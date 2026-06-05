"""FastAPI backend for TradeDesk — the production transport over the agent.

Responsibilities:
  - bootstrap the database (create tables if absent, seed the demo account),
  - authenticate users and scope all data to them,
  - run the provider-agnostic agent per turn and **persist** the conversation,
  - expose the user's operational data (read + write) for the dashboard.

The agent loop, tools, and integration boundary are unchanged — this module is
auth + persistence + transport around them.

Run it:
    uvicorn tradedesk.api:app --reload
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import date

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import config, models, schemas, security
from .agent import CHAT_SYSTEM_PROMPT, SYSTEM_PROMPT, TradeDeskAgent
from .auth import current_user
from .auth import router as auth_router
from .db import SessionLocal, get_session, init_db
from .ops_api import router as ops_router
from .ops_client import OpsClient
from .providers import ProviderConfigError, get_provider, provider_availability
from .seed import ensure_demo_user

log = logging.getLogger("tradedesk")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    if config.IS_INSECURE_SECRET:
        log.warning(
            "TRADEDESK_SECRET_KEY is unset — using a dev-only key. Set it in production."
        )
    with SessionLocal() as db:
        ensure_demo_user(db, today=date.today())
    yield


app = FastAPI(
    title="TradeDesk Agent API",
    description="Production multi-user LLM agent for a trade/field-service business.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(ops_router)


# --- helpers -------------------------------------------------------------
def _user_keys(user: models.User) -> dict[str, str]:
    """Decrypt the user's stored provider keys into {provider: plaintext}."""
    out: dict[str, str] = {}
    for provider, ciphertext in (user.encrypted_keys or {}).items():
        plain = security.decrypt_key(ciphertext)
        if plain:
            out[provider] = plain
    return out


def _reconstruct_history(provider, msgs: list[models.ChatMessage]) -> list:
    """Rebuild a provider-native history as plain user/assistant text turns.

    We persist a transcript (not provider-native tool blocks), so continuing a
    conversation replays prior turns as plain messages — valid for every
    provider — giving conversational continuity without cross-format coupling.
    """
    history: list = []
    for m in msgs:
        if m.role == "user":
            history.append(provider.user_message(m.content))
        else:
            history.append({"role": "assistant", "content": m.content or ""})
    return history


# --- providers -----------------------------------------------------------
@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/providers", response_model=list[schemas.ProviderInfo])
def providers(user: models.User = Depends(current_user)) -> list[schemas.ProviderInfo]:
    return [schemas.ProviderInfo(**p) for p in provider_availability(_user_keys(user))]


# --- conversations -------------------------------------------------------
@app.get("/conversations", response_model=list[schemas.ConversationOut])
def list_conversations(
    user: models.User = Depends(current_user), db: Session = Depends(get_session)
) -> list[schemas.ConversationOut]:
    rows = db.scalars(
        select(models.Conversation)
        .where(models.Conversation.user_id == user.id)
        .order_by(models.Conversation.updated_at.desc())
    ).all()
    out = []
    for c in rows:
        count = db.scalar(
            select(func.count()).select_from(models.ChatMessage)
            .where(models.ChatMessage.conversation_id == c.id)
        ) or 0
        out.append(_conversation_out(c, count))
    return out


@app.get("/conversations/{conv_id}", response_model=schemas.ConversationDetail)
def get_conversation(
    conv_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_session)
) -> schemas.ConversationDetail:
    conv = _owned_conversation(db, user.id, conv_id)
    messages = [
        schemas.ChatMessageOut(id=m.id, role=m.role, content=m.content, tool_calls=m.tool_calls or [])
        for m in conv.messages
    ]
    base = _conversation_out(conv, len(messages))
    return schemas.ConversationDetail(**base.model_dump(), messages=messages)


@app.delete("/conversations/{conv_id}")
def delete_conversation(
    conv_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_session)
) -> dict:
    conv = _owned_conversation(db, user.id, conv_id)
    db.delete(conv)
    db.commit()
    return {"deleted": conv_id}


def _owned_conversation(db: Session, user_id: int, conv_id: int) -> models.Conversation:
    conv = db.get(models.Conversation, conv_id)
    if conv is None or conv.user_id != user_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


def _conversation_out(c: models.Conversation, count: int) -> schemas.ConversationOut:
    return schemas.ConversationOut(
        id=c.id, title=c.title, provider=c.provider, model=c.model, mode=c.mode,
        updated_at=c.updated_at.isoformat(), message_count=count,
    )


# --- chat ----------------------------------------------------------------
@app.post("/chat", response_model=schemas.ChatResponse)
def chat(
    req: schemas.ChatRequest,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_session),
) -> schemas.ChatResponse:
    if not req.message.strip():
        raise HTTPException(status_code=422, detail="message must not be empty")

    try:
        provider = get_provider(req.provider, model=req.model, user_keys=_user_keys(user))
    except ProviderConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Resolve / create the conversation.
    if req.conversation_id is not None:
        conv = _owned_conversation(db, user.id, req.conversation_id)
    else:
        conv = models.Conversation(
            user_id=user.id, title=req.message.strip()[:60] or "New conversation",
            provider=provider.name, model=provider.model, mode=req.mode,
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    # Build the agent, replay prior turns, run one turn.
    system = SYSTEM_PROMPT if req.mode == "agent" else CHAT_SYSTEM_PROMPT
    ops = OpsClient(db, user_id=user.id, today=date.today())
    agent = TradeDeskAgent(ops, provider, system_prompt=system)
    agent.history = _reconstruct_history(provider, list(conv.messages))

    calls: list[schemas.ToolCallInfo] = []

    def on_tool_call(name: str, tool_input: dict, output: str) -> None:
        import json
        try:
            parsed = json.loads(output)
        except (json.JSONDecodeError, TypeError):
            parsed = output
        calls.append(schemas.ToolCallInfo(name=name, input=tool_input, output=parsed))

    try:
        reply = agent.send(req.message, on_tool_call=on_tool_call, use_tools=(req.mode == "agent"))
    except ProviderConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # provider/network/runtime errors
        raise HTTPException(status_code=502, detail=f"Agent error: {exc}")

    # Persist the turn.
    db.add(models.ChatMessage(conversation_id=conv.id, role="user", content=req.message, tool_calls=[]))
    db.add(models.ChatMessage(
        conversation_id=conv.id, role="assistant", content=reply,
        tool_calls=[c.model_dump() for c in calls],
    ))
    conv.provider, conv.model, conv.mode = provider.name, provider.model, req.mode
    db.add(conv)
    db.commit()

    return schemas.ChatResponse(
        conversation_id=conv.id, reply=reply, provider=provider.name,
        model=provider.model, mode=req.mode, tool_calls=calls,
    )


# --- AI summarize --------------------------------------------------------
SUMMARY_SYSTEM_PROMPT = (
    "You are TradeDesk's business analyst for a small trade/field-service company. "
    "Summarise the supplied operational data for a busy owner in clear, plain English. "
    "Be specific and ground every figure ONLY in the data given — never invent numbers. "
    "Money is AUD and figures are ex-GST unless stated (GST is 10%). "
    "Structure the answer with a one-line headline, a few key points, and one or two "
    "concrete suggested actions. Keep it tight and useful. Remember nothing is ever "
    "auto-sent — quotes and messages are drafts a human approves."
)


@app.post("/summarize", response_model=schemas.SummarizeResponse)
def summarize(
    req: schemas.SummarizeRequest,
    user: models.User = Depends(current_user),
) -> schemas.SummarizeResponse:
    """One-shot, non-persisted AI summary of arbitrary dashboard/data context.

    Uses the caller's selected provider + model (resolving their stored key
    first). Runs a single completion with no tools, so it never mutates data.
    """
    import json

    try:
        provider = get_provider(req.provider, model=req.model, user_keys=_user_keys(user))
    except ProviderConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    ctx = req.context if isinstance(req.context, str) else json.dumps(req.context, indent=2, default=str)
    # Keep the JSON block last so lightweight providers can parse it cleanly.
    prompt = (
        f"Summarise this in depth but concisely.\n\nTopic: {req.title}\n\nData (JSON):\n{ctx}"
    )

    try:
        resp = provider.complete(SUMMARY_SYSTEM_PROMPT, [provider.user_message(prompt)], [])
    except ProviderConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # provider/network/runtime errors
        raise HTTPException(status_code=502, detail=f"Summary error: {exc}")

    return schemas.SummarizeResponse(
        summary=resp.text or "(no summary produced)",
        provider=provider.name,
        model=provider.model,
    )

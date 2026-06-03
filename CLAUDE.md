# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

TradeDesk is a **production, multi-user, database-backed AI agent** for a small
trade/field-service business. It answers questions about jobs/invoices and drafts
quotes and customer messages against the user's own operational data. The core is
a provider-agnostic, hand-written tool-use loop (not an SDK auto-runner) that runs
unchanged on Claude, GPT, Gemini, local Ollama, or a built-in keyless `mock`
provider.

It ships as a full stack: a **FastAPI** backend (`tradedesk/`) with auth,
persistence, and the agent; and a **React + Vite + TypeScript + Tailwind** SPA
(`frontend/`) that talks to it over `/api`. There is **no CLI and no Streamlit**
anymore — those were removed.

## Commands

```bash
# Backend
pip install -r requirements.txt
uvicorn tradedesk.api:app --reload     # :8000  (/docs for Swagger)
pytest                                 # backend tests (temp SQLite + mock provider)

# Frontend
cd frontend
npm install
npm run dev                            # :5173 (proxies /api -> :8000)
npm test                               # Vitest + React Testing Library
npm run build                          # tsc -b + vite build

# Full stack
docker compose up --build              # UI :8080, backend behind nginx /api
```

No API keys are required to run or test anything — the keyless `mock` provider is
always available and is what the test suites use.

Demo login: `demo` / `demo1234` (pre-seeded on first startup).

## Architecture

The core idea is unchanged from the original: **one agent loop, many models, one
swappable integration boundary.** What's new is everything *around* the loop:
auth, per-user persistence, and a real web frontend.

- **`tradedesk/agent.py`** — `TradeDeskAgent.send()` is the loop: append user turn
  → `provider.complete(system, history, tools)` → if no tool calls, return text;
  otherwise execute each call via `execute_tool`, append results, repeat (capped at
  `MAX_TOOL_ITERATIONS`). `use_tools=False` runs *chat mode* (no tools, general
  conversation, `CHAT_SYSTEM_PROMPT`). `on_tool_call(name, input, output)` is the
  hook the API uses to capture tool calls. The loop is intentionally manual so
  every external action can be traced/logged/gated.

- **`tradedesk/providers/`** — the `LLMProvider` interface (`base.py`) makes the
  loop model-agnostic. `anthropic_provider.py` uses the native Messages API with
  `cache_control`. `openai_provider.py` serves OpenAI, Gemini, and Ollama (all
  OpenAI-compatible; different base_url/key). `mock_provider.py` is a keyless,
  offline, deterministic stand-in that still makes real tool calls through the
  loop. `__init__.py` `get_provider(name, model, user_keys)` resolves a key from
  the user's stored keys first, then server env; `provider_availability()` powers
  the UI's picker; `mock` is always available.

- **`tradedesk/ops_client.py`** — **the integration boundary**, now SQLAlchemy-
  backed and **user-scoped**: every read/write filters by `user_id`. Same method
  names and return shapes as the original JSON mock, so tools/agent didn't change
  when storage moved to a DB. Human/agent-facing ids (`JOB-5012`, `CUST-1001`) live
  in a per-user `ref` column. Quote math (labour `$95/hr` ex-GST, 10% GST) lives
  here. To go live, replace this class with one calling a real field-service API.

- **`tradedesk/tools.py`** — `TOOL_SCHEMAS` is the single provider-neutral source
  of truth; `execute_tool()` dispatches a tool name to an `OpsClient` method and
  returns a JSON string (errors caught and returned as `{"error": ...}`).

- **`tradedesk/models.py` / `db.py`** — ORM models (users, customers, jobs,
  invoices, quotes, messages, conversations, chat_messages) and the engine/session.
  `init_db()` creates tables if absent (never drops). SQLite by default; set
  `TRADEDESK_DATABASE_URL` to Postgres for production — nothing else changes.

- **`tradedesk/seed.py`** — the rich sample dataset, generated with dates
  *relative to a reference `today`* so "overdue by N days" is always realistic.
  Backs both the pre-seeded `demo` account (created in the app's lifespan) and the
  per-account "Load sample data" button. New accounts start empty.

- **`tradedesk/auth.py` / `security.py`** — username/password (bcrypt) → JWT;
  `current_user` dependency resolves the bearer token. Per-user provider keys are
  encrypted with Fernet (`security.encrypt_key`) and stored on the user row.

- **`tradedesk/api.py`** — app wiring + lifespan (init DB, seed demo). `POST /chat`
  builds a provider (with the user's keys), resolves/creates the conversation,
  **replays persisted history as plain turns**, runs one agent turn, and persists
  the user + assistant messages (assistant carries the captured tool calls).
  Conversations are listable/deletable and fully owner-checked. Provider/config
  errors → 400; agent/provider runtime errors → 502.

- **`tradedesk/ops_api.py`** — read endpoints for the dashboard plus write
  endpoints so users insert their own customers/jobs/invoices/quotes, and
  `POST /ops/load-sample-data`. All go through a user-scoped `OpsClient`.

- **`frontend/`** — React + Vite + TS + Tailwind SPA, n8n-style, dark/light. No LLM
  work itself; it calls the API. `src/api` (axios client with JWT interceptor +
  typed endpoints), `src/context` (Auth + Theme), `src/components` (Workspace shell:
  Sidebar + TopBar + ChatView + DataView + SettingsView), `src/pages/Login`. Token
  in localStorage; a 401 interceptor resets auth. Provider/model picked in the top
  bar; Agent/Chat toggle in the composer.

### Adding capabilities

- **New tool:** add a schema to `TOOL_SCHEMAS`, a branch in `execute_tool`, and a
  method on `OpsClient`. No provider/API/UI change needed for it to flow into chat.
- **New dashboard data:** add an `OpsClient` read method, an `@router.get("/ops/…")`
  route in `ops_api.py`, and a tab/table in `frontend/src/components/DataView.tsx`.
- **New provider:** if OpenAI-compatible, just add a branch in `get_provider`
  pointing `OpenAIProvider` at the right base_url/key (as Gemini/Ollama do).
  Otherwise implement the three `LLMProvider` methods. Register it in `_ALIASES`,
  `DEFAULT_MODELS`, `PROVIDERS`, `_KEY_HELP`.
- **New DB field/table:** add to `models.py` (created on next startup). For
  destructive schema changes in production, introduce Alembic migrations.

## Conventions that matter

- **Nothing is ever "sent."** Quotes and messages are saved as drafts for a human
  to approve. The system prompt and tool descriptions enforce this; preserve it.
- **Ground answers in tool results** — the agent must look up jobs/invoices/figures
  in *agent mode*, never invent them. In *chat mode* (no tools) it must say it
  can't see live data rather than guessing.
- **Everything is user-scoped.** Never query a business table without filtering by
  `user_id`; always go through `OpsClient`, which does this for you.
- Money is AUD, ex-GST unless stated; GST (10%) is computed in `OpsClient`.
- **No keys required to run/test.** Keep the `mock` provider working and keyless.
- Seed dates are generated relative to `date.today()` so overdue invoices stay
  realistic; don't hard-code absolute dates in `seed.py`.
- There is no linter configured. Backend tests: `pytest`. Frontend: `npm test`
  (Vitest) and `npm run build` (typecheck via `tsc -b`).

"""Pydantic request/response models for the API."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# --- auth -----------------------------------------------------------------
class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)
    email: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    provider_keys: list[str] = Field(default_factory=list, description="Providers with a user key set.")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class SetProviderKeyRequest(BaseModel):
    provider: str
    api_key: str = Field(..., description="Send an empty string to clear the stored key.")


# --- chat -----------------------------------------------------------------
class ChatRequest(BaseModel):
    message: str = Field(..., description="The user's request in plain English.")
    conversation_id: Optional[int] = Field(None, description="Omit to start a new conversation.")
    provider: str = Field("mock", description="mock | anthropic | openai | gemini | ollama")
    model: Optional[str] = None
    mode: Literal["agent", "chat"] = Field(
        "agent", description="agent = tools enabled; chat = plain conversation, no tools."
    )


class ToolCallInfo(BaseModel):
    name: str
    input: dict
    output: Optional[Any] = None


class ChatResponse(BaseModel):
    conversation_id: int
    reply: str
    provider: str
    model: str
    mode: str
    tool_calls: list[ToolCallInfo] = Field(default_factory=list)


class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    tool_calls: list[dict] = Field(default_factory=list)


class ConversationOut(BaseModel):
    id: int
    title: str
    provider: str
    model: str
    mode: str
    updated_at: str
    message_count: int = 0


class ConversationDetail(ConversationOut):
    messages: list[ChatMessageOut] = Field(default_factory=list)


class ProviderInfo(BaseModel):
    id: str
    default_model: str
    available: bool
    source: str = ""  # "server" | "user" | ""
    detail: str = ""


# --- ops write payloads ---------------------------------------------------
class CustomerCreate(BaseModel):
    name: str
    contact: str = ""
    email: str = ""
    phone: str = ""
    site_address: str = ""


class JobCreate(BaseModel):
    customer_ref: str
    title: str
    status: Literal["quote_requested", "scheduled", "in_progress", "completed"] = "quote_requested"
    priority: Literal["low", "medium", "high"] = "medium"
    scheduled_date: Optional[str] = None
    assigned_tech: Optional[str] = None
    description: str = ""
    notes: str = ""


class InvoiceCreate(BaseModel):
    customer_ref: str
    job_ref: Optional[str] = None
    amount: float
    issued_date: Optional[str] = None
    due_date: Optional[str] = None
    status: Literal["unpaid", "paid"] = "unpaid"


class LineItem(BaseModel):
    description: str
    qty: float
    unit_price: float


class QuoteCreate(BaseModel):
    job_ref: str
    line_items: list[LineItem]
    labour_hours: float
    notes: str = ""


# --- ops update payloads --------------------------------------------------
# All fields optional: only the keys actually sent are applied (PATCH-style),
# so the UI can update a subset without wiping the rest.
class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    contact: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    site_address: Optional[str] = None


class JobUpdate(BaseModel):
    customer_ref: Optional[str] = None
    title: Optional[str] = None
    status: Optional[Literal["quote_requested", "scheduled", "in_progress", "completed"]] = None
    priority: Optional[Literal["low", "medium", "high"]] = None
    scheduled_date: Optional[str] = None
    assigned_tech: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None


class InvoiceUpdate(BaseModel):
    customer_ref: Optional[str] = None
    job_ref: Optional[str] = None
    amount: Optional[float] = None
    issued_date: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[Literal["unpaid", "paid"]] = None


class QuoteUpdate(BaseModel):
    line_items: Optional[list[LineItem]] = None
    labour_hours: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[Literal["draft", "approved", "rejected"]] = None


class MessageUpdate(BaseModel):
    reference_id: Optional[str] = None
    purpose: Optional[str] = None
    body: Optional[str] = None
    status: Optional[str] = None


# --- AI summarize ---------------------------------------------------------
class SummarizeRequest(BaseModel):
    title: str = Field(..., description="Human label for what is being summarised.")
    context: Any = Field(..., description="JSON-serialisable data (dict/list/str) to summarise.")
    provider: str = Field("mock", description="mock | anthropic | openai | gemini | ollama")
    model: Optional[str] = None


class SummarizeResponse(BaseModel):
    summary: str
    provider: str
    model: str


# --- persisted summaries --------------------------------------------------
class SummaryCreate(BaseModel):
    title: str
    subject_type: str = Field("metric", description="invoice | quote | job | customer | metric")
    subject_ref: str = ""
    context: Any
    provider: str = "mock"
    model: Optional[str] = None


class SummaryRegenerate(BaseModel):
    """Re-run an existing summary; provider/model optional (falls back to stored)."""

    provider: Optional[str] = None
    model: Optional[str] = None


class SummaryOut(BaseModel):
    id: int
    title: str
    subject_type: str
    subject_ref: str
    context: Any = None
    summary: str
    provider: str
    model: str
    created_at: str
    updated_at: str

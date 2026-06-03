"""The TradeDesk agent: a provider-agnostic tool-use loop.

The loop lives here and is identical for every backend (Claude / GPT / Gemini /
local Ollama);
each LLMProvider handles its own wire format. The loop is manual (rather than an
SDK auto-runner) so every external action can be traced, logged, gated, or sent
for human review before it fires — what you'd want the moment this touches a
real business.
"""

from __future__ import annotations

from typing import Callable, Optional

from .ops_client import OpsClient
from .providers.base import LLMProvider, ToolResult
from .tools import TOOL_SCHEMAS, execute_tool

MAX_TOOL_ITERATIONS = 8

SYSTEM_PROMPT = """\
You are TradeDesk, the AI job-desk assistant for an established small trade business
(around 80 staff). You sit on top of the company's job-management system (jobs,
customers, invoices, quotes) and help office staff and team leaders move faster
through everyday admin.

What you help with:
- Answering questions about jobs, schedules and invoices using the tools provided.
- Drafting quotes against jobs once you've checked the real job detail.
- Drafting customer messages - payment reminders, scheduling notes, quote follow-ups.

How to work:
- Always ground answers in tool results. Never guess a job, invoice, figure, or
  customer detail - look it up. If a tool returns nothing, say so plainly.
- Chain tools when needed: e.g. to chase overdue payments, list overdue invoices,
  then draft a reminder for each. To quote a job, get the job detail first.
- Everything you create (quotes, messages) is saved as a DRAFT for a human to
  review and send. Make that clear; never imply something was sent or paid.
- Money is in AUD and ex-GST unless stated; the system adds 10% GST to quotes.
- Be concise and practical - these are busy tradies and office staff, not a
  technical audience. Lead with the answer, then the detail.

Safety: you draft and inform; a person always approves before anything leaves the
business. Don't threaten customers, invent prices, or take irreversible actions.
"""

# Used in "chat" mode (tools disabled): a general assistant that can still talk
# about the business but doesn't pretend to look things up it can't see.
CHAT_SYSTEM_PROMPT = """\
You are TradeDesk, a helpful assistant for a small trade business. In this mode
you are a general conversational assistant: answer questions, help draft text,
explain things, and chat about whatever the user wants. You do not have live
access to the job-management system in this mode, so if the user asks for
specific jobs, invoices, or figures, say you'd need to switch to Agent mode to
look those up rather than inventing them. Be concise, friendly and practical.
"""


class TradeDeskAgent:
    def __init__(
        self,
        backend: OpsClient,
        provider: LLMProvider,
        system_prompt: str = SYSTEM_PROMPT,
    ):
        self.backend = backend
        self.provider = provider
        self.system = system_prompt
        self.history: list = []

    def send(
        self,
        user_message: str,
        on_tool_call: Optional[Callable[[str, dict, str], None]] = None,
        use_tools: bool = True,
    ) -> str:
        """Send one user turn; run the tool loop to completion; return final text.

        ``use_tools=False`` runs a plain conversation (no tools offered), used by
        the UI's "chat" mode. ``on_tool_call`` is invoked with
        ``(name, input, output)`` for each tool the agent runs.
        """
        tools = TOOL_SCHEMAS if use_tools else []
        self.history.append(self.provider.user_message(user_message))

        for _ in range(MAX_TOOL_ITERATIONS):
            response = self.provider.complete(self.system, self.history, tools)
            self.history.append(response.assistant_message)

            if not response.tool_calls:
                return response.text

            results = []
            for call in response.tool_calls:
                output = execute_tool(self.backend, call.name, call.input)
                if on_tool_call:
                    on_tool_call(call.name, call.input, output)
                results.append(ToolResult(call, output))

            self.history.extend(self.provider.tool_result_messages(results))

        return "(Stopped after hitting the tool-call limit. Try narrowing the request.)"

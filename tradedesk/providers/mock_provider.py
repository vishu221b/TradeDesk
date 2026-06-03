"""A keyless, offline provider.

Lets the whole stack run, be tested, and be deployed with **zero API keys**. It
is not an LLM — it's a small deterministic stand-in that understands a handful of
intents and will make a real tool call through the same agent loop the cloud
providers use, so the end-to-end path (tool selection → execution → grounded
reply) is exercised without a network or a key. Pick a real provider in the UI
for genuine reasoning.
"""

from __future__ import annotations

import json
import uuid

from .base import LLMProvider, LLMResponse, ToolCall, ToolResult


class MockProvider(LLMProvider):
    name = "mock"

    def __init__(self, model: str = "mock-1"):
        self.model = model

    def user_message(self, text: str) -> dict:
        return {"role": "user", "content": text}

    def tool_result_messages(self, results: list[ToolResult]) -> list:
        return [
            {"role": "tool", "tool_call_id": r.call.id, "content": r.output}
            for r in results
        ]

    def complete(self, system: str, history: list, tools: list[dict]) -> LLMResponse:
        last = history[-1] if history else {}
        role = last.get("role")

        # Second pass: we already ran a tool — summarise its output and finish.
        if role == "tool":
            return self._summarise(last.get("content", ""))

        text = (last.get("content") or "") if isinstance(last.get("content"), str) else ""
        lowered = text.lower()
        tool_names = {t["name"] for t in tools}

        # First pass: pick a tool when one is enabled and the intent matches.
        if tools:
            call = self._route(lowered, tool_names)
            if call is not None:
                assistant = {"role": "assistant", "content": "",
                             "tool_calls": [{"id": call.id, "name": call.name, "input": call.input}]}
                return LLMResponse("", [call], assistant)

        reply = self._chitchat(text, bool(tools))
        return LLMResponse(reply, [], {"role": "assistant", "content": reply})

    # --- intent routing --------------------------------------------------
    @staticmethod
    def _route(text: str, tool_names: set[str]) -> ToolCall | None:
        def mk(name: str, inp: dict) -> ToolCall:
            return ToolCall(id=f"mock_{uuid.uuid4().hex[:8]}", name=name, input=inp)

        # explicit JOB-#### reference
        import re
        m = re.search(r"\bjob[-\s]?(\d{3,5})\b", text)
        if m and "get_job" in tool_names:
            return mk("get_job", {"job_id": f"JOB-{m.group(1)}"})

        if ("overdue" in text or "outstanding" in text or "chase" in text or "owe" in text) \
                and "list_invoices" in tool_names:
            return mk("list_invoices", {"only_overdue": True})
        if "invoice" in text and "list_invoices" in tool_names:
            return mk("list_invoices", {"only_overdue": False})
        if ("job" in text or "scheduled" in text or "what's on" in text or "whats on" in text
                or "work" in text) and "search_jobs" in tool_names:
            inp: dict = {}
            if "scheduled" in text:
                inp["status"] = "scheduled"
            return mk("search_jobs", inp)
        return None

    @staticmethod
    def _summarise(tool_output: str) -> LLMResponse:
        try:
            data = json.loads(tool_output)
        except json.JSONDecodeError:
            data = tool_output

        if isinstance(data, dict) and "error" in data:
            text = f"I hit a problem looking that up: {data['error']}"
        elif isinstance(data, list):
            n = len(data)
            if n == 0:
                text = "I looked, and there's nothing matching right now."
            else:
                preview = ", ".join(
                    str(item.get("id") or item.get("title") or item.get("ref") or "")
                    for item in data[:5] if isinstance(item, dict)
                )
                text = (f"I found {n} matching record(s) in the system"
                        + (f": {preview}." if preview.strip(", ") else "."))
        elif isinstance(data, dict):
            ident = data.get("id") or data.get("ref") or "the record"
            text = f"Here's the detail for {ident}. (Demo mode — connect a real model for a full write-up.)"
        else:
            text = str(data)

        text += ("\n\n_(Demo provider: deterministic, no LLM. Choose Anthropic / OpenAI / "
                 "Gemini / Ollama in the header for real answers.)_")
        return LLMResponse(text, [], {"role": "assistant", "content": text})

    @staticmethod
    def _chitchat(text: str, tools_enabled: bool) -> str:
        base = ("Hi! I'm the TradeDesk demo provider — a keyless stand-in so you can try the "
                "app without an API key. ")
        if tools_enabled:
            base += ("Ask me about jobs, scheduled work, or overdue invoices and I'll call the "
                     "real tools against your data. ")
        base += ("For genuine reasoning (drafting quotes, writing messages), pick Anthropic, "
                 "OpenAI, Gemini, or Ollama in the header.")
        return base

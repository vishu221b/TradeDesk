"""OpenAI-compatible provider — Chat Completions with function calling.

One class covers OpenAI, Google Gemini, and local Ollama: Gemini and Ollama both
expose an OpenAI-compatible endpoint, so it's the same wire format with a
different base URL, model, and key. Any other OpenAI-compatible gateway works too.
"""

from __future__ import annotations

import json

from openai import OpenAI

from .base import LLMProvider, LLMResponse, ProviderConfigError, ToolCall, ToolResult


class OpenAIProvider(LLMProvider):
    def __init__(self, model: str, api_key: str, base_url: str | None = None, name: str = "openai"):
        if not api_key:
            raise ProviderConfigError(f"{name}: API key is required")
        self.model = model
        self.name = name
        self.client = OpenAI(api_key=api_key, base_url=base_url) if base_url else OpenAI(api_key=api_key)

    def user_message(self, text: str) -> dict:
        return {"role": "user", "content": text}

    @staticmethod
    def _tools(tools: list[dict]) -> list[dict]:
        return [
            {"type": "function", "function": {
                "name": t["name"], "description": t["description"], "parameters": t["parameters"],
            }}
            for t in tools
        ]

    def complete(self, system: str, history: list, tools: list[dict]) -> LLMResponse:
        messages = [{"role": "system", "content": system}] + history
        kwargs: dict = {"model": self.model, "messages": messages}
        # Only send `tools` when non-empty: OpenAI/Gemini reject an empty array,
        # which would break no-tools calls (chat mode, /summarize).
        if tools:
            kwargs["tools"] = self._tools(tools)
        resp = self.client.chat.completions.create(**kwargs)
        msg = resp.choices[0].message

        calls: list[ToolCall] = []
        for tc in (msg.tool_calls or []):
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            calls.append(ToolCall(id=tc.id, name=tc.function.name, input=args))

        assistant_message: dict = {"role": "assistant", "content": msg.content}
        if msg.tool_calls:
            assistant_message["tool_calls"] = [
                {"id": tc.id, "type": "function",
                 "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in msg.tool_calls
            ]
        return LLMResponse(msg.content or "", calls, assistant_message)

    def tool_result_messages(self, results: list[ToolResult]) -> list:
        return [
            {"role": "tool", "tool_call_id": r.call.id, "content": r.output}
            for r in results
        ]

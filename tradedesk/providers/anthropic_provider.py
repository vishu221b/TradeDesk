"""Anthropic (Claude) provider — native Messages API with tool use + prompt caching."""

from __future__ import annotations

import anthropic

from .base import LLMProvider, LLMResponse, ProviderConfigError, ToolCall, ToolResult


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self, model: str, api_key: str | None = None, max_tokens: int = 4000):
        self.model = model
        self.max_tokens = max_tokens
        try:
            self.client = anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()
        except Exception as exc:  # pragma: no cover - config-time failure
            raise ProviderConfigError(str(exc)) from exc

    def user_message(self, text: str) -> dict:
        return {"role": "user", "content": text}

    @staticmethod
    def _tools(tools: list[dict]) -> list[dict]:
        return [
            {"name": t["name"], "description": t["description"], "input_schema": t["parameters"]}
            for t in tools
        ]

    def complete(self, system: str, history: list, tools: list[dict]) -> LLMResponse:
        kwargs: dict = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            # cache_control on the system block caches tools + system together
            # (render order is tools -> system -> messages): paid once, read cheaply.
            "system": [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            "messages": history,
        }
        # Omit `tools` entirely when empty (no-tools calls: chat mode, /summarize).
        if tools:
            kwargs["tools"] = self._tools(tools)
        resp = self.client.messages.create(**kwargs)
        text = "".join(b.text for b in resp.content if b.type == "text").strip()
        calls = [
            ToolCall(id=b.id, name=b.name, input=dict(b.input))
            for b in resp.content
            if b.type == "tool_use"
        ]
        return LLMResponse(text, calls, {"role": "assistant", "content": resp.content})

    def tool_result_messages(self, results: list[ToolResult]) -> list:
        return [{
            "role": "user",
            "content": [
                {"type": "tool_result", "tool_use_id": r.call.id, "content": r.output}
                for r in results
            ],
        }]

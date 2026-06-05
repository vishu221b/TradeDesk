"""Providers must omit an empty `tools` arg (chat mode + /summarize).

OpenAI/Gemini reject an empty `tools` array, which previously turned every
no-tools completion into a 502. These unit tests stub the SDK client so no key
or network is needed.
"""

from __future__ import annotations

from unittest.mock import MagicMock

from tradedesk.providers.anthropic_provider import AnthropicProvider
from tradedesk.providers.openai_provider import OpenAIProvider

_TOOL = {"name": "t", "description": "d", "parameters": {"type": "object", "properties": {}}}


def test_openai_omits_tools_when_empty():
    p = OpenAIProvider(model="gpt-x", api_key="sk-test")
    fake = MagicMock()
    msg = MagicMock()
    msg.tool_calls = None
    msg.content = "hello"
    fake.chat.completions.create.return_value = MagicMock(choices=[MagicMock(message=msg)])
    p.client = fake

    p.complete("sys", [{"role": "user", "content": "x"}], [])
    assert "tools" not in fake.chat.completions.create.call_args.kwargs

    p.complete("sys", [{"role": "user", "content": "x"}], [_TOOL])
    assert "tools" in fake.chat.completions.create.call_args.kwargs


def test_anthropic_omits_tools_when_empty():
    p = AnthropicProvider(model="claude-x", api_key="sk-test")
    fake = MagicMock()
    block = MagicMock()
    block.type = "text"
    block.text = "hello"
    fake.messages.create.return_value = MagicMock(content=[block])
    p.client = fake

    p.complete("sys", [{"role": "user", "content": "x"}], [])
    assert "tools" not in fake.messages.create.call_args.kwargs

    p.complete("sys", [{"role": "user", "content": "x"}], [_TOOL])
    assert "tools" in fake.messages.create.call_args.kwargs

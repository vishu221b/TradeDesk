"""Provider-neutral types and the LLM provider interface.

The agent loop talks to an LLMProvider; each concrete provider translates the
neutral tool schema + conversation into its own wire format and back. This is
what lets the same agent run on Claude, GPT, Gemini, or local Ollama unchanged.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class ToolCall:
    """A tool the model asked to run."""
    id: str
    name: str
    input: dict


@dataclass
class ToolResult:
    """The output of running a ToolCall."""
    call: ToolCall
    output: str


@dataclass
class LLMResponse:
    text: str
    tool_calls: list[ToolCall]
    assistant_message: Any  # provider-native message, appended back to history


class ProviderConfigError(RuntimeError):
    """Raised when a provider can't be configured (e.g. missing API key)."""


class LLMProvider(ABC):
    name: str
    model: str

    @abstractmethod
    def user_message(self, text: str) -> Any:
        """Return a provider-native user-turn message."""

    @abstractmethod
    def complete(self, system: str, history: list, tools: list[dict]) -> LLMResponse:
        """One model round-trip. `tools` are neutral {name, description, parameters} dicts."""

    @abstractmethod
    def tool_result_messages(self, results: list[ToolResult]) -> list:
        """Return provider-native message(s) carrying the tool results."""

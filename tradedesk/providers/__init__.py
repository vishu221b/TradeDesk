"""Provider factory: pick a backend LLM by name, resolve its key, build it.

Keys come from one of two places, in priority order: a key the logged-in user
stored in their account settings (decrypted and passed in as ``user_keys``), then
the server-side environment key. The built-in ``mock`` provider needs neither —
it is always available so the app runs with zero configuration.
"""

from __future__ import annotations

import os

from .. import config
from .anthropic_provider import AnthropicProvider
from .base import LLMProvider, LLMResponse, ProviderConfigError, ToolCall, ToolResult
from .mock_provider import MockProvider
from .openai_provider import OpenAIProvider

__all__ = [
    "LLMProvider", "LLMResponse", "ToolCall", "ToolResult", "ProviderConfigError",
    "get_provider", "canonical_provider", "provider_availability",
    "DEFAULT_MODELS", "PROVIDERS",
]

GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434/v1"

PROVIDERS = ["mock", "anthropic", "openai", "gemini", "ollama"]

DEFAULT_MODELS = {
    "mock": "mock-1",
    "anthropic": "claude-opus-4-8",
    "openai": "gpt-4o",
    "gemini": "gemini-2.0-flash",
    "ollama": "llama3.1",
}

_ALIASES = {
    "mock": "mock", "demo": "mock", "offline": "mock",
    "anthropic": "anthropic", "claude": "anthropic",
    "openai": "openai", "chatgpt": "openai", "gpt": "openai",
    "gemini": "gemini", "google": "gemini",
    "ollama": "ollama", "local": "ollama",
}

_KEY_HELP = {
    "anthropic": ("ANTHROPIC_API_KEY", "https://console.anthropic.com/"),
    "openai": ("OPENAI_API_KEY", "https://platform.openai.com/api-keys"),
    "gemini": ("GEMINI_API_KEY (or GOOGLE_API_KEY)", "https://aistudio.google.com/apikey"),
    "ollama": ("OLLAMA_API_KEY", "run `ollama serve`; key usually not required"),
}


def canonical_provider(name: str) -> str | None:
    return _ALIASES.get((name or "").lower())


def _resolve_key(canon: str, user_keys: dict[str, str] | None) -> str | None:
    if user_keys and user_keys.get(canon):
        return user_keys[canon]
    return config.SERVER_PROVIDER_KEYS.get(canon)


def get_provider(
    name: str, model: str | None = None, user_keys: dict[str, str] | None = None
) -> LLMProvider:
    canon = canonical_provider(name)
    if not canon:
        raise ProviderConfigError(
            f"Unknown provider '{name}'. Choose one of: {' | '.join(PROVIDERS)}."
        )
    model = model or DEFAULT_MODELS[canon]

    if canon == "mock":
        return MockProvider(model=model)

    if canon == "anthropic":
        key = _resolve_key(canon, user_keys)
        if not key:
            _raise_missing(canon)
        return AnthropicProvider(model=model, api_key=key)

    if canon == "openai":
        key = _resolve_key(canon, user_keys)
        if not key:
            _raise_missing(canon)
        return OpenAIProvider(model=model, api_key=key, name="openai")

    if canon == "gemini":
        key = _resolve_key(canon, user_keys)
        if not key:
            _raise_missing(canon)
        return OpenAIProvider(model=model, api_key=key, base_url=GEMINI_OPENAI_BASE_URL, name="gemini")

    # ollama: local OpenAI-compatible endpoint; key usually not needed.
    base_url = os.environ.get("OLLAMA_BASE_URL", OLLAMA_DEFAULT_BASE_URL)
    key = _resolve_key(canon, user_keys) or "ollama"
    return OpenAIProvider(model=model, api_key=key, base_url=base_url, name="ollama")


def provider_availability(user_keys: dict[str, str] | None = None) -> list[dict]:
    """For the UI: which providers can be used right now, and from where."""
    out = []
    for pid in PROVIDERS:
        source, detail, available = "", "", True
        if pid == "mock":
            source = "builtin"
        elif pid == "ollama":
            source = "user" if (user_keys and user_keys.get("ollama")) else "local"
        else:
            if user_keys and user_keys.get(pid):
                source = "user"
            elif config.SERVER_PROVIDER_KEYS.get(pid):
                source = "server"
            else:
                available = False
                env_name, url = _KEY_HELP[pid]
                detail = f"Set {env_name} on the server or add your own key in Settings ({url})."
        out.append({
            "id": pid, "default_model": DEFAULT_MODELS[pid],
            "available": available, "source": source, "detail": detail,
        })
    return out


def _raise_missing(canon: str):
    env_name, url = _KEY_HELP[canon]
    raise ProviderConfigError(
        f"No key for {canon}. Set {env_name} on the server or add your own key in Settings ({url})."
    )

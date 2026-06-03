"""Runtime configuration for the TradeDesk backend.

Everything that differs between local dev and a production deployment is read
from the environment here, with safe defaults for local use. In production set
at minimum ``TRADEDESK_SECRET_KEY`` (JWT signing) and ``TRADEDESK_FERNET_KEY``
(encryption of per-user provider API keys); the rest have sensible defaults.
"""

from __future__ import annotations

import base64
import hashlib
import os
from pathlib import Path

try:  # load a .env if present, but never required
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover
    pass

# --- paths ----------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BASE_DIR / "data" / "tradedesk.db"

# SQLAlchemy URL. Defaults to a local SQLite file under data/. Point this at
# Postgres in production (e.g. postgresql+psycopg://user:pass@host/db) and the
# ORM layer keeps working unchanged.
DATABASE_URL = os.environ.get(
    "TRADEDESK_DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}"
)

# --- auth -----------------------------------------------------------------
SECRET_KEY = os.environ.get(
    "TRADEDESK_SECRET_KEY",
    # Dev-only fallback. Logged as a warning at startup; override in prod.
    "dev-insecure-secret-change-me",
)
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TTL_MINUTES = int(os.environ.get("TRADEDESK_TOKEN_TTL_MINUTES", "10080"))  # 7 days

# Key used to encrypt per-user provider API keys at rest (Fernet). If not
# supplied, we derive a stable key from SECRET_KEY so the app still runs; set an
# explicit ``TRADEDESK_FERNET_KEY`` (a urlsafe base64 32-byte key) in production.
_RAW_FERNET = os.environ.get("TRADEDESK_FERNET_KEY")


def fernet_key() -> bytes:
    if _RAW_FERNET:
        return _RAW_FERNET.encode()
    digest = hashlib.sha256(SECRET_KEY.encode()).digest()
    return base64.urlsafe_b64encode(digest)


# --- providers ------------------------------------------------------------
# Provider keys configured server-side (the default for all users unless they
# set their own in account settings).
SERVER_PROVIDER_KEYS = {
    "anthropic": os.environ.get("ANTHROPIC_API_KEY"),
    "openai": os.environ.get("OPENAI_API_KEY"),
    "gemini": os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"),
    "ollama": os.environ.get("OLLAMA_API_KEY"),
}

IS_INSECURE_SECRET = SECRET_KEY == "dev-insecure-secret-change-me"

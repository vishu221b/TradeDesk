"""Shared pytest fixtures.

Each test session runs against a throwaway SQLite file and a fixed test secret,
configured *before* the app is imported (config reads the environment at import
time). Everything uses the keyless ``mock`` provider, so the suite needs no API
keys and no network.
"""

from __future__ import annotations

import os
import tempfile
import uuid

import pytest

# Configure the environment BEFORE importing the app/config.
_TMP_DB = os.path.join(tempfile.gettempdir(), f"tradedesk_test_{uuid.uuid4().hex}.db")
os.environ["TRADEDESK_DATABASE_URL"] = f"sqlite:///{_TMP_DB}"
os.environ["TRADEDESK_SECRET_KEY"] = "test-secret-key-that-is-long-enough-32b"
# Make sure no real provider keys leak in from a developer .env.
for _k in ("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "OLLAMA_API_KEY"):
    os.environ.pop(_k, None)

from fastapi.testclient import TestClient  # noqa: E402

from tradedesk.api import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _cleanup_db():
    yield
    try:
        os.remove(_TMP_DB)
    except OSError:
        pass


@pytest.fixture()
def client():
    # The context manager runs lifespan (init_db + demo seed).
    with TestClient(app) as c:
        yield c


def _register(client: TestClient, username: str | None = None, password: str = "secret123") -> dict:
    username = username or f"user_{uuid.uuid4().hex[:8]}"
    r = client.post("/auth/register", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    body = r.json()
    return {
        "username": username,
        "password": password,
        "token": body["access_token"],
        "headers": {"Authorization": f"Bearer {body['access_token']}"},
        "user": body["user"],
    }


@pytest.fixture()
def user(client):
    """A freshly registered user with auth headers."""
    return _register(client)


@pytest.fixture()
def seeded_user(client, user):
    """A user with the sample dataset loaded."""
    r = client.post("/ops/load-sample-data", headers=user["headers"])
    assert r.status_code == 200, r.text
    return user

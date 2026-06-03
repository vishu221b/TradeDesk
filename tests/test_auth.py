"""Auth: registration, login, token-protected access, per-user provider keys."""

from __future__ import annotations

import uuid


def test_register_and_me(client, user):
    r = client.get("/auth/me", headers=user["headers"])
    assert r.status_code == 200
    assert r.json()["username"] == user["username"]


def test_register_duplicate_username(client):
    name = f"dup_{uuid.uuid4().hex[:8]}"
    assert client.post("/auth/register", json={"username": name, "password": "secret123"}).status_code == 200
    r = client.post("/auth/register", json={"username": name, "password": "secret123"})
    assert r.status_code == 409


def test_login_wrong_password(client, user):
    r = client.post("/auth/login", json={"username": user["username"], "password": "nope"})
    assert r.status_code == 401


def test_login_success(client, user):
    r = client.post("/auth/login", json={"username": user["username"], "password": user["password"]})
    assert r.status_code == 200
    assert r.json()["user"]["username"] == user["username"]


def test_protected_requires_token(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/ops/jobs").status_code == 401
    assert client.get("/ops/jobs", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_set_and_clear_provider_key(client, user):
    r = client.post("/auth/provider-key", headers=user["headers"],
                    json={"provider": "openai", "api_key": "sk-test-123"})
    assert r.status_code == 200
    assert "openai" in r.json()["provider_keys"]

    # provider now shows as available, sourced from the user's key
    provs = {p["id"]: p for p in client.get("/providers", headers=user["headers"]).json()}
    assert provs["openai"]["available"] and provs["openai"]["source"] == "user"

    # clearing removes it
    r = client.post("/auth/provider-key", headers=user["headers"],
                    json={"provider": "openai", "api_key": ""})
    assert "openai" not in r.json()["provider_keys"]


def test_unknown_provider_key_rejected(client, user):
    r = client.post("/auth/provider-key", headers=user["headers"],
                    json={"provider": "nope", "api_key": "x"})
    assert r.status_code == 400


def test_demo_account_seeded(client):
    r = client.post("/auth/login", json={"username": "demo", "password": "demo1234"})
    assert r.status_code == 200
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert len(client.get("/ops/jobs", headers=headers).json()) > 0

"""Chat: agent tool-use loop, chat mode, persistence and continuation."""

from __future__ import annotations


def test_agent_mode_calls_tool(seeded_user, client):
    r = client.post("/chat", headers=seeded_user["headers"], json={
        "message": "which invoices are overdue?", "provider": "mock", "mode": "agent",
    })
    assert r.status_code == 200
    data = r.json()
    assert any(c["name"] == "list_invoices" for c in data["tool_calls"])
    assert "record" in data["reply"].lower() or "found" in data["reply"].lower()


def test_chat_mode_uses_no_tools(seeded_user, client):
    r = client.post("/chat", headers=seeded_user["headers"], json={
        "message": "which invoices are overdue?", "provider": "mock", "mode": "chat",
    })
    assert r.status_code == 200
    assert r.json()["tool_calls"] == []


def test_conversation_persisted_and_continued(seeded_user, client):
    h = seeded_user["headers"]
    r1 = client.post("/chat", headers=h, json={"message": "what jobs are scheduled?", "provider": "mock"})
    cid = r1.json()["conversation_id"]

    r2 = client.post("/chat", headers=h, json={
        "message": "thanks!", "provider": "mock", "conversation_id": cid,
    })
    assert r2.json()["conversation_id"] == cid

    detail = client.get(f"/conversations/{cid}", headers=h).json()
    roles = [m["role"] for m in detail["messages"]]
    assert roles == ["user", "assistant", "user", "assistant"]
    assert detail["message_count"] == 4


def test_conversations_list_and_delete(seeded_user, client):
    h = seeded_user["headers"]
    cid = client.post("/chat", headers=h, json={"message": "hi", "provider": "mock"}).json()["conversation_id"]
    assert any(c["id"] == cid for c in client.get("/conversations", headers=h).json())

    assert client.delete(f"/conversations/{cid}", headers=h).status_code == 200
    assert client.get(f"/conversations/{cid}", headers=h).status_code == 404


def test_cannot_access_others_conversation(client, seeded_user):
    from tests.conftest import _register

    h = seeded_user["headers"]
    cid = client.post("/chat", headers=h, json={"message": "hi", "provider": "mock"}).json()["conversation_id"]

    other = _register(client)
    assert client.get(f"/conversations/{cid}", headers=other["headers"]).status_code == 404


def test_empty_message_rejected(client, user):
    r = client.post("/chat", headers=user["headers"], json={"message": "   ", "provider": "mock"})
    assert r.status_code == 422


def test_unconfigured_provider_400(client, user):
    # No server key and no user key for anthropic in the test env.
    r = client.post("/chat", headers=user["headers"], json={"message": "hi", "provider": "anthropic"})
    assert r.status_code == 400

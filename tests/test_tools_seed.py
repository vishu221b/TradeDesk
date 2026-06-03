"""Unit tests for tool dispatch, the agent loop, and the seed builder.

These bypass HTTP and exercise the core directly against an in-memory DB.
"""

from __future__ import annotations

import json
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from tradedesk.agent import TradeDeskAgent
from tradedesk.db import Base
from tradedesk.ops_client import OpsClient
from tradedesk.providers import get_provider
from tradedesk.seed import DEMO_PASSWORD, seed_user_data
from tradedesk.security import hash_password
from tradedesk.tools import execute_tool
from tradedesk import models


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    with Session() as s:
        yield s


@pytest.fixture()
def seeded(db):
    user = models.User(username="t", password_hash=hash_password(DEMO_PASSWORD), encrypted_keys={})
    db.add(user)
    db.commit()
    db.refresh(user)
    seed_user_data(db, user.id, today=date(2026, 5, 30))
    return user


def test_seed_idempotent_and_replace(db):
    user = models.User(username="u", password_hash="x", encrypted_keys={})
    db.add(user)
    db.commit()
    db.refresh(user)

    assert seed_user_data(db, user.id, today=date(2026, 5, 30)) is True
    assert seed_user_data(db, user.id, today=date(2026, 5, 30)) is False  # no-op
    assert seed_user_data(db, user.id, today=date(2026, 5, 30), replace=True) is True


def test_seed_dates_relative(db):
    user = models.User(username="r", password_hash="x", encrypted_keys={})
    db.add(user)
    db.commit()
    db.refresh(user)
    today = date(2030, 1, 15)
    seed_user_data(db, user.id, today=today)
    ops = OpsClient(db, user.id, today=today)
    overdue = ops.list_invoices(only_overdue=True)
    assert len(overdue) >= 1  # dates float with `today`, so always some overdue


def test_execute_tool_search_jobs(seeded, db):
    ops = OpsClient(db, seeded.id, today=date(2026, 5, 30))
    out = json.loads(execute_tool(ops, "search_jobs", {"status": "scheduled"}))
    assert all(j["status"] == "scheduled" for j in out)


def test_execute_tool_unknown(seeded, db):
    ops = OpsClient(db, seeded.id, today=date(2026, 5, 30))
    out = json.loads(execute_tool(ops, "does_not_exist", {}))
    assert "error" in out


def test_execute_tool_get_job_missing(seeded, db):
    ops = OpsClient(db, seeded.id, today=date(2026, 5, 30))
    out = json.loads(execute_tool(ops, "get_job", {"job_id": "JOB-0000"}))
    assert "error" in out


def test_agent_loop_with_mock(seeded, db):
    ops = OpsClient(db, seeded.id, today=date(2026, 5, 30))
    agent = TradeDeskAgent(ops, get_provider("mock"))
    calls = []
    reply = agent.send("what jobs are scheduled?", on_tool_call=lambda n, i, o: calls.append(n))
    assert "search_jobs" in calls
    assert reply  # produced a grounded summary


def test_agent_chat_mode_no_tools(seeded, db):
    ops = OpsClient(db, seeded.id, today=date(2026, 5, 30))
    agent = TradeDeskAgent(ops, get_provider("mock"))
    calls = []
    agent.send("hello there", on_tool_call=lambda n, i, o: calls.append(n), use_tools=False)
    assert calls == []

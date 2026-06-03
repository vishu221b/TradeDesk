"""Database engine, session factory, and schema bootstrap.

The schema is created on startup if it does not already exist (``init_db``);
nothing is dropped. SQLite is the zero-config default for local/demo use — point
``TRADEDESK_DATABASE_URL`` at Postgres for production and nothing else changes.
"""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from . import config


class Base(DeclarativeBase):
    pass


def _make_engine(url: str):
    # check_same_thread is a SQLite-only concern; harmless to branch on the URL.
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args, future=True)


engine = _make_engine(config.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


def init_db() -> None:
    """Create tables if absent and ensure the data directory exists."""
    if config.DATABASE_URL.startswith("sqlite:///"):
        config.DEFAULT_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    # Import models so they register on Base.metadata before create_all.
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


def get_session() -> Iterator[Session]:
    """FastAPI dependency: yields a session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

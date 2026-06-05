"""Database engine, session factory, and schema bootstrap.

The schema is created on startup if it does not already exist (``init_db``);
nothing is dropped. SQLite is the zero-config default for local/demo use — point
``TRADEDESK_DATABASE_URL`` at Postgres for production and nothing else changes.
"""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from . import config


class Base(DeclarativeBase):
    pass


# Tables that gained the soft-delete ``is_active`` flag after first release.
_SOFT_DELETE_TABLES = ("customers", "jobs", "invoices", "quotes", "messages")


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
    _backfill_is_active()


def _backfill_is_active() -> None:
    """Add the ``is_active`` soft-delete column to pre-existing tables.

    ``create_all`` never alters existing tables, so a database created before
    soft-delete shipped would be missing the column. Add it (defaulting to
    active) so older SQLite/Postgres databases keep working without a manual
    migration. New databases already have the column and are skipped.
    """
    inspector = inspect(engine)
    existing = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table in _SOFT_DELETE_TABLES:
            if table not in existing:
                continue
            cols = {c["name"] for c in inspector.get_columns(table)}
            if "is_active" in cols:
                continue
            conn.execute(
                text(f"ALTER TABLE {table} ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1")
            )


def get_session() -> Iterator[Session]:
    """FastAPI dependency: yields a session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

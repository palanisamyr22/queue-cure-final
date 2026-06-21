"""
backend/app/database.py

SQLAlchemy engine, session factory, and database initialisation for Queue Cure.

Design decisions:
  - SQLite is used for hackathon simplicity; the DATABASE_URL env var makes it
    trivially swappable to PostgreSQL in the future without changing this module.
  - WAL (Write-Ahead Logging) journal mode is applied on every new connection via
    a SQLAlchemy event listener, not as a one-shot pragma, so it is guaranteed even
    if the connection pool recycles connections.
  - check_same_thread=False is required for SQLite when used across multiple threads
    (FastAPI / Uvicorn use a thread pool for sync route handlers).
  - autocommit=False / autoflush=False gives explicit transaction control to route
    handlers, which is required for the atomic call-next lock guard in Phase 2.
"""

import os
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Read from environment; default to a local file suitable for development.
# On Render the DATABASE_URL will point to the persistent disk mount, e.g.
# "sqlite:////data/queue_cure.db".
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./queue_cure.db")

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

engine: Engine = create_engine(
    DATABASE_URL,
    # Required for SQLite when used across multiple threads (FastAPI / Uvicorn
    # use a thread pool for sync route handlers).
    connect_args={"check_same_thread": False},
    # Issue a lightweight SELECT before returning a pooled connection to the
    # caller.  Detects stale connections (e.g. after a Render service restart)
    # before they reach route handlers, preventing cryptic "database closed"
    # errors mid-request.
    pool_pre_ping=True,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_connection, connection_record) -> None:
    """
    Apply SQLite pragmas on every new physical connection.

    This listener fires each time the pool creates a new underlying DBAPI
    connection, guaranteeing both settings survive connection recycling.

    WAL journal mode:
        Allows concurrent readers while a writer holds a lock.  Without WAL,
        a slow write (e.g. call-next + broadcast) would block add-patient reads
        and occasionally produce "database is locked" errors under load.

    foreign_keys = ON:
        SQLite disables FK enforcement by default.  Enabling it ensures that
        ConsultationLog.patient_id correctly references a real Patient row and
        that ON DELETE CASCADE fires as expected.
    """
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------

SessionLocal: sessionmaker[Session] = sessionmaker(
    bind=engine,
    autocommit=False,  # All commits are explicit — required for transaction guards.
    autoflush=False,   # Flush only when we call session.flush() or session.commit().
    expire_on_commit=False,  # Allow attribute access on ORM objects after commit
                             # without issuing a follow-up SELECT.  Safe under
                             # --workers 1 (single process, no cross-session staleness
                             # risk) and improves broadcast performance where we read
                             # objects immediately after committing.
)

# ---------------------------------------------------------------------------
# Declarative base
# ---------------------------------------------------------------------------


class Base(DeclarativeBase):
    """
    Shared declarative base for all ORM models.

    All models must inherit from this class so that create_tables() picks them
    up via Base.metadata.create_all().  Import models.py in main.py *before*
    calling create_tables() so the metadata is populated.
    """


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


def create_tables() -> None:
    """
    Create all tables defined in Base.metadata if they do not already exist.

    Called once during the FastAPI startup event (main.py).  Uses
    ``checkfirst=True`` (the default for create_all) so it is safe to call on
    every startup without dropping data.

    Imports models inside the function body to guarantee that all model classes
    are registered on Base.metadata before the CREATE TABLE statements run,
    even if this module is imported before models.py in some edge case.
    """
    # Local import avoids a circular-import risk if models.py ever needs to
    # import something from this module at the top level.
    import app.models  # noqa: F401 — side-effect import registers models on Base

    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a SQLAlchemy Session per request.

    Usage in a route:
        @router.post("/example")
        def example(db: Session = Depends(get_db)):
            ...

    The session is always closed in the finally block, returning the underlying
    connection to the pool regardless of whether the route raised an exception.
    Callers are responsible for calling db.commit() and db.rollback() explicitly.
    """
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()

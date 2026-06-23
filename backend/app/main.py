"""
backend/app/main.py

FastAPI application entry point for Queue Cure.

⚠️  SINGLE WORKER ONLY — run as:
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1

    The WebSocket connection pool (Phase 3) is an in-process data structure.
    Running multiple Uvicorn workers means each worker has its own isolated
    pool — a broadcast in worker A will never reach clients connected to
    worker B, breaking the 40%-weighted live-sync criterion silently.
"""

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import SessionLocal, create_tables
from app.models import QueueSettings, _utcnow
from app.routers import patients, queue, ws

# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    FastAPI lifespan context manager (replaces deprecated @app.on_event).

    Startup:
        1. Create all database tables (idempotent — safe on every restart).
        2. Seed the QueueSettings singleton row (id=1) if it doesn't exist.
           This guarantees that _get_settings() never returns None in routers.

    Shutdown:
        Nothing to clean up in Phase 2.  Phase 3 will close active WS connections.
    """
    # ── Startup ──────────────────────────────────────────────────────────────
    create_tables()
    _seed_queue_settings()

    yield  # Application runs here

    # ── Shutdown ─────────────────────────────────────────────────────────────
    # Phase 3: manager.disconnect_all()


def _seed_queue_settings() -> None:
    """
    Insert the QueueSettings row (id=1) if it does not already exist.

    Uses a short-lived session separate from the request cycle so seeding
    is not entangled with any in-flight request session.
    """
    db = SessionLocal()
    try:
        if db.get(QueueSettings, 1) is None:
            db.add(
                QueueSettings(
                    id=1,
                    avg_consultation_minutes=10,
                    current_token=None,
                    last_token_issued=0,
                    updated_at=_utcnow(),
                )
            )
            db.commit()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Queue Cure API",
    description=(
        "Real-time clinic queue management system.  "
        "Receptionists manage the queue via REST; patients watch a live display "
        "screen updated via WebSocket broadcasts."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(patients.router)
app.include_router(queue.router)
app.include_router(queue.history_router)
app.include_router(ws.router)

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@app.get(
    "/health",
    tags=["system"],
    summary="Health check",
    description=(
        "Lightweight liveness probe used by Render's health-check system. "
        "Returns 200 as long as the process is running and the event loop is live."
    ),
)
def health_check() -> dict:
    """
    Return a simple health status.

    Render requires this endpoint to return HTTP 200 for the service to be
    considered healthy.  We intentionally keep this as lightweight as possible —
    no DB query — so a slow or locked SQLite write never causes a false-positive
    health failure.
    """
    return {"status": "healthy"}

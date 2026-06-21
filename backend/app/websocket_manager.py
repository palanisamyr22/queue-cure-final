"""
backend/app/websocket_manager.py

WebSocket ConnectionManager and broadcast hook.

Responsibilities:
- Track active WebSocket connections
- Handle connects/disconnects
- Broadcast queue snapshots to all connected clients
- Automatically drop dead/stale connections without crashing the server
"""

import asyncio
import logging
from typing import List

from fastapi import WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Patient, PatientStatus, QueueSettings, _utcnow
from app.schemas import PatientResponse, QueueSettingsResponse, QueueSnapshot, WSMessage

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    In-memory state manager for connected WebSockets.
    
    ⚠️ Requires `--workers 1` because the active_connections list lives
    only in the memory space of a single Uvicorn process.
    """

    def __init__(self):
        self.active_connections: List[WebSocket] = []
        # Lock to prevent race conditions when iterating over or mutating
        # the connections list during a high-concurrency event broadcast.
        self._lock = asyncio.Lock()
        self.main_loop = None

    async def connect(self, websocket: WebSocket):
        """Accept connection and add to pool."""
        if self.main_loop is None:
            self.main_loop = asyncio.get_running_loop()
            
        await websocket.accept()
        async with self._lock:
            self.active_connections.append(websocket)
        logger.info(f"Client connected. Active clients: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket):
        """Remove connection from pool gracefully."""
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
        logger.info(f"Client disconnected. Active clients: {len(self.active_connections)}")

    async def broadcast_event(self, event_name: str, payload: QueueSnapshot):
        """
        Send a WSMessage containing the snapshot to all connected clients.
        
        Handles closed/stale sockets gracefully by catching exceptions
        and automatically removing the dead sockets.
        """
        message = WSMessage(
            event=event_name,
            data=payload,
            timestamp=_utcnow().isoformat()
        )
        message_json = message.model_dump_json()

        dead_connections = []
        
        async with self._lock:
            # We copy the list for iteration to safely handle mutations if needed,
            # though we defer removals to after the loop.
            connections = list(self.active_connections)

        for connection in connections:
            try:
                await connection.send_text(message_json)
            except Exception as e:
                # Connection might have dropped without sending a close frame
                logger.warning(f"Failed to send message to client, removing: {e}")
                dead_connections.append(connection)

        # Cleanup dead connections
        if dead_connections:
            async with self._lock:
                for dead_conn in dead_connections:
                    if dead_conn in self.active_connections:
                        self.active_connections.remove(dead_conn)


# Singleton instance
manager = ConnectionManager()


from app.services.wait_time import calculate_wait_time_for_patient

def _build_queue_snapshot(db: Session) -> QueueSnapshot:
    """
    Constructs a full QueueSnapshot from the database.
    
    This identical logic is used both for the initial connect push
    and the subsequent broadcasts, ensuring the payload structure
    is perfectly identical.
    """
    settings = db.get(QueueSettings, 1)
    if not settings:
        # Fallback if DB isn't seeded (should never happen due to lifespan)
        raise RuntimeError("QueueSettings not initialized.")

    total_waiting = (
        db.query(func.count(Patient.id))
        .filter(Patient.status == PatientStatus.WAITING.value)
        .scalar()
        or 0
    )

    # We send all waiting and in_consultation patients, plus recently completed/no_show.
    patients = db.query(Patient).order_by(Patient.created_at.asc()).all()

    patient_responses = []
    for p in patients:
        p_resp = PatientResponse.model_validate(p)
        if p.status == PatientStatus.WAITING.value:
            pa, ew = calculate_wait_time_for_patient(db, p.id)
            p_resp.people_ahead = pa
            p_resp.estimated_wait_minutes = ew
        patient_responses.append(p_resp)

    return QueueSnapshot(
        patients=patient_responses,
        current_token=settings.current_token,
        total_waiting=total_waiting,
        settings=QueueSettingsResponse.model_validate(settings)
    )


def broadcast_queue_update(db: Session) -> None:
    """
    Synchronous hook called by REST routers after every commit.
    
    Reads fresh state from the DB session and safely bridges from the 
    synchronous FastAPI worker thread back into the main event loop 
    to trigger the asynchronous broadcast.
    """
    try:
        snapshot = _build_queue_snapshot(db)
    except Exception as e:
        logger.error(f"Failed to build queue snapshot for broadcast: {e}")
        return

    if manager.main_loop is not None and manager.active_connections:
        try:
            asyncio.run_coroutine_threadsafe(
                manager.broadcast_event("queue_updated", snapshot), 
                manager.main_loop
            )
        except Exception as e:
            logger.error(f"Failed to schedule broadcast: {e}")

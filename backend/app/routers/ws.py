"""
backend/app/routers/ws.py

WebSocket endpoint router.

Provides a single continuous connection for both the Patient Display 
and the Receptionist Dashboard. 

Endpoint:
  WS /ws/queue

Behavior:
1. On connection: Immediately sends a full queue snapshot with event="queue_full_snapshot".
2. Keeps connection open, waiting for client disconnect.
3. Automatically removed from the broadcast pool upon disconnection.
"""

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.database import SessionLocal
from app.websocket_manager import _build_queue_snapshot, manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/queue")
async def websocket_queue_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time queue updates.
    
    Both receptionist and patient screens connect here.
    """
    await manager.connect(websocket)
    
    try:
        # 1. Immediately send the full state upon connection.
        #    We use a short-lived session so we don't hold a DB connection
        #    open for the lifetime of the WebSocket.
        with SessionLocal() as db:
            snapshot = _build_queue_snapshot(db)
            
        from app.schemas import WSMessage
        from app.models import _utcnow
        
        msg = WSMessage(
            event="queue_full_snapshot",
            data=snapshot,
            timestamp=_utcnow().isoformat()
        )
        await websocket.send_text(msg.model_dump_json())

        # 2. Keep connection open and handle client-initiated closure
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        logger.info("Client initiated disconnect.")
        await manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Unexpected WebSocket error: {e}")
        await manager.disconnect(websocket)


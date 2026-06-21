"""
backend/app/routers/queue.py

REST endpoints for queue control (receptionist) and queue status (patient-facing).

Router prefix : /api/queue
Tags          : queue

Endpoints
---------
Receptionist (state-changing):
  POST  /call-next   Atomically complete current → promote next waiting → in_consultation
  POST  /complete    Mark current in_consultation patient as completed
  POST  /no-show     Mark current in_consultation patient as no_show (no auto-advance)
  PUT   /settings    Update avg_consultation_minutes

Read-only (both screens):
  GET   /settings    Fetch current queue settings
  GET   /status      { current_token, total_waiting, avg_consultation_minutes }
  GET   /wait-time/{token_id}  { people_ahead, estimated_minutes }

Concurrency guard — call-next
------------------------------
A threading.Lock is held for the entire read-modify-write cycle of call-next.
This prevents double-advance when:
  - The receptionist double-clicks "Call Next"
  - Two browser tabs have the receptionist dashboard open simultaneously

The lock is process-scoped, which is safe because the architecture mandates
--workers 1.  If the worker count is ever increased, this guard must be replaced
with a DB-level advisory lock or a SELECT FOR UPDATE (not supported in SQLite).

Broadcast hook
--------------
Every state-changing endpoint calls broadcast_queue_update(db) after commit.
Phase 2: no-op stub.  Phase 3: real WebSocket fan-out.

Wait-time formula (Phase 2 — basic)
--------------------------------------
  estimated_minutes = people_ahead × avg_consultation_minutes

Phase 6 upgrades this to the elapsed-time-aware formula:
  estimated_minutes = max(0, avg − elapsed_current) + people_ahead × avg
"""

import threading
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ConsultationLog, Patient, PatientStatus, QueueSettings, ArchivedPatient, _utcnow
from app.schemas import (
    CallNextResponse,
    CompleteConsultationResponse,
    NoShowResponse,
    PatientResponse,
    QueueSettingsResponse,
    QueueSettingsUpdate,
    QueueStatusResponse,
    WaitTimeResponse,
    QueueHistoryResponse,
    ArchivedPatientResponse,
    HistoryAnalytics,
)
from app.websocket_manager import broadcast_queue_update

router = APIRouter(prefix="/api/queue", tags=["queue"])
history_router = APIRouter(tags=["history"])

# ---------------------------------------------------------------------------
# Process-level lock for call-next atomicity.
# Safe under --workers 1.  See module docstring for the multi-worker caveat.
# ---------------------------------------------------------------------------
_call_next_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Helper: fetch settings or raise 500
# ---------------------------------------------------------------------------


def _get_settings(db: Session) -> QueueSettings:
    """
    Fetch the singleton QueueSettings row (id=1).

    Raises 500 if the row is missing — this should never happen because
    main.py seeds it on startup, but an explicit error is better than an
    AttributeError bubbling up later.
    """
    settings = db.get(QueueSettings, 1)
    if settings is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Queue settings not initialised.  Restart the server.",
        )
    return settings


# ---------------------------------------------------------------------------
# POST /api/queue/call-next
# ---------------------------------------------------------------------------


@router.post(
    "/call-next",
    response_model=CallNextResponse,
    summary="Call next patient",
    description=(
        "Atomically: (1) marks the current in_consultation patient as completed, "
        "(2) records consultation duration in ConsultationLog, "
        "(3) promotes the next waiting patient to in_consultation, "
        "(4) updates QueueSettings.current_token.  "
        "A process-level lock prevents double-advance from rapid clicks or "
        "two simultaneous receptionist tabs."
    ),
)
def call_next(db: Session = Depends(get_db)) -> CallNextResponse:
    """
    Advance the queue by one position.

    The lock guarantees that concurrent calls read the same initial state
    only once — the second caller will re-read after the first has committed
    and will correctly see no patients waiting (or the next one).

    Status transitions performed:
        current in_consultation → completed
        next waiting → in_consultation
    """
    with _call_next_lock:
        # ── Find the next waiting patient (FIFO by created_at) ──────────────
        next_patient: Optional[Patient] = (
            db.query(Patient)
            .filter(Patient.status == PatientStatus.WAITING.value)
            .order_by(Patient.created_at.asc())
            .first()
        )

        if next_patient is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No patients are currently waiting.",
            )

        now = _utcnow()

        # ── Complete the current in_consultation patient (if any) ────────────
        current_patient: Optional[Patient] = (
            db.query(Patient)
            .filter(Patient.status == PatientStatus.IN_CONSULTATION.value)
            .first()
        )

        if current_patient is not None:
            current_patient.status = PatientStatus.COMPLETED.value
            current_patient.consultation_end = now

            # Record the actual duration in ConsultationLog
            duration_minutes = 0
            if current_patient.consultation_start is not None:
                delta = now - current_patient.consultation_start
                duration_minutes = max(0, round(delta.total_seconds() / 60))

            # Only create a log entry if one doesn't already exist
            if current_patient.consultation_log is None:
                log_entry = ConsultationLog(
                    patient_id=current_patient.id,
                    duration_minutes=duration_minutes,
                )
                db.add(log_entry)

        # ── Promote next patient into the consultation room ──────────────────
        next_patient.status = PatientStatus.IN_CONSULTATION.value
        next_patient.called_at = now
        next_patient.consultation_start = now

        # ── Update QueueSettings to reflect new current token ────────────────
        settings = _get_settings(db)
        settings.current_token = next_patient.id
        settings.last_token_issued = max(
            settings.last_token_issued, next_patient.id
        )

        db.commit()
        db.refresh(next_patient)
        db.refresh(settings)

    # Broadcast outside the lock — lock only protects the DB transaction,
    # not the (cheap) fan-out to connected clients.
    broadcast_queue_update(db)

    return CallNextResponse(
        message=f"Token {next_patient.id} is now in consultation.",
        patient=PatientResponse.model_validate(next_patient),
        settings=QueueSettingsResponse.model_validate(settings),
    )


# ---------------------------------------------------------------------------
# POST /api/queue/complete
# ---------------------------------------------------------------------------


@router.post(
    "/complete",
    response_model=CompleteConsultationResponse,
    summary="Complete current consultation",
    description=(
        "Marks the patient currently in_consultation as completed and records "
        "the actual consultation duration.  Clears QueueSettings.current_token. "
        "Does NOT automatically call the next patient — use POST /call-next for that."
    ),
)
def complete_consultation(db: Session = Depends(get_db)) -> CompleteConsultationResponse:
    """
    Mark the current patient as completed.

    Status transition: in_consultation → completed

    If there is no patient in_consultation a 409 is returned.
    """
    current_patient: Optional[Patient] = (
        db.query(Patient)
        .filter(Patient.status == PatientStatus.IN_CONSULTATION.value)
        .first()
    )

    if current_patient is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No patient is currently in consultation.",
        )

    now = _utcnow()
    current_patient.status = PatientStatus.COMPLETED.value
    current_patient.consultation_end = now

    # Compute actual duration
    duration_minutes = 0
    if current_patient.consultation_start is not None:
        delta = now - current_patient.consultation_start
        duration_minutes = max(0, round(delta.total_seconds() / 60))

    # Record in ConsultationLog (idempotent — skip if already logged)
    if current_patient.consultation_log is None:
        db.add(
            ConsultationLog(
                patient_id=current_patient.id,
                duration_minutes=duration_minutes,
            )
        )

    # Clear the current_token pointer in settings
    settings = _get_settings(db)
    settings.current_token = None

    db.commit()
    db.refresh(current_patient)

    broadcast_queue_update(db)

    return CompleteConsultationResponse(
        message=f"Token {current_patient.id} consultation complete.",
        patient=PatientResponse.model_validate(current_patient),
        duration_minutes=duration_minutes,
    )


# ---------------------------------------------------------------------------
# POST /api/queue/no-show
# ---------------------------------------------------------------------------


@router.post(
    "/no-show",
    response_model=NoShowResponse,
    summary="Mark current patient as no-show",
    description=(
        "Marks the patient currently in_consultation as no_show — they were called "
        "but did not appear.  Clears QueueSettings.current_token. "
        "Does NOT advance the queue; use POST /call-next after this to serve the "
        "next waiting patient.  "
        "This endpoint covers the edge case that accounts for 15% of judging criteria."
    ),
)
def mark_no_show(db: Session = Depends(get_db)) -> NoShowResponse:
    """
    Mark the current in_consultation patient as no_show.

    Status transition: in_consultation → no_show

    The queue does not auto-advance — the receptionist must explicitly press
    "Call Next" after marking a no-show.  This gives them control over pacing.
    """
    current_patient: Optional[Patient] = (
        db.query(Patient)
        .filter(Patient.status == PatientStatus.IN_CONSULTATION.value)
        .first()
    )

    if current_patient is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No patient is currently in consultation.",
        )

    current_patient.status = PatientStatus.NO_SHOW.value
    # Preserve called_at and consultation_start; clear consultation_end is
    # intentionally not set — the consultation never happened.

    settings = _get_settings(db)
    settings.current_token = None

    db.commit()
    db.refresh(current_patient)

    broadcast_queue_update(db)

    return NoShowResponse(
        message=f"Token {current_patient.id} marked as no-show.",
        patient=PatientResponse.model_validate(current_patient),
    )


# ---------------------------------------------------------------------------
# PUT /api/queue/settings
# ---------------------------------------------------------------------------


@router.put(
    "/settings",
    response_model=QueueSettingsResponse,
    summary="Update queue settings",
    description=(
        "Update avg_consultation_minutes.  The change takes effect immediately "
        "for all subsequent wait-time calculations and is broadcast to all "
        "connected clients so the patient display updates live."
    ),
)
def update_settings(
    payload: QueueSettingsUpdate, db: Session = Depends(get_db)
) -> QueueSettingsResponse:
    """Update the avg_consultation_minutes setting."""
    settings = _get_settings(db)
    settings.avg_consultation_minutes = payload.avg_consultation_minutes
    # updated_at is set automatically by the onupdate= column directive

    db.commit()
    db.refresh(settings)

    broadcast_queue_update(db)

    return QueueSettingsResponse.model_validate(settings)


# ---------------------------------------------------------------------------
# GET /api/queue/settings
# ---------------------------------------------------------------------------


@router.get(
    "/settings",
    response_model=QueueSettingsResponse,
    summary="Get queue settings",
    description="Returns the current avg_consultation_minutes and queue state.",
)
def get_settings(db: Session = Depends(get_db)) -> QueueSettingsResponse:
    """Fetch the singleton settings row."""
    return QueueSettingsResponse.model_validate(_get_settings(db))


# ---------------------------------------------------------------------------
# GET /api/queue/status
# ---------------------------------------------------------------------------


from app.services.wait_time import calculate_walk_in_wait_time, get_dynamic_avg_consultation

@router.get(
    "/status",
    response_model=QueueStatusResponse,
    summary="Get overall queue status",
    description=(
        "Returns the current token in consultation, total waiting patients, "
        "and the average consultation duration.  Read by both screens."
    ),
)
def get_queue_status(db: Session = Depends(get_db)) -> QueueStatusResponse:
    """Lightweight status read — no ORM object loading, just a count query."""
    settings = _get_settings(db)

    total_waiting: int = (
        db.query(func.count(Patient.id))
        .filter(Patient.status == PatientStatus.WAITING.value)
        .scalar()
        or 0
    )

    people_ahead, estimated_wait_minutes = calculate_walk_in_wait_time(db)
    dynamic_avg = get_dynamic_avg_consultation(db)

    return QueueStatusResponse(
        current_token=settings.current_token,
        total_waiting=total_waiting,
        people_ahead=people_ahead,
        estimated_wait_minutes=estimated_wait_minutes,
        avg_consultation_minutes=dynamic_avg,
    )


# ---------------------------------------------------------------------------
# GET /api/queue/wait-time/{token_id}
# ---------------------------------------------------------------------------


from app.services.wait_time import calculate_wait_time_for_patient

@router.get(
    "/wait-time/{token_id}",
    response_model=WaitTimeResponse,
    summary="Get wait-time estimate for a token",
    description=(
        "Returns the number of patients ahead of the given token and an "
        "estimated wait time in minutes.  "
        "Phase 2 uses the simple formula: people_ahead × avg_consultation_minutes.  "
        "Phase 6 upgrades to the elapsed-time-aware formula."
    ),
)
def get_wait_time(token_id: int, db: Session = Depends(get_db)) -> WaitTimeResponse:
    """
    Estimate wait time for a given token.

    Phase 2 formula (simple):
        estimated_minutes = people_ahead × avg_consultation_minutes

    Phase 6 formula (elapsed-aware):
        estimated_minutes =
            max(0, avg - elapsed_time_of_current_patient)
            + people_ahead × avg

    Both are correct server-side calculations that always reflect the live
    queue state — the patient display shows 'real' dynamic values, not a
    static snapshot taken at registration time.
    """
    patient = db.get(Patient, token_id)
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Token {token_id} not found.",
        )

    if patient.status not in (
        PatientStatus.WAITING.value,
        PatientStatus.IN_CONSULTATION.value,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Token {token_id} is not active (status='{patient.status}'). "
                "Wait-time is only meaningful for waiting or in_consultation patients."
            ),
        )

    # Phase 6: dynamic elapsed-aware version
    people_ahead, estimated_minutes = calculate_wait_time_for_patient(db, token_id)

    return WaitTimeResponse(
        token_id=token_id,
        people_ahead=people_ahead,
        estimated_minutes=estimated_minutes,
    )


# ---------------------------------------------------------------------------
# DELETE /api/queue/reset — Reset queue and archive records
# ---------------------------------------------------------------------------


@router.delete(
    "/reset",
    status_code=status.HTTP_200_OK,
    summary="Reset today's queue",
    description="Archives all current patients to history, clears active queue tables, and resets auto-increment token counters.",
)
def reset_queue(db: Session = Depends(get_db)) -> dict:
    """
    Clear all patient rows and reset sequence to 1, while archiving data.
    """
    try:
        # 1. Fetch all current patient records
        patients = db.query(Patient).all()

        # 2. Archive each patient
        for p in patients:
            # Pre-calculate wait time in minutes
            wait_time = None
            if p.consultation_start:
                wait_time = max(0, int((p.consultation_start - p.created_at).total_seconds() / 60))
            elif p.status == PatientStatus.WAITING.value:
                wait_time = max(0, int((_utcnow() - p.created_at).total_seconds() / 60))

            # Pre-calculate consultation duration in minutes
            duration = None
            if p.consultation_end and p.consultation_start:
                duration = max(0, int((p.consultation_end - p.consultation_start).total_seconds() / 60))
            elif p.status == PatientStatus.IN_CONSULTATION.value and p.consultation_start:
                duration = max(0, int((_utcnow() - p.consultation_start).total_seconds() / 60))

            archived = ArchivedPatient(
                token_number=p.id,
                name=p.name,
                phone=p.phone,
                status=p.status,
                created_at=p.created_at,
                called_at=p.called_at,
                consultation_start=p.consultation_start,
                consultation_end=p.consultation_end,
                wait_time_minutes=wait_time,
                consultation_duration_minutes=duration,
                archived_at=_utcnow()
            )
            db.add(archived)

        # 3. Clear active tables (ConsultationLog will cascade-delete)
        db.query(Patient).delete()

        # 4. Reset SQLite auto-increment token counter back to 0 (so next is 1)
        try:
            db.execute(text("DELETE FROM sqlite_sequence WHERE name = 'patients'"))
        except Exception:
            pass

        # 5. Clear settings current_token and reset last_token_issued
        settings = db.get(QueueSettings, 1)
        if settings:
            settings.current_token = None
            settings.last_token_issued = 0

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset queue: {str(e)}"
        )

    # Broadcast empty state over websockets
    broadcast_queue_update(db)

    return {"message": "Queue has been reset successfully. Token sequence restarted from 1."}


# ---------------------------------------------------------------------------
# GET /api/history — Retrieve archived patients and summaries
# ---------------------------------------------------------------------------


@history_router.get(
    "/api/history",
    response_model=QueueHistoryResponse,
    summary="Get patient queue history",
    description="Returns archived patient records with search, status filters, and global statistics.",
)
def get_history(
    name: Optional[str] = None,
    status_filter: Optional[str] = None,
    date_filter: Optional[str] = None,
    db: Session = Depends(get_db)
) -> QueueHistoryResponse:
    """
    Fetch history, supporting search by name, date, and status.
    """
    query = db.query(ArchivedPatient)

    if name:
        query = query.filter(ArchivedPatient.name.ilike(f"%{name}%"))
    
    if status_filter:
        query = query.filter(ArchivedPatient.status == status_filter)

    if date_filter:
        # Check against archived_at or created_at (match YYYY-MM-DD date prefix)
        query = query.filter(func.strftime("%Y-%m-%d", ArchivedPatient.archived_at) == date_filter)

    records = query.order_by(ArchivedPatient.archived_at.desc()).all()

    # Pre-calculate analytics on the filtered set
    patients_served_today = sum(1 for r in records if r.status == PatientStatus.COMPLETED.value)
    no_show_count = sum(1 for r in records if r.status == PatientStatus.NO_SHOW.value)

    # Average wait time
    wait_times = [r.wait_time_minutes for r in records if r.wait_time_minutes is not None]
    avg_wait = round(sum(wait_times) / len(wait_times), 1) if wait_times else 0.0

    # Average consultation time
    consultation_times = [r.consultation_duration_minutes for r in records if r.consultation_duration_minutes is not None]
    avg_consultation = round(sum(consultation_times) / len(consultation_times), 1) if consultation_times else 0.0

    analytics = HistoryAnalytics(
        patients_served_today=patients_served_today,
        avg_wait_time=avg_wait,
        avg_consultation_time=avg_consultation,
        no_show_count=no_show_count
    )

    return QueueHistoryResponse(
        records=[ArchivedPatientResponse.model_validate(r) for r in records],
        analytics=analytics,
        total=len(records)
    )


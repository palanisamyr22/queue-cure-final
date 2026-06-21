"""
backend/app/schemas.py

Pydantic v2 request/response models for all Queue Cure API endpoints.

Naming convention:
  *Create   — request body for POST endpoints (inbound data)
  *Update   — request body for PUT endpoints (inbound data)
  *Response — response body (outbound data, serialised from ORM models)
  *Snapshot — composite payload used in WebSocket broadcasts (Phase 3)

All datetime fields are serialised as ISO-8601 strings by Pydantic.
Values are naive UTC (see models.py for the rationale).

No ORM imports here — Pydantic only.  model_config = ConfigDict(from_attributes=True)
is set on every response model so they can be constructed directly from
SQLAlchemy ORM instances via PatientResponse.model_validate(orm_obj).
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ---------------------------------------------------------------------------
# Patient schemas
# ---------------------------------------------------------------------------


class PatientCreate(BaseModel):
    """
    Request body for POST /api/patients.

    ``name`` is required and must be non-empty.
    ``phone`` is optional; the receptionist can leave it blank.
    """

    name: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Patient's full name as displayed on the queue screen.",
        examples=["Jane Smith"],
    )
    phone: Optional[str] = Field(
        None,
        max_length=30,
        description="Optional contact number. Not used by core queue logic.",
        examples=["9876543210"],
    )

    @field_validator("name")
    @classmethod
    def name_must_not_be_whitespace(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty or just whitespace.")
        return v


class PatientResponse(BaseModel):
    """
    Serialised patient row returned by all patient-related endpoints.

    ``token_number`` mirrors ``id`` — included explicitly so API consumers
    can use a semantically meaningful field name without knowing the
    id==token implementation detail.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Patient primary key — also the queue token number.")
    token_number: int = Field(description="Patient-facing queue token (alias for id).")
    name: str
    phone: Optional[str]
    status: str = Field(
        description="Lifecycle state: waiting | in_consultation | completed | no_show"
    )
    created_at: datetime = Field(description="Naive UTC — when patient was added.")
    called_at: Optional[datetime] = Field(
        None, description="Naive UTC — when the token was called."
    )
    consultation_start: Optional[datetime] = Field(
        None, description="Naive UTC — when consultation began."
    )
    consultation_end: Optional[datetime] = Field(
        None, description="Naive UTC — when consultation was marked complete."
    )
    people_ahead: Optional[int] = Field(
        None, description="Dynamic wait calculation — patients ahead (if waiting)."
    )
    estimated_wait_minutes: Optional[int] = Field(
        None, description="Dynamic wait calculation — estimated minutes (if waiting)."
    )


class PatientListResponse(BaseModel):
    """Response body for GET /api/patients."""

    patients: List[PatientResponse]
    total: int = Field(description="Total number of patients in the result set.")


# ---------------------------------------------------------------------------
# Queue settings schemas
# ---------------------------------------------------------------------------


class QueueSettingsUpdate(BaseModel):
    """
    Request body for PUT /api/queue/settings.

    Validated server-side: avg_consultation_minutes must be 1–480 (1 min to
    8 hours).  The DB CHECK constraint (avg_consultation_minutes > 0) is a
    second line of defence.
    """

    avg_consultation_minutes: int = Field(
        ...,
        gt=0,
        le=480,
        description="Estimated average consultation duration in minutes (1–480).",
        examples=[10],
    )


class QueueSettingsResponse(BaseModel):
    """Response body for GET /api/queue/settings and embedded in other responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    avg_consultation_minutes: int
    current_token: Optional[int] = Field(
        None,
        description="Patient.id currently in_consultation, or null if room is empty.",
    )
    last_token_issued: int = Field(
        description="Highest token (Patient.id) issued so far — informational."
    )
    updated_at: datetime


# ---------------------------------------------------------------------------
# Queue status / wait-time schemas
# ---------------------------------------------------------------------------


class QueueStatusResponse(BaseModel):
    """
    Response body for GET /api/queue/status.

    Read by both the patient display (to show total_waiting) and the
    receptionist dashboard (to know the current room state).
    """

    current_token: Optional[int] = Field(
        None,
        description="Token currently in consultation, or null if none.",
    )
    total_waiting: int = Field(description="Number of patients with status=waiting.")
    people_ahead: int = Field(description="Walk-in wait time: Number of waiting patients ahead.")
    estimated_wait_minutes: int = Field(description="Walk-in wait time: Estimated wait in minutes.")
    avg_consultation_minutes: int


class WaitTimeResponse(BaseModel):
    """
    Response body for GET /api/queue/wait-time/{token_id}.

    Computed server-side by services/wait_time.py (Phase 6).
    In Phase 2 this endpoint returns a basic estimate using the simple
    formula: people_ahead × avg_consultation_minutes.
    Phase 6 upgrades it to the elapsed-time-aware formula.
    """

    token_id: int
    people_ahead: int = Field(description="Number of waiting patients ahead in queue.")
    estimated_minutes: int = Field(
        description="Estimated wait in minutes. Updated every broadcast."
    )


# ---------------------------------------------------------------------------
# Queue action response schemas
# ---------------------------------------------------------------------------


class CallNextResponse(BaseModel):
    """
    Response body for POST /api/queue/call-next.

    Returns the newly promoted patient and the updated settings row so the
    receptionist dashboard can update without a separate GET.
    """

    message: str
    patient: PatientResponse = Field(
        description="The patient now in_consultation."
    )
    settings: QueueSettingsResponse = Field(
        description="Updated queue settings reflecting the new current_token."
    )


class CompleteConsultationResponse(BaseModel):
    """Response body for POST /api/queue/complete."""

    message: str
    patient: PatientResponse = Field(description="The patient just marked completed.")
    duration_minutes: int = Field(
        description="Actual consultation duration in whole minutes."
    )


class NoShowResponse(BaseModel):
    """Response body for POST /api/queue/no-show."""

    message: str
    patient: PatientResponse = Field(
        description="The patient marked as no_show."
    )


# ---------------------------------------------------------------------------
# WebSocket broadcast schemas (used in Phase 3)
# ---------------------------------------------------------------------------


class QueueSnapshot(BaseModel):
    """
    Full queue state payload embedded in every queue_updated WS event.

    Sent to all connected clients on every state change, and immediately
    on new connection (on-connect push).  Both the receptionist dashboard
    and the patient display re-render entirely from this snapshot — no
    per-client diffing needed.
    """

    patients: List[PatientResponse] = Field(
        description="All non-archived patients (waiting + in_consultation + recent completed)."
    )
    current_token: Optional[int] = Field(
        None, description="Token currently in consultation."
    )
    total_waiting: int
    settings: QueueSettingsResponse


class WSMessage(BaseModel):
    """
    WebSocket message envelope.

    Every message sent from server → client follows this structure.
    The client can switch on ``event`` to determine how to handle ``data``.

    Current events: 'queue_updated' (the only event in hackathon scope).
    """

    event: str = Field(description="Event name, e.g. 'queue_updated'.")
    data: QueueSnapshot
    timestamp: str = Field(
        description="ISO-8601 naive UTC string of when the event was generated."
    )

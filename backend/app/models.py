"""
backend/app/models.py

SQLAlchemy ORM models for Queue Cure.

Tables
------
Patient          — one row per patient visit; id doubles as the token number.
QueueSettings    — single-row (id=1) global configuration for the active queue.
ConsultationLog  — audit/analytics log of completed consultations.

Design decisions
----------------
Patient.id == token number:
    Using AUTOINCREMENT as the token eliminates the need for a separate
    ``last_token_issued`` counter in QueueSettings and removes the
    concurrent-write race that would arise if two simultaneous
    ``POST /api/patients`` requests read and incremented that counter at
    the same moment.  SQLite's AUTOINCREMENT guarantees uniqueness and
    strict monotonic increase (IDs are never reused even after deletes).

Status as a plain string column (not a DB enum):
    SQLite has no native ENUM type.  Using a CHECK constraint with a
    plain VARCHAR is the idiomatic SQLAlchemy approach and keeps the
    migration story simple if we ever move to PostgreSQL.

Timestamps — naive UTC:
    All DateTime columns store naive UTC datetimes.  SQLite stores datetimes
    as plain text (e.g. '2026-06-21 07:42:14.691489') and strips timezone
    info on round-trip, returning naive datetime objects regardless of what
    was written.  Using naive UTC consistently throughout avoids the
    TypeError: can't compare offset-naive and offset-aware datetimes that
    would otherwise crash the wait-time calculation in Phase 6.

    Convention: every datetime value in this codebase is naive UTC.
    Use _utcnow() for all application-generated timestamps.

QueueSettings singleton (id=1):
    The table is designed for exactly one row.  The application seed
    in main.py inserts this row on startup if it does not exist.
    Callers should always query with ``db.get(QueueSettings, 1)``.

ConsultationLog foreign key:
    Requires ``PRAGMA foreign_keys=ON``, which is applied in database.py
    on every new connection.
"""

import enum
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class PatientStatus(str, enum.Enum):
    """
    Lifecycle states for a patient in the queue.

    Inheriting from ``str`` means values serialise as plain strings in JSON
    (e.g. Pydantic models) without any extra configuration.

    Valid transitions:
        waiting → in_consultation  (call-next)
        waiting → no_show          (receptionist cancels before calling)
        in_consultation → completed (complete)
        in_consultation → no_show   (patient called but did not appear)
    """

    WAITING = "waiting"
    IN_CONSULTATION = "in_consultation"
    COMPLETED = "completed"
    NO_SHOW = "no_show"


# ---------------------------------------------------------------------------
# Timestamp helper
# ---------------------------------------------------------------------------


def _utcnow() -> datetime:
    """
    Return the current UTC time as a naive datetime.

    Naive UTC is used throughout because SQLite stores datetimes as plain text
    and strips timezone info on read, always returning naive datetimes.  Using
    naive UTC on both write and read keeps types consistent and prevents the
    TypeError: can't compare offset-naive and offset-aware datetimes that would
    otherwise occur in the wait-time calculation.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ---------------------------------------------------------------------------
# Patient
# ---------------------------------------------------------------------------


class Patient(Base):
    """
    Represents one patient visit in the queue.

    ``id`` is both the primary key and the displayed token number.  This
    design is intentional — see module docstring for the rationale.

    SQLite's SQLITE_INTEGER with autoincrement=True emits the AUTOINCREMENT
    keyword in DDL, guaranteeing that token numbers are strictly monotonically
    increasing and never reused, even if rows are physically deleted.

    All nullable timestamp columns are set by the application when the
    corresponding state transition occurs:
        called_at            — when the token is announced / called
        consultation_start   — when the patient physically enters the room
        consultation_end     — when the consultation is marked complete
    """

    __tablename__ = "patients"

    __table_args__ = (
        # Enforce the status domain at the database level so a bug in
        # application code cannot silently persist an invalid status.
        CheckConstraint(
            "status IN ('waiting', 'in_consultation', 'completed', 'no_show')",
            name="ck_patient_status",
        ),
        # Composite index covers the call-next query pattern:
        # WHERE status = 'waiting' ORDER BY created_at ASC
        # A single-column index on status is used for status-filter list queries.
        Index("ix_patients_status", "status"),
        Index("ix_patients_created_at", "created_at"),
    )

    # Primary key — also serves as the displayed token number.
    #
    # Note on AUTOINCREMENT: SQLAlchemy 2.x does not emit the AUTOINCREMENT
    # keyword in SQLite DDL regardless of the autoincrement= flag or dialect
    # type used (confirmed by investigation — this is an intentional SQLAlchemy
    # design decision for SQLite).  SQLite's INTEGER PRIMARY KEY already aliases
    # the rowid and auto-increments (max_rowid + 1).  The only difference is
    # that without AUTOINCREMENT, a deleted maximum ID could theoretically be
    # reused.  Risk for this app: ZERO — patients are never physically deleted;
    # they transition to 'completed' or 'no_show' status.  The only DELETE
    # endpoint marks rows as no_show before removing them.  If strict no-reuse
    # becomes a requirement post-hackathon, add an Alembic migration to recreate
    # the table with an explicit AUTOINCREMENT keyword via raw DDL.
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Auto-incrementing PK; used as the patient-facing token number.",
    )

    # Alias exposed to business logic so callers can refer to token_number
    # without knowing the id==token implementation detail.
    # This is a Python property, not a separate DB column.
    @property
    def token_number(self) -> int:
        """Alias for id — the patient-facing queue token."""
        return self.id

    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Patient's display name as entered by the receptionist.",
    )

    phone: Mapped[Optional[str]] = mapped_column(
        String(30),
        nullable=True,
        default=None,
        comment="Optional contact number; not used by core queue logic.",
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=PatientStatus.WAITING.value,
        comment="Lifecycle state: waiting | in_consultation | completed | no_show.",
    )

    # ------------------------------------------------------------------
    # Timestamps (all naive UTC — see module docstring)
    # ------------------------------------------------------------------

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        default=_utcnow,
        comment="Naive UTC timestamp when the patient was added to the queue.",
    )

    called_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        nullable=True,
        default=None,
        comment="Naive UTC timestamp when the token was called/announced.",
    )

    consultation_start: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        nullable=True,
        default=None,
        comment=(
            "Naive UTC timestamp when the consultation began (patient entered room). "
            "Used by wait_time.py: elapsed = utcnow() - consultation_start."
        ),
    )

    consultation_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        nullable=True,
        default=None,
        comment="Naive UTC timestamp when the consultation was marked complete.",
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    consultation_log: Mapped[Optional["ConsultationLog"]] = relationship(
        "ConsultationLog",
        back_populates="patient",
        uselist=False,  # one-to-one: each patient has at most one log entry
        cascade="all, delete-orphan",
    )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def __repr__(self) -> str:
        return (
            f"<Patient id={self.id} name={self.name!r} status={self.status!r}>"
        )


# ---------------------------------------------------------------------------
# QueueSettings
# ---------------------------------------------------------------------------


class QueueSettings(Base):
    """
    Single-row configuration table for the active queue.

    There is always exactly one row with id=1.  The application seed in
    main.py inserts it on startup if it is missing.

    ``current_token`` tracks which Patient.id is currently in_consultation so
    the receptionist UI and patient display can highlight it without querying
    the full patients table on every read.

    ``last_token_issued`` is kept for informational purposes (e.g. knowing
    the highest token generated today) but is NOT used to generate new tokens
    — that role belongs to Patient.id AUTOINCREMENT.
    """

    __tablename__ = "queue_settings"

    __table_args__ = (
        # Prevent setting a zero or negative consultation time, which would
        # produce nonsensical wait estimates (division anomaly or negative values).
        CheckConstraint(
            "avg_consultation_minutes > 0",
            name="ck_settings_avg_positive",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        default=1,
        comment="Always 1 — this table holds exactly one configuration row.",
    )

    avg_consultation_minutes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=10,
        comment=(
            "Receptionist-editable estimate of how long each consultation takes. "
            "Used by wait_time.py as the per-patient time unit in the formula. "
            "Must be > 0 (enforced by ck_settings_avg_positive)."
        ),
    )

    current_token: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        default=None,
        comment=(
            "Patient.id currently in_consultation, or NULL if the room is empty. "
            "Updated atomically by the call-next and complete/no-show handlers."
        ),
    )

    last_token_issued: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment=(
            "The highest Patient.id (token) issued so far. "
            "Informational only — new tokens are generated by AUTOINCREMENT, "
            "not by reading and incrementing this field."
        ),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        default=_utcnow,
        onupdate=_utcnow,
        comment="Naive UTC timestamp of the last settings change.",
    )

    def __repr__(self) -> str:
        return (
            f"<QueueSettings avg={self.avg_consultation_minutes}min "
            f"current_token={self.current_token}>"
        )


# ---------------------------------------------------------------------------
# ConsultationLog
# ---------------------------------------------------------------------------


class ConsultationLog(Base):
    """
    Audit log of completed consultations.

    One row per completed patient visit.  Populated by the complete-consultation
    handler in Phase 2 when a patient's status transitions to 'completed'.

    Primary use case (Phase 6): computing a rolling average of actual
    consultation durations to replace the static ``avg_consultation_minutes``
    setting with an empirically derived estimate.

    ``duration_minutes`` is stored as a rounded integer to keep the schema and
    UI simple; sub-minute precision is not meaningful for patient wait estimates.
    """

    __tablename__ = "consultation_log"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    patient_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # One log entry per patient visit.
        comment="FK to patients.id — the completed patient this log entry belongs to.",
    )

    duration_minutes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment=(
            "Actual consultation duration in whole minutes "
            "(consultation_end − consultation_start, rounded)."
        ),
    )

    logged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        default=_utcnow,
        comment="Naive UTC timestamp when this log entry was created.",
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    patient: Mapped["Patient"] = relationship(
        "Patient",
        back_populates="consultation_log",
    )

    def __repr__(self) -> str:
        return (
            f"<ConsultationLog patient_id={self.patient_id} "
            f"duration={self.duration_minutes}min>"
        )


# ---------------------------------------------------------------------------
# ArchivedPatient (History)
# ---------------------------------------------------------------------------


class ArchivedPatient(Base):
    """
    Historical log of patient visits archived upon queue reset.
    Stores pre-calculated metrics (wait times and durations) for auditing/analytics.
    """

    __tablename__ = "archived_patients"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    token_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Original token number (Patient.id) from the active queue.",
    )

    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    phone: Mapped[Optional[str]] = mapped_column(
        String(30),
        nullable=True,
        default=None,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Final status: waiting | in_consultation | completed | no_show.",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        comment="Arrival time.",
    )

    called_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        nullable=True,
    )

    consultation_start: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        nullable=True,
    )

    consultation_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        nullable=True,
    )

    wait_time_minutes: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="Wait duration in minutes: consultation_start - created_at, or now - created_at.",
    )

    consultation_duration_minutes: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="Consultation duration in minutes: consultation_end - consultation_start.",
    )

    archived_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        default=_utcnow,
        comment="Clinic day reset timestamp.",
    )

    def __repr__(self) -> str:
        return (
            f"<ArchivedPatient id={self.id} token={self.token_number} "
            f"name={self.name!r} status={self.status!r}>"
        )


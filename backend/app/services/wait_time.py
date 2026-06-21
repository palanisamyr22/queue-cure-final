from typing import Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Patient, PatientStatus, QueueSettings, ConsultationLog, _utcnow
import logging

logger = logging.getLogger(__name__)

def get_dynamic_avg_consultation(db: Session) -> int:
    """
    Calculate the rolling average of actual consultation durations from the last 20 completions.
    Fallback to QueueSettings.avg_consultation_minutes if insufficient data.
    """
    # Get baseline fallback
    settings = db.get(QueueSettings, 1)
    fallback = settings.avg_consultation_minutes if settings else 10

    # Get last 20 consultations
    logs = (
        db.query(ConsultationLog)
        .order_by(ConsultationLog.id.desc())
        .limit(20)
        .all()
    )
    
    if not logs:
        return fallback

    total_minutes = sum(log.duration_minutes for log in logs)
    return max(1, round(total_minutes / len(logs)))

def get_current_patient_remaining_time(db: Session, avg_minutes: int) -> int:
    """
    Calculate remaining time for the patient currently in consultation.
    remaining = max(avg_minutes - elapsed_minutes, 0)
    """
    current_patient = (
        db.query(Patient)
        .filter(Patient.status == PatientStatus.IN_CONSULTATION.value)
        .first()
    )

    if not current_patient or not current_patient.consultation_start:
        return 0

    elapsed_delta = _utcnow() - current_patient.consultation_start
    elapsed_minutes = int(elapsed_delta.total_seconds() / 60)
    
    return max(avg_minutes - elapsed_minutes, 0)

def calculate_wait_time_for_patient(db: Session, patient_id: int) -> Tuple[int, int]:
    """
    Returns (people_ahead, estimated_wait_minutes) for a specific waiting patient.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient or patient.status != PatientStatus.WAITING.value:
        return 0, 0

    # Count how many waiting patients are ahead of this one (older created_at)
    people_ahead = (
        db.query(func.count(Patient.id))
        .filter(Patient.status == PatientStatus.WAITING.value)
        .filter(Patient.created_at < patient.created_at)
        .scalar()
        or 0
    )

    dynamic_avg = get_dynamic_avg_consultation(db)
    remaining_time = get_current_patient_remaining_time(db, dynamic_avg)

    estimated_wait = remaining_time + (people_ahead * dynamic_avg)
    return people_ahead, estimated_wait

def calculate_walk_in_wait_time(db: Session) -> Tuple[int, int]:
    """
    Returns (people_ahead, estimated_wait_minutes) for a brand new arrival.
    Here, people_ahead equals the total number of waiting patients.
    """
    people_ahead = (
        db.query(func.count(Patient.id))
        .filter(Patient.status == PatientStatus.WAITING.value)
        .scalar()
        or 0
    )

    dynamic_avg = get_dynamic_avg_consultation(db)
    remaining_time = get_current_patient_remaining_time(db, dynamic_avg)

    estimated_wait = remaining_time + (people_ahead * dynamic_avg)
    return people_ahead, estimated_wait

import pytest
from concurrent.futures import ThreadPoolExecutor
from app.database import SessionLocal
from app.models import Patient, PatientStatus, QueueSettings

def test_concurrent_call_next(client):
    # Add 5 patients
    for i in range(5):
        client.post("/api/patients/", json={"name": f"Patient {i}"})
        
    def call_next():
        return client.post("/api/queue/call-next")
        
    # Simulate two receptionists furiously clicking 'Call Next' at the exact same millisecond
    with ThreadPoolExecutor(max_workers=2) as executor:
        future1 = executor.submit(call_next)
        future2 = executor.submit(call_next)
        
        r1 = future1.result()
        r2 = future2.result()
        
    # One should succeed, one should succeed for the NEXT patient
    # Wait, the lock makes them run sequentially.
    # So r1 will get Patient 0, r2 will get Patient 1.
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["patient"]["id"] != r2.json()["patient"]["id"]
    
def test_concurrent_call_next_empty(client):
    # Empty queue
    def call_next():
        return client.post("/api/queue/call-next")
        
    with ThreadPoolExecutor(max_workers=2) as executor:
        future1 = executor.submit(call_next)
        future2 = executor.submit(call_next)
        
        r1 = future1.result()
        r2 = future2.result()
        
    assert r1.status_code == 409
    assert r2.status_code == 409

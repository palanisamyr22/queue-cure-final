import pytest

def test_call_next_empty(client):
    # Empty queue should return 409 Conflict
    response = client.post("/api/queue/call-next")
    assert response.status_code == 409

def test_call_next_success(client):
    # Add patient
    client.post("/api/patients/", json={"name": "Patient 1"})
    
    # Call next
    response = client.post("/api/queue/call-next")
    assert response.status_code == 200
    data = response.json()
    assert data["patient"]["name"] == "Patient 1"
    assert data["patient"]["status"] == "in_consultation"
    assert data["settings"]["current_token"] == data["patient"]["id"]

def test_complete_consultation(client):
    # Add and call
    client.post("/api/patients/", json={"name": "Patient 2"})
    client.post("/api/queue/call-next")
    
    # Complete
    response = client.post("/api/queue/complete")
    assert response.status_code == 200
    data = response.json()
    assert data["patient"]["status"] == "completed"

def test_no_show_consultation(client):
    # Add and call
    client.post("/api/patients/", json={"name": "Patient 3"})
    client.post("/api/queue/call-next")
    
    # Mark no show
    response = client.post("/api/queue/no-show")
    assert response.status_code == 200
    assert response.json()["patient"]["status"] == "no_show"

def test_update_settings(client):
    response = client.put("/api/queue/settings", json={"avg_consultation_minutes": 15})
    assert response.status_code == 200
    assert response.json()["avg_consultation_minutes"] == 15

def test_queue_status_wait_time(client):
    # Add two patients
    client.post("/api/patients/", json={"name": "Patient 1"})
    client.post("/api/patients/", json={"name": "Patient 2"})
    
    status_resp = client.get("/api/queue/status")
    assert status_resp.status_code == 200
    assert status_resp.json()["total_waiting"] == 2
    
    # Get wait time for Patient 2
    # P1 is ahead, avg is 10 min
    wait_resp = client.get("/api/queue/wait-time/2")
    assert wait_resp.status_code == 200
    data = wait_resp.json()
    assert data["people_ahead"] == 1
    assert data["estimated_minutes"] == 10

import pytest

def test_add_patient_success(client):
    response = client.post("/api/patients/", json={"name": "John Doe", "phone": "1234567890"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "John Doe"
    assert data["status"] == "waiting"
    assert "token_number" in data

def test_add_patient_empty_name(client):
    response = client.post("/api/patients/", json={"name": "   "})
    assert response.status_code == 422

def test_list_patients(client):
    client.post("/api/patients/", json={"name": "John"})
    client.post("/api/patients/", json={"name": "Jane"})
    
    response = client.get("/api/patients/")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 2
    assert len(data["patients"]) >= 2
    
def test_get_patient(client):
    # Add a patient
    resp = client.post("/api/patients/", json={"name": "To Get"})
    patient_id = resp.json()["id"]
    
    # Get them
    get_resp = client.get(f"/api/patients/{patient_id}")
    assert get_resp.status_code == 200
    
    # Verify name
    patient = get_resp.json()
    assert patient["name"] == "To Get"
    assert patient["status"] == "waiting"

import pytest
from fastapi.testclient import TestClient

def test_websocket_snapshot_on_connect(client):
    with client.websocket_connect("/ws/queue") as websocket:
        data = websocket.receive_json()
        assert data["event"] == "queue_full_snapshot"
        assert "patients" in data["data"]
        assert "total_waiting" in data["data"]



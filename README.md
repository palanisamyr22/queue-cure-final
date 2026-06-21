# Queue Cure

Queue Cure is a modern, real-time clinic waitlist management system. It replaces stressful, opaque waiting room experiences with transparent, mathematically driven wait time estimates broadcast instantly to patients via WebSockets.

📚 **Documentation**:
*   [Architecture Blueprint](file:///c:/Users/palan/OneDrive/Documents/queue-cure/docs/ARCHITECTURE.md)
*   [Thought Process & Core Rationale](file:///c:/Users/palan/OneDrive/Documents/queue-cure/docs/THOUGHT_PROCESS.md)

---

## 🏥 Problem Statement
Clinical waiting rooms are notoriously frustrating. Patients frequently feel anxious because they don't know how many people are ahead of them or how much longer they will actually have to wait. Traditional digital queue systems rely on static "average time" multiplications, which become wildly inaccurate the moment a single consultation runs long.

Queue Cure solves this by:
1. Providing a **Receptionist Dashboard** for ultra-fast, keyboard-friendly patient onboarding.
2. Powering a massive, TV-ready **Patient Display Screen** that syncs across the room instantly.
3. Calculating **Dynamic Wait Times** using a rolling average of actual doctor performance minus the real-time elapsed duration of the patient currently in the room.

---

## ✨ Features
- **Real-Time WebSockets**: 100% of the Patient Display state is hydrated natively by an asynchronous WebSocket stream. No slow REST API polling.
- **Dynamic Elapsed-Time Math**: If a 10-minute average consultation reaches minute 8, the next patient's estimated wait instantly drops to 2 minutes, not 10.
- **Reactive UI/UX**: Keyboard-navigable fast-entry forms, massive typography for TV displays, accessibility alerts for screen readers, and automated reconnection routines for network drops.
- **Zero Race Conditions**: Strict backend mutex locking prevents ghost patients or double-calls when multiple receptionists operate concurrently.
- **Self-Healing Rolling Average**: Uses the last 20 ConsultationLog entries to adjust the wait time dynamically based on the doctor's actual speed for the day.

---

## 🏗️ Architecture Diagram

```mermaid
graph TD;
    A[Receptionist Screen] -->|POST /call-next| B[FastAPI Backend];
    B -->|Commit to DB| C[(SQLite DB)];
    C -->|Trigger Hook| B;
    B -->|queue_updated (JSON)| D[WebSocket Manager];
    D -->|Broadcast| E[Patient TV Display];
    D -->|Broadcast| F[Mobile Web Clients];
```

---

## 📁 Folder Structure
```text
queue-cure/
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI entry point & lifespan
│   │   ├── database.py            # SQLite connection
│   │   ├── models.py              # SQLAlchemy ORM definitions
│   │   ├── schemas.py             # Pydantic validation (REST & WS)
│   │   ├── websocket_manager.py   # Connection pool & broadcasting
│   │   ├── routers/               # REST API & WS endpoints
│   │   └── services/
│   │       └── wait_time.py       # Rolling avg & dynamic elapsed math
│   ├── tests/                     # 13x Pytest Automation Suite
│   ├── render.yaml                # Render Platform deployment blueprint
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx                # React Router setup
    │   ├── pages/
    │   │   ├── ReceptionistDashboard.jsx
    │   │   └── PatientDisplay.jsx
    │   ├── components/            # Isolated view components
    │   ├── hooks/
    │   │   └── useWebSocket.js    # Custom self-healing WS hook
    │   └── services/
    │       └── api.js             # REST API fetch wrappers
    ├── vercel.json                # Vercel SPA routing
    └── package.json               # Vite + React + TailwindCSS
```

---

## 🚀 Local Development & Installation

### 1. Backend Setup
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
```
Copy `.env.example` to `.env` if desired, then start the server:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
```
*(Note: `--workers 1` is strictly required for the in-memory WebSocket ConnectionManager).*

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

*   **Receptionist Dashboard**: Available at `http://localhost:5173/receptionist` (automatically redirects to `/login` if unauthenticated).
    *   **Demo Credentials**:
        *   **Username**: `receptionist`
        *   **Password**: `QueueCure2026`
*   **Patient Display Screen**: Available at `http://localhost:5173/patient` (publicly accessible).

---

## 🌐 Deployment Steps

### Backend (Render)
Queue Cure is configured for Render Web Services.
1. Connect your repository to Render.
2. Select **Blueprint** and point to `backend/render.yaml`.
3. Render will automatically provision a Python environment with a 1GB persistent disk for `queue_cure.db`.

### Frontend (Vercel)
Queue Cure is configured for Vercel.
1. Connect your repository to Vercel.
2. Set the Framework Preset to **Vite**.
3. Add the following Environment Variables in the Vercel dashboard:
   - `VITE_API_URL` = `https://<your-render-app>.onrender.com`
   - `VITE_WS_URL` = `wss://<your-render-app>.onrender.com/ws/queue`
4. Deploy. The `vercel.json` file automatically handles React Router SPA fallbacks.

---

## 📡 API Reference

### REST Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/patients/` | Add a new walk-in patient. |
| POST | `/api/queue/call-next` | Complete current consultation & promote the next waiting token. |
| POST | `/api/queue/complete` | Mark the current consultation complete without promoting. |
| POST | `/api/queue/no-show` | Mark the current consultation as a no-show. |
| GET | `/api/queue/status` | Fetch total waiting and walk-in wait times. |

### WebSocket Events
Endpoint: `/ws/queue`

**`queue_full_snapshot`** (Fired instantly upon connection)
**`queue_updated`** (Fired instantly after any REST DB mutation)
```json
{
  "event": "queue_updated",
  "data": {
    "patients": [
      {
        "id": 1,
        "token_number": 1,
        "name": "Jane Doe",
        "status": "waiting",
        "people_ahead": 0,
        "estimated_wait_minutes": 5
      }
    ],
    "current_token": 12,
    "total_waiting": 1,
    "settings": { ... }
  },
  "timestamp": "2026-06-21T10:00:00.000"
}
```

---

## 🎬 Hackathon Demo Instructions (2-3 Minutes)

Follow this script to perfectly showcase all major hackathon criteria:

1. **Split Screen Setup**: Put the Receptionist Dashboard on the left and the Patient Display on the right.
2. **Fast Entry**: Click into the Receptionist "Patient Name" field. Type "Alice" and press Enter. Then type "Bob" and press Enter. Point out that the focus automatically returns to the input field for maximum clinic efficiency.
3. **Wait Times in Action**: Point out the Patient Display on the right. Notice that Bob's estimated wait time is mathematically calculated based on the fact that Alice is ahead of him.
4. **Call Next (WebSockets)**: Click "Call Next Patient" on the Receptionist Dashboard. Watch the Patient Display instantly animate. Alice moves to the "Now being served" massive card, and Bob moves to "You are next". Note that you never refreshed the right-side page.
5. **No-Show Handling**: Click "Mark No-Show". Watch Alice disappear from the queue, allowing you to call Bob next.
6. **Graceful Reconnect**: Kill your terminal running the backend `uvicorn` server. Show the judges the instant "Offline" red indicator on the TV screen. Restart the terminal. Show the TV automatically recovering the connection without user intervention.

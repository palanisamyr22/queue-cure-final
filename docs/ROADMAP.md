# Queue Cure — Development Roadmap

> **Post-Review Roadmap** (integrates all architecture review fixes)  
> Target: ~24–30 hr hackathon. Compress proportionally if shorter.

---

## Phase 1: Database

**Hours**: 0–2  
**Dependencies**: None — foundation layer.

### Files to Create
- `backend/app/database.py` — SQLAlchemy engine, session factory, WAL journal mode pragma
- `backend/app/models.py` — `Patient` and `QueueSettings` ORM models

### Purpose
Define the persistent schema and lock in two key decisions from the architecture review:
1. Token number = `Patient.id` (AUTOINCREMENT) — removes the duplicate-token race condition
2. `journal_mode=WAL` — reduces "database is locked" errors under concurrent writes

### Implementation Notes
- Create tables on app startup (not via migrations — hackathon scope)
- Seed `queue_settings` row (id=1) if it doesn't exist
- Verify WAL is set correctly on every connection open

---

## Phase 2: FastAPI Backend (REST)

**Hours**: 2–6  
**Dependencies**: Phase 1

### Files to Create
- `backend/app/main.py` — FastAPI app instance, CORS middleware, router mounting, startup hook, `/health` endpoint
- `backend/app/schemas.py` — Pydantic I/O models for all request/response shapes
- `backend/app/routers/patients.py` — `POST /api/patients`, `GET /api/patients`, `GET /api/patients/{id}`, `DELETE /api/patients/{id}`
- `backend/app/routers/queue.py` — `POST /api/queue/call-next` (with lock guard), `POST /api/queue/complete`, `POST /api/queue/no-show`, `PUT /api/queue/settings`, `GET /api/queue/settings`, `GET /api/queue/status`, `GET /api/queue/wait-time/{token}`
- `backend/requirements.txt`

### Purpose
Expose all patient CRUD and queue control via REST. Implement the two concurrency edge cases from the review:
1. **Transaction/lock guard** inside `call-next` — prevents double-advance from double-click or two open receptionist tabs
2. **Explicit `no_show` and empty-queue response paths** — covers the judge-facing edge cases (15% weight)

`/health` exists for Render's uptime health check.

### Implementation Notes
- All state-changing endpoints must call `websocket_manager.broadcast()` after committing (stub the call in Phase 2, wire it in Phase 3)
- `call-next` must be atomic: read current state + write new state in one transaction
- Return clear error responses (not 500s) for empty queue, already-completed token, etc.

---

## Phase 3: WebSocket Server

**Hours**: 6–9  
**Dependencies**: Phase 2

### Files to Create
- `backend/app/websocket_manager.py` — `ConnectionManager` class: `connect()`, `disconnect()`, `broadcast()`, `send_current_state()` (on-connect snapshot)
- `backend/app/routers/ws.py` — `/ws/queue` endpoint registration

### Purpose
Real-time fan-out of `queue_updated` on every successful state change. Key behaviors:
1. **On-connect push**: immediately sends the current full snapshot to any newly connected client — the fix for stale/empty screens on load or reconnect
2. **Auto-reconnect support**: clients should reconnect with exponential backoff; the on-connect push makes reconnection seamless
3. **Single-worker enforcement**: documented in `render.yaml` start command (`--workers 1`)

### Implementation Notes
- Wire the `broadcast()` stub calls from Phase 2 routers to the real manager
- WS event envelope: `{ "event": "queue_updated", "data": {...}, "timestamp": "ISO-8601" }`
- `data` payload = `{ patients: [...], current_token: int|null, settings: {...} }`
- Handle client disconnects gracefully (remove from pool, no crash)

---

## Phase 4: Receptionist React Screen

**Hours**: 9–14  
**Dependencies**: Phase 2 (REST contract), Phase 3 (WS event shape)  
**Parallelizable with**: Phase 5 (if two developers)

### Files to Create
- `frontend/src/services/api.js` — REST client wrapper (fetch or axios), base URL from env var
- `frontend/src/hooks/useWebSocket.js` — connect, reconnect-with-backoff, message handler; shared by both screens
- `frontend/src/pages/ReceptionistDashboard.jsx` — page layout, state management, WS subscription
- `frontend/src/components/receptionist/AddPatientForm.jsx` — name + phone input, POST /api/patients
- `frontend/src/components/receptionist/QueueTable.jsx` — live table of waiting/in-consultation patients
- `frontend/src/components/receptionist/CallNextButton.jsx` — POST /api/queue/call-next
- `frontend/src/components/receptionist/ConsultationTimeSetting.jsx` — editable avg minutes, PUT /api/queue/settings
- `frontend/src/components/receptionist/RecallNoShowButton.jsx` — POST /api/queue/no-show (judge-facing edge case)

### Purpose
Operational control surface. Wires REST actions to the backend and subscribes to WS for live table refresh without polling.

### Implementation Notes
- `useWebSocket.js` must be generic enough to reuse in Phase 5 with no modification
- Queue table re-renders purely from WS `queue_updated` data — no separate GET polling
- Add patient form should clear/reset on successful submission
- Disable "Call Next" while a request is in flight to prevent double-submit

---

## Phase 5: Patient React Screen

**Hours**: 9–14 (parallel with Phase 4)  
**Dependencies**: Phase 3 (WS), `useWebSocket.js` from Phase 4

### Files to Create
- `frontend/src/pages/PatientDisplay.jsx` — page layout, WS subscription, derived state
- `frontend/src/components/patient/CurrentTokenCard.jsx` — large display of the currently-called token
- `frontend/src/components/patient/PeopleAheadCounter.jsx` — for a given patient's token
- `frontend/src/components/patient/WaitTimeBadge.jsx` — estimated minutes badge
- `frontend/src/components/patient/ConnectionStatusIndicator.jsx` — live/reconnecting/disconnected badge (polish + safety net)
- `frontend/src/components/patient/TokenChangeAlert.jsx` — chime + visual flash when `current_token` changes (judge-facing demo feature)

### Purpose
Read-only live display for patients in the waiting area. Designed to be clearly visible on a large screen. All data comes from the WS `queue_updated` event — no REST calls except for the initial wait-time query if a patient knows their token.

### Implementation Notes
- `ConnectionStatusIndicator` is a small but high-visibility polish feature — shows "LIVE" or "Reconnecting..." to judges
- `TokenChangeAlert` should play a soft audio chime and briefly flash the card — extremely demo-able with two screens side by side
- Screen should handle the empty-queue state gracefully ("No patients currently waiting")

---

## Phase 6: Wait Time Calculation

**Hours**: 14–17  
**Dependencies**: Phase 1 (timestamp columns), Phase 2 (endpoints), Phase 3 (must be included in WS broadcast)

### Files to Create / Modify
- **CREATE**: `backend/app/services/wait_time.py` — wait time calculation logic
- **MODIFY**: `backend/app/routers/queue.py` — call the service from `/api/queue/status` and `/api/queue/wait-time/{token}`, include result in broadcast payload

### Purpose
Implement the "true dynamic" formula from the review (not the static `people_ahead × avg` version):

```
estimated_minutes =
  max(0, avg_consultation_minutes − elapsed_time_of_current_patient)
  + people_ahead × avg_consultation_minutes
```

- `elapsed_time_of_current_patient` = `now − consultation_start`
- Optionally: evolve `avg_consultation_minutes` into a rolling average of last N actual durations

### Implementation Notes
- Calculation runs server-side and rides along in the `queue_updated` broadcast
- The rolling average (stretch goal) requires reading `consultation_end − consultation_start` from past completed patients
- Edge cases: no current patient (current_token is null), single remaining patient, settings change mid-consultation

---

## Phase 7: Testing

**Hours**: 17–20 (formal pass; smoke tests run throughout)  
**Dependencies**: Phases 1–6 functionally complete

### Files to Create
- `backend/tests/test_patients.py` — patient CRUD, token generation
- `backend/tests/test_queue.py` — call-next, complete, no-show, settings, status
- `backend/tests/test_websocket.py` — connect, on-connect snapshot, broadcast on state change
- `backend/tests/test_concurrency.py` — double "call-next" race, concurrent add-patient race
- `frontend/TEST_CHECKLIST.md` — manual multi-tab sync checklist for two-screen demo

### Purpose
Automated tests focus on concurrency-sensitive logic only — that's where invisible bugs hide. Manual testing (two browser windows: receptionist + patient side by side) is the fastest way to validate live sync.

### Manual Checklist (key scenarios)
- [ ] Patient screen loads mid-queue → shows correct state immediately
- [ ] Patient screen reconnects after simulated disconnect → recovers within 3 seconds
- [ ] Double-click "Call Next" → only advances once
- [ ] Two receptionist tabs open → both update live
- [ ] Mark no-show → queue advances correctly
- [ ] Empty queue → no error, graceful UI state
- [ ] Settings change mid-consultation → wait time updates live

---

## Phase 8: Deployment

**Hours**: 20–23  
**Dependencies**: All prior phases working locally

### Files to Create / Configure
- `backend/render.yaml` — start command pinned to single worker: `uvicorn app.main:app --workers 1 --host 0.0.0.0 --port $PORT`
- `frontend/vercel.json` — SPA routing config (redirect all paths to `index.html`)
- `backend/.env.example` — `DATABASE_URL`, `CORS_ORIGINS`
- `frontend/.env.example` — `VITE_API_URL`, `VITE_WS_URL`

### Purpose
Ship backend to Render (single worker + persistent disk for SQLite) and frontend to Vercel (static build).

### Critical Deployment Checks
- [ ] Backend `--workers 1` enforced in `render.yaml`
- [ ] SQLite file path points to Render persistent disk mount
- [ ] `VITE_WS_URL` uses `wss://` in production (not `ws://`)
- [ ] CORS origins include the Vercel production domain
- [ ] `/health` returns 200 for Render uptime health check
- [ ] End-to-end test: receptionist add patient → patient screen updates within 1 second

> ⚠️ **Highest-risk item**: `ws://` vs `wss://` protocol mismatch. Smoke-test the WS connection to Render from a browser as early as Phase 3, not here for the first time.

---

## Timing & Parallel Tracks

| Phase | Hours | Can Parallelize With |
|---|---|---|
| 1. Database | 0–2 | — |
| 2. Backend REST | 2–6 | — |
| 3. WebSocket Server | 6–9 | — |
| 4. Receptionist Screen | 9–14 | Phase 5 (2nd developer) |
| 5. Patient Screen | 9–14 | Phase 4 (1st developer) |
| 6. Wait Time Calc | 14–17 | — |
| 7. Testing | 17–20 | Smoke tests run throughout |
| 8. Deployment | 20–23 | — |

Phases 1–3 are strictly sequential (single backend developer, critical path).  
Once the WS contract is frozen at end of Phase 3, a second team member can pick up Phase 5 while the first builds Phase 4.

---

## De-risk Priority Order

If time is tight, fix in this order:

1. **Single-worker pin** → protects the 40%-weighted live sync criterion
2. **WS on-connect snapshot push** → ensures screens are never stale on load/reconnect
3. **call-next race guard** → prevents double-advance corruption
4. **Empty-queue explicit response** → prevents receptionist UI error/hang
5. **Improved wait-time formula** (elapsed-time-aware) → wins points with judges
6. **Audio cue on token change** → highly demo-able polish

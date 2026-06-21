# Queue Cure — Architecture Document

> **Status**: Approved. This document is the single source of truth for all design and implementation decisions.  
> Do not redesign the project without updating this document and obtaining team approval.

---

## 1. Folder Structure

```
queue-cure/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app + CORS + router mounting
│   │   ├── database.py              # SQLite connection/session
│   │   ├── models.py                # SQLAlchemy models
│   │   ├── schemas.py               # Pydantic request/response models
│   │   ├── websocket_manager.py     # Connection pool + broadcast()
│   │   ├── routers/
│   │   │   ├── patients.py          # add/list/cancel patient
│   │   │   ├── queue.py             # call-next, complete, settings, status
│   │   │   └── ws.py                # WS endpoint registration
│   │   └── services/
│   │       └── wait_time.py         # wait-time calculation logic
│   ├── requirements.txt
│   └── render.yaml                  # Render deploy config
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ReceptionistDashboard.jsx
│   │   │   └── PatientDisplay.jsx
│   │   ├── components/
│   │   │   ├── receptionist/        # AddPatientForm, QueueTable, CallNextButton, ConsultTimeSetting, RecallNoShowButton
│   │   │   └── patient/             # CurrentTokenCard, PeopleAheadCounter, WaitTimeBadge, ConnectionStatusIndicator, TokenChangeAlert
│   │   ├── hooks/
│   │   │   └── useWebSocket.js      # single hook, used by both screens
│   │   ├── services/
│   │   │   └── api.js               # REST client (fetch/axios wrapper)
│   │   ├── App.jsx                  # routes: /receptionist, /patient
│   │   └── main.jsx
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── vercel.json                  # Vercel deploy config
│
├── docs/
│   ├── ARCHITECTURE.md              # This file
│   └── ROADMAP.md
│
└── README.md
```

---

## 2. Database Schema (SQLite)

### `patients`

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | Also used as token_number (removes duplicate-token race) |
| name | TEXT | |
| phone | TEXT NULL | optional |
| status | TEXT | `waiting` \| `in_consultation` \| `completed` \| `no_show` |
| created_at | DATETIME | |
| called_at | DATETIME NULL | |
| consultation_start | DATETIME NULL | |
| consultation_end | DATETIME NULL | |

> **Design decision**: `id` doubles as the token number. Eliminates the `last_token_issued` field and its associated concurrent-write race condition.

### `queue_settings` (single row, id=1)

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | always 1 |
| avg_consultation_minutes | INTEGER | default 10, receptionist-editable |
| current_token | INTEGER NULL | token currently `in_consultation` |
| updated_at | DATETIME | |

> `consultation_log` table is deferred (stretch goal / post-hackathon analytics only).

---

## 3. API Endpoint List

### Patients

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/patients` | Add patient → auto-generates token |
| GET | `/api/patients` | List queue (filter by `?status=`) |
| GET | `/api/patients/{id}` | Single patient detail |
| DELETE | `/api/patients/{id}` | Cancel / mark no-show |

### Queue Control (Receptionist)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/queue/call-next` | Completes current, promotes next waiting → in_consultation |
| POST | `/api/queue/complete` | Marks current in_consultation → completed |
| POST | `/api/queue/no-show` | Marks current token as no_show, does not advance |
| PUT | `/api/queue/settings` | Update avg_consultation_minutes |
| GET | `/api/queue/settings` | Fetch current settings |

### Patient-Facing (read-only)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/queue/status` | `{ current_token, total_waiting, avg_consultation_minutes }` |
| GET | `/api/queue/wait-time/{token}` | `{ people_ahead, estimated_minutes }` |

### System

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Render health check — returns `{ "status": "ok" }` |

> Every state-changing POST/PUT/DELETE also triggers a WebSocket broadcast. That is the sync mechanism.

---

## 4. WebSocket Event Design

**Endpoint**: `WS /ws/queue`

Both screens connect to the same socket. No separate channels needed for a single-counter hackathon scope.

**Envelope**:
```json
{ "event": "<name>", "data": {...}, "timestamp": "ISO-8601" }
```

### Server → Client (broadcast + on-connect push)

| Event | Payload | Sent when |
|---|---|---|
| `queue_updated` | Full snapshot: `{ patients[], current_token, settings }` | On every state change AND immediately on new connection |

### Client → Server

None required. Receptionist actions go through REST; the WS connection is purely a read-only broadcast feed.

> **Design call**: One fat `queue_updated` event instead of granular events. One event type = one client-side handler = far less to debug under hackathon time pressure.

---

## 5. Project Architecture Diagram

```
┌─────────────────────────┐        ┌─────────────────────────┐
│   Receptionist Screen    │        │     Patient Screen        │
│  (React, /receptionist)  │        │   (React, /patient)       │
│  - Add patient form      │        │  - Current token          │
│  - Queue table           │        │  - People ahead           │
│  - Call Next button      │        │  - Est. wait time         │
│  - No-show / Recall      │        │  - Connection indicator   │
└────────────┬─────────────┘        └────────────┬─────────────┘
             │ REST (POST/PUT/DELETE)             │ WS only (read)
             │                                    │
             └──────────────┬─────────────────────┘
                            │  WS: queue_updated (broadcast + on-connect push)
                ┌───────────▼───────────┐
                │   FastAPI Backend       │
                │  ┌───────────────────┐ │
                │  │ REST Routers       │ │
                │  │ patients / queue   │ │
                │  └─────────┬─────────┘ │
                │  ┌─────────▼─────────┐ │
                │  │ Wait-Time Service  │ │
                │  └─────────┬─────────┘ │
                │  ┌─────────▼─────────┐ │
                │  │ WebSocket Manager  │─┼──► broadcasts to all
                │  │ (in-process pool)  │ │     connected clients
                │  └─────────┬─────────┘ │
                └────────────┼───────────┘
                              │
                     ┌────────▼────────┐
                     │   SQLite DB      │
                     │ patients,        │
                     │ queue_settings   │
                     └──────────────────┘

Deployment:
  Receptionist + Patient Screens ──► Vercel (static build)
  FastAPI + WebSocket Manager     ──► Render (single worker web service)
  SQLite file                     ──► Render persistent disk
```

---

## 6. Critical Design Decisions

| Decision | Rationale |
|---|---|
| `id` = token number | Eliminates `last_token_issued` field and concurrent-write race |
| Single worker (`--workers 1`) | WS connection pool is in-memory; multiple workers = silent broadcast failure |
| WAL journal mode | Reduces SQLite "database is locked" errors under concurrent writes |
| On-connect WS snapshot | Screens that load mid-queue or reconnect are never stale |
| Lock on call-next | Prevents double-advance from double-click or two receptionist tabs |
| One `queue_updated` event | Simplest client handler; easy to debug under time pressure |
| No auth | Judges score queue behavior, not access control |
| No multi-doctor | Adds schema/UI complexity for zero scoring upside |

---

## 7. Wait-Time Formula

```
estimated_minutes =
  max(0, avg_consultation_minutes − elapsed_time_of_current_patient)
  + people_ahead × avg_consultation_minutes
```

- `elapsed_time_of_current_patient` = `now − consultation_start` of the patient currently `in_consultation`
- `avg_consultation_minutes` = optionally a rolling average of last N actual durations (stretch goal)
- Recalculated server-side on every `queue_updated` broadcast

---

## 8. Deployment Checklist

- [ ] Backend running with `--workers 1`
- [ ] SQLite file on Render persistent disk (not ephemeral storage)
- [ ] Frontend env var `VITE_API_URL` points to Render HTTPS URL
- [ ] Frontend env var `VITE_WS_URL` uses `wss://` (not `ws://`)
- [ ] CORS origins on backend include Vercel domain
- [ ] `/health` returns 200 for Render health checks

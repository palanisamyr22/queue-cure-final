# Queue Cure — Design Thought Process & Core Rationale

This document presents the detailed engineering decisions, concurrency designs, and problem-solving rationales that drove the architecture of **Queue Cure**.

---

## 1. Dynamic Wait-Time Calculation Strategy
Traditional clinical displays use static wait times (e.g. `number of people ahead * 10 minutes`). This becomes inaccurate immediately if a consultation runs long. Queue Cure implements a two-layered dynamic wait-time engine:

*   **Empirical Performance (Rolling Average)**: The system tracks actual consultation times by recording completion durations in a `ConsultationLog` table. It computes a rolling average of the last 20 consultations ($T_{avg}$) to dynamically represent the doctor's actual speed for the day.
*   **Active Elapsed Duration Subtraction**: If a patient enters the room, the backend tracks their start time. The remaining duration of the active consultation is calculated as:
    $$T_{remaining} = \max(0, T_{avg} - T_{elapsed})$$
    where $T_{elapsed} = \text{Current Time} - T_{start}$.
*   **Sequential Accumulation**: For any waiting patient $i$ with $P_i$ people ahead of them, their estimated wait time is:
    $$\text{Wait Estimate}_i = T_{remaining} + (P_i \times T_{avg})$$

This ensures that the patient display screen updates automatically in real-time, reflecting changes as doctors run behind or ahead of schedule.

---

## 2. Real-Time Synchronization via WebSockets
To meet the 40%-weighted hackathon requirement of instant screen updates across multiple monitors without manual refreshes:

*   **WebSocket Broadcast Feed**: Both the Receptionist Dashboard and Patient Display Screen open a persistent WebSocket connection to `/ws/queue`.
*   **State-Changing REST Triggers**: All receptionist actions (adding patients, promotions, completions, cancellations, no-shows, and settings changes) occur via standard REST endpoints.
*   **Instant Hydration Snapshot**: Upon any write commit, a hook triggers the WebSocket Manager to broadcast a full queue state snapshot (`queue_updated` event) to all connected clients.
*   **Self-Healing Connections**: The client-side WebSocket hook (`useWebSocket.js`) incorporates automated reconnection logic with a 3-second delay, ensuring the screens recover instantly if local connections drop.

---

## 3. Concurrency & Data Integrity Protection
Clinics are high-pressure environments where multiple receptionists may manage the queue concurrently, leading to potential race conditions:

*   **The Single-Worker Constraint**: The WebSocket connection manager resides in-process. Running multiple Uvicorn worker threads would partition the connection pool, breaking the live broadcast. Thus, the system is strictly pinned to `--workers 1`.
*   **Call-Next Mutual Exclusion**: To prevent double-calling a patient if a receptionist double-clicks the "Call Next" button or has two dashboard tabs open, a process-level `threading.Lock` serializes execution of the promotion route.
*   **SQLite WAL Journal Mode**: SQLite defaults to rollback journal mode, which locks the database during writes. We apply `PRAGMA journal_mode=WAL` (Write-Ahead Logging) on every new database connection. This permits concurrent reader threads to scan queue tables while a writer commit is occurring, preventing "database is locked" errors.
*   **Monotonic Token Generation**: Patient `id` is used directly as the display token number. By relying on SQLite's AUTOINCREMENT primary keys, we eliminate the need for a separate tracking counter in settings, removing concurrent generation conflicts entirely.

---

## 4. Receptionist Dashboard Speed & UX Safety
A receptionist dashboard must support quick, mistake-proof data entry:

*   **Autofocus Refocus Loop**: On submit, the name input field is immediately refocused using a React `useRef` timer loop, letting the receptionist register consecutive patients quickly.
*   **Destructive Guard Rails**: Actions such as cancelling waiting patients, marking no-shows, and resetting settings prompt standard confirmation dialogs (`window.confirm`) to prevent accidental clicks.
*   **Conditional Button Disabling**: The "Call Next Patient" action is disabled instantly if the queue is empty or if the connection status is offline, preventing invalid backend requests.

---

## 5. Lightweight Hackathon Authentication Strategy
A secure but easy-to-demonstrate authentication layer is vital for hackathons:

*   **Credential Verification**: Single-user credentials (`receptionist` / `QueueCure2026`) are verified client-side.
*   **Persistent Storage Session**: Successful logins store `admin_authenticated = "true"` and `admin_username = "receptionist"` in `localStorage`, maintaining the session across page refreshes.
*   **Route Redirection**: The `/receptionist` route is protected by a `<ProtectedRoute>` component which redirects unauthorized clients to `/login`. The `/patient` display screen is kept entirely public so it can be shown on general clinic monitors.

---

## 6. Voice Announcement System & Audio Security
To make the waiting room experience as accessible and hands-free as possible, we implemented a browser-native voice call system:

*   **Browser-Native Web Speech Synthesis**: Uses the `window.speechSynthesis` API. This avoids latency and costs associated with external cloud text-to-speech services, which is ideal for a hackathon.
*   **State-Change Debouncing**: On loading or reconnecting to a WebSocket, the state is hydrated. To prevent replaying announcements of active tokens on page refreshes or connection recover events, a load ref `isFirstLoadRef.current` filters out the first snapshot trigger. Announcements are only read aloud when the server transmits a transition to a different, non-null patient token ID.
*   **Persistent Mute Controls**: Because clinics might need to silence voice calls during quiet hours, we added an toggle button directly in the patient header, saving state preference locally (`localStorage.setItem('voice_announcements_enabled')`) so it is respected across refreshes.


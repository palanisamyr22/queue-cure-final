# Queue Cure - Manual Test Checklist

Use this checklist to manually verify the End-to-End behavior of the application before deployment. These tests complement the automated backend test suite.

## Environment Setup
1. Start the backend: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1`
2. Start the frontend: `cd frontend && npm run dev`
3. Open two browser windows side-by-side:
   - Window A (Receptionist): `http://localhost:5173/receptionist`
   - Window B (Patient Screen): `http://localhost:5173/`

## 1. Receptionist Screen

### Add Patient
- [ ] Type a patient name into the input field and press `Enter` (or click Add).
- [ ] Verify the patient appears instantly at the bottom of the Queue Table.
- [ ] Verify the input field regains focus automatically for quick data entry.
- [ ] Verify the "Add" button is disabled if the name field is empty or whitespace.

### Call Next
- [ ] Click "Call Next Patient" when the room is empty.
- [ ] Verify the first waiting patient moves to the "in_consultation" status.
- [ ] Verify the Call Next button correctly promotes the *next* patient in line if clicked again.

### Complete Consultation
- [ ] Click "Complete Current Consultation".
- [ ] Verify the currently serving patient disappears from the active table (or their status updates to completed).

### No-Show Handling
- [ ] Click "Mark No-Show" for an active consultation.
- [ ] Verify the patient is removed from active service without auto-promoting the next patient in the queue.

## 2. Patient Screen (WebSocket & Real-time Sync)

### Current Token Updates
- [ ] When the Receptionist clicks "Call Next", verify Window B updates instantly without a page refresh.
- [ ] Verify the massive token number at the top of the Patient Screen displays the correct active token.

### Wait Time Updates
- [ ] Verify the "People Ahead" counter matches the exact number of waiting patients.
- [ ] Add a new patient and verify the "Estimated Wait" badge correctly calculates the wait time based on the active average.
- [ ] Call the next patient and verify the next person in line's badge immediately updates to a pulsing "You are next".

### Token Change Alerts
- [ ] When a new patient is called, verify the green banner ("Now Serving: Token X") drops down from the top.
- [ ] Verify the banner dismisses automatically after 5 seconds.
- [ ] (Accessibility) Verify a screen reader announces the alert when the banner drops down.

### Reconnection Behavior
- [ ] Stop the backend `uvicorn` server process.
- [ ] Verify the Patient Screen instantly displays a red "Offline" / "Reconnecting..." indicator.
- [ ] Restart the backend server.
- [ ] Verify the Patient Screen automatically reconnects and re-hydrates the latest snapshot seamlessly.

## 3. Concurrency (End-to-End)
- [ ] Open a third window (Window C) pointing to the Receptionist dashboard.
- [ ] Click "Call Next" simultaneously in Window A and Window C.
- [ ] Verify the system handles the race condition gracefully (no duplicate active patients).

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ReceptionistDashboard from './pages/ReceptionistDashboard';
import PatientDisplay from './pages/PatientDisplay';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/receptionist" 
          element={
            <ProtectedRoute>
              <ReceptionistDashboard />
            </ProtectedRoute>
          } 
        />
        <Route path="/patient" element={<PatientDisplay />} />
        <Route path="/login" element={<Login />} />
        {/* Default to Receptionist route which will auto-redirect to /login if unauthenticated */}
        <Route path="*" element={<Navigate to="/receptionist" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

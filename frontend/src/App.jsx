import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ReceptionistDashboard from './pages/ReceptionistDashboard';
import PatientDisplay from './pages/PatientDisplay';
import Login from './pages/Login';
import Landing from './pages/Landing';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/landing" element={<Landing />} />
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
        {/* Default to the Landing page */}
        <Route path="/" element={<Navigate to="/landing" replace />} />
        <Route path="*" element={<Navigate to="/landing" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

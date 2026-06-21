import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { api } from '../services/api';
import AddPatientForm from '../components/receptionist/AddPatientForm';
import QueueTable from '../components/receptionist/QueueTable';
import CallNextButton from '../components/receptionist/CallNextButton';
import ConsultationTimeSetting from '../components/receptionist/ConsultationTimeSetting';
import ResetButton from '../components/receptionist/ResetButton';
import HistorySection from '../components/receptionist/HistorySection';
import { Wifi, WifiOff, Users, UserCheck, UserX, LogOut } from 'lucide-react';

export default function ReceptionistDashboard() {
  const navigate = useNavigate();
  const { snapshot, isConnected, error } = useWebSocket();
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const handleResetSuccess = () => setHistoryRefresh(c => c + 1);

  const username = localStorage.getItem('admin_username') || 'receptionist';

  const handleLogout = () => {
    localStorage.removeItem('admin_authenticated');
    localStorage.removeItem('admin_username');
    navigate('/login', { replace: true });
  };

  const handleComplete = async () => {
    try {
      await api.completeConsultation();
    } catch (err) {
      alert(err.message || 'Failed to complete consultation');
    }
  };

  const handleNoShow = async () => {
    if (!window.confirm("Mark current patient as No Show?")) return;
    try {
      await api.markNoShow();
    } catch (err) {
      alert(err.message || 'Failed to mark no-show');
    }
  };

  // If initial connection hasn't returned a snapshot yet
  if (!snapshot && isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Connecting to Queue Server...</p>
        </div>
      </div>
    );
  }

  const { patients = [], current_token, total_waiting = 0, settings } = snapshot || {};
  
  const currentPatient = patients.find(p => p.id === current_token);
  const isQueueEmpty = total_waiting === 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Queue Cure Reception</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-600 text-sm font-medium mr-2">
              Welcome, {username}
            </span>

            {isConnected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium border border-emerald-200">
                <Wifi className="w-4 h-4" /> Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 text-sm font-medium border border-red-200">
                <WifiOff className="w-4 h-4" /> Disconnected
              </span>
            )}
            
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-sm font-medium"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        {error && (
          <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 flex items-center gap-3">
            <WifiOff className="w-5 h-5 flex-shrink-0" />
            <p className="font-medium">{error} Reconnecting...</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Controls */}
          <div className="space-y-6">
            
            {/* Current Consultation Card */}
            <div className="bg-indigo-600 rounded-xl shadow-md p-6 text-white relative overflow-hidden">
              <div className="absolute -right-6 -top-6 text-white/10">
                <Users className="w-32 h-32" />
              </div>
              <h2 className="text-indigo-100 font-medium mb-1">In Consultation Room</h2>
              {currentPatient ? (
                <div className="mt-4 relative z-10">
                  <div className="text-5xl font-bold font-mono tracking-tighter mb-2">
                    #{currentPatient.token_number}
                  </div>
                  <div className="text-xl font-medium truncate">
                    {currentPatient.name}
                  </div>
                  
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={handleComplete}
                      className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <UserCheck className="w-4 h-4" /> Finish
                    </button>
                    <button
                      onClick={handleNoShow}
                      className="flex-1 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-red-100 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <UserX className="w-4 h-4" /> No Show
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 relative z-10 py-6">
                  <div className="text-indigo-200 italic">Room is empty</div>
                </div>
              )}
            </div>

            {/* Call Next Button */}
            <CallNextButton disabled={isQueueEmpty || !isConnected} />

            {/* Add Patient */}
            <AddPatientForm />

            {/* Settings */}
            {settings && (
              <ConsultationTimeSetting initialMinutes={settings.avg_consultation_minutes} />
            )}
            <ResetButton onResetSuccess={handleResetSuccess} />

          </div>

          {/* Right Column: Queue Table */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                Queue Status
              </h2>
              <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-sm font-semibold">
                {total_waiting} Waiting
              </span>
            </div>
            <QueueTable patients={patients} currentToken={current_token} />
          </div>

        </div>

        {/* History Dashboard */}
        <HistorySection refreshTrigger={historyRefresh} />
      </main>
    </div>
  );
}

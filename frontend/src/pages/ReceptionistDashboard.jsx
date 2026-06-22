import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { api } from '../services/api';
import AddPatientForm from '../components/receptionist/AddPatientForm';
import QueueTable from '../components/receptionist/QueueTable';
import CallNextButton from '../components/receptionist/CallNextButton';
import ConsultationTimeSetting from '../components/receptionist/ConsultationTimeSetting';
import ResetButton from '../components/receptionist/ResetButton';
import HistorySection from '../components/receptionist/HistorySection';
import { Wifi, WifiOff, Users, UserCheck, UserX, LogOut, Clock, CheckCircle2, Calendar } from 'lucide-react';

export default function ReceptionistDashboard() {
  const navigate = useNavigate();
  const { snapshot, isConnected, error } = useWebSocket();
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [historyStats, setHistoryStats] = useState({
    patients_served_today: 0,
    avg_wait_time: 0,
  });

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

  // Clock tick effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch history stats to compute total metrics for today
  const fetchHistoryStats = async () => {
    try {
      const data = await api.getHistory();
      setHistoryStats({
        patients_served_today: data.analytics?.patients_served_today || 0,
        avg_wait_time: data.analytics?.avg_wait_time || 0,
      });
    } catch (err) {
      console.error('Failed to fetch history stats', err);
    }
  };

  useEffect(() => {
    fetchHistoryStats();
  }, [snapshot, historyRefresh]);

  // If initial connection hasn't returned a snapshot yet
  if (!snapshot && isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 font-semibold tracking-wide">Connecting to Queue Server...</p>
        </div>
      </div>
    );
  }

  const { patients = [], current_token, total_waiting = 0, settings } = snapshot || {};
  
  const currentPatient = patients.find(p => p.id === current_token);
  const isQueueEmpty = total_waiting === 0;

  // Statistic Card Calculations
  const activeCompleted = patients.filter(p => p.status === 'completed').length;
  const totalServedTodayCount = activeCompleted;
  
  const waitingPatients = patients.filter(p => p.status === 'waiting');
  const avgWaitTimeCalculated = waitingPatients.length > 0
    ? Math.round(waitingPatients.reduce((sum, p) => sum + (p.estimated_wait_minutes || 0), 0) / waitingPatients.length)
    : (settings ? settings.avg_consultation_minutes : 10);

  const formattedTime = currentTime.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  const formattedDate = currentTime.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-16 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-sm transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
              <span className="text-white font-extrabold text-xl">+</span>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">Queue Cure</h1>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Reception Portal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Dynamic Clock Section */}
            <div className="hidden md:flex items-center gap-3 border-r border-slate-200 pr-6">
              <Calendar className="w-4.5 h-4.5 text-slate-400" />
              <div className="text-right">
                <p className="text-sm font-bold text-slate-800 leading-none">{formattedTime}</p>
                <p className="text-[10px] text-slate-450 font-bold mt-1 uppercase tracking-wider">{formattedDate}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex flex-col text-right">
                <span className="text-slate-850 text-sm font-bold">
                  {username}
                </span>
                <span className="text-[10px] text-slate-450 font-semibold">Administrator</span>
              </div>

              {isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-250/60 shadow-sm shadow-emerald-50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <Wifi className="w-3.5 h-3.5" /> Live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-250/60 shadow-sm shadow-rose-50">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                  <WifiOff className="w-3.5 h-3.5" /> Offline
                </span>
              )}
              
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-650 hover:bg-slate-50 hover:text-slate-900 transition-all text-xs font-bold shadow-sm"
                title="Log Out"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {error && (
          <div className="mb-6 bg-rose-50 text-rose-700 p-4 rounded-2xl border border-rose-200 flex items-center gap-3 shadow-sm animate-in fade-in duration-300">
            <WifiOff className="w-5 h-5 flex-shrink-0" />
            <p className="font-semibold text-sm">{error} Reconnecting automatically...</p>
          </div>
        )}

        {/* 4-Column Summary Statistics Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Card 1: Patients Waiting */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow duration-300">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Patients Waiting</p>
              <p className="text-3xl font-black text-slate-800 mt-1.5">{total_waiting}</p>
            </div>
            <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100/50">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Current Token */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow duration-300">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Current Token</p>
              <p className="text-3xl font-black text-slate-850 mt-1.5">
                {currentPatient ? `#${currentPatient.token_number}` : 'None'}
              </p>
            </div>
            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100/50">
              <UserCheck className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Avg. Wait Time */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow duration-300">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Avg. Wait Time</p>
              <p className="text-3xl font-black text-slate-850 mt-1.5">
                {avgWaitTimeCalculated} <span className="text-sm font-bold text-slate-500">min</span>
              </p>
            </div>
            <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100/50">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          {/* Card 4: Patients Served Today */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow duration-300">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Served Today</p>
              <p className="text-3xl font-black text-slate-850 mt-1.5">{totalServedTodayCount}</p>
            </div>
            <div className="p-3.5 bg-sky-50 text-sky-600 rounded-2xl border border-sky-100/50">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Controls */}
          <div className="space-y-6">
            
            {/* Current Consultation Card */}
            <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 rounded-3xl shadow-xl p-6 text-white relative overflow-hidden border border-indigo-950">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute -right-6 -top-6 text-white/5 pointer-events-none">
                <Users className="w-36 h-36" />
              </div>
              <h2 className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1 relative z-10">In Consultation Room</h2>
              {currentPatient ? (
                <div className="mt-4 relative z-10">
                  <div className="text-5xl font-black font-mono tracking-tighter mb-1 drop-shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                    #{currentPatient.token_number}
                  </div>
                  <div className="text-lg font-bold text-slate-100 truncate max-w-full">
                    {currentPatient.name}
                  </div>
                  
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={handleComplete}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4.5 h-4.5" /> Finish
                    </button>
                    <button
                      onClick={handleNoShow}
                      className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      <UserX className="w-4.5 h-4.5" /> No Show
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 relative z-10 py-6 text-center border border-dashed border-indigo-850 rounded-2xl bg-indigo-950/20">
                  <div className="text-indigo-300 font-semibold italic text-sm">Room is unoccupied</div>
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
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                Queue Status
              </h2>
              <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-xs font-bold">
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


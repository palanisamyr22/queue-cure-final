import React, { useState, useEffect, useMemo } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import ConnectionStatusIndicator from '../components/patient/ConnectionStatusIndicator';
import CurrentTokenCard from '../components/patient/CurrentTokenCard';
import PeopleAheadCounter from '../components/patient/PeopleAheadCounter';
import WaitTimeBadge from '../components/patient/WaitTimeBadge';
import TokenChangeAlert from '../components/patient/TokenChangeAlert';
import { Volume2, VolumeX, Clock, Wifi, RefreshCw } from 'lucide-react';

export default function PatientDisplay() {
  const { snapshot, isConnected, error } = useWebSocket();
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    return localStorage.getItem('voice_announcements_enabled') !== 'false';
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const toggleVoice = () => {
    setVoiceEnabled(prev => {
      const nextVal = !prev;
      localStorage.setItem('voice_announcements_enabled', String(nextVal));
      return nextVal;
    });
  };

  const { patients = [], current_token, total_waiting = 0, settings } = snapshot || {};
  
  const currentPatient = patients.find(p => p.id === current_token);
  const waitingPatients = patients.filter(p => p.status === 'waiting');
  
  // Combine current patient and waiting patients for the list
  const displayList = currentPatient ? [currentPatient, ...waitingPatients] : waitingPatients;

  // Track active patient consultation duration elapsed time
  useEffect(() => {
    if (!currentPatient || !currentPatient.consultation_start) {
      setElapsedSeconds(0);
      return;
    }

    const start = new Date(currentPatient.consultation_start + 'Z').getTime();
    const update = () => {
      const sec = Math.max(0, Math.floor((Date.now() - start) / 1000));
      setElapsedSeconds(sec);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [currentPatient]);

  // Next walk-in wait time calculation (elapsed-time-aware)
  const nextEstimatedWait = useMemo(() => {
    const avg = settings?.avg_consultation_minutes || 10;
    const elapsedMin = elapsedSeconds / 60;
    const remainingMin = Math.max(0, avg - elapsedMin);
    return Math.round(remainingMin + total_waiting * avg);
  }, [settings, elapsedSeconds, total_waiting]);

  if (!snapshot && isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-2xl text-slate-500 font-medium tracking-wide">Loading Queue Display...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-indigo-500 selection:text-white flex flex-col">
      <TokenChangeAlert 
        currentToken={current_token} 
        currentPatientName={currentPatient?.name} 
        voiceEnabled={voiceEnabled} 
      />

      {/* Top Bar */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-sm relative z-10 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
            <span className="text-white font-extrabold text-xl">+</span>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              Queue Cure
            </h1>
            <p className="text-[10px] text-slate-450 font-bold uppercase tracking-widest mt-0.5">Live Waiting Room Monitor</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleVoice}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              voiceEnabled 
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 shadow-sm' 
                : 'bg-slate-50 border-slate-200 text-slate-550 hover:bg-slate-100'
            }`}
            title={voiceEnabled ? 'Disable Voice Announcements' : 'Enable Voice Announcements'}
          >
            {voiceEnabled ? (
              <>
                <Volume2 className="w-4 h-4 animate-pulse text-indigo-600" />
                <span>Voice Announcements On</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-slate-400" />
                <span>Voice Announcements Off</span>
              </>
            )}
          </button>
          <ConnectionStatusIndicator isConnected={isConnected} error={error} />
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch relative z-10">
        
        {/* Left Column: Huge current token and summary */}
        <div className="lg:col-span-7 flex flex-col gap-6 h-full justify-between">
          <div className="flex-1 min-h-[420px]">
            <CurrentTokenCard 
              currentToken={currentPatient?.token_number} 
              currentPatientName={currentPatient?.name} 
            />
          </div>
          
          {/* 3-Card Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1: People Ahead */}
            <PeopleAheadCounter totalWaiting={total_waiting} />
            
            {/* Card 2: Next Est. Wait Time */}
            <div className="bg-white border border-slate-200/85 rounded-3xl shadow-sm p-6 flex items-center justify-between transition-all hover:shadow-md duration-300">
              <div className="flex items-center gap-4">
                <div className="bg-purple-50 p-3.5 rounded-2xl border border-purple-100/50">
                  <Clock className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight">Est. Wait Time</h3>
                  <p className="text-[10px] text-slate-550 font-bold uppercase tracking-wider mt-0.5">Next Walk-in</p>
                </div>
              </div>
              <div className="text-3xl font-black text-purple-600 font-mono tracking-tight">
                {nextEstimatedWait} <span className="text-xs font-bold text-slate-400">m</span>
              </div>
            </div>

            {/* Card 3: Speech alerts status */}
            <div className="bg-white border border-slate-200/85 rounded-3xl shadow-sm p-6 flex items-center justify-between transition-all hover:shadow-md duration-300">
              <div className="flex items-center gap-4">
                <div className={`p-3.5 rounded-2xl border ${
                  voiceEnabled ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400 border-slate-200'
                }`}>
                  {voiceEnabled ? <Volume2 className="w-6 h-6 animate-pulse" /> : <VolumeX className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight">Voice Alerts</h3>
                  <p className="text-[10px] text-slate-550 font-bold uppercase tracking-wider mt-0.5">Announcement</p>
                </div>
              </div>
              <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full border ${
                voiceEnabled 
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                  : 'bg-slate-50 text-slate-400 border-slate-200'
              }`}>
                {voiceEnabled ? 'Active' : 'Muted'}
              </span>
            </div>

          </div>
        </div>

        {/* Right Column: Upcoming Tokens List */}
        <div className="lg:col-span-5 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="bg-slate-50/80 text-slate-800 px-8 py-6 border-b border-slate-200 shadow-sm flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">Upcoming Tokens</h2>
            <span className="bg-slate-200 text-slate-600 text-xs px-3 py-1 rounded-full font-bold border border-slate-200/50">
              {displayList.length} in view
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-slate-200">
            {displayList.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-base font-semibold p-12 text-center">
                No patients currently waiting in line.
              </div>
            ) : (
              <ul className="space-y-4">
                {displayList.map((patient, index) => {
                  const isServing = patient.status === 'in_consultation';
                  const isNext = !isServing && index === (currentPatient ? 1 : 0);
                  return (
                    <li 
                      key={patient.id} 
                      className={`p-5 rounded-2xl border-2 transition-all duration-300 ${
                        isServing
                          ? 'border-emerald-300 bg-emerald-50/30'
                          : isNext 
                            ? 'border-indigo-300 bg-indigo-50/30 transform scale-[1.01]' 
                            : 'border-slate-100 bg-white hover:border-slate-200/80 hover:bg-slate-50/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-5">
                          <div className={`text-2xl font-mono font-black py-1 px-2.5 rounded-lg ${
                            isServing 
                              ? 'text-emerald-700 bg-emerald-50' 
                              : isNext 
                                ? 'text-indigo-700 bg-indigo-50' 
                                : 'text-slate-600 bg-slate-100'
                          }`}>
                            #{patient.token_number}
                          </div>
                          <div className={`text-lg font-bold truncate max-w-[180px] sm:max-w-[240px] ${
                            isServing ? 'text-emerald-950' : isNext ? 'text-indigo-950' : 'text-slate-800'
                          }`}>
                            {patient.name}
                          </div>
                        </div>
                        <WaitTimeBadge 
                          patientId={patient.id} 
                          isNext={isNext} 
                          isServing={isServing}
                          estimatedWaitMinutes={patient.estimated_wait_minutes}
                          peopleAhead={patient.people_ahead}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}



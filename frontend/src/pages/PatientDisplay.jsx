import React, { useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import ConnectionStatusIndicator from '../components/patient/ConnectionStatusIndicator';
import CurrentTokenCard from '../components/patient/CurrentTokenCard';
import PeopleAheadCounter from '../components/patient/PeopleAheadCounter';
import WaitTimeBadge from '../components/patient/WaitTimeBadge';
import TokenChangeAlert from '../components/patient/TokenChangeAlert';
import { Volume2, VolumeX } from 'lucide-react';

export default function PatientDisplay() {
  const { snapshot, isConnected, error } = useWebSocket();
  const [updateCounter, setUpdateCounter] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    return localStorage.getItem('voice_announcements_enabled') !== 'false';
  });

  const toggleVoice = () => {
    setVoiceEnabled(prev => {
      const nextVal = !prev;
      localStorage.setItem('voice_announcements_enabled', String(nextVal));
      return nextVal;
    });
  };

  // We use this counter to force WaitTimeBadges to re-fetch when the snapshot updates
  React.useEffect(() => {
    if (snapshot) {
      setUpdateCounter(c => c + 1);
    }
  }, [snapshot]);

  if (!snapshot && isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-pulse flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-2xl text-slate-500 font-medium tracking-wide">Loading Queue Display...</p>
        </div>
      </div>
    );
  }

  const { patients = [], current_token, total_waiting = 0 } = snapshot || {};
  
  const currentPatient = patients.find(p => p.id === current_token);
  const waitingPatients = patients.filter(p => p.status === 'waiting');
  
  // Combine current patient and waiting patients for the list
  const displayList = currentPatient ? [currentPatient, ...waitingPatients] : waitingPatients;

  return (
    <div className="min-h-screen bg-slate-100 font-sans selection:bg-indigo-500 selection:text-white flex flex-col">
      <TokenChangeAlert 
        currentToken={current_token} 
        currentPatientName={currentPatient?.name} 
        voiceEnabled={voiceEnabled} 
      />

      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between shadow-sm">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <span className="bg-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center">+</span>
          Queue Cure
        </h1>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleVoice}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
              voiceEnabled 
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' 
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}
            title={voiceEnabled ? 'Disable Voice Announcements' : 'Enable Voice Announcements'}
          >
            {voiceEnabled ? (
              <>
                <Volume2 className="w-5 h-5 animate-pulse" />
                <span className="hidden md:inline">Voice Announcements On</span>
              </>
            ) : (
              <>
                <VolumeX className="w-5 h-5" />
                <span className="hidden md:inline">Voice Announcements Off</span>
              </>
            )}
          </button>
          <ConnectionStatusIndicator isConnected={isConnected} error={error} />
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full p-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Left Column: Huge current token and summary */}
        <div className="lg:col-span-7 flex flex-col gap-8">
          <div className="flex-1">
            <CurrentTokenCard 
              currentToken={currentPatient?.token_number} 
              currentPatientName={currentPatient?.name} 
            />
          </div>
          <div className="h-48">
            <PeopleAheadCounter totalWaiting={total_waiting} />
          </div>
        </div>

        {/* Right Column: Up Next List */}
        <div className="lg:col-span-5 bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="bg-slate-800 text-white px-8 py-6 border-b border-slate-700 shadow-sm">
            <h2 className="text-2xl font-bold tracking-wide">Upcoming Tokens</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {displayList.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xl font-medium p-12 text-center">
                No patients currently waiting.
              </div>
            ) : (
              <ul className="space-y-4">
                {displayList.map((patient, index) => {
                  const isServing = patient.status === 'in_consultation';
                  const isNext = !isServing && index === (currentPatient ? 1 : 0);
                  return (
                    <li 
                      key={patient.id} 
                      className={`p-6 rounded-2xl border-2 transition-all ${
                        isServing
                          ? 'border-emerald-400 bg-emerald-50/50 shadow-md'
                          : isNext 
                            ? 'border-indigo-400 bg-indigo-50/50 shadow-md transform scale-[1.02]' 
                            : 'border-slate-100 bg-white hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-6">
                          <div className={`text-4xl font-mono font-bold ${isServing ? 'text-emerald-600' : isNext ? 'text-indigo-600' : 'text-slate-600'}`}>
                            #{patient.token_number}
                          </div>
                          <div className={`text-2xl font-medium truncate ${isServing ? 'text-emerald-900' : isNext ? 'text-indigo-900' : 'text-slate-700'}`}>
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

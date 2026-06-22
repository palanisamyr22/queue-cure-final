import React from 'react';
import { UserCheck, Sparkles } from 'lucide-react';

export default function CurrentTokenCard({ currentToken, currentPatientName }) {
  if (!currentToken) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-12 text-center h-full flex flex-col items-center justify-center min-h-[400px] transition-all duration-300">
        <UserCheck className="w-16 h-16 text-slate-350 mb-4" />
        <h2 className="text-2xl font-bold text-slate-400 tracking-wide">Waiting for next patient</h2>
        <p className="text-slate-500 text-sm mt-2 font-medium">Room is currently unoccupied</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 rounded-3xl shadow-xl border border-indigo-950 p-12 text-center h-full flex flex-col items-center justify-center relative overflow-hidden min-h-[400px] transition-all duration-350">
      {/* Absolute decorative glow circles */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none"></div>
      
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
        <UserCheck className="w-80 h-80 text-white" />
      </div>
      
      <div className="relative z-10 space-y-6 w-full animate-in fade-in zoom-in-95 duration-500">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-indigo-200 text-xs font-bold uppercase tracking-widest">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Now Serving</span>
        </div>
        
        <div className="bg-white/5 backdrop-blur-md rounded-3xl py-10 px-4 border border-white/10 shadow-xl relative">
          {/* Subtle pulse ring around the token */}
          <div className="absolute inset-0 rounded-3xl border border-white/10 animate-ping opacity-10 pointer-events-none"></div>
          
          <div className="text-[10rem] font-black text-white tracking-tighter leading-none font-mono drop-shadow-[0_0_20px_rgba(255,255,255,0.05)] select-none">
            #{currentToken}
          </div>
          {currentPatientName && (
            <div className="text-4xl font-extrabold text-white truncate max-w-full px-8 mt-2 tracking-tight select-all">
              {currentPatientName}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


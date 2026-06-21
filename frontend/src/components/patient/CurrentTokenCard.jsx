import React from 'react';
import { UserCheck } from 'lucide-react';

export default function CurrentTokenCard({ currentToken, currentPatientName }) {
  if (!currentToken) {
    return (
      <div className="bg-white rounded-3xl shadow-xl border-4 border-slate-100 p-12 text-center h-full flex flex-col items-center justify-center min-h-[400px]">
        <h2 className="text-3xl font-semibold text-slate-400">Waiting for next patient</h2>
      </div>
    );
  }

  return (
    <div className="bg-indigo-600 rounded-3xl shadow-2xl border-4 border-indigo-500 p-12 text-center h-full flex flex-col items-center justify-center relative overflow-hidden min-h-[400px]">
      <div className="absolute top-0 right-0 p-8 opacity-10">
        <UserCheck className="w-64 h-64" />
      </div>
      
      <div className="relative z-10 space-y-6 w-full">
        <h2 className="text-3xl font-bold text-indigo-200 uppercase tracking-widest">Now Serving</h2>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-3xl py-12 px-4 shadow-inner border border-white/20">
          <div className="text-9xl font-black text-white tracking-tighter mb-4 font-mono">
            #{currentToken}
          </div>
          {currentPatientName && (
            <div className="text-4xl font-semibold text-indigo-100 truncate max-w-full px-8">
              {currentPatientName}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

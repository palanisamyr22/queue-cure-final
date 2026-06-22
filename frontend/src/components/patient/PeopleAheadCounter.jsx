import React from 'react';
import { Users } from 'lucide-react';

export default function PeopleAheadCounter({ totalWaiting }) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm p-6 flex items-center justify-between transition-all duration-300">
      <div className="flex items-center gap-4">
        <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-100/50">
          <Users className="w-8 h-8 text-emerald-600" />
        </div>
        <div>
          <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">People Waiting</h3>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-0.5">Total in queue</p>
        </div>
      </div>
      <div className="text-5xl font-black text-slate-800 font-mono tracking-tight">
        {totalWaiting}
      </div>
    </div>
  );
}


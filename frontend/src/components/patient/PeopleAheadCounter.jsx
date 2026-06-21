import React from 'react';
import { Users } from 'lucide-react';

export default function PeopleAheadCounter({ totalWaiting }) {
  return (
    <div className="bg-white rounded-3xl shadow-lg border border-slate-200 p-8 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div className="bg-emerald-100 p-4 rounded-2xl">
          <Users className="w-10 h-10 text-emerald-600" />
        </div>
        <div>
          <h3 className="text-2xl font-semibold text-slate-600">People Waiting</h3>
          <p className="text-slate-400 font-medium mt-1">Total in queue</p>
        </div>
      </div>
      <div className="text-6xl font-black text-slate-800 font-mono">
        {totalWaiting}
      </div>
    </div>
  );
}

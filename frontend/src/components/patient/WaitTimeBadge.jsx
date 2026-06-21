import React from 'react';
import { Clock, Users } from 'lucide-react';

export default function WaitTimeBadge({ patientId, isNext, isServing, estimatedWaitMinutes, peopleAhead }) {
  // Currently being served state
  if (isServing) {
    return (
      <div className="bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 shadow-sm border border-emerald-200 animate-pulse">
        <Clock className="w-4 h-4" />
        Now being served
      </div>
    );
  }

  // Next Patient state
  if (isNext) {
    return (
      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
        <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border border-emerald-200">
          <Users className="w-3.5 h-3.5" />
          0 ahead
        </span>
        <span className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 shadow-sm border border-amber-200">
          <Clock className="w-4 h-4" />
          You are next
        </span>
      </div>
    );
  }

  // Normal wait state
  return (
    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
      {peopleAhead !== undefined && peopleAhead !== null && (
        <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border border-indigo-100">
          <Users className="w-3.5 h-3.5 text-indigo-500" />
          {peopleAhead} ahead
        </span>
      )}
      <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5 border border-slate-200">
        <Clock className="w-4 h-4 text-slate-500" />
        Estimated Wait: {estimatedWaitMinutes ?? '...'} min
      </span>
    </div>
  );
}


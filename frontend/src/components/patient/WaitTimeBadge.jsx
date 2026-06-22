import React from 'react';
import { Clock, Users } from 'lucide-react';

export default function WaitTimeBadge({ patientId, isNext, isServing, estimatedWaitMinutes, peopleAhead }) {
  // Currently being served state
  if (isServing) {
    return (
      <div className="bg-emerald-50 text-emerald-700 px-3.5 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 border border-emerald-250/60 shadow-sm shadow-emerald-50">
        <Clock className="w-3.5 h-3.5 text-emerald-500" />
        Now being served
      </div>
    );
  }

  // Next Patient state
  if (isNext) {
    return (
      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
        <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border border-emerald-200/60">
          <Users className="w-3.5 h-3.5 text-emerald-500" />
          0 ahead
        </span>
        <span className="bg-amber-50 text-amber-750 px-3 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 border border-amber-250/60 shadow-sm shadow-amber-50">
          <Clock className="w-3.5 h-3.5 text-amber-550" />
          You are next
        </span>
      </div>
    );
  }

  // Normal wait state
  return (
    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
      {peopleAhead !== undefined && peopleAhead !== null && (
        <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border border-indigo-200/60">
          <Users className="w-3.5 h-3.5 text-indigo-500" />
          {peopleAhead} ahead
        </span>
      )}
      <span className="bg-slate-50 text-slate-600 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border border-slate-200/80">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        Estimated Wait: {estimatedWaitMinutes ?? '...'} min
      </span>
    </div>
  );
}



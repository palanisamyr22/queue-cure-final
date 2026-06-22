import React from 'react';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';
import RecallNoShowButton from './RecallNoShowButton';
import { api } from '../../services/api';

const STATUS_CONFIG = {
  waiting: { 
    label: 'Waiting', 
    bg: 'bg-amber-50/50 text-amber-700 border-amber-200/60', 
    dot: 'bg-amber-500' 
  },
  in_consultation: { 
    label: 'In Room', 
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-250/60 shadow-sm shadow-emerald-50', 
    dot: 'bg-emerald-500 animate-pulse' 
  },
  completed: { 
    label: 'Completed', 
    bg: 'bg-slate-100/60 text-slate-500 border-slate-200/60', 
    dot: 'bg-slate-400' 
  },
  no_show: { 
    label: 'No Show', 
    bg: 'bg-rose-50 text-rose-700 border-rose-200/60', 
    dot: 'bg-rose-500' 
  }
};

export default function QueueTable({ patients, currentToken }) {
  
  const handleCancelWaiting = async (id) => {
    if (!window.confirm("Mark this waiting patient as No Show?")) return;
    try {
      await api.cancelPatient(id);
    } catch (err) {
      alert(err.message || "Failed to cancel patient");
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-205 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-450 uppercase tracking-wider">
              <th className="py-4 px-6 text-center w-24">Token</th>
              <th className="py-4 px-6">Patient Name</th>
              <th className="py-4 px-6">Status</th>
              <th className="py-4 px-6">Arrival Time</th>
              <th className="py-4 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-650">
            {patients.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-12 text-center text-slate-400 font-medium">
                  No patients in the queue today.
                </td>
              </tr>
            ) : (
              patients.map((patient, index) => {
                const config = STATUS_CONFIG[patient.status] || STATUS_CONFIG.waiting;
                const isCurrent = patient.id === currentToken;
                
                return (
                  <tr 
                    key={patient.id} 
                    className={`hover:bg-slate-50/60 transition-colors duration-200 ${
                      isCurrent 
                        ? 'bg-indigo-50/30' 
                        : index % 2 === 1 
                          ? 'bg-slate-50/20' 
                          : 'bg-white'
                    }`}
                  >
                    <td className="py-4 px-6 text-center">
                      <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/50">
                        #{patient.token_number}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-800">
                      {patient.name}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${config.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
                        {config.label}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-500 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {format(new Date(patient.created_at + "Z"), 'hh:mm a')}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {patient.status === 'waiting' && (
                          <button
                            onClick={() => handleCancelWaiting(patient.id)}
                            className="text-xs px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/50 rounded-xl font-bold transition-all cursor-pointer active:scale-95"
                            title="Mark No Show"
                          >
                            Cancel
                          </button>
                        )}
                        {patient.status === 'no_show' && (
                          <RecallNoShowButton patient={patient} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


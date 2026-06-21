import React from 'react';
import { format } from 'date-fns';
import { XCircle, CheckCircle, UserX, Clock } from 'lucide-react';
import RecallNoShowButton from './RecallNoShowButton';
import { api } from '../../services/api';

const STATUS_CONFIG = {
  waiting: { label: 'Waiting', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  in_consultation: { label: 'In Room', color: 'bg-emerald-100 text-emerald-800 animate-pulse', icon: PlayCircle },
  completed: { label: 'Completed', color: 'bg-slate-100 text-slate-600', icon: CheckCircle },
  no_show: { label: 'No Show', color: 'bg-red-100 text-red-700', icon: UserX }
};

// SVG component missing from lucide export above
function PlayCircle(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
    </svg>
  );
}

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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-600">
              <th className="py-3 px-4">Token</th>
              <th className="py-3 px-4">Patient Name</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Time</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patients.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-8 text-center text-slate-500">
                  No patients in the queue today.
                </td>
              </tr>
            ) : (
              patients.map((patient) => {
                const config = STATUS_CONFIG[patient.status] || STATUS_CONFIG.waiting;
                const Icon = config.icon;
                const isCurrent = patient.id === currentToken;
                
                return (
                  <tr key={patient.id} className={`hover:bg-slate-50 transition-colors ${isCurrent ? 'bg-emerald-50/50' : ''}`}>
                    <td className="py-3 px-4">
                      <span className="font-mono font-semibold text-slate-700">
                        #{patient.token_number}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {patient.name}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {config.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-500">
                      {format(new Date(patient.created_at + "Z"), 'hh:mm a')}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {patient.status === 'waiting' && (
                        <button
                          onClick={() => handleCancelWaiting(patient.id)}
                          className="text-sm px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Mark No Show"
                        >
                          Cancel
                        </button>
                      )}
                      {patient.status === 'no_show' && (
                        <RecallNoShowButton patient={patient} />
                      )}
                      {/* in_consultation controls are handled globally in the dashboard headers */}
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

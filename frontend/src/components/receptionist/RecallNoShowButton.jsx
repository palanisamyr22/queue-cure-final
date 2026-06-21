import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { api } from '../../services/api';

export default function RecallNoShowButton({ patient }) {
  const [isRecalling, setIsRecalling] = useState(false);

  const handleRecall = async () => {
    if (!window.confirm(`Recall ${patient.name} to the queue? This will generate a new token number at the end of the line.`)) {
      return;
    }
    
    setIsRecalling(true);
    try {
      // Re-add the patient to the end of the queue
      await api.addPatient({ name: patient.name, phone: patient.phone });
    } catch (err) {
      alert(err.message || 'Failed to recall patient');
    } finally {
      setIsRecalling(false);
    }
  };

  return (
    <button
      onClick={handleRecall}
      disabled={isRecalling}
      className="text-sm px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md flex items-center gap-1.5 transition-colors"
      title="Add back to queue"
    >
      <RotateCcw className="w-3.5 h-3.5" />
      Recall
    </button>
  );
}

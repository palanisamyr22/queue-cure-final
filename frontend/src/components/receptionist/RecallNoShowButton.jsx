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
      className="text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-250/60 rounded-xl flex items-center gap-1 transition-all font-bold cursor-pointer"
      title="Add back to queue"
    >
      <RotateCcw className="w-3 h-3" />
      Recall
    </button>
  );
}


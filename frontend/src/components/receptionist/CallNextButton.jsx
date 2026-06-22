import React from 'react';
import { Play } from 'lucide-react';
import { api } from '../../services/api';

export default function CallNextButton({ disabled }) {
  const [isCalling, setIsCalling] = React.useState(false);

  const handleCallNext = async () => {
    setIsCalling(true);
    try {
      await api.callNext();
    } catch (err) {
      alert(err.message || 'Failed to call next patient');
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <button
      onClick={handleCallNext}
      disabled={disabled || isCalling}
      className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-4.5 px-6 rounded-2xl flex items-center justify-center gap-3 w-full shadow-lg shadow-blue-150/40 hover:shadow-xl active:scale-[0.98] transition-all cursor-pointer border border-transparent"
    >
      <Play className="w-5 h-5 fill-current" />
      <span className="text-lg">Call Next Patient</span>
    </button>
  );
}


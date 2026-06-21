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
      className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 w-full shadow-md transition-transform active:scale-95"
    >
      <Play className="w-6 h-6" />
      <span className="text-xl">Call Next Patient</span>
    </button>
  );
}

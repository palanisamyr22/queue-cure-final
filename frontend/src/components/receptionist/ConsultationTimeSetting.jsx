import React, { useState, useEffect } from 'react';
import { Clock, Save } from 'lucide-react';
import { api } from '../../services/api';

export default function ConsultationTimeSetting({ initialMinutes }) {
  const [minutes, setMinutes] = useState(initialMinutes || 10);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (initialMinutes) setMinutes(initialMinutes);
  }, [initialMinutes]);

  const handleSave = async (e) => {
    e?.preventDefault();
    setIsSaving(true);
    try {
      await api.updateSettings({ avg_consultation_minutes: parseInt(minutes, 10) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(err.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-8">
      <h2 className="text-lg font-bold text-slate-850 mb-5 flex items-center gap-2.5">
        <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100/50">
          <Clock className="w-5 h-5" />
        </div>
        Queue Settings
      </h2>
      <form onSubmit={handleSave} className="flex items-end gap-4">
        <div className="flex-1">
          <label className="block text-xs font-bold text-slate-450 uppercase tracking-wider mb-2">
            Avg. Consultation Time (min)
          </label>
          <input
            type="number"
            min="1"
            max="120"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 bg-slate-50/40 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-sm font-medium"
          />
        </div>
        <button
          type="submit"
          disabled={isSaving || minutes == initialMinutes}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold px-5 py-3 rounded-xl flex items-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-indigo-150/50 hover:shadow-lg disabled:shadow-none cursor-pointer text-sm"
        >
          {saved ? "Saved!" : <><Save className="w-4 h-4" /> Save</>}
        </button>
      </form>
    </div>
  );
}


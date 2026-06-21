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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-indigo-500" />
        Queue Settings
      </h2>
      <form onSubmit={handleSave} className="flex items-end gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Avg. Consultation Time (min)
          </label>
          <input
            type="number"
            min="1"
            max="120"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          type="submit"
          disabled={isSaving || minutes == initialMinutes}
          className="bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          {saved ? "Saved!" : <><Save className="w-4 h-4" /> Save</>}
        </button>
      </form>
    </div>
  );
}

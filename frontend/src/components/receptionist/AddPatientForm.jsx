import React, { useState, useRef } from 'react';
import { api } from '../../services/api';
import { UserPlus, Loader2 } from 'lucide-react';

export default function AddPatientForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const nameInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setError('');
    setIsSubmitting(true);
    
    try {
      await api.addPatient({ name: name.trim(), phone: phone.trim() || undefined });
      setName('');
      setPhone('');
      // Refocus the input to allow extremely fast consecutive data entry
      setTimeout(() => nameInputRef.current?.focus(), 0);
    } catch (err) {
      setError(err.message || 'Failed to add patient');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-8">
      <h2 className="text-lg font-bold text-slate-850 mb-5 flex items-center gap-2.5">
        <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100/50">
          <UserPlus className="w-5 h-5" />
        </div>
        Add New Patient
      </h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="name" className="block text-xs font-bold text-slate-450 uppercase tracking-wider mb-2">
            Patient Name *
          </label>
          <input
            id="name"
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 bg-slate-50/40 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-sm font-medium placeholder-slate-400"
            placeholder="John Doe"
            disabled={isSubmitting}
            autoComplete="off"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-xs font-bold text-slate-450 uppercase tracking-wider mb-2">
            Phone Number (Optional)
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 bg-slate-50/40 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-sm font-medium placeholder-slate-400"
            placeholder="+1 (234) 567-8900"
            disabled={isSubmitting}
            autoComplete="off"
          />
        </div>
        
        {error && (
          <div className="text-sm text-red-650 bg-red-50 p-3 rounded-xl border border-red-100 font-medium">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-emerald-100/50 hover:shadow-lg disabled:shadow-none cursor-pointer"
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <UserPlus className="w-5 h-5" />
          )}
          Add to Queue
        </button>
      </form>
    </div>
  );
}


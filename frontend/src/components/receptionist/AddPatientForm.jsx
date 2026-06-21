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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-indigo-500" />
        Add New Patient
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
            Patient Name *
          </label>
          <input
            id="name"
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            placeholder="John Doe"
            disabled={isSubmitting}
            autoComplete="off"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
            Phone Number (Optional)
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            placeholder="+1 234 567 8900"
            disabled={isSubmitting}
            autoComplete="off"
          />
        </div>
        
        {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</div>}

        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
          Add to Queue
        </button>
      </form>
    </div>
  );
}

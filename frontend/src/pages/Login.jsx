import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Users, AlertCircle } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // If already authenticated, redirect to dashboard immediately
    if (localStorage.getItem('admin_authenticated') === 'true') {
      navigate('/receptionist', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    // Demo hardcoded credentials
    if (username.trim() === 'receptionist' && password === 'QueueCure2026') {
      localStorage.setItem('admin_authenticated', 'true');
      localStorage.setItem('admin_username', username.trim());
      navigate('/receptionist', { replace: true });
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans px-4 selection:bg-indigo-500 selection:text-white">
      {/* Dynamic ambient background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-200/20 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200/80 p-8 md:p-10 relative overflow-hidden transition-all duration-300 hover:shadow-indigo-100/40">
        
        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 mb-4 border border-indigo-500/20">
            <Users className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-855 tracking-tight text-center leading-tight">
            Queue Cure
          </h1>
          <p className="text-slate-450 text-xs font-bold uppercase tracking-wider mt-1.5 text-center">
            Reception Administration
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div>
            <label htmlFor="username" className="block text-xs font-bold text-slate-450 uppercase tracking-wider mb-2">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <User className="w-4.5 h-4.5" />
              </span>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 bg-slate-50/40 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-sm font-medium placeholder-slate-400"
                placeholder="Enter username"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-bold text-slate-450 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Lock className="w-4.5 h-4.5" />
              </span>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 bg-slate-50/40 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-sm font-medium placeholder-slate-400 font-mono"
                placeholder="••••••••••••"
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div className="text-xs text-rose-650 bg-rose-50 p-3.5 rounded-xl border border-rose-100 flex items-center gap-2.5 animate-in fade-in zoom-in-95 duration-200 font-semibold leading-snug">
              <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-150/40 transition-all cursor-pointer border border-transparent"
          >
            Log In
          </button>
        </form>
      </div>
    </div>
  );
}



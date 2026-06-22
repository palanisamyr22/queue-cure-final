import React, { useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';

export default function ResetButton({ onResetSuccess }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await api.resetQueue();
      setIsOpen(false);
      if (onResetSuccess) onResetSuccess();
    } catch (err) {
      alert(err.message || 'Failed to reset queue');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] cursor-pointer shadow-sm shadow-rose-100"
        title="Clear all active patients and reset token sequence"
      >
        <RefreshCw className="w-4 h-4 animate-spin-hover" />
        Reset Today's Queue
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => !isResetting && setIsOpen(false)}
          />

          {/* Modal Container */}
          <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-200/80 max-w-md w-full p-8 overflow-hidden z-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3.5 bg-rose-100 rounded-2xl text-rose-600 flex-shrink-0 border border-rose-200/50">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Reset Today's Queue?</h3>
                <p className="text-slate-550 text-sm font-medium mt-1 leading-relaxed">
                  You are about to reset today's active queue.
                </p>
              </div>
            </div>

            <div className="bg-slate-50/80 rounded-2xl p-5 mb-6 border border-slate-100">
              <p className="text-xs font-bold text-slate-450 uppercase tracking-wider mb-3">This action will:</p>
              <ul className="text-sm text-slate-600 font-semibold space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  Clear all active patients
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  Reset token numbering back to 1
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  Remove currently active consultation
                </li>
              </ul>
              <div className="mt-4 pt-3.5 border-t border-slate-200/60">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Historical Records</p>
                <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  Patient history and consultation logs will be preserved. This cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setIsOpen(false)}
                disabled={isResetting}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-650 rounded-xl font-bold transition-all text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-xl font-bold transition-all text-sm shadow-md shadow-rose-200/50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isResetting ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


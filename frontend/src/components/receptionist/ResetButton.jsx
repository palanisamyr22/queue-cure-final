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
        className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 hover:border-red-300 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]"
        title="Clear all active patients and reset token sequence"
      >
        <RefreshCw className="w-4 h-4" />
        Reset Today's Queue
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => !isResetting && setIsOpen(false)}
          />

          {/* Modal Container */}
          <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-8 overflow-hidden z-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-red-100 rounded-2xl text-red-650 flex-shrink-0">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-850 tracking-tight">Warning</h3>
                <p className="text-slate-500 font-medium mt-2 leading-relaxed">
                  You are about to reset today's queue.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 mb-8 border border-slate-100">
              <p className="text-sm font-semibold text-slate-700 mb-3">This action will:</p>
              <ul className="text-sm text-slate-500 font-medium space-y-2 list-disc list-inside">
                <li>Clear the active queue</li>
                <li>Reset token numbering back to 1</li>
                <li>Remove the currently active patient</li>
              </ul>
              <div className="mt-4 pt-3 border-t border-slate-200/60">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Note</p>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Patient history will be preserved. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setIsOpen(false)}
                disabled={isResetting}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-650 rounded-xl font-bold transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="flex-1 py-3 px-4 bg-red-650 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-bold transition-all text-sm shadow-lg shadow-red-100 flex items-center justify-center gap-1.5"
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

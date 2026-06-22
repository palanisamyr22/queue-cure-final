import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export default function ConnectionStatusIndicator({ isConnected, error }) {
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    if (!isConnected && !error) {
      setIsReconnecting(true);
    } else {
      setIsReconnecting(false);
    }
  }, [isConnected, error]);

  if (isConnected) {
    return (
      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3.5 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-500/20 shadow-sm transition-all duration-500 text-sm font-semibold">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <Wifi className="w-4 h-4" />
        <span>Live</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-450 bg-rose-50 dark:bg-rose-500/10 px-3.5 py-1.5 rounded-full border border-rose-200 dark:border-rose-500/20 shadow-sm transition-all duration-500 text-sm font-semibold">
        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
        <WifiOff className="w-4 h-4" />
        <span>Offline</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-3.5 py-1.5 rounded-full border border-amber-200 dark:border-amber-500/20 shadow-sm transition-all duration-500 text-sm font-semibold">
      <RefreshCw className="w-4 h-4 animate-spin" />
      <span>Connecting...</span>
    </div>
  );
}

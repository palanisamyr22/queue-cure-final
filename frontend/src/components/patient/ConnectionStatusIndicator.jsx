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
      <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full shadow-sm border border-emerald-200 transition-all duration-500">
        <Wifi className="w-5 h-5" />
        <span className="font-semibold tracking-wide">Live</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-full shadow-sm border border-red-200 transition-all duration-500">
        <WifiOff className="w-5 h-5" />
        <span className="font-semibold tracking-wide">Offline</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-full shadow-sm border border-amber-200 transition-all duration-500">
      <RefreshCw className="w-5 h-5 animate-spin" />
      <span className="font-semibold tracking-wide">Reconnecting...</span>
    </div>
  );
}

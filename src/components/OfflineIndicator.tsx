"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Shows offline status indicator when connection is lost.
 */
export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // Keep banner visible briefly to show reconnection
      setTimeout(() => setShowBanner(false), 2000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!showBanner && isOnline) return null;

  return (
    <div
      className={`
        fixed top-0 left-0 right-0 z-100
        flex items-center justify-center gap-2 py-2 px-4
        text-sm font-medium
        transition-colors duration-300
        ${isOnline 
          ? "bg-green-100 text-green-800" 
          : "bg-amber-100 text-amber-800"
        }
      `}
    >
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4" />
          <span>Back online</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>You're offline, but don't worry, files are processed locally</span>
        </>
      )}
    </div>
  );
}

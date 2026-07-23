"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/**
 * Shows offline status indicator when connection is lost.
 */
export function OfflineIndicator() {
  // Derived from the browser; SSR assumes online (server snapshot).
  const isOnline = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  );
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      // Keep banner visible briefly to show reconnection
      setTimeout(() => setShowBanner(false), 2000);
    };

    const handleOffline = () => {
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
          ? "bg-success-bg text-success-text"
          : "bg-warning-bg text-warning-text"
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
          <span>You&apos;re offline, but don&apos;t worry, files are processed locally</span>
        </>
      )}
    </div>
  );
}

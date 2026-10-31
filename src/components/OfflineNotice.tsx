import React, { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

// Tells members when the site is showing the copy saved on their phone
export default function OfflineNotice() {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div role="status" className="fixed inset-x-0 z-50 flex justify-center pointer-events-none px-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6">
      <p className="bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-full px-4 py-2 flex items-center gap-2 shadow-lg">
        <WifiOff className="w-4 h-4 text-amber-500" />
        No signal · showing what was saved on this device
      </p>
    </div>
  );
}

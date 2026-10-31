import React, { useState } from "react";
import { Share, X } from "lucide-react";

const DISMISSED_KEY = "movie_club_home_screen_hint_dismissed";

function shouldShow(): boolean {
  try {
    const isIPhone = /iPhone|iPod/.test(navigator.userAgent);
    const isInstalled = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    return isIPhone && !isInstalled && !localStorage.getItem(DISMISSED_KEY);
  } catch {
    return false;
  }
}

// On an iPhone in Safari, explains once how to add the club to the Home Screen
export default function HomeScreenHint() {
  const [visible, setVisible] = useState(shouldShow);
  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
    setVisible(false);
  };

  return (
    <aside className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 pr-2 flex items-start gap-3">
      <img src="/apple-touch-icon.png" alt="" className="w-11 h-11 rounded-xl shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-zinc-100">Put Movie Club on your Home Screen</p>
        <p className="text-sm text-zinc-400 mt-1">
          Tap <Share className="inline w-4 h-4 -mt-1 text-amber-500" aria-label="Share" /> below, then <strong className="text-zinc-200">Add to Home Screen</strong>. It opens full-screen like an app.
        </p>
      </div>
      <button type="button" onClick={dismiss} aria-label="Don't show this again" className="w-11 h-11 -mt-2 flex items-center justify-center text-zinc-500 hover:text-zinc-200 cursor-pointer shrink-0">
        <X className="w-5 h-5" />
      </button>
    </aside>
  );
}

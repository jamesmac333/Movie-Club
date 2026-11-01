import React, { useEffect, useRef, useState } from "react";
import { ArrowDown, RefreshCw } from "lucide-react";

// Pull down from the top of the page to reload, like Reddit or Mail. Only in the
// Home Screen app: a browser tab already has its own refresh.

const TRIGGER = 70; // how far (after resistance) the pull must go before letting go reloads
const MAX_PULL = 110;

function isHomeScreenApp() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// A pull that starts inside something scrolled (a sheet, a list) scrolls that instead
function startsInScrolledArea(target: EventTarget | null) {
  for (let el = target as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
    if (el.scrollTop > 0) return true;
  }
  return false;
}

export default function PullToRefresh({ disabled }: { disabled: boolean }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const pulling = useRef(false);
  const pullRef = useRef(0);

  useEffect(() => {
    if (disabled || refreshing) return;

    const set = (value: number) => {
      pullRef.current = value;
      setPull(value);
    };

    const onStart = (e: TouchEvent) => {
      start.current = null;
      pulling.current = false;
      if (e.touches.length !== 1 || window.scrollY > 0 || !isHomeScreenApp()) return;
      // Pop-ups and sheets keep their own scrolling
      if (document.querySelector('[aria-modal="true"]') || startsInScrolledArea(e.target)) return;
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const onMove = (e: TouchEvent) => {
      if (!start.current) return;
      const dx = e.touches[0].clientX - start.current.x;
      const dy = e.touches[0].clientY - start.current.y;
      if (!pulling.current) {
        // Upward or sideways swipes (carousels) are left alone
        if (dy < 8 || Math.abs(dx) > dy || window.scrollY > 0) {
          if (dy < 0 || Math.abs(dx) > 8) start.current = null;
          return;
        }
        pulling.current = true;
      }
      e.preventDefault();
      set(Math.min(MAX_PULL, Math.max(0, dy * 0.5)));
    };

    const onEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;
      start.current = null;
      if (pullRef.current >= TRIGGER) {
        setRefreshing(true);
        set(TRIGGER);
        // A moment for the spinner to show, then load the latest version of everything
        setTimeout(() => window.location.reload(), 350);
      } else {
        set(0);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [disabled, refreshing]);

  if (!pull && !refreshing) return null;

  const ready = pull >= TRIGGER;
  return (
    <div
      className="fixed inset-x-0 top-0 z-[55] flex justify-center pointer-events-none"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      role="status"
      aria-live="polite"
    >
      <div
        className={`mt-2 w-11 h-11 rounded-full border flex items-center justify-center shadow-lg ${
          ready || refreshing ? "bg-amber-500 border-amber-400 text-zinc-950" : "bg-zinc-900 border-zinc-700 text-zinc-300"
        }`}
        style={{
          transform: `translateY(${pull - 44}px)`,
          opacity: Math.min(1, pull / 40),
          transition: pulling.current ? "none" : "transform 0.25s ease, opacity 0.25s ease"
        }}
      >
        {refreshing ? (
          <RefreshCw className="w-5 h-5 animate-spin" aria-hidden="true" />
        ) : (
          <ArrowDown className="w-5 h-5" style={{ transform: `rotate(${ready ? 180 : 0}deg)`, transition: "transform 0.2s ease" }} aria-hidden="true" />
        )}
        <span className="sr-only">{refreshing ? "Refreshing" : ready ? "Let go to refresh" : "Pull to refresh"}</span>
      </div>
    </div>
  );
}

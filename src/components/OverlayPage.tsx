import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { ChevronLeft, X } from "lucide-react";
import { User } from "../types.ts";

// A full-screen page that slides over the app, used for film pages and member pages.
// Opening one from another stacks them, so the button goes back to the previous page.
export function OverlayPage({ label, canGoBack, onClose, children }: { label: string; canGoBack: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[45] bg-zinc-950 overflow-y-auto overscroll-contain"
    >
      <div className="sticky top-0 z-10 bg-ink-deep/95 backdrop-blur-md border-b border-zinc-800 pt-[env(safe-area-inset-top)]">
        <div className="max-w-3xl mx-auto px-2 sm:px-4 h-14 flex items-center">
          <button type="button" onClick={onClose} className="min-h-11 pl-2 pr-4 rounded-xl text-zinc-200 hover:text-amber-500 flex items-center gap-1 cursor-pointer">
            {canGoBack ? <ChevronLeft className="w-5 h-5" /> : <X className="w-5 h-5" />}
            {canGoBack ? "Back" : "Close"}
          </button>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 pb-[max(3rem,env(safe-area-inset-bottom))]">{children}</div>
    </motion.div>,
    document.body
  );
}

export function Avatar({ user, name, className }: { user?: User; name: string; className: string }) {
  return user?.avatarUrl ? (
    <img src={user.avatarUrl} alt="" className={`${className} rounded-full object-cover shrink-0`} referrerPolicy="no-referrer" />
  ) : (
    <span className={`${className} rounded-full bg-slate text-zinc-100 text-xs font-semibold flex items-center justify-center shrink-0`}>{name.substring(0, 2).toUpperCase()}</span>
  );
}

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex text-lg leading-none shrink-0" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden="true" className={n <= rating ? "text-amber-500" : n - 0.5 === rating ? "text-amber-700" : "text-zinc-700"}>★</span>
      ))}
    </span>
  );
}

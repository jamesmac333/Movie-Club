import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { CalendarPlus, Check, ChevronRight, Link, X } from "lucide-react";

// The club calendar's private link, fetched once and shared by every button
let linkRequest: Promise<string | null> | null = null;
function getCalendarPath(): Promise<string | null> {
  linkRequest ??= fetch("/api/calendar-link")
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => data?.path || null)
    .catch(() => {
      linkRequest = null;
      return null;
    });
  return linkRequest;
}

const isIPhone = () => /iPhone|iPod/.test(navigator.userAgent);

// Subscribes the member's calendar to every club night. Their calendar app re-checks the feed,
// so moved dates and new picks update by themselves. Members choose Apple or Google Calendar,
// since Google only adds subscriptions through its own website.
export default function AddToCalendarButton({ className = "" }: { className?: string }) {
  const [path, setPath] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getCalendarPath().then(setPath);
  }, []);

  if (!path) return null;

  const httpsUrl = `${window.location.origin}${path}`;
  const webcalUrl = httpsUrl.replace(/^https?:/, "webcal:");
  const googleUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(httpsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link into your calendar app:", httpsUrl);
    }
  };

  const option = "min-h-16 w-full rounded-2xl bg-zinc-800 hover:bg-zinc-700 px-4 py-3 flex items-center gap-3 text-left cursor-pointer";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`min-h-12 px-6 rounded-2xl bg-red-700 hover:bg-red-600 text-ticket font-semibold text-base flex items-center justify-center gap-2 cursor-pointer ${className}`}
      >
        <CalendarPlus className="w-5 h-5" />
        Add to calendar
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
              <motion.div
                className="absolute inset-0 bg-black/80"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpen(false)}
              />
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-calendar-title"
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="relative w-full md:max-w-md bg-zinc-900 border-t md:border border-zinc-800 rounded-t-[28px] md:rounded-3xl px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-4"
              >
                <span aria-hidden="true" className="self-center w-10 h-1.5 rounded-full bg-zinc-700 md:hidden" />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id="add-calendar-title" className="font-serif text-2xl text-zinc-50">Add Movie Club to your calendar</h2>
                    <p className="text-sm text-zinc-400 mt-1">Every club night, kept up to date when dates move or films are picked.</p>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="w-11 h-11 shrink-0 rounded-full bg-zinc-800 text-zinc-100 flex items-center justify-center cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <a href={webcalUrl} onClick={() => setOpen(false)} className={option}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-zinc-100">Apple Calendar</span>
                    <span className="block text-sm text-zinc-400">The Calendar app on iPhone, iPad and Mac</span>
                  </span>
                  <ChevronRight className="w-5 h-5 text-zinc-500 shrink-0" />
                </a>

                <a href={googleUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className={option}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-zinc-100">Google Calendar</span>
                    <span className="block text-sm text-zinc-400">
                      Saves to your Google account, so it shows in the Google Calendar app.
                      {isIPhone() && " If Google doesn't offer to add it on your phone, do this once on a computer."}
                    </span>
                  </span>
                  <ChevronRight className="w-5 h-5 text-zinc-500 shrink-0" />
                </a>

                <button type="button" onClick={copyLink} className="min-h-11 self-center px-3 text-sm text-zinc-400 hover:text-amber-500 flex items-center gap-1.5 cursor-pointer">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Link className="w-4 h-4" />}
                  {copied ? "Link copied" : "Something else? Copy the link"}
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

import React, { useEffect, useState } from "react";
import { CalendarPlus, Check, Link } from "lucide-react";

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

interface AddToCalendarButtonProps {
  className?: string;
  // Also offer the plain link, for calendars that can't open webcal:// links (e.g. Google Calendar)
  showCopyLink?: boolean;
}

// Subscribes the member's calendar to every club night. Their calendar app re-checks the feed,
// so moved dates and new picks update by themselves.
export default function AddToCalendarButton({ className = "", showCopyLink = false }: AddToCalendarButtonProps) {
  const [path, setPath] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getCalendarPath().then(setPath);
  }, []);

  if (!path) return null;

  const httpsUrl = `${window.location.origin}${path}`;
  const webcalUrl = httpsUrl.replace(/^https?:/, "webcal:");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(httpsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link into your calendar app:", httpsUrl);
    }
  };

  return (
    <>
      <a
        href={webcalUrl}
        className={`min-h-12 px-6 rounded-2xl bg-red-700 hover:bg-red-600 text-ticket font-semibold text-base flex items-center justify-center gap-2 ${className}`}
      >
        <CalendarPlus className="w-5 h-5" />
        Add to calendar
      </a>
      {showCopyLink && (
        <button
          type="button"
          onClick={copyLink}
          className="min-h-11 px-3 text-sm text-zinc-400 hover:text-amber-500 flex items-center gap-1.5 cursor-pointer"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Link className="w-4 h-4" />}
          {copied ? "Link copied" : "Using Google Calendar? Copy the link"}
        </button>
      )}
    </>
  );
}

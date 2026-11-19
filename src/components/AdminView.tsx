import React, { useState } from "react";
import { CalendarClock, ChevronDown, Disc3, Mail, RefreshCw, ShieldCheck, Users } from "lucide-react";
import ThemeAdminPanel from "./ThemeAdminPanel.tsx";
import { MovieNight, NightOverview, NightPush, Review, User, ROTATION_MEMBERS } from "../types.ts";
import OverviewForm from "./OverviewForm.tsx";
import GapTracker from "./GapTracker.tsx";
import BestReviewPicks from "./BestReviewPicks.tsx";
import AdminMembersPanel from "./AdminMembersPanel.tsx";
import EdmAdminManager from "./EdmAdminManager.tsx";

interface AdminViewProps {
  currentUser: User;
  nights: MovieNight[];
  reviews: Review[];
  overviews: NightOverview[];
  members: User[];
  onPostOverview: (movieNightId: string, title: string, content: string, imageUrl: string) => Promise<void>;
  onUpdateOverviewImage: (overviewId: string, imageUrl: string) => Promise<void>;
  onRealignRotation: () => Promise<void>;
  // Reloads the schedule after dates are re-aligned
  onNightsChanged?: () => void;
  onUserUpdate: () => void;
  onOpenMember: (name: string) => void;
  // Opens the recap writer on this night, when Ash came from the prompt on Home
  recapNightId?: string;
  // Only Ash picks best reviews
  isAsh: boolean;
  onToggleStarReview: (reviewId: string) => Promise<void>;
  showBestReviews?: boolean;
  onShownBestReviews?: () => void;
  onOpenWheel: () => void;
  onThemesChanged: () => void;
  // Bumped when the wheel closes, so the theme list reloads
  themesRefreshKey?: number;
  // Open the Themes section straight away (from the suggestions card on Home)
  openThemes?: boolean;
  onOpenedThemes?: () => void;
}

// A section that stays folded until it's needed, so the recap writer stays at the top
function Fold({ id, title, subtitle, icon: Icon, children, defaultOpen = false }: { id: string; title: string; subtitle: string; icon: typeof Users; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (defaultOpen) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  return (
    <section ref={ref} aria-labelledby={`${id}-heading`} className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
      <h2 id={`${id}-heading`}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen(!open)}
          className="w-full min-h-16 px-5 py-4 flex items-center gap-3 text-left cursor-pointer"
        >
          <Icon className="w-5 h-5 text-amber-500 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block font-serif text-2xl text-zinc-50">{title}</span>
            <span className="block text-sm text-zinc-400">{subtitle}</span>
          </span>
          <ChevronDown className={`w-5 h-5 text-zinc-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </h2>
      {open && (
        <div id={`${id}-body`} className="px-5 pb-5">
          {children}
        </div>
      )}
    </section>
  );
}

function RotationPanel({ onRealignRotation }: { onRealignRotation: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const order = ROTATION_MEMBERS.map((m) => m.shortName).join(", ");

  const realign = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await onRealignRotation();
      setMessage({ ok: true, text: "Upcoming nights are back in the usual order." });
    } catch (err: any) {
      setMessage({ ok: false, text: err.message || "Couldn't re-align the rotation." });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-300">
        Puts every upcoming night back in the usual host order: {order}. Nights already watched aren't touched.
      </p>
      {confirming ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-amber-500">This changes who hosts each upcoming night. Carry on?</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="flex-1 min-h-12 rounded-2xl border border-zinc-700 text-zinc-300 font-semibold cursor-pointer">
              Cancel
            </button>
            <button type="button" onClick={realign} disabled={busy} className="flex-1 min-h-12 rounded-2xl bg-red-700 hover:bg-red-600 disabled:opacity-60 text-ticket font-semibold cursor-pointer">
              {busy ? "Re-aligning…" : "Yes, re-align"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="min-h-12 rounded-2xl border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 font-semibold flex items-center justify-center gap-2 cursor-pointer">
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Re-align the rotation
        </button>
      )}
      {message && <p role="status" className={`text-sm ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>}
    </div>
  );
}

// Puts upcoming dates back on a fortnightly Friday rhythm from the next night, after a preview
function RealignDatesPanel({ nights, onNightsChanged }: { nights: MovieNight[]; onNightsChanged?: () => void }) {
  const [preview, setPreview] = useState<NightPush[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const day = (d: string) => new Date(d).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
  const next = [...nights].filter((n) => n.status === "scheduled").sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  const call = async (apply: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/nights/realign-dates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apply }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't re-align the dates.");
      if (apply) {
        setPreview(null);
        setMessage({ ok: true, text: data.changes.length ? `Moved ${data.changes.length} night${data.changes.length === 1 ? "" : "s"}.` : "Already on track." });
        onNightsChanged?.();
      } else if (!data.changes.length) {
        setMessage({ ok: true, text: "Every upcoming night is already a fortnight apart on a Friday." });
      } else {
        setPreview(data.changes);
      }
    } catch (err: any) {
      setMessage({ ok: false, text: err.message || "Couldn't re-align the dates." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pt-5 mt-1 border-t border-zinc-800">
      <p className="text-sm text-zinc-300">
        Puts the dates back on track if rescheduling has made a mess of them. {next ? `${next.selector.split(" ")[0]}'s night (${day(next.date)}) stays where it is` : "The next night stays where it is"}, and every night after it is set a fortnight apart, on Fridays at 7 pm. Hosts don't change.
      </p>
      {preview ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-amber-500">These nights will move:</p>
          <ul className="text-sm text-zinc-200 space-y-0.5">
            {preview.map((p) => (
              <li key={p.id}>
                {p.selector.split(" ")[0]}: {day(p.from)} → <span className="font-semibold">{day(p.to)}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPreview(null)} disabled={busy} className="flex-1 min-h-12 rounded-2xl border border-zinc-700 text-zinc-300 font-semibold cursor-pointer">
              Cancel
            </button>
            <button type="button" onClick={() => call(true)} disabled={busy} className="flex-1 min-h-12 rounded-2xl bg-red-700 hover:bg-red-600 disabled:opacity-60 text-ticket font-semibold cursor-pointer">
              {busy ? "Moving…" : "Move them"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => call(false)} disabled={busy} className="min-h-12 rounded-2xl border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 font-semibold flex items-center justify-center gap-2 cursor-pointer">
          <CalendarClock className="w-4 h-4" aria-hidden="true" />
          {busy ? "Checking…" : "Re-align dates"}
        </button>
      )}
      {message && <p role="status" className={`text-sm ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>}
    </div>
  );
}

// Everything only Ash and James can do, in one place. Per-night controls stay on the nights themselves.
export default function AdminView({ currentUser, nights, reviews, overviews, members, onPostOverview, onUpdateOverviewImage, onRealignRotation, onUserUpdate, onNightsChanged, onOpenMember, recapNightId, isAsh, onToggleStarReview, showBestReviews, onShownBestReviews, onOpenWheel, onThemesChanged, themesRefreshKey, openThemes, onOpenedThemes }: AdminViewProps) {
  // Remember the request to open Themes for this visit, then clear it
  const [themesOpen] = useState(!!openThemes);
  React.useEffect(() => {
    if (openThemes) onOpenedThemes?.();
  }, []);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="slate text-zinc-400 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-amber-500" aria-hidden="true" />
          Ash and James only
        </p>
        <h1 className="font-serif text-4xl text-zinc-50">Admin</h1>
      </div>

      <OverviewForm initialNightId={recapNightId} nights={nights} currentUser={currentUser} onPostOverview={onPostOverview} overviews={overviews} onUpdateOverviewImage={onUpdateOverviewImage} />

      <GapTracker nights={nights} reviews={reviews} members={members} onOpenMember={onOpenMember} />

      {isAsh && <BestReviewPicks nights={nights} reviews={reviews} members={members} onToggleStar={onToggleStarReview} scrollIntoView={showBestReviews} onScrolled={onShownBestReviews} />}

      <Fold id="admin-themes" title="Themes" subtitle="The wheel, the theme list and members' suggestions" icon={Disc3} defaultOpen={themesOpen}>
        <ThemeAdminPanel nights={nights} onOpenWheel={onOpenWheel} onChanged={onThemesChanged} refreshKey={themesRefreshKey} />
      </Fold>

      <Fold id="admin-members" title="Members" subtitle="Photos, password resets and backups" icon={Users}>
        <AdminMembersPanel currentUser={currentUser} users={members} onUserUpdate={onUserUpdate} />
      </Fold>

      <Fold id="admin-emails" title="Club emails" subtitle="Who gets club emails, and what was sent" icon={Mail}>
        <EdmAdminManager currentUser={currentUser} />
      </Fold>

      <Fold id="admin-rotation" title="Rotation" subtitle="Put upcoming hosts and dates back in order" icon={RefreshCw}>
        <RotationPanel onRealignRotation={onRealignRotation} />
        <RealignDatesPanel nights={nights} onNightsChanged={onNightsChanged} />
      </Fold>
    </div>
  );
}

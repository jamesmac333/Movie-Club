import React, { useState } from "react";
import { ChevronDown, Mail, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { MovieNight, NightOverview, Review, User, ROTATION_MEMBERS } from "../types.ts";
import OverviewForm from "./OverviewForm.tsx";
import GapTracker from "./GapTracker.tsx";
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
  onUserUpdate: () => void;
  onOpenMember: (name: string) => void;
  // Opens the recap writer on this night, when Ash came from the prompt on Home
  recapNightId?: string;
}

// A section that stays folded until it's needed, so the recap writer stays at the top
function Fold({ id, title, subtitle, icon: Icon, children }: { id: string; title: string; subtitle: string; icon: typeof Users; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby={`${id}-heading`} className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
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

// Everything only Ash and James can do, in one place. Per-night controls stay on the nights themselves.
export default function AdminView({ currentUser, nights, reviews, overviews, members, onPostOverview, onUpdateOverviewImage, onRealignRotation, onUserUpdate, onOpenMember, recapNightId }: AdminViewProps) {
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

      <Fold id="admin-members" title="Members" subtitle="Photos, password resets and backups" icon={Users}>
        <AdminMembersPanel currentUser={currentUser} users={members} onUserUpdate={onUserUpdate} />
      </Fold>

      <Fold id="admin-emails" title="Club emails" subtitle="Who gets club emails, and what was sent" icon={Mail}>
        <EdmAdminManager currentUser={currentUser} />
      </Fold>

      <Fold id="admin-rotation" title="Rotation" subtitle="Put upcoming hosts back in order" icon={RefreshCw}>
        <RotationPanel onRealignRotation={onRealignRotation} />
      </Fold>
    </div>
  );
}

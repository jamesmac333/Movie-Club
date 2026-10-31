import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Award, ChevronRight, Loader2, Star, X } from "lucide-react";
import { MovieNight, Review, User } from "../types.ts";
import { bestReviewStatus } from "../clubStats.ts";
import { Avatar } from "./OverlayPage.tsx";

type Status = ReturnType<typeof bestReviewStatus<MovieNight, Review>>[number];

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });

function Poster({ night }: { night: MovieNight }) {
  return night.movie?.posterUrl ? (
    <img src={night.movie.posterUrl} alt="" className="w-9 aspect-[2/3] rounded object-cover border border-zinc-700 shrink-0" referrerPolicy="no-referrer" />
  ) : (
    <span className="w-9 aspect-[2/3] rounded bg-slate border border-zinc-700 shrink-0" />
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500 text-sm tracking-tight" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(Math.floor(rating))}
      {rating % 1 ? "½" : ""}
    </span>
  );
}

// Every member's review of one night, with a button to make one of them Ash's pick
function PickSheet({ status, members, onToggleStar, onClose }: { status: Status; members: User[]; onToggleStar: (reviewId: string) => Promise<void>; onClose: () => void }) {
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const night = status.night;

  const choose = async (review: Review) => {
    setSaving(review.id);
    setError("");
    try {
      await onToggleStar(review.id);
      if (!review.isStarred) onClose();
    } catch (err: any) {
      setError(err?.message || "Couldn't save your pick. Please try again.");
    } finally {
      setSaving("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <motion.div className="absolute inset-0 bg-black/80" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pick-sheet-title"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="relative w-full md:max-w-lg bg-zinc-900 border-t md:border border-zinc-800 rounded-t-[28px] md:rounded-3xl px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-4 max-h-[92dvh] overflow-y-auto"
      >
        <div className="mx-auto w-10 h-1.5 rounded-full bg-zinc-700 md:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-zinc-400">{shortDate(night.date)} · {night.selector.split(" ")[0]} chose this film</p>
            <h2 id="pick-sheet-title" className="font-serif text-3xl text-zinc-50 leading-tight break-words">Best review of {night.movie?.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <ul className="flex flex-col gap-3">
          {[...status.reviews].sort((a, b) => b.rating - a.rating).map((review) => {
            const member = members.find((m) => m.name.toLowerCase() === review.user.toLowerCase());
            const first = review.user.split(" ")[0];
            return (
              <li key={review.id} className={`rounded-2xl border p-4 flex flex-col gap-3 ${review.isStarred ? "border-amber-500/60 bg-amber-500/5" : "border-zinc-800 bg-zinc-950/40"}`}>
                <div className="flex items-center gap-3">
                  <Avatar user={member} name={review.user} className="w-9 h-9" badgeSize="sm" />
                  <span className="font-semibold text-zinc-100 flex-1">{first}</span>
                  <Stars rating={review.rating} />
                </div>
                <p className="text-zinc-300 whitespace-pre-line break-words">{review.comment}</p>
                <button
                  type="button"
                  onClick={() => choose(review)}
                  disabled={!!saving}
                  className={`min-h-11 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 ${
                    review.isStarred ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800" : "border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                  }`}
                >
                  {saving === review.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className={`w-4 h-4 ${review.isStarred ? "" : "fill-amber-500"}`} aria-hidden="true" />}
                  {review.isStarred ? "Remove pick" : `Pick ${first}'s review`}
                </button>
              </li>
            );
          })}
        </ul>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      </motion.div>
    </div>
  );
}

interface BestReviewPicksProps {
  nights: MovieNight[];
  reviews: Review[];
  members: User[];
  onToggleStar: (reviewId: string) => Promise<void>;
  // Arriving from the nudge on Home: bring this section into view
  scrollIntoView?: boolean;
  onScrolled?: () => void;
}

// Admin tab, for Ash: nights where everyone has reviewed, ready for her to pick the best review
export default function BestReviewPicks({ nights, reviews, members, onToggleStar, scrollIntoView, onScrolled }: BestReviewPicksProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!scrollIntoView) return;
    ref.current?.scrollIntoView({ block: "start" });
    onScrolled?.();
  }, [scrollIntoView]);
  const status = bestReviewStatus(nights, reviews, members.map((m) => m.name));
  const ready = status.filter((s) => s.ready && !s.pick);
  const picked = status.filter((s) => s.pick);
  const waiting = status.filter((s) => !s.ready && !s.pick);
  const open = status.find((s) => s.night.id === openId);

  const row = (s: Status, right: React.ReactNode) => (
    <li key={s.night.id}>
      <button type="button" onClick={() => setOpenId(s.night.id)} className="w-full min-h-16 py-3 flex items-center gap-3 text-left cursor-pointer group">
        <Poster night={s.night} />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-zinc-100 leading-snug break-words group-hover:text-amber-500">{s.night.movie?.title}</span>
          <span className="block text-sm text-zinc-400">{shortDate(s.night.date)}</span>
        </span>
        <span className="shrink-0 flex items-center gap-0.5 text-sm font-semibold">{right}<ChevronRight className="w-4 h-4 text-zinc-500" aria-hidden="true" /></span>
      </button>
    </li>
  );

  return (
    <section ref={ref} id="best-review-picks" aria-labelledby="best-review-picks-heading" className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-col gap-4 scroll-mt-24">
      <div className="flex flex-col gap-1">
        <h2 id="best-review-picks-heading" className="font-serif text-3xl text-zinc-50 flex items-center gap-2">
          <Award className="w-6 h-6 text-amber-500" aria-hidden="true" />
          Best reviews
        </h2>
        <p className="text-sm text-zinc-400">Once everyone has reviewed a night, pick the best review. It shows as Ash's pick in Memories and on the film's page.</p>
      </div>

      {ready.length > 0 && (
        <div>
          <h3 className="slate text-amber-500">Ready to pick · {ready.length}</h3>
          <ul className="divide-y divide-zinc-800">{ready.map((s) => row(s, <span className="text-amber-500">Pick</span>))}</ul>
        </div>
      )}

      {ready.length === 0 && <p className="text-zinc-300">Nothing to pick right now. Nights appear here once every member has reviewed them.</p>}

      {waiting.length > 0 && (
        <div>
          <h3 className="slate text-zinc-400">Waiting on reviews</h3>
          <ul className="divide-y divide-zinc-800">
            {waiting.map((s) => (
              <li key={s.night.id} className="min-h-14 py-2.5 flex items-center gap-3">
                <Poster night={s.night} />
                <span className="min-w-0 flex-1 font-semibold text-zinc-300 leading-snug break-words">{s.night.movie?.title}</span>
                <span className="text-sm text-zinc-400 shrink-0">{s.reviewed} of {s.total} reviewed</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {picked.length > 0 && (
        <div>
          <h3 className="slate text-zinc-400">Picked</h3>
          <ul className="divide-y divide-zinc-800">{picked.map((s) => row(s, <span className="text-zinc-300">{s.pick!.user.split(" ")[0]}</span>))}</ul>
        </div>
      )}

      <AnimatePresence>
        {open && <PickSheet status={open} members={members} onToggleStar={onToggleStar} onClose={() => setOpenId(null)} />}
      </AnimatePresence>
    </section>
  );
}

// Home, for Ash: a nudge when nights are ready for her pick
export function BestReviewNudge({ nights, reviews, members, onOpen }: { nights: MovieNight[]; reviews: Review[]; members: User[]; onOpen: () => void }) {
  const ready = bestReviewStatus(nights, reviews, members.map((m) => m.name)).filter((s) => s.ready && !s.pick);
  if (!ready.length) return null;
  const titles = ready.map((s) => s.night.movie?.title).join(", ");
  return (
    <section aria-labelledby="best-review-nudge" className="bg-zinc-900 border border-amber-800 rounded-2xl overflow-hidden">
      <button type="button" onClick={onOpen} className="w-full min-h-16 px-4 py-3 flex items-center gap-3 text-left cursor-pointer">
        <Award className="w-6 h-6 text-amber-500 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <h2 id="best-review-nudge" className="font-serif text-xl text-zinc-50">
            {ready.length === 1 ? "A night is ready for your best-review pick" : `${ready.length} nights are ready for your best-review pick`}
          </h2>
          <span className="block text-sm text-zinc-400 break-words">Everyone has reviewed {titles}.</span>
        </span>
        <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" aria-hidden="true" />
      </button>
    </section>
  );
}

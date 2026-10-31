import React, { useState } from "react";
import { AnimatePresence } from "motion/react";
import { Check, Loader2, PenLine } from "lucide-react";
import { MovieNight, Review, User, DATA_LOSS_DATE } from "../types.ts";
import { watchedFilms } from "../clubStats.ts";
import ReviewSheet from "./ReviewSheet.tsx";

const SKIPPED_KEY = "movie_club_gap_fill_skipped";

function loadSkipped(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SKIPPED_KEY) || "[]");
  } catch {
    return [];
  }
}

interface GapFillCardProps {
  nights: MovieNight[];
  reviews: Review[];
  currentUser: User;
  onAddReview: (movieNightId: string, user: string, rating: number, comment: string) => Promise<void>;
  onOpenFilm: (nightId: string) => void;
}

// Reviews from before the data loss were wiped. Lists each of those films the member hasn't
// rated, so one tap per film rebuilds the club's ratings. Words are optional.
export default function GapFillCard({ nights, reviews, currentUser, onAddReview, onOpenFilm }: GapFillCardProps) {
  const [skipped, setSkipped] = useState<string[]>(loadSkipped);
  // Films rated during this visit stay listed, so members can see it saved and add words
  const [savedHere, setSavedHere] = useState<string[]>([]);
  const [saving, setSaving] = useState<{ id: string; rating: number } | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [sheetNight, setSheetNight] = useState<MovieNight | null>(null);

  const myReview = (nightId: string) => reviews.find((r) => r.movieNightId === nightId && r.user === currentUser.name);
  const oldFilms = watchedFilms(nights).filter((n) => n.date.slice(0, 10) < DATA_LOSS_DATE);
  const rows = oldFilms.filter((n) => savedHere.includes(n.id) || (!myReview(n.id) && !skipped.includes(n.id)));
  if (rows.length === 0) return null;

  const ratedCount = oldFilms.filter((n) => myReview(n.id)).length;

  const rate = async (night: MovieNight, rating: number) => {
    setSaving({ id: night.id, rating });
    setError(null);
    try {
      await onAddReview(night.id, currentUser.name, rating, myReview(night.id)?.comment || "");
      setSavedHere((prev) => (prev.includes(night.id) ? prev : [...prev, night.id]));
    } catch (err: any) {
      setError({ id: night.id, message: err?.message || "Couldn't save that. Please try again." });
    } finally {
      setSaving(null);
    }
  };

  const skip = (nightId: string) => {
    const next = [...skipped, nightId];
    setSkipped(next);
    try {
      localStorage.setItem(SKIPPED_KEY, JSON.stringify(next));
    } catch {}
  };

  return (
    <section aria-labelledby="gap-fill" className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="gap-fill" className="font-serif text-3xl text-zinc-50">Fill in the gaps</h2>
          <span className="text-sm text-zinc-400 shrink-0">{ratedCount} of {oldFilms.length} rated</span>
        </div>
        <p className="text-sm text-zinc-400">
          Reviews from before 14 October were lost. Tap the stars for each film you remember. Words are optional.
        </p>
      </div>

      <ul className="divide-y divide-zinc-800 border-t border-zinc-800">
        {rows.map((night) => {
          const mine = myReview(night.id);
          const shown = saving?.id === night.id ? saving.rating : mine?.rating || 0;
          const date = new Date(night.date).toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
          return (
            <li key={night.id} className="px-5 py-4 flex flex-col gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button type="button" onClick={() => onOpenFilm(night.id)} className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer">
                  {night.movie!.posterUrl ? (
                    <img src={night.movie!.posterUrl} alt="" className="w-11 aspect-[2/3] rounded-md object-cover border border-zinc-700 shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="w-11 aspect-[2/3] rounded-md bg-slate border border-zinc-700 shrink-0" />
                  )}
                  <span className="min-w-0">
                    <span className="block font-semibold text-zinc-100 break-words">{night.movie!.title}</span>
                    <span className="block text-sm text-zinc-400">{date} · {night.selector.split(" ")[0]}'s pick</span>
                  </span>
                </button>
                {!mine && (
                  <button type="button" onClick={() => skip(night.id)} className="min-h-11 px-2 text-sm text-zinc-500 hover:text-zinc-200 shrink-0 cursor-pointer">
                    Wasn't there
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div role="group" aria-label={`Rate ${night.movie!.title}`} className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={!!saving}
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      aria-pressed={Math.floor(shown) >= n}
                      onClick={() => rate(night, n)}
                      className={`w-11 h-11 text-4xl leading-none cursor-pointer disabled:cursor-wait ${n <= shown ? "text-amber-500" : n - 0.5 === shown ? "text-amber-700" : "text-zinc-700 hover:text-amber-700"}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                {saving?.id === night.id ? (
                  <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" aria-label="Saving" />
                ) : mine ? (
                  <span className="flex items-center gap-2 text-sm">
                    <span className="flex items-center gap-1 text-emerald-400"><Check className="w-4 h-4" />Saved</span>
                    <button type="button" onClick={() => setSheetNight(night)} className="min-h-11 px-2 text-zinc-300 hover:text-amber-500 flex items-center gap-1.5 cursor-pointer">
                      <PenLine className="w-4 h-4" />
                      {mine.comment ? "Edit words" : "Add words"}
                    </button>
                  </span>
                ) : null}
              </div>
              {error?.id === night.id && <p role="alert" className="text-sm text-red-400">{error.message}</p>}
            </li>
          );
        })}
      </ul>

      <AnimatePresence>
        {sheetNight && (
          <ReviewSheet
            night={sheetNight}
            initialRating={myReview(sheetNight.id)?.rating || 0}
            initialComment={myReview(sheetNight.id)?.comment || ""}
            commentOptional
            onClose={() => setSheetNight(null)}
            onSubmit={(rating, comment) => onAddReview(sheetNight.id, currentUser.name, rating, comment)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

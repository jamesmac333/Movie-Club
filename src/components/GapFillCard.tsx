import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { MovieNight, Review, User, DATA_LOSS_DATE } from "../types.ts";
import { gapFillProgress } from "../clubStats.ts";
import ReviewSheet from "./ReviewSheet.tsx";
import GapsCelebration from "./GapsCelebration.tsx";

// Left open and untouched this long, the card folds itself down to a one-line reminder
const AUTO_MINIMISE_MS = 30000;

interface GapFillCardProps {
  nights: MovieNight[];
  reviews: Review[];
  currentUser: User;
  onAddReview: (movieNightId: string, user: string, rating: number, comment: string) => Promise<void>;
}

// Reviews from before the data loss were wiped. This is a task each member chips away at:
// every lost night needs a rating and a few words. Finished nights drop off,
// and finishing the lot sets off fireworks and earns a badge on the member's photo.
export default function GapFillCard({ nights, reviews, currentUser, onAddReview }: GapFillCardProps) {
  const [sheet, setSheet] = useState<{ night: MovieNight; rating: number } | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const hadGaps = useRef(false);

  // Minimised, the card is a slim reminder bar. Remembered on this phone, per member.
  const storageKey = `movie_club_gaps_minimised_${currentUser.username}`;
  const [minimised, setMinimised] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });
  const minimise = (value: boolean) => {
    setMinimised(value);
    try {
      localStorage.setItem(storageKey, value ? "1" : "0");
    } catch {}
  };
  // Bumped whenever the member taps or types in the card, which restarts the auto-minimise timer
  const [touched, setTouched] = useState(0);
  const touch = () => setTouched((n) => n + 1);
  useEffect(() => {
    if (minimised || sheet) return;
    const timer = setTimeout(() => minimise(true), AUTO_MINIMISE_MS);
    return () => clearTimeout(timer);
  }, [minimised, sheet, touched]);

  const progress = gapFillProgress(nights, reviews, currentUser.name, DATA_LOSS_DATE);
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const myReview = (nightId: string) => reviews.find((r) => r.movieNightId === nightId && r.user === currentUser.name);

  // Celebrate only when the last gap is filled in front of the member, not on later visits
  useEffect(() => {
    if (progress.remaining.length > 0) hadGaps.current = true;
    else if (hadGaps.current && progress.complete) {
      hadGaps.current = false;
      setCelebrating(true);
    }
  }, [progress.remaining.length, progress.complete]);

  const celebration = (
    <AnimatePresence>
      {celebrating && <GapsCelebration firstName={currentUser.name.split(" ")[0]} filmCount={progress.total} onClose={() => setCelebrating(false)} />}
    </AnimatePresence>
  );

  if (progress.total === 0 || progress.complete) return celebration;

  if (minimised) {
    return (
      <section aria-labelledby="gap-fill" className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <button
          type="button"
          aria-expanded={false}
          onClick={() => minimise(false)}
          className="w-full min-h-14 px-4 py-3 flex items-center gap-3 text-left cursor-pointer"
        >
          <span className="min-w-0 flex-1 flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-2">
              <h2 id="gap-fill" className="font-serif text-xl text-zinc-50">Fill in the gaps</h2>
              <span className="text-sm text-zinc-400 shrink-0">
                {progress.remaining.length} left · <span className="font-semibold text-amber-500">{percent}%</span>
              </span>
            </span>
            <span className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <span className="block h-full rounded-full bg-amber-500" style={{ width: `${percent}%` }} />
            </span>
          </span>
          <ChevronDown className="w-5 h-5 text-zinc-400 shrink-0" aria-hidden="true" />
          <span className="sr-only">Show</span>
        </button>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="gap-fill"
      onPointerDown={touch}
      onKeyDown={touch}
      onFocus={touch}
      className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden"
    >
      <div className="px-5 pt-5 pb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="gap-fill" className="font-serif text-3xl text-zinc-50">Fill in the gaps</h2>
          <span className="flex items-center gap-1 shrink-0">
            <span className="font-serif text-3xl text-amber-500">{percent}%</span>
            <button
              type="button"
              aria-expanded={true}
              aria-label="Minimise Fill in the gaps"
              onClick={() => minimise(true)}
              className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer"
            >
              <ChevronUp className="w-5 h-5" aria-hidden="true" />
            </button>
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Lost nights filled in"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
          className="h-3 rounded-full bg-zinc-800 overflow-hidden"
        >
          <motion.div className="h-full rounded-full bg-amber-500" initial={false} animate={{ width: `${percent}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
        </div>
        <p className="text-sm text-zinc-400">
          {progress.done} of {progress.total} done. Reviews from before 14 October were lost, so tap each night to give it stars and a few words.
          Finish them all for a badge on your photo.
        </p>
      </div>

      <ul className="border-t border-zinc-800">
        <AnimatePresence initial={false}>
          {progress.remaining.map((night) => {
            const mine = myReview(night.id);
            const date = new Date(night.date).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
            return (
              <motion.li
                key={night.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0, transition: { duration: 0.35 } }}
                className="border-b border-zinc-800 last:border-b-0 overflow-hidden"
              >
                {/* The whole row opens the review sheet */}
                <button
                  type="button"
                  onClick={() => setSheet({ night, rating: mine?.rating || 0 })}
                  className="w-full min-h-16 px-5 py-3 flex items-center gap-3 text-left hover:bg-zinc-850 active:bg-zinc-850 cursor-pointer"
                >
                  {night.movie!.posterUrl ? (
                    <img src={night.movie!.posterUrl} alt="" className="w-9 aspect-[2/3] rounded object-cover border border-zinc-700 shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="w-9 aspect-[2/3] rounded bg-slate border border-zinc-700 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-zinc-100 leading-snug break-words">{night.movie!.title}</span>
                    <span className="block text-sm text-zinc-400">{date}</span>
                  </span>
                  <span className="shrink-0 flex items-center gap-0.5 text-sm font-semibold text-amber-500">
                    {mine ? "Add words" : "Review"}
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </span>
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <AnimatePresence>
        {sheet && (
          <ReviewSheet
            night={sheet.night}
            initialRating={sheet.rating}
            initialComment={myReview(sheet.night.id)?.comment || ""}
            onClose={() => setSheet(null)}
            onSubmit={(rating, comment) => onAddReview(sheet.night.id, currentUser.name, rating, comment)}
          />
        )}
      </AnimatePresence>
      {celebration}
    </section>
  );
}

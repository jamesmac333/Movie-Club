import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PenLine } from "lucide-react";
import { MovieNight, Review, User, DATA_LOSS_DATE } from "../types.ts";
import { gapFillProgress } from "../clubStats.ts";
import ReviewSheet from "./ReviewSheet.tsx";
import StarInput from "./StarInput.tsx";
import GapsCelebration from "./GapsCelebration.tsx";

// "Wasn't there" used to be kept on each device; it now lives on the server
const OLD_SKIPPED_KEY = "movie_club_gap_fill_skipped";

interface GapFillCardProps {
  nights: MovieNight[];
  reviews: Review[];
  currentUser: User;
  missedNights: string[];
  onAddReview: (movieNightId: string, user: string, rating: number, comment: string) => Promise<void>;
  onSetMissed: (nightId: string, missed: boolean) => Promise<void>;
  onOpenFilm: (nightId: string) => void;
}

// Reviews from before the data loss were wiped. This is a task each member chips away at:
// every lost night needs a rating and a few words (or "Wasn't there"). Finished nights drop off,
// and finishing the lot sets off fireworks and earns a badge on the member's photo.
export default function GapFillCard({ nights, reviews, currentUser, missedNights, onAddReview, onSetMissed, onOpenFilm }: GapFillCardProps) {
  const [sheet, setSheet] = useState<{ night: MovieNight; rating: number } | null>(null);
  const [undo, setUndo] = useState<MovieNight | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [celebrating, setCelebrating] = useState(false);
  const hadGaps = useRef(false);

  const progress = gapFillProgress(nights, reviews, currentUser.name, missedNights, DATA_LOSS_DATE);
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

  // Carry over "Wasn't there" taps saved on this device before they moved to the server
  useEffect(() => {
    let old: string[] = [];
    try {
      old = JSON.parse(localStorage.getItem(OLD_SKIPPED_KEY) || "[]");
      localStorage.removeItem(OLD_SKIPPED_KEY);
    } catch {}
    old.filter((id) => !missedNights.includes(id)).forEach((id) => onSetMissed(id, true).catch(() => {}));
  }, []);

  const markMissed = async (night: MovieNight, missed: boolean) => {
    setBusy(true);
    setError("");
    try {
      await onSetMissed(night.id, missed);
      setUndo(missed ? night : null);
    } catch {
      setError("Couldn't save that. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const celebration = (
    <AnimatePresence>
      {celebrating && <GapsCelebration firstName={currentUser.name.split(" ")[0]} filmCount={progress.total} onClose={() => setCelebrating(false)} />}
    </AnimatePresence>
  );

  if (progress.total === 0 || (progress.complete && !undo)) return celebration;

  return (
    <section aria-labelledby="gap-fill" className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
      <div className="px-5 pt-5 pb-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="gap-fill" className="font-serif text-3xl text-zinc-50">Fill in the gaps</h2>
          <span className="font-serif text-3xl text-amber-500 shrink-0">{percent}%</span>
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
          {progress.done} of {progress.total} lost nights done. Reviews from before 14 October were wiped, so give each one your stars and a few words.
          Finish them all to earn a badge on your profile photo.
        </p>
      </div>

      {undo && (
        <div className="mx-5 mb-3 rounded-2xl bg-zinc-800 px-4 py-2 flex items-center justify-between gap-3 text-sm">
          <span className="text-zinc-300 min-w-0">Marked as not there: {undo.movie!.title}</span>
          <button type="button" disabled={busy} onClick={() => markMissed(undo, false)} className="min-h-11 px-2 font-semibold text-amber-500 shrink-0 cursor-pointer">
            Undo
          </button>
        </div>
      )}
      {error && <p role="alert" className="px-5 pb-3 text-sm text-red-400">{error}</p>}

      <ul className="border-t border-zinc-800">
        <AnimatePresence initial={false}>
          {progress.remaining.map((night) => {
            const mine = myReview(night.id);
            const date = new Date(night.date).toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
            return (
              <motion.li
                key={night.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0, transition: { duration: 0.35 } }}
                className="border-b border-zinc-800 last:border-b-0 overflow-hidden"
              >
                <div className="px-5 py-4 flex flex-col gap-3">
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
                    <button type="button" disabled={busy} onClick={() => markMissed(night, true)} className="min-h-11 px-2 text-sm text-zinc-500 hover:text-zinc-200 shrink-0 cursor-pointer">
                      Wasn't there
                    </button>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <StarInput
                      value={mine?.rating || 0}
                      onChange={(rating) => setSheet({ night, rating })}
                      label={`Rate ${night.movie!.title}`}
                    />
                    {mine && (
                      <button type="button" onClick={() => setSheet({ night, rating: mine.rating })} className="min-h-11 px-2 text-sm text-amber-500 hover:text-amber-400 flex items-center gap-1.5 cursor-pointer">
                        <PenLine className="w-4 h-4" />
                        Add your review to finish
                      </button>
                    )}
                  </div>
                </div>
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

import React, { useState } from "react";
import { AnimatePresence } from "motion/react";
import { PenLine } from "lucide-react";
import { MovieNight, Review, User } from "../types.ts";
import PaletteStrip from "./PaletteStrip.tsx";
import ReviewSheet from "./ReviewSheet.tsx";

const REVIEW_WINDOW_DAYS = 7;

interface JustWatchedCardProps {
  nights: MovieNight[];
  reviews: Review[];
  users: User[];
  currentUser: User;
  onAddReview: (movieNightId: string, user: string, rating: number, comment: string) => Promise<void>;
}

// After a movie night, invites members who haven't reviewed it yet to rate it straight from Home
export default function JustWatchedCard({ nights, reviews, users, currentUser, onAddReview }: JustWatchedCardProps) {
  const [quickRating, setQuickRating] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);

  const now = Date.now();
  const night = nights
    .filter((n) => n.movie && n.status !== "skipped" && new Date(n.date).getTime() <= now && now - new Date(n.date).getTime() < REVIEW_WINDOW_DAYS * 86400000)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  if (!night) return null;

  const nightReviews = reviews.filter((r) => r.movieNightId === night.id);
  if (nightReviews.some((r) => r.user === currentUser.name)) return null;

  const reviewers = nightReviews
    .map((r) => users.find((u) => u.name === r.user))
    .filter((u): u is User => !!u);
  const toGo = Math.max(0, users.length - nightReviews.length);
  const firstNames = reviewers.map((u) => u.name.split(" ")[0]);
  const date = new Date(night.date).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
  const hostFirstName = night.selector.split(" ")[0];
  const movie = night.movie!;

  const openSheet = (rating = quickRating) => {
    setQuickRating(rating);
    setSheetOpen(true);
  };

  return (
    <section aria-labelledby="just-watched" className="bg-zinc-900 border border-amber-800 rounded-3xl overflow-hidden mb-8">
      <div className="flex items-baseline justify-between px-5 pt-5">
        <h2 id="just-watched" className="slate text-amber-500">Just watched</h2>
        <span className="text-sm text-zinc-400">{date}</span>
      </div>

      <div className="md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-8 md:px-5 md:pt-5">
      <div className="flex gap-4 items-end px-5 pt-4 md:p-0 md:block">
        {movie.posterUrl ? (
          <img src={movie.posterUrl} alt={`${movie.title} poster`} className="w-32 sm:w-40 md:w-full aspect-[2/3] object-cover rounded-xl border border-zinc-700 shadow-[0_14px_30px_rgba(0,0,0,0.45)] shrink-0" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-32 sm:w-40 md:w-full aspect-[2/3] rounded-xl bg-slate border border-zinc-700 shrink-0 flex items-end p-3">
            <span className="font-serif text-2xl leading-none text-ticket">{movie.title}</span>
          </div>
        )}
        <div className="min-w-0 pb-1 md:hidden">
          <p className="font-serif text-3xl leading-tight text-zinc-50">How was {movie.title}?</p>
          <p className="text-sm text-zinc-400 mt-1">{hostFirstName}'s pick · your review goes straight to Memories</p>
        </div>
      </div>

      <div className="min-w-0 md:flex md:flex-col md:justify-center md:max-w-xl">
      <div className="hidden md:block">
        <p className="font-serif text-5xl leading-tight text-zinc-50">How was {movie.title}?</p>
        <p className="text-base text-zinc-400 mt-2">{hostFirstName}'s pick · your review goes straight to Memories</p>
      </div>

      <div className="px-5 pt-4 md:px-0 md:pt-6">
        <PaletteStrip posterUrl={movie.posterUrl} className="h-5 rounded-md" />
      </div>

      <div className="px-5 pt-4 md:px-0">
        <p id="quick-rate" className="text-sm font-semibold text-zinc-400 mb-1">Tap to rate</p>
        <div role="group" aria-labelledby="quick-rate" className="flex justify-between max-w-sm">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
              onClick={() => openSheet(n)}
              className={`w-14 h-14 text-5xl leading-none cursor-pointer ${n <= quickRating ? "text-amber-500" : "text-zinc-700 hover:text-amber-700"}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pt-3 pb-5 md:px-0 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => openSheet()}
          className="min-h-14 rounded-2xl bg-red-700 hover:bg-red-600 text-ticket font-semibold text-lg flex items-center justify-center gap-2 cursor-pointer"
        >
          <PenLine className="w-5 h-5" />
          Write your review
        </button>
        <div className="flex items-center gap-3">
          {reviewers.length > 0 && (
            <div className="flex">
              {reviewers.slice(0, 5).map((u, i) =>
                u.avatarUrl ? (
                  <img key={u.username} src={u.avatarUrl} alt="" className={`w-7 h-7 rounded-full object-cover border-2 border-zinc-900 ${i ? "-ml-2" : ""}`} referrerPolicy="no-referrer" />
                ) : null
              )}
            </div>
          )}
          <span className="text-sm text-zinc-400">
            {firstNames.length === 0
              ? "Be the first to review it"
              : `${firstNames.length <= 2 ? firstNames.join(" and ") : `${firstNames.length} members`} ${firstNames.length === 1 ? "has" : "have"} reviewed · ${toGo} to go`}
          </span>
        </div>
      </div>
      </div>
      </div>

      <AnimatePresence>
        {sheetOpen && (
          <ReviewSheet
            night={night}
            initialRating={quickRating}
            onClose={() => setSheetOpen(false)}
            onSubmit={(rating, comment) => onAddReview(night.id, currentUser.name, rating, comment)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

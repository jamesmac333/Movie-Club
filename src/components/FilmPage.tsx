import React, { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import { Lock, PenLine, Play } from "lucide-react";
import { MovieNight, Review, NightOverview, User, isAuthenticGatheringPhoto, isBeforeDataLoss } from "../types.ts";
import { filmRatings } from "../clubStats.ts";
import PaletteStrip from "./PaletteStrip.tsx";
import ReviewSheet from "./ReviewSheet.tsx";
import { Avatar, OverlayPage, Stars } from "./OverlayPage.tsx";

interface FilmPageProps {
  night: MovieNight;
  reviews: Review[];
  sealed: boolean;
  overviews: NightOverview[];
  users: User[];
  currentUser: User;
  canGoBack: boolean;
  onClose: () => void;
  onOpenMember: (name: string) => void;
  onAddReview: (movieNightId: string, user: string, rating: number, comment: string) => Promise<void>;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// Everything about one club night's film in one place: everyone's ratings side by side,
// who loved it and who didn't, the reviews, and Ash's recap
export default function FilmPage({ night, reviews, sealed, overviews, users, currentUser, canGoBack, onClose, onOpenMember, onAddReview }: FilmPageProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const movie = night.movie!;
  const all = filmRatings(reviews, night.id);
  const { ratings, average, split } = sealed ? { ratings: [], average: null, split: null } : all;
  const mine = reviews.find((r) => r.movieNightId === night.id && r.user === currentUser.name);
  const notRated = users.filter((u) => !ratings.some((r) => r.user === u.name));
  const overview = overviews.find((o) => o.movieNightId === night.id);
  const userFor = (name: string) => users.find((u) => u.name === name);
  const first = (name: string) => name.split(" ")[0];
  const date = new Date(night.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const watched = night.status === "watched" || new Date(night.date).getTime() < Date.now();
  const facts = [movie.year, movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : null, movie.genre].filter(Boolean).join(" · ");

  return (
    <OverlayPage label={movie.title} canGoBack={canGoBack} onClose={onClose}>
      <PaletteStrip posterUrl={movie.posterUrl} className="h-2.5 -mx-4 sm:mx-0 sm:rounded-full" />

      <header className="flex gap-4 sm:gap-6 items-end mt-6">
        {movie.posterUrl ? (
          <img src={movie.posterUrl} alt={`${movie.title} poster`} className="w-32 sm:w-44 aspect-[2/3] rounded-xl object-cover border border-zinc-700 shadow-[0_14px_30px_rgba(0,0,0,0.45)] shrink-0" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-32 sm:w-44 aspect-[2/3] rounded-xl bg-slate border border-zinc-700 shrink-0" />
        )}
        <div className="min-w-0 pb-1 flex flex-col gap-1.5">
          <h1 className="font-serif text-3xl sm:text-5xl leading-tight text-zinc-50 break-words">{movie.title}</h1>
          {facts && <p className="text-sm text-zinc-400">{facts}</p>}
          {movie.director && <p className="slate text-zinc-300">A film by {movie.director}</p>}
        </div>
      </header>

      <p className="mt-5 text-zinc-300">
        <button type="button" onClick={() => onOpenMember(night.selector)} className="font-semibold text-zinc-100 hover:text-amber-500 cursor-pointer">{first(night.selector)}'s pick</button>
        <span className="text-zinc-500"> · {date}</span>
      </p>

      {movie.trailerUrl && (
        <a href={movie.trailerUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 px-4 rounded-xl border border-zinc-700 text-zinc-200 hover:text-amber-500 items-center gap-2">
          <Play className="w-4 h-4" />
          Watch the trailer
        </a>
      )}

      {watched && (
        <section aria-labelledby="film-ratings" className="mt-10">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <h2 id="film-ratings" className="font-serif text-3xl text-zinc-50">The club's verdict</h2>
            {average !== null && (
              <p className="text-amber-500 font-serif text-3xl leading-none">
                ★ {average.toFixed(1)}
                <span className="text-sm font-sans text-zinc-400"> from {ratings.length}</span>
              </p>
            )}
          </div>

          {sealed ? (
            <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-zinc-300">
                {all.ratings.length} review{all.ratings.length === 1 ? " is" : "s are"} in. Post yours to see what everyone else thought.
              </p>
            </div>
          ) : ratings.length === 0 ? (
            <p className="mt-4 text-zinc-400">No ratings yet.</p>
          ) : (
            <>
              {split && split.gap >= 1 && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                    <p className="slate text-zinc-400">Loved it most</p>
                    <p className="mt-2 font-semibold text-zinc-100">{first(split.lovedMost.user)} <span className="text-amber-500">★ {fmt(split.lovedMost.rating)}</span></p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                    <p className="slate text-zinc-400">Liked it least</p>
                    <p className="mt-2 font-semibold text-zinc-100">{first(split.likedLeast.user)} <span className="text-amber-500">★ {fmt(split.likedLeast.rating)}</span></p>
                  </div>
                </div>
              )}

              <ul className="mt-4 flex flex-col gap-2">
                {ratings.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => onOpenMember(r.user)} className="w-full min-h-12 flex items-center gap-3 text-left cursor-pointer group">
                      <Avatar user={userFor(r.user)} name={r.user} className="w-9 h-9" badgeSize="sm" />
                      <span className="w-16 shrink-0 text-zinc-200 group-hover:text-amber-500 truncate">{first(r.user)}</span>
                      <span className="flex-1 h-3 rounded-full bg-zinc-800 overflow-hidden">
                        <span className="block h-full rounded-full bg-amber-500" style={{ width: `${(r.rating / 5) * 100}%` }} />
                      </span>
                      <span className="w-10 shrink-0 text-right text-zinc-100 font-semibold">{fmt(r.rating)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {notRated.length > 0 && (
                <p className="mt-3 text-sm text-zinc-500">Not rated yet: {notRated.map((u) => first(u.name)).join(", ")}</p>
              )}
            </>
          )}

          {!mine && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="mt-5 w-full sm:w-auto min-h-14 px-6 rounded-2xl bg-red-700 hover:bg-red-600 text-ticket font-semibold text-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <PenLine className="w-5 h-5" />
              Rate it
            </button>
          )}
        </section>
      )}

      {!sealed && ratings.some((r) => r.comment) && (
        <section aria-labelledby="film-reviews" className="mt-10">
          <h2 id="film-reviews" className="font-serif text-3xl text-zinc-50">What everyone said</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {ratings.filter((r) => r.comment).map((r) => (
              <li key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 min-w-0">
                    <Avatar user={userFor(r.user)} name={r.user} className="w-7 h-7" badgeSize="sm" />
                    <span className="font-semibold text-zinc-100 truncate">{first(r.user)}</span>
                    {r.isStarred && <span className="text-xs text-amber-500">Ash's pick</span>}
                  </span>
                  <Stars rating={r.rating} />
                </div>
                <p className="mt-3 text-zinc-300 leading-relaxed whitespace-pre-line">{r.comment}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {overview && (
        <section aria-labelledby="film-recap" className="mt-10">
          <p className="slate text-zinc-400">Ash's recap</p>
          <h2 id="film-recap" className="font-serif text-3xl text-zinc-50 mt-1">{overview.title}</h2>
          {isAuthenticGatheringPhoto(overview.imageUrl) && (
            <img src={overview.imageUrl} alt="The night" className="mt-4 w-full rounded-2xl border border-zinc-800 object-cover max-h-[28rem]" />
          )}
          <p className="mt-4 text-zinc-300 leading-relaxed whitespace-pre-line">{overview.content}</p>
        </section>
      )}

      {!overview && isBeforeDataLoss(night.date) && (
        <p className="mt-10 text-sm text-zinc-500">This night's recap and photos were lost in the October data loss.</p>
      )}

      {createPortal(
      <AnimatePresence>
        {sheetOpen && (
          <ReviewSheet
            night={night}
            commentOptional={isBeforeDataLoss(night.date)}
            onClose={() => setSheetOpen(false)}
            onSubmit={(rating, comment) => onAddReview(night.id, currentUser.name, rating, comment)}
          />
        )}
      </AnimatePresence>,
      document.body
      )}
    </OverlayPage>
  );
}

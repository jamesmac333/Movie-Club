import React from "react";
import { MovieNight, Review, User } from "../types.ts";
import { Film, Clock, Star, Trophy, Flame, Heart } from "lucide-react";
import { motion } from "motion/react";
import { WithGapBadge } from "./GapBadge.tsx";

interface GroupStatisticsProps {
  nights: MovieNight[];
  reviews: Review[];
  users?: User[];
  onOpenMember?: (name: string) => void;
}

export default function GroupStatistics({ nights, reviews, users = [], onOpenMember }: GroupStatisticsProps) {
  // 1. Movies watched
  const watchedNights = nights.filter((n) => n.status === "watched" && n.movie);
  const totalWatched = watchedNights.length;

  // 2. Total hours watched
  const totalMinutes = watchedNights.reduce((acc, n) => {
    return acc + (n.movie?.runtime || 120); // fallback to 120 mins if runtime is missing
  }, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  // 3. Average group rating
  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(2)
    : "N/A";

  // 4. Favourite genre
  const genreCounts: { [key: string]: number } = {};
  watchedNights.forEach((n) => {
    if (n.movie?.genre) {
      // Split by comma in case of multiple genres listed like "Action, Sci-Fi"
      const genres = n.movie.genre.split(",").map(g => g.trim());
      genres.forEach((genre) => {
        if (genre) {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        }
      });
    }
  });

  let favoriteGenre = "None yet";
  let maxGenreCount = 0;
  Object.entries(genreCounts).forEach(([genre, count]) => {
    if (count > maxGenreCount) {
      maxGenreCount = count;
      favoriteGenre = genre;
    } else if (count === maxGenreCount && maxGenreCount > 0) {
      // Tie breaker/append
      if (!favoriteGenre.includes(genre)) {
        favoriteGenre += ` & ${genre}`;
      }
    }
  });

  // 5. Best Reviewer (calculated on the highest number of starred reviews)
  // Let's count starred reviews per reviewer (by name)
  const starredReviews = reviews.filter((r) => r.isStarred);
  const reviewerStarredCounts: { [key: string]: number } = {};

  starredReviews.forEach((r) => {
    // Normalise name or use exact string
    const reviewerName = r.user;
    reviewerStarredCounts[reviewerName] = (reviewerStarredCounts[reviewerName] || 0) + 1;
  });

  let bestReviewers: string[] = [];
  let maxStarredCount = 0;

  Object.entries(reviewerStarredCounts).forEach(([name, count]) => {
    if (count > maxStarredCount) {
      maxStarredCount = count;
      bestReviewers = [name];
    } else if (count === maxStarredCount) {
      bestReviewers.push(name);
    }
  });

  // Map to User avatars if available
  const getReviewerAvatar = (name: string) => {
    const found = users.find(u => u.name.toLowerCase() === name.toLowerCase() || u.username.toLowerCase() === name.toLowerCase());
    return found?.avatarUrl;
  };

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const stats = [
    { value: String(totalWatched), label: "Nights watched", icon: Film },
    { value: `${hours}h ${minutes}m`, label: "Screen time", icon: Clock },
    { value: avgRating === "N/A" ? "—" : `★ ${Number(avgRating).toFixed(1)}`, label: totalReviews ? `Average of ${totalReviews} review${totalReviews === 1 ? "" : "s"}` : "Average rating", icon: Star },
    { value: favoriteGenre, label: "Top genre", icon: Flame }
  ];

  return (
    <motion.section
      aria-labelledby="club-stats"
      initial={{ opacity: 0, y: 35 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="space-y-4"
    >
      <h2 id="club-stats" className="font-serif text-3xl text-zinc-50">Club stats</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(({ value, label, icon: Icon }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-2 min-w-0">
            <Icon className="w-5 h-5 text-amber-500" aria-hidden="true" />
            <p className="font-serif text-2xl sm:text-3xl text-zinc-50 leading-tight break-words">{value}</p>
            <p className="slate text-zinc-400">{label}</p>
          </div>
        ))}
      </div>

      {onOpenMember && users.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5">
          <p className="slate text-zinc-400">Members · tap for their picks and ratings</p>
          <ul className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
            {users.map((u) => (
              <li key={u.username}>
                <button type="button" onClick={() => onOpenMember(u.name)} className="w-full min-h-11 py-2 rounded-xl hover:bg-zinc-800 flex flex-col items-center gap-1.5 cursor-pointer">
                  <WithGapBadge show={!!u.hasGapBadge}>
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="w-12 h-12 rounded-full bg-slate text-zinc-100 text-xs font-semibold flex items-center justify-center">{u.name.substring(0, 2).toUpperCase()}</span>
                    )}
                  </WithGapBadge>
                  <span className="text-sm text-zinc-200">{u.name.split(" ")[0]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-amber-950 border border-amber-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-amber-500 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-serif text-xl text-zinc-50">Best reviewer</p>
            <p className="text-sm text-zinc-400">Whoever has the most reviews starred by Ash</p>
          </div>
        </div>
        {maxStarredCount > 0 && bestReviewers.length > 0 ? (
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {bestReviewers.map((reviewer) => {
                const avatar = getReviewerAvatar(reviewer);
                return avatar ? (
                  <img key={reviewer} src={avatar} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-amber-950" referrerPolicy="no-referrer" />
                ) : (
                  <span key={reviewer} className="w-10 h-10 rounded-full bg-slate text-zinc-100 text-xs font-semibold border-2 border-amber-950 flex items-center justify-center">{reviewer.substring(0, 2).toUpperCase()}</span>
                );
              })}
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-100">{bestReviewers.map((r) => r.split(" ")[0]).join(" & ")}</p>
              <p className="text-sm text-amber-500">★ {maxStarredCount} starred</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">No starred reviews yet</p>
        )}
      </div>
    </motion.section>
  );
}

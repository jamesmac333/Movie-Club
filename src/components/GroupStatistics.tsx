import React from "react";
import { MovieNight, Review, User } from "../types.ts";
import { Film, Clock, Star, Trophy, Flame, Heart } from "lucide-react";

interface GroupStatisticsProps {
  nights: MovieNight[];
  reviews: Review[];
  users?: User[];
}

export default function GroupStatistics({ nights, reviews, users = [] }: GroupStatisticsProps) {
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

  return (
    <div className="bg-[#fcfcfc] border border-zinc-200/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
      {/* Header */}
      <div className="border-b border-zinc-200/80 pb-5">
        <span className="text-[10px] font-mono text-amber-600 uppercase tracking-widest flex items-center gap-1 mb-1">
          <Trophy className="w-3.5 h-3.5" /> Club Insights
        </span>
        <h3 className="text-2xl font-serif text-zinc-900 font-bold tracking-tight">Movie Club Statistics</h3>
        <p className="text-xs text-zinc-500 font-mono mt-0.5">Real-time performance metrics and records of our sessions</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Movies */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex items-start gap-4 hover:border-zinc-300 transition-colors shadow-sm">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl shrink-0">
            <Film className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-mono uppercase tracking-wider block">Watched</span>
            <div className="text-2xl font-bold font-mono text-zinc-900">{totalWatched}</div>
            <span className="text-[10px] text-zinc-500 block font-sans">Movie sessions completed</span>
          </div>
        </div>

        {/* Stat 2: Hours */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex items-start gap-4 hover:border-zinc-300 transition-colors shadow-sm">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-mono uppercase tracking-wider block">Screen Time</span>
            <div className="text-2xl font-bold font-mono text-zinc-900">{totalHours}h</div>
            <span className="text-[10px] text-zinc-500 block font-sans">Based on film runtimes</span>
          </div>
        </div>

        {/* Stat 3: Average Rating */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex items-start gap-4 hover:border-zinc-300 transition-colors shadow-sm">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl shrink-0">
            <Star className="w-5 h-5 fill-amber-500/20" />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-mono uppercase tracking-wider block">Avg Rating</span>
            <div className="text-2xl font-bold font-mono text-zinc-900">
              {avgRating} <span className="text-xs text-zinc-400">/ 5</span>
            </div>
            <span className="text-[10px] text-zinc-500 block font-sans">Calculated across {totalReviews} reviews</span>
          </div>
        </div>

        {/* Stat 4: Favourite Genre */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex items-start gap-4 hover:border-zinc-300 transition-colors shadow-sm min-w-0">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <span className="text-xs text-zinc-400 font-mono uppercase tracking-wider block">Top Genre</span>
            <div className="text-base font-bold text-zinc-900 break-words leading-tight" title={favoriteGenre}>
              {favoriteGenre}
            </div>
            <span className="text-[10px] text-zinc-500 block font-sans">
              {maxGenreCount > 0 ? `${maxGenreCount} films watched` : "No genre data"}
            </span>
          </div>
        </div>
      </div>

      {/* Starred Review Winner Section */}
      <div className="bg-[#fcf8f2] border border-amber-100 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-2xl">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-zinc-800 flex flex-wrap items-center gap-2">
              Best Reviewer Award
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-700 font-mono rounded-full">
                Ash's Starred Choice
              </span>
            </h4>
            <p className="text-xs text-zinc-500 mt-1">
              Calculated dynamically based on who has received the highest number of starred reviews.
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-3">
          {maxStarredCount > 0 && bestReviewers.length > 0 ? (
            <div className="flex items-center gap-3 bg-white border border-zinc-200/80 px-4 py-2.5 rounded-xl shadow-xs">
              <div className="flex -space-x-2">
                {bestReviewers.map((reviewer) => {
                  const avatar = getReviewerAvatar(reviewer);
                  return (
                    <div key={reviewer} className="w-8 h-8 rounded-full overflow-hidden border border-white bg-zinc-100 flex items-center justify-center">
                      {avatar ? (
                        <img src={avatar} alt={reviewer} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-amber-600 uppercase">{reviewer.substring(0, 2)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-800">
                  {bestReviewers.join(" & ")}
                </div>
                <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1 mt-0.5">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500/20" />
                  <span>{maxStarredCount} Starred {maxStarredCount === 1 ? "Review" : "Reviews"}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-zinc-400 font-mono italic bg-white/40 border border-dashed border-zinc-200 px-4 py-2.5 rounded-xl">
              No starred reviews yet. Ash has not starred any reviews.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

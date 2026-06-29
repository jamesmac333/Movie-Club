import React from "react";
import { MovieNight, Review, NightOverview } from "../types.ts";
import { Calendar, Star, MessageSquare, Image as ImageIcon, Film, Heart } from "lucide-react";
import { motion } from "motion/react";

interface PriorSessionRecapProps {
  nights: MovieNight[];
  reviews: Review[];
  overviews: NightOverview[];
}

export default function PriorSessionRecap({ nights, reviews, overviews }: PriorSessionRecapProps) {
  // 1. Find the most recently watched movie night
  const watchedNights = nights
    .filter((n) => n.status === "watched" && n.movie)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const priorNight = watchedNights[0] || null;

  if (!priorNight) {
    return (
      <div className="bg-zinc-900/5 border border-dashed border-zinc-900 rounded-3xl p-8 text-center space-y-2">
        <Film className="w-8 h-8 text-zinc-700 mx-auto animate-pulse" />
        <h4 className="text-sm font-semibold text-zinc-400 font-mono uppercase tracking-wider">No Prior Sessions Yet</h4>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
          Once we complete our first movie night and mark it as watched, its overview and member reviews will be highlighted here.
        </p>
      </div>
    );
  }

  // Find associated overview and reviews
  const overview = overviews.find((ov) => ov.movieNightId === priorNight.id);
  const nightReviews = reviews.filter((rev) => rev.movieNightId === priorNight.id);

  // Compute average rating
  const avgRating =
    nightReviews.length > 0
      ? (nightReviews.reduce((sum, r) => sum + r.rating, 0) / nightReviews.length).toFixed(1)
      : null;

  const formatNZTDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-NZ", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, idx) => {
          const val = idx + 1;
          const isFullyFilled = rating >= val;
          const isHalfFilled = !isFullyFilled && rating >= val - 0.5;

          return (
            <div key={idx} className="relative select-none" style={{ width: "12px", height: "12px" }}>
              <div className="absolute inset-0 pointer-events-none">
                {/* Background empty star */}
                <Star className="w-3 h-3 text-zinc-800" />
                
                {/* Foreground filled/half-filled star */}
                {isFullyFilled ? (
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500 absolute inset-0" />
                ) : isHalfFilled ? (
                  <div className="absolute inset-0 w-[50%] overflow-hidden">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500 max-w-none" />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Title & Badge */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
        <div className="space-y-0.5">
          <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest block font-bold">Prior Event Spotlight</span>
          <h3 className="text-2xl font-serif text-zinc-100 font-bold tracking-tight">Last Session Recap</h3>
        </div>
        
        {avgRating && (
          <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 px-3 py-1.5 rounded-xl text-xs font-mono">
            <Star className="w-3.5 h-3.5 fill-amber-500" />
            <span>Score: {avgRating} / 5.0</span>
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-[#0c0c0c] border border-zinc-900/60 rounded-3xl p-6 sm:p-8">
        
        {/* Left/Middle: Film details and recap */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Film banner widget */}
          <div className="flex gap-4 items-start bg-[#080808] border border-zinc-900/80 p-4 rounded-2xl">
            {priorNight.movie!.posterUrl && (
              <img
                src={priorNight.movie!.posterUrl}
                alt={priorNight.movie!.title}
                className="w-16 sm:w-20 rounded-lg object-cover border border-zinc-800 shrink-0"
                referrerPolicy="no-referrer"
              />
            )}
            <div className="space-y-1">
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest block">Watched Film</span>
              <h4 className="text-lg font-serif font-bold text-zinc-100 italic">
                "{priorNight.movie!.title}"
                <span className="text-xs text-zinc-400 not-italic ml-1.5">({priorNight.movie!.year})</span>
              </h4>
              <p className="text-xs text-zinc-400 leading-normal font-sans">
                Directed by <strong className="text-zinc-300">{priorNight.movie!.director}</strong> • {priorNight.movie!.genre}
              </p>
              <div className="text-[10px] text-zinc-500 font-mono pt-1">
                📅 Watched on {formatNZTDate(priorNight.date)}
              </div>
            </div>
          </div>

          {/* Overview text content */}
          {overview ? (
            <div className="space-y-3">
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Recap by Ash Macintosh</span>
                <h5 className="text-lg font-serif font-semibold text-zinc-200">{overview.title}</h5>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed font-sans font-light">
                {overview.content}
              </p>
            </div>
          ) : (
            <div className="p-5 bg-zinc-900/10 border border-dashed border-zinc-900 rounded-2xl text-center">
              <p className="text-xs text-zinc-500 font-serif italic">Ash Macintosh is preparing the final memory recap of this session...</p>
            </div>
          )}

          {/* Memory image if present */}
          {overview?.imageUrl && (
            <div className="relative rounded-2xl overflow-hidden border border-zinc-900 max-h-72 bg-zinc-950">
              <img
                src={overview.imageUrl}
                alt="Movie Night Gathering Memory"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md text-zinc-400 border border-zinc-800 rounded px-2.5 py-1 text-[10px] font-mono flex items-center gap-1.5">
                <ImageIcon className="w-3 h-3 text-amber-500" />
                Snapshot of the Night
              </div>
            </div>
          )}
        </div>

        {/* Right side: All reviews list */}
        <div className="lg:col-span-5 flex flex-col h-full border-t lg:border-t-0 lg:border-l border-zinc-900 pt-6 lg:pt-0 lg:pl-8">
          <h5 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5 mb-4">
            <MessageSquare className="w-4 h-4 text-zinc-500" />
            Member Reviews ({nightReviews.length})
          </h5>

          {nightReviews.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#080808] border border-zinc-900 rounded-2xl text-center space-y-1.5 my-auto">
              <Heart className="w-5 h-5 text-zinc-800" />
              <p className="text-xs text-zinc-500 font-sans italic">No member reviews submitted yet.</p>
              <p className="text-[10px] text-zinc-600">Reviewers can submit their memories in the "Memories" tab!</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
              {nightReviews.map((review) => (
                <div 
                  key={review.id} 
                  className="bg-[#080808]/80 border border-zinc-900 p-4 rounded-xl space-y-2 hover:border-zinc-800/80 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-zinc-200">{review.user}</span>
                    {renderStars(review.rating)}
                  </div>
                  <p className="text-zinc-400 text-xs leading-relaxed font-sans font-light">
                    "{review.comment}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

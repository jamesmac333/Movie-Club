import React, { useEffect } from "react";
import { MovieNight, NightOverview, Review } from "../types.ts";
import { motion } from "motion/react";
import { BookOpen, Sparkles, X, Calendar, User as UserIcon, Film, Clock, Star, Camera, Quote } from "lucide-react";

interface RecapAlertModalProps {
  overview: NightOverview;
  night: MovieNight;
  reviews?: Review[];
  onClose: (overviewId: string) => void;
}

export default function RecapAlertModal({
  overview,
  night,
  reviews = [],
  onClose
}: RecapAlertModalProps) {
  const movie = night.movie;

  // Calculate average review rating if any reviews exist for this night
  const nightReviews = reviews.filter((r) => r.movieNightId === night.id);
  const avgRating =
    nightReviews.length > 0
      ? (nightReviews.reduce((sum, r) => sum + r.rating, 0) / nightReviews.length).toFixed(1)
      : null;

  // Keyboard escape key support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose(overview.id);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [overview.id, onClose]);

  const formatNZTDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-NZ", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Dark Ambient Cinema Backdrop Filter */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[#0a0807]/92 backdrop-blur-lg pointer-events-auto"
        onClick={() => onClose(overview.id)}
      />

      {/* Retro Spotlight glow behind the modal */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.12)_0%,transparent_65%)] pointer-events-none" />

      {/* Main Modal Dialog Box */}
      <motion.div
        initial={{ scale: 0.92, y: 35, opacity: 0 }}
        animate={{
          scale: 1,
          y: 0,
          opacity: 1,
          transition: { type: "spring", damping: 24, stiffness: 140 }
        }}
        exit={{ scale: 0.94, y: 20, opacity: 0 }}
        className="relative bg-[#14100e] border-2 border-amber-500/70 rounded-[28px] sm:rounded-[36px] w-full max-w-3xl max-h-[90vh] flex flex-col shadow-[0_0_80px_rgba(245,158,11,0.25)] z-10 overflow-hidden my-auto"
      >
        {/* Flashing Vintage Film Border Ribbon */}
        <div className="h-1.5 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 shrink-0" />

        {/* Modal Sticky Header */}
        <div className="px-6 sm:px-8 py-5 border-b border-zinc-800/80 bg-[#191411]/90 flex items-center justify-between gap-4 shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-amber-500/15 border border-amber-500/30 text-amber-500 rounded-xl shrink-0">
              <BookOpen className="w-5 h-5 text-amber-500" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-amber-500 uppercase flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500 animate-spin" /> FRESH RECAP PUBLISHED
                </span>
                <span className="text-zinc-600 hidden sm:inline">•</span>
                <span className="text-[11px] text-zinc-400 font-mono hidden sm:inline">
                  {formatNZTDate(overview.createdAt || night.date)}
                </span>
              </div>
              <p className="text-xs text-zinc-400 truncate">
                By <strong className="text-zinc-200">{overview.author || "Ash Macintosh"}</strong> for Movie Night with <span className="text-amber-400/90">{night.selector}</span>
              </p>
            </div>
          </div>

          {/* Top-Right Quick Close Button */}
          <button
            onClick={() => onClose(overview.id)}
            className="p-2.5 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-zinc-800 transition-all cursor-pointer shrink-0"
            title="Close window (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Container */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* Headline Banner */}
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-zinc-100 font-extrabold tracking-tight leading-tight">
              {overview.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 font-mono pt-1">
              <span className="flex items-center gap-1 text-zinc-300">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                {formatNZTDate(night.date)}
              </span>
              <span className="text-zinc-700">•</span>
              <span>Host/Selector: <strong className="text-zinc-200">{night.selector}</strong></span>
              {avgRating && (
                <>
                  <span className="text-zinc-700">•</span>
                  <span className="flex items-center gap-1 text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    <Star className="w-3 h-3 fill-amber-400" />
                    Score {avgRating}/5.0
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Featured Friends Memory Photo */}
          {overview.imageUrl && (
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-zinc-800/80 bg-zinc-950 shadow-2xl group">
              <img
                src={overview.imageUrl}
                alt={overview.title}
                className="w-full max-h-[420px] object-cover sm:object-contain bg-zinc-950 mx-auto"
                referrerPolicy="no-referrer"
              />
              <div className="p-3 bg-zinc-950/90 border-t border-zinc-900/60 flex items-center justify-between text-xs text-zinc-400 font-mono">
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <Camera className="w-3.5 h-3.5 text-amber-500" />
                  Friends Gathering Photo
                </span>
                <span className="text-[11px] text-zinc-500">Documented by Ash</span>
              </div>
            </div>
          )}

          {/* Full Narrative Recap Story */}
          <div className="bg-[#191411]/60 border border-zinc-800/70 rounded-2xl sm:rounded-3xl p-5 sm:p-7 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-500 tracking-wider uppercase font-bold">
              <Quote className="w-4 h-4 text-amber-500" />
              The Night Chronicles
            </div>
            <div className="text-zinc-200 text-base sm:text-lg leading-relaxed font-sans font-light whitespace-pre-line">
              {overview.content}
            </div>
          </div>

          {/* Associated Film Badge */}
          {movie && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-[#191411]/40 border border-zinc-800/60 rounded-2xl p-4 sm:p-5">
              {movie.posterUrl && (
                <img
                  src={movie.posterUrl}
                  alt={movie.title}
                  className="w-16 sm:w-20 rounded-xl object-cover border border-zinc-800 shadow-md shrink-0"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="space-y-1 min-w-0 flex-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">
                  Film Spotlight
                </span>
                <h4 className="text-lg sm:text-xl font-serif text-zinc-100 font-bold italic leading-tight truncate">
                  "{movie.title}" <span className="text-sm text-zinc-400 not-italic">({movie.year})</span>
                </h4>
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 font-mono">
                  <span>Dir: <strong className="text-zinc-300">{movie.director}</strong></span>
                  <span className="text-zinc-700">•</span>
                  <span>{movie.genre}</span>
                  <span className="text-zinc-700">•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    {movie.runtime} min
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer with Clear Dismissal / Exit Button */}
        <div className="px-6 sm:px-8 py-4 bg-[#191411] border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-zinc-500 font-mono hidden sm:inline">
            Press <kbd className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded border border-zinc-700 text-[10px]">ESC</kbd> or click below to exit
          </span>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onClose(overview.id)}
            className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-serif font-bold text-sm sm:text-base py-2.5 sm:py-3 px-8 rounded-2xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer tracking-wide flex items-center justify-center gap-2"
          >
            <span>📖 Finished Reading • Exit Window</span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

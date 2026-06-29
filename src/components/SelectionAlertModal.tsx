import React from "react";
import { MovieNight } from "../types.ts";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Clapperboard, Star, Calendar, Clock, Film } from "lucide-react";

interface SelectionAlertModalProps {
  night: MovieNight;
  onAcknowledge: (nightId: string, movieTitle: string) => void;
}

export default function SelectionAlertModal({ night, onAcknowledge }: SelectionAlertModalProps) {
  if (!night.movie) return null;

  const movie = night.movie;

  // Render decorative vintage star icons
  const renderDecorativeStars = () => (
    <div className="flex justify-center gap-1 text-amber-500 animate-pulse">
      <Star className="w-3.5 h-3.5 fill-amber-500" />
      <Star className="w-4 h-4 fill-amber-500" />
      <Star className="w-3.5 h-3.5 fill-amber-500" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Rich Retro Backdrop Filter & Vignette */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[#14100d]/90 backdrop-blur-md pointer-events-auto"
        onClick={() => onAcknowledge(night.id, movie.title)}
      />

      {/* Retro Spotlight effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(223,139,57,0.15)_0%,transparent_60%)] pointer-events-none" />

      {/* Marquee Glowing Container */}
      <motion.div
        initial={{ scale: 0.85, y: 50, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1, transition: { type: "spring", damping: 20, stiffness: 100 } }}
        exit={{ scale: 0.9, y: 30, opacity: 0 }}
        className="relative bg-[#1c1613] border-4 border-amber-500 rounded-[32px] w-full max-w-lg overflow-hidden shadow-[0_0_80px_rgba(223,139,57,0.35)] z-10 p-1 select-none"
      >
        {/* Flashing Retro Marquee Lights Effect */}
        <div className="absolute inset-x-0 top-0 h-1 bg-[repeating-linear-gradient(90deg,#df8b39,0px,#df8b39_4px,transparent_4px,transparent_12px)] opacity-80" />
        <div className="absolute inset-y-0 left-0 w-1 bg-[repeating-linear-gradient(180deg,#df8b39,0px,#df8b39_4px,transparent_4px,transparent_12px)] opacity-80" />
        <div className="absolute inset-y-0 right-0 w-1 bg-[repeating-linear-gradient(180deg,#df8b39,0px,#df8b39_4px,transparent_4px,transparent_12px)] opacity-80" />
        <div className="absolute inset-x-0 bottom-0 h-1 bg-[repeating-linear-gradient(90deg,#df8b39,0px,#df8b39_4px,transparent_4px,transparent_12px)] opacity-80" />

        {/* Vintage Ticket Stub Graphic with cuts */}
        <div className="relative bg-[#14100d] border border-zinc-800 rounded-[28px] p-6 sm:p-8 space-y-6 overflow-hidden">
          
          {/* Half-circle punchouts on the left/right margins for ticket look */}
          <div className="absolute -left-5 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#1c1613] border-r border-amber-500/40 rounded-full z-20" />
          <div className="absolute -right-5 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#1c1613] border-l border-amber-500/40 rounded-full z-20" />

          {/* Golden Ticket Header */}
          <div className="text-center space-y-2">
            <span className="text-[10px] font-mono text-amber-500 tracking-[0.25em] uppercase font-bold flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500 animate-spin" /> THE CURTAIN RISES
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif text-zinc-100 font-extrabold italic tracking-tight leading-none">
              A Selection is Made!
            </h2>
            {renderDecorativeStars()}
          </div>

          {/* Announcement Callout */}
          <div className="bg-[#1c1613] border border-dashed border-zinc-800 p-4 rounded-2xl text-center space-y-1">
            <p className="text-xs text-zinc-400 font-sans uppercase tracking-wide">
              Your host for this cycle
            </p>
            <span className="text-xl font-serif text-amber-500 font-bold tracking-tight">
              {night.selector}
            </span>
            <p className="text-xs text-zinc-400 font-sans">
              has unlocked their chosen movie for the next night!
            </p>
          </div>

          {/* Film Showcase Card */}
          <div className="flex gap-5 items-start bg-[#1c1613]/50 border border-zinc-800 p-4 rounded-2xl relative">
            {movie.posterUrl && (
              <img
                src={movie.posterUrl}
                alt={movie.title}
                className="w-20 sm:w-24 rounded-xl object-cover border border-zinc-800 shrink-0 shadow-lg shadow-black/80"
                referrerPolicy="no-referrer"
              />
            )}
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                {movie.rating && (
                  <span className="text-[9px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700 px-1.5 py-0.5 rounded font-bold uppercase">
                    {movie.rating}
                  </span>
                )}
                <span className="text-[10px] font-mono text-zinc-500">
                  {movie.genre}
                </span>
              </div>
              
              <h3 className="text-lg sm:text-xl font-serif text-zinc-100 font-bold leading-tight italic truncate">
                "{movie.title}"
              </h3>
              
              <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-mono">
                <span className="flex items-center gap-1">
                  <Film className="w-3.5 h-3.5 text-zinc-500" />
                  {movie.year}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  {movie.runtime} min
                </span>
              </div>

              <p className="text-xs text-zinc-400 italic line-clamp-3 leading-relaxed mt-1">
                Directed by <span className="font-semibold text-zinc-300 not-italic">{movie.director}</span>
              </p>
            </div>
          </div>

          {/* Action Row / Vintage Dismissal Button */}
          <div className="pt-2 text-center relative z-30">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onAcknowledge(night.id, movie.title)}
              className="w-full bg-amber-500 hover:bg-amber-600 text-zinc-950 font-serif font-bold italic text-base py-3 px-6 rounded-2xl shadow-[0_4px_20px_rgba(223,139,57,0.4)] hover:shadow-[0_4px_25px_rgba(223,139,57,0.55)] transition-all cursor-pointer border border-amber-600/20 tracking-wider"
            >
              🎟️ ADMIT ONE - CLAIM TICKET
            </motion.button>
            <p className="text-[10px] text-zinc-500 font-mono mt-3 uppercase tracking-widest">
              Dismiss & Save to My Screen
            </p>
          </div>

        </div>
      </motion.div>
    </div>
  );
}

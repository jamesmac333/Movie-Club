import React, { useState, useEffect } from "react";
import { MovieNight, User, MOVIE_CLUB_USERS } from "../types.ts";
import { Film, Clock, Search, Calendar, Sparkles, AlertCircle, RefreshCw, RotateCcw, Play, ExternalLink } from "lucide-react";
import { motion } from "motion/react";

interface NextMovieHeroProps {
  nights: MovieNight[];
  currentUser: User | null;
  onChooseMovie: (id: string, title: string, selector: string) => Promise<void>;
  onResetMovie: (id: string) => Promise<void>;
  users?: User[];
}

export default function NextMovieHero({ nights, currentUser, onChooseMovie, onResetMovie, users = MOVIE_CLUB_USERS }: NextMovieHeroProps) {
  const [movieInput, setMovieInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Auto-clear confirmation state after 4 seconds
  useEffect(() => {
    if (!confirmReset) return;
    const timer = setTimeout(() => {
      setConfirmReset(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [confirmReset]);

  // Find the next upcoming scheduled night (chronologically, date is in the future)
  const nextNight = nights
    .filter(n => n.status === "scheduled")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] || 
    nights.filter(n => n.movie === null)[0] || 
    nights[nights.length - 1]; // fallback

  const selectorUser = nextNight ? users.find(
    u => u.name.toLowerCase() === nextNight.selector.toLowerCase() ||
         u.username.toLowerCase() === nextNight.selector.toLowerCase()
  ) : null;

  const isNextSelector = currentUser && nextNight && nextNight.selector.toLowerCase() === currentUser.name.toLowerCase();
  const isAdmin = currentUser?.isAdmin || false;
  const canSelect = isNextSelector || isAdmin;
  const canReset = isNextSelector || isAdmin;

  // Countdown timer to the next movie night
  useEffect(() => {
    if (!nextNight) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const eventTime = new Date(nextNight.date).getTime();
      const difference = eventTime - now;

      if (difference <= 0) {
        clearInterval(timer);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [nextNight]);

  const handleSelectMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movieInput.trim()) {
      setError("Please enter a movie title");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await onChooseMovie(nextNight.id, movieInput.trim(), nextNight.selector);
      setSuccess(`Successfully selected "${movieInput}"! Movie metadata was retrieved.`);
      setMovieInput("");
    } catch (e: any) {
      setError(e.message || "Failed to search and retrieve movie metadata. Try again!");
    } finally {
      setLoading(false);
    }
  };

  const handleResetMovieSelection = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }

    setError("");
    setSuccess("");
    setLoadingReset(true);

    try {
      await onResetMovie(nextNight.id);
      setSuccess("Movie selection reset successfully!");
      setConfirmReset(false);
    } catch (e: any) {
      setError(e.message || "Failed to reset movie choice. Try again!");
    } finally {
      setLoadingReset(false);
    }
  };

  if (!nextNight) {
    return (
      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-10 text-center">
        <Film className="w-12 h-12 text-zinc-600 mx-auto mb-4 animate-pulse" />
        <p className="text-zinc-400">All nights completed or no nights configured.</p>
      </div>
    );
  }

  const formatNZTDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-NZ", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  };

  const hasMovie = nextNight.movie !== null;

  return (
    <div className="relative bg-[#0c0c0c] border border-zinc-900/60 rounded-3xl overflow-hidden shadow-2xl mb-12 shadow-[0_0_24px_rgba(245,158,11,0.03)]">
      {/* Cinematic Poster background overlay */}
      {hasMovie && nextNight.movie!.posterUrl && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20 blur-sm scale-105 pointer-events-none"
          style={{ backgroundImage: `url(${nextNight.movie!.posterUrl})` }}
        />
      )}
      
      {/* Decorative Film roll strip borders on top and bottom */}
      <div className="absolute top-0 inset-x-0 h-3 bg-zinc-950 flex justify-around overflow-hidden select-none pointer-events-none opacity-20">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="w-2.5 h-1.5 bg-zinc-100 rounded-sm" />
        ))}
      </div>

      <div className="p-8 sm:p-10 md:p-12 relative z-10">
        
        {/* Next Night Header Badging */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="bg-amber-500 text-zinc-950 text-xs font-mono font-bold tracking-widest px-3 py-1 rounded-full uppercase">
            Next Event
          </span>
          <span className="text-xs font-mono text-zinc-400 flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800/80 px-3 py-1 rounded-full">
            <Calendar className="w-3.5 h-3.5 text-amber-500/80" />
            {formatNZTDate(nextNight.date)}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 items-center">
          
          {/* LEFT: Countdown timer or Movie Selection Prompt */}
          <div className="lg:col-span-7 space-y-6">
            
            {hasMovie ? (
              // Case A: Movie selected, show metadata
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {selectorUser?.avatarUrl && (
                    <img 
                      src={selectorUser.avatarUrl} 
                      alt={nextNight.selector}
                      className="w-6 h-6 rounded-full object-cover border border-amber-500/50"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <p className="text-sm font-mono text-amber-500/80 tracking-widest uppercase">
                    Selected by {nextNight.selector}
                  </p>
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif text-white font-extrabold tracking-tight leading-none italic drop-shadow-2xl">
                  {nextNight.movie!.title}
                </h1>
                
                {/* Meta details */}
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-zinc-400 pt-1">
                  <span className="bg-zinc-900 px-2.5 py-1 rounded border border-zinc-800 font-semibold text-zinc-300">
                    {nextNight.movie!.year}
                  </span>
                  <span className="bg-zinc-900 px-2.5 py-1 rounded border border-zinc-800 font-semibold text-zinc-300">
                    {nextNight.movie!.rating || "PG-13"}
                  </span>
                  <span className="bg-zinc-900 px-2.5 py-1 rounded border border-zinc-800 font-semibold text-zinc-300">
                    {nextNight.movie!.runtime} mins
                  </span>
                  <span className="text-amber-500/80 bg-amber-500/5 border border-amber-500/10 px-2.5 py-1 rounded">
                    {nextNight.movie!.genre}
                  </span>
                </div>

                <div className="pt-2">
                  <p className="text-sm font-mono text-zinc-500 uppercase tracking-wider mb-1">Director</p>
                  <p className="text-base text-zinc-300 font-medium font-serif italic">{nextNight.movie!.director}</p>
                </div>

                <div className="pt-2">
                  <p className="text-sm font-mono text-zinc-500 uppercase tracking-wider mb-1">Plot Summary</p>
                  <p className="text-zinc-300 text-sm leading-relaxed max-w-xl">
                    {nextNight.movie!.overview}
                  </p>
                </div>

                {nextNight.movie!.trailerUrl && (
                  <div className="pt-4 flex flex-wrap gap-3">
                    <a
                      href={nextNight.movie!.trailerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-mono text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-xl transition-all shadow-lg shadow-red-600/20 active:scale-[0.98]"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Watch Trailer
                      <ExternalLink className="w-3.5 h-3.5 opacity-60 ml-0.5" />
                    </a>
                  </div>
                )}

                {canReset && (
                  <div className="pt-4 flex flex-col gap-2 items-start">
                    <button
                      onClick={handleResetMovieSelection}
                      disabled={loadingReset}
                      className={`text-xs font-mono font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                        confirmReset
                          ? "bg-red-500 text-zinc-950 border-red-500 hover:bg-red-600 shadow-md shadow-red-500/20"
                          : "bg-zinc-950/60 text-zinc-400 border-zinc-800 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/[0.02]"
                      }`}
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${loadingReset ? "animate-spin" : ""}`} />
                      {loadingReset
                        ? "Resetting Selection..."
                        : confirmReset
                        ? "Are you sure? Click to Confirm"
                        : "Reset Movie Choice / Change Mind"}
                    </button>
                    {confirmReset && (
                      <p className="text-[10px] text-zinc-500 font-mono italic">
                        * Click again to confirm. This will clear the current selection and metadata.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // Case B: No movie selected yet
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {selectorUser?.avatarUrl && (
                    <img 
                      src={selectorUser.avatarUrl} 
                      alt={nextNight.selector}
                      className="w-10 h-10 rounded-full object-cover border-2 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <p className="text-sm font-mono text-amber-500 tracking-widest uppercase">
                    Host Selector: {nextNight.selector}
                  </p>
                </div>
                <h1 className="text-3xl sm:text-4xl font-serif text-zinc-50 font-bold leading-tight">
                  Await Selection...
                </h1>
                <p className="text-zinc-400 text-sm leading-relaxed max-w-lg">
                  Every fortnight we rotate selections. It's <span className="font-semibold text-zinc-200">{nextNight.selector}</span>'s turn to pick the movie. Once selected, our online engine will pull rich information, runtime, synopsis, and genres instantly!
                </p>

                {/* Selection input for the designated selector or admins */}
                {canSelect ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 mt-6 max-w-xl"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-200">
                        {isNextSelector ? "Your Turn to Select!" : "Admin Override: Pick Movie"}
                      </h4>
                    </div>

                    <form onSubmit={handleSelectMovie} className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Search movie title (e.g., Gladiator, Dune)..."
                          value={movieInput}
                          onChange={(e) => setMovieInput(e.target.value)}
                          disabled={loading}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-4 pr-10 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                        />
                        <Film className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-bold px-4 py-2.5 rounded-lg text-sm transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/5 cursor-pointer"
                      >
                        {loading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                        {loading ? "Searching..." : "Select"}
                      </button>
                    </form>
                    
                    {error && (
                      <div className="flex items-center gap-1.5 text-xs text-red-400 mt-2.5 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {error}
                      </div>
                    )}
                    {success && (
                      <p className="text-xs text-emerald-400 mt-2.5 font-medium">
                        {success}
                      </p>
                    )}
                  </motion.div>
                ) : (
                  <div className="bg-zinc-900/30 border border-zinc-900/60 rounded-xl p-4 mt-6 flex items-start gap-3 max-w-md">
                    <AlertCircle className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-zinc-500">
                      Sign in as <span className="text-zinc-400 font-semibold">{nextNight.selector}</span> to submit your choice for this fortnight.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Countdown Box or Graphic & Poster */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            {hasMovie ? (
              // If movie has been selected, show beautiful cinematic poster representation
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-xl w-64 aspect-[2/3] max-w-full flex flex-col justify-end group cursor-pointer"
              >
                {nextNight.movie!.posterUrl ? (
                  <img 
                    src={nextNight.movie!.posterUrl} 
                    alt={nextNight.movie!.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center p-4">
                    <Film className="w-12 h-12 text-zinc-700 mb-2" />
                  </div>
                )}
                {/* Visual overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent opacity-80" />
                <div className="relative p-4 z-10">
                  <p className="text-[10px] font-mono text-amber-400 uppercase tracking-widest mb-1">Coming Up</p>
                  <h4 className="text-sm font-serif font-bold text-zinc-100 italic leading-tight">
                    "{nextNight.movie!.title}"
                  </h4>
                </div>
              </motion.div>
            ) : (
              // Countdown Clock Container for empty movie choice
              <div className="bg-zinc-900/80 border border-zinc-800 p-6 rounded-2xl w-full max-w-xs text-center space-y-4 shadow-xl">
                <div className="flex items-center justify-center gap-2 text-amber-500 font-mono text-xs uppercase tracking-widest font-semibold">
                  <Clock className="w-4 h-4 animate-pulse" />
                  Countdown to Event
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-zinc-950 rounded-lg p-2 border border-zinc-800/80">
                    <span className="block font-mono text-2xl font-bold text-zinc-100">{timeLeft.days}</span>
                    <span className="text-[10px] text-zinc-500 uppercase font-sans">Days</span>
                  </div>
                  <div className="bg-zinc-950 rounded-lg p-2 border border-zinc-800/80">
                    <span className="block font-mono text-2xl font-bold text-zinc-100">{timeLeft.hours}</span>
                    <span className="text-[10px] text-zinc-500 uppercase font-sans">Hrs</span>
                  </div>
                  <div className="bg-zinc-950 rounded-lg p-2 border border-zinc-800/80">
                    <span className="block font-mono text-2xl font-bold text-zinc-100">{timeLeft.minutes}</span>
                    <span className="text-[10px] text-zinc-500 uppercase font-sans">Mins</span>
                  </div>
                  <div className="bg-zinc-950 rounded-lg p-2 border border-zinc-800/80">
                    <span className="block font-mono text-2xl font-bold text-zinc-100">{timeLeft.seconds}</span>
                    <span className="text-[10px] text-zinc-500 uppercase font-sans">Secs</span>
                  </div>
                </div>

                {selectorUser?.avatarUrl && (
                  <div className="flex flex-col items-center py-2">
                    <div className="bg-[#fdfbf7] p-2 pb-5 border border-zinc-300 shadow-md rotate-[-2deg] transition-transform hover:rotate-0 duration-300 w-28">
                      <div className="bg-zinc-200 aspect-square overflow-hidden border border-zinc-300 relative">
                        <img 
                          src={selectorUser.avatarUrl} 
                          alt={selectorUser.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span className="text-[9px] font-serif text-zinc-800 tracking-wide mt-2 block font-bold italic leading-none">
                        {selectorUser.username} 🎟️
                      </span>
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-zinc-400 font-medium">
                  {nextNight.selector} is in charge of selection!
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Decorative film rolls on the bottom */}
      <div className="absolute bottom-0 inset-x-0 h-3 bg-zinc-950 flex justify-around overflow-hidden select-none pointer-events-none opacity-20">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="w-2.5 h-1.5 bg-zinc-100 rounded-sm" />
        ))}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { MovieNight, User, MOVIE_CLUB_USERS } from "../types.ts";
import { Film, Clock, Search, Calendar, Sparkles, AlertCircle, RefreshCw, RotateCcw, Play, ExternalLink, Share2, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import PaletteStrip from "./PaletteStrip.tsx";

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
  const [copiedShare, setCopiedShare] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Auto-clear confirmation state after 4 seconds
  useEffect(() => {
    if (!confirmReset) return;
    const timer = setTimeout(() => {
      setConfirmReset(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [confirmReset]);

  // Find the next upcoming scheduled night (chronologically, date is in the future)
  // A night stays "next" until four hours after it starts; then the following one takes over
  const nextNight = nights
    .filter(n => n.status === "scheduled" && new Date(n.date).getTime() > Date.now() - 4 * 3600000)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ||
    nights
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
        <Film className="w-12 h-12 text-zinc-500 mx-auto mb-4 animate-pulse" />
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

  const handleShareOrCopy = async () => {
    const dateFormatted = formatNZTDate(nextNight.date);
    let shareTitle = "";
    let shareText = "";

    if (hasMovie) {
      shareTitle = `🎬 Movie Club: ${nextNight.movie!.title}`;
      shareText = `🎬 Movie Club Night: ${nextNight.movie!.title} (${nextNight.movie!.year})
📅 ${dateFormatted}
👤 Host Selector: ${nextNight.selector}
⭐ Genre: ${nextNight.movie!.genre || "Film"} • ${nextNight.movie!.runtime} mins
📝 Plot: ${nextNight.movie!.overview ? nextNight.movie!.overview.slice(0, 160) + "..." : "No synopsis"}
🍿 Club Portal: ${window.location.origin}`;
    } else {
      shareTitle = "🎬 Next Movie Club Night";
      shareText = `🎬 Next Movie Club Night
📅 ${dateFormatted}
👤 Host Selector: ${nextNight.selector}'s turn to pick the film!
🍿 Club Portal: ${window.location.origin}`;
    }

    // Try Web Share API first (supported by iOS Safari & Chrome on user interaction)
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: window.location.origin,
        });
        setShareToast("Shared to group chat! 🍿");
        setTimeout(() => setShareToast(null), 3500);
        return;
      } catch (err: any) {
        if (err.name === "AbortError") {
          return; // User canceled the native sheet
        }
      }
    }

    // Fallback: Copy to clipboard
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedShare(true);
      setShareToast("Copied details to clipboard for group chat! 📋");
      setTimeout(() => {
        setCopiedShare(false);
        setShareToast(null);
      }, 3500);
    } catch {
      setShareToast("Could not copy automatically. Please copy manually.");
      setTimeout(() => setShareToast(null), 3000);
    }
  };

  const eventDate = new Date(nextNight.date);
  const shortDate = eventDate.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
  const shortTime = eventDate.toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit", hour12: true });
  const hostFirstName = nextNight.selector.split(" ")[0];
  const countdownLabel = timeLeft.days > 1 ? `in ${timeLeft.days} days` : timeLeft.days === 1 ? "tomorrow" : (timeLeft.hours || timeLeft.minutes) ? "tonight" : "now";

  return (
    <motion.section
      aria-label="Next movie night"
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="relative bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden mb-12 [--ticket-notch:var(--color-zinc-950)]"
    >
      <div className="flex items-baseline justify-between gap-3 px-5 sm:px-8 pt-5 sm:pt-7">
        <p className="slate text-amber-500">Now showing · {countdownLabel}</p>
        <p className="text-sm text-zinc-400">{shortDate} · {shortTime}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-6 md:gap-10 p-4 sm:p-8 md:items-center">
        {/* Poster: the feature of the card */}
        <div className="flex flex-col gap-3">
          {hasMovie && nextNight.movie!.posterUrl ? (
            <img
              src={nextNight.movie!.posterUrl}
              alt={`${nextNight.movie!.title} poster`}
              className="w-full aspect-[2/3] object-cover rounded-2xl border border-zinc-700 shadow-[0_24px_50px_rgba(0,0,0,0.5)]"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full aspect-[2/3] rounded-2xl border border-zinc-700 bg-slate shadow-[0_24px_50px_rgba(0,0,0,0.5)] flex flex-col justify-between p-6">
              <span className="slate text-amber-500">{hasMovie ? "No poster" : `${hostFirstName}'s pick`}</span>
              <div className="space-y-3">
                {!hasMovie && selectorUser?.avatarUrl && (
                  <img src={selectorUser.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-amber-500" referrerPolicy="no-referrer" />
                )}
                <p className="font-serif text-5xl leading-[0.95] text-ticket">{hasMovie ? nextNight.movie!.title : "Still choosing…"}</p>
                {!hasMovie && (
                  <p className="slate text-zinc-300">
                    {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m to go
                  </p>
                )}
              </div>
            </div>
          )}
          <PaletteStrip posterUrl={hasMovie ? nextNight.movie!.posterUrl : null} className="h-2 rounded" />
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          {hasMovie ? (
            <>
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-7xl leading-[0.95] text-zinc-50 break-words">
                {nextNight.movie!.title}
              </h1>
              <p className="text-sm sm:text-base text-zinc-400">
                {[nextNight.movie!.year, nextNight.movie!.rating, nextNight.movie!.runtime ? `${Math.floor(nextNight.movie!.runtime / 60)}h ${nextNight.movie!.runtime % 60}m` : null, nextNight.movie!.genre].filter(Boolean).join(" · ")}
              </p>
              {nextNight.movie!.director && <p className="slate text-zinc-300">A film by {nextNight.movie!.director}</p>}
              {nextNight.movie!.overview && (
                <>
                  <p className="hidden md:block text-base leading-relaxed text-zinc-300 max-w-xl">{nextNight.movie!.overview}</p>
                  <details className="md:hidden">
                    <summary className="cursor-pointer text-sm font-medium text-zinc-200 py-2">Plot summary</summary>
                    <p className="text-sm leading-relaxed text-zinc-300">{nextNight.movie!.overview}</p>
                  </details>
                </>
              )}
            </>
          ) : (
            <>
              <h1 className="font-serif text-4xl sm:text-5xl leading-tight text-zinc-50">It's {hostFirstName}'s turn to pick</h1>
              <p className="text-sm sm:text-base leading-relaxed text-zinc-400 max-w-lg">
                Hosting rotates every fortnight. Once {hostFirstName} chooses, the poster, plot and running time appear here.
              </p>
            </>
          )}

          <div className="flex items-center gap-3">
            {selectorUser?.avatarUrl ? (
              <img src={selectorUser.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover border border-amber-500/60" referrerPolicy="no-referrer" />
            ) : (
              <span className="w-9 h-9 rounded-full bg-red-800 text-ticket text-xs font-semibold flex items-center justify-center">{hostFirstName.slice(0, 2).toUpperCase()}</span>
            )}
            <span className="text-sm text-zinc-200">{hasMovie ? `${hostFirstName}'s pick` : `${hostFirstName} is hosting`}</span>
          </div>

          {/* Host or admin: choose the film */}
          {!hasMovie && canSelect && (
            <form onSubmit={handleSelectMovie} className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-4 space-y-3 max-w-xl">
              <label htmlFor="movie-search" className="slate text-amber-500 block">
                {isNextSelector ? "Your turn: pick the film" : "Admin: pick the film"}
              </label>
              <div className="flex gap-2">
                <input
                  id="movie-search"
                  type="text"
                  placeholder="Film title, e.g. Gladiator"
                  value={movieInput}
                  onChange={(e) => setMovieInput(e.target.value)}
                  disabled={loading}
                  className="flex-1 min-w-0 h-12 bg-zinc-950 border border-zinc-700 rounded-xl px-4 text-base text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="h-12 px-5 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-60 text-ticket font-semibold text-sm flex items-center gap-2 cursor-pointer"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {loading ? "Searching…" : "Choose"}
                </button>
              </div>
              {error && (
                <p className="flex items-center gap-1.5 text-sm text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </p>
              )}
              {success && <p className="text-sm text-emerald-400">{success}</p>}
            </form>
          )}
        </div>
      </div>

      {/* Ticket stub */}
      <div className="ticket-tear" aria-hidden="true"><span /></div>
      <div className="px-5 sm:px-8 pb-5 sm:pb-7 pt-2 flex flex-col gap-4">
        <p className="slate text-zinc-400">Admit one · {shortDate} · {shortTime} · {hostFirstName} hosts</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleShareOrCopy}
            className={`flex-1 sm:flex-none min-h-12 px-6 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              copiedShare ? "bg-emerald-500 text-zinc-950" : "bg-red-700 hover:bg-red-600 text-ticket"
            }`}
          >
            {copiedShare ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            {copiedShare ? "Copied" : "Copy for group chat"}
          </button>
          {hasMovie && nextNight.movie!.trailerUrl && (
            <a
              href={nextNight.movie!.trailerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-12 px-5 rounded-2xl border border-zinc-700 hover:border-amber-500 text-zinc-100 font-medium flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Trailer
            </a>
          )}
          {hasMovie && canReset && (
            <button
              type="button"
              onClick={handleResetMovieSelection}
              disabled={loadingReset}
              className={`min-h-12 px-4 rounded-2xl text-sm font-medium flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                confirmReset ? "bg-red-700 text-ticket" : "text-zinc-400 hover:text-amber-500"
              }`}
            >
              <RotateCcw className={`w-4 h-4 ${loadingReset ? "animate-spin" : ""}`} />
              {loadingReset ? "Clearing…" : confirmReset ? "Tap again to clear the pick" : "Change the pick"}
            </button>
          )}
        </div>
        {hasMovie && (error || success) && (
          <p className={`text-sm ${error ? "text-red-400" : "text-emerald-400"}`}>{error || success}</p>
        )}
      </div>

      {/* Share / copy confirmation */}
      <AnimatePresence>
        {shareToast && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            role="status"
            className="fixed bottom-28 md:bottom-12 left-1/2 -translate-x-1/2 z-50 bg-ink-deep border border-amber-500/70 text-amber-200 px-5 py-3 rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.6)] text-sm flex items-center gap-2.5 pointer-events-none"
          >
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{shareToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

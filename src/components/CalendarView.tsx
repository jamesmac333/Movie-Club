import React, { useState } from "react";
import { MovieNight, User, NightOverview, MOVIE_CLUB_USERS } from "../types.ts";
import { Calendar, Edit, CheckCircle, Clock, UserCheck, Shield, BookOpen, Play, ExternalLink, History, ChevronDown, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CalendarViewProps {
  nights: MovieNight[];
  currentUser: User | null;
  onUpdateDate: (id: string, newDate: string) => Promise<void>;
  onForceStatus?: (id: string, newStatus: 'scheduled' | 'watched' | 'skipped') => Promise<void>;
  users?: User[];
  overviews?: NightOverview[];
  onOpenRecapModal?: (overview: NightOverview, night: MovieNight) => void;
  futureOnly?: boolean;
  limit?: number;
  onViewFullSchedule?: () => void;
  title?: string;
  subtitle?: string;
}

export default function CalendarView({ 
  nights, 
  currentUser, 
  onUpdateDate, 
  onForceStatus, 
  users = MOVIE_CLUB_USERS,
  overviews = [],
  onOpenRecapModal,
  futureOnly = false,
  limit,
  onViewFullSchedule,
  title,
  subtitle
}: CalendarViewProps) {
  const [editingNightId, setEditingNightId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPreviousSessions, setShowPreviousSessions] = useState(false);

  const isAdmin = currentUser?.isAdmin || false;

  const handleEditClick = (night: MovieNight) => {
    setEditingNightId(night.id);
    // Convert current ISO date to input-friendly format
    const isoDate = new Date(night.date);
    // Adjust to local datetime-local format
    const offset = isoDate.getTimezoneOffset();
    const adjustedDate = new Date(isoDate.getTime() - (offset * 60 * 1000));
    setEditDate(adjustedDate.toISOString().slice(0, 16));
  };

  const handleSaveDate = async (id: string) => {
    if (!editDate) {
      setError("Please select a valid date");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onUpdateDate(id, new Date(editDate).toISOString());
      setEditingNightId(null);
    } catch (e: any) {
      setError(e.message || "Failed to update date");
    } finally {
      setLoading(false);
    }
  };

  const formatNZTDate = (dateStr: string) => {
    const d = new Date(dateStr);
    // Custom formatted date string in NZT context
    // Movie nights are always 7 PM NZT.
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

  // Sort all nights chronologically
  const sortedNights = [...nights].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  // Partition nights into previous (completed/watched/past) and upcoming (scheduled future)
  const isPreviousNight = (night: MovieNight) => {
    return night.status === "watched" || (new Date(night.date).getTime() < todayStart && night.status !== "scheduled");
  };

  const previousNights = sortedNights
    .filter(isPreviousNight)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Most recent completed first

  const upcomingNights = sortedNights.filter((n) => !isPreviousNight(n));

  // If futureOnly is requested (e.g. homepage), filter to strictly future scheduled sessions
  const rawDisplayNights = futureOnly
    ? sortedNights.filter((night) => {
        const nightTime = new Date(night.date).getTime();
        return nightTime >= todayStart && night.status === "scheduled";
      })
    : upcomingNights;

  const displayNights = limit ? rawDisplayNights.slice(0, limit) : rawDisplayNights;

  const renderNightCard = (night: MovieNight, index: number, isPreviousList: boolean = false) => {
    const isEditing = editingNightId === night.id;
    const hasMovie = night.movie !== null;
    const isWatched = night.status === "watched";

    // Find original sequence number in full database schedule
    const originalIndex = sortedNights.findIndex((n) => n.id === night.id);
    const nightNumber = originalIndex >= 0 ? originalIndex + 1 : index + 1;

    return (
      <motion.div
        key={night.id}
        initial={{ opacity: 0, y: 15, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.25) }}
        className={`relative rounded-xl p-5 transition-colors border ${
          isPreviousList
            ? "bg-[#080808]/70 hover:bg-[#0c0c0c]/90 border-zinc-800/60 hover:border-zinc-700/80"
            : isWatched
              ? "border-zinc-900/60 hover:border-zinc-800 bg-[#080808]/40"
              : night.status === "skipped"
                ? "border-zinc-900/40 hover:border-zinc-900/60 bg-[#080808]/20 opacity-50"
                : "bg-[#080808]/80 hover:bg-[#0c0c0c]/80 border-zinc-800 hover:border-amber-500/30 shadow-lg shadow-amber-500/[0.01]"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          {/* Date & Selector Info */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono px-2.5 py-0.5 bg-zinc-800 text-zinc-300 rounded border border-zinc-700/60 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-500/80" />
                Night #{nightNumber}
              </span>

              {isWatched ? (
                <span className="text-[11px] font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-900/60 px-2 py-0.5 rounded flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Watched
                </span>
              ) : night.status === "skipped" ? (
                <span className="text-[11px] font-semibold bg-red-950/20 text-red-400 border border-red-900/30 px-2 py-0.5 rounded flex items-center gap-1">
                  Skipped / Event
                </span>
              ) : (
                <span className="text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                  <Clock className="w-3 h-3 animate-pulse" />
                  Scheduled
                </span>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-2 pt-2 max-w-sm">
                <input
                  type="datetime-local"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                {error && <p className="text-xs text-red-400">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveDate(night.id)}
                    disabled={loading}
                    className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold px-3 py-1.5 rounded text-xs transition-all cursor-pointer"
                  >
                    {loading ? "Saving..." : "Save Date"}
                  </button>
                  <button
                    onClick={() => setEditingNightId(null)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded text-xs transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <h3 className="text-lg font-serif font-bold text-zinc-100 tracking-wide">
                {formatNZTDate(night.date)}
              </h3>
            )}

            {/* Selector Info */}
            <div className="flex items-center gap-2 text-sm text-zinc-400 pt-1">
              {(() => {
                const u = users.find(
                  (user) =>
                    user.name.toLowerCase() === night.selector.toLowerCase() ||
                    user.username.toLowerCase() === night.selector.toLowerCase()
                );
                return (
                  <>
                    {u?.avatarUrl ? (
                      <img
                        src={u.avatarUrl}
                        alt={night.selector}
                        className="w-5 h-5 rounded-full object-cover border border-amber-500/30"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <UserCheck className="w-4 h-4 text-amber-500/70" />
                    )}
                    <span>Selector:</span>
                    <span className="font-semibold text-zinc-200">{night.selector}</span>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Selected Movie details */}
          <div className="flex flex-col md:items-end justify-center gap-2 md:text-right min-w-[200px]">
            {hasMovie ? (
              <div className="space-y-1">
                <p className="text-xs font-mono text-zinc-500">SELECTED MOVIE</p>
                <p className="text-sm font-serif font-semibold text-zinc-100 italic flex items-center md:justify-end gap-1.5">
                  "{night.movie!.title}"
                  <span className="text-xs text-zinc-400 not-italic">({night.movie!.year})</span>
                </p>
                <p className="text-xs text-zinc-400">Dir: {night.movie!.director}</p>
                {night.movie!.trailerUrl && (
                  <div className="flex justify-start md:justify-end">
                    <a
                      href={night.movie!.trailerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-red-400 hover:text-red-300 transition-colors mt-1"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      Watch Trailer
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs font-mono text-zinc-500">STATUS</p>
                <p className="text-sm text-zinc-400 italic">No movie selected yet</p>
              </div>
            )}

            {/* Action buttons: Completed night overview popup OR Future reschedule/admin controls */}
            <div className="flex items-center gap-2 mt-2 flex-wrap md:justify-end">
              {/* For Completed / Watched Nights: Link to Night Overview pop-up window */}
              {isWatched && onOpenRecapModal && (
                <button
                  onClick={() => {
                    const matchingOverview: NightOverview = overviews.find(
                      (o) => o.movieNightId === night.id
                    ) || {
                      id: `overview-${night.id}`,
                      movieNightId: night.id,
                      title: night.movie
                        ? `${night.movie.title} — Session Recap`
                        : `Movie Night #${nightNumber} Recap`,
                      content: `Official session chronicle for the movie night of ${formatNZTDate(
                        night.date
                      )}. Hosted by ${night.selector} screening "${
                        night.movie?.title || "the chosen movie"
                      }". Member reviews and ratings have been preserved in the club ledger.`,
                      imageUrl: night.movie?.posterUrl || "",
                      author: "Ash Macintosh",
                      createdAt: night.date
                    };
                    onOpenRecapModal(matchingOverview, night);
                  }}
                  className="text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-500/50 transition-all rounded-lg px-3 py-1.5 flex items-center gap-1.5 font-medium cursor-pointer shadow-sm shadow-amber-500/5"
                  title="Open Night Overview Pop-up Window"
                >
                  <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>Night Overview</span>
                </button>
              )}

              {/* Admin controls: rescheduling only for uncompleted future dates */}
              {isAdmin && !isEditing && (
                <>
                  {!isWatched && (
                    <button
                      onClick={() => handleEditClick(night)}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 hover:border-zinc-600 transition-all rounded px-3 py-1.5 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Reschedule
                    </button>
                  )}

                  {onForceStatus && (
                    <>
                      {night.status === "skipped" ? (
                        <button
                          onClick={() => onForceStatus(night.id, "scheduled")}
                          className="text-[10px] uppercase font-mono px-2.5 py-1.5 rounded border transition-all cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-amber-500/30"
                        >
                          Unskip
                        </button>
                      ) : (
                        <>
                          {!isWatched && (
                            <button
                              onClick={() => onForceStatus(night.id, "skipped")}
                              className="text-[10px] uppercase font-mono px-2.5 py-1.5 rounded border transition-all cursor-pointer bg-red-950/40 hover:bg-red-950/80 text-red-400 border-red-900/40"
                              title="Skip this night (e.g. for Christmas, events, cancellation)"
                            >
                              Skip
                            </button>
                          )}
                          <button
                            onClick={() => onForceStatus(night.id, isWatched ? "scheduled" : "watched")}
                            className="text-[10px] uppercase font-mono px-2.5 py-1.5 rounded border transition-all cursor-pointer bg-zinc-950 hover:bg-zinc-800 text-zinc-400 border-zinc-800"
                          >
                            Mark {isWatched ? "Scheduled" : "Watched"}
                          </button>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="bg-[#0c0c0c] border border-zinc-900/60 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-xl shadow-[0_0_24px_rgba(245,158,11,0.01)]"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-serif text-zinc-100 font-bold flex items-center gap-3">
            <Calendar className="w-8 h-8 text-amber-500" />
            {title || "Fortnightly Schedule"}
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            {subtitle || "Starts 17th of July 2026 • Always 7:00 PM NZST / NZDT"}
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1.5 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full font-mono">
            <Shield className="w-3.5 h-3.5" />
            ADMIN MODE ENABLED
          </div>
        )}
      </div>

      {/* IN THE SCHEDULE TAB: Button to toggle & reveal all previous sessions */}
      {!futureOnly && previousNights.length > 0 && (
        <div className="mb-8">
          <button
            type="button"
            onClick={() => setShowPreviousSessions((prev) => !prev)}
            className="w-full flex items-center justify-between p-4 sm:p-5 rounded-2xl bg-[#090909] hover:bg-[#111111] border border-zinc-800/80 hover:border-amber-500/40 text-zinc-300 transition-all cursor-pointer group shadow-lg"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 group-hover:scale-105 transition-transform">
                <History className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold uppercase tracking-wider text-zinc-100 group-hover:text-amber-400 transition-colors flex items-center gap-2">
                  <span>{showPreviousSessions ? "Hide Previous Sessions" : "Previous Sessions"}</span>
                  <span className="text-[10px] font-mono font-normal bg-zinc-800 text-amber-400 px-2 py-0.5 rounded-full border border-zinc-700/60">
                    {previousNights.length}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 font-sans mt-0.5">
                  {showPreviousSessions
                    ? "Click to collapse previous sessions list"
                    : `Click to reveal ${previousNights.length} completed & past sessions`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 group-hover:text-amber-400">
              <span className="hidden sm:inline font-semibold">
                {showPreviousSessions ? "Hide History" : "View History"}
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-300 text-amber-500 ${
                  showPreviousSessions ? "rotate-180" : ""
                }`}
              />
            </div>
          </button>

          {/* Hidden previous sessions revealed upon button click */}
          <AnimatePresence>
            {showPreviousSessions && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="overflow-hidden space-y-4 pt-5 pb-3 border-b border-zinc-800/80"
              >
                <div className="flex items-center justify-between px-2 text-xs uppercase font-mono tracking-wider text-zinc-400">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Completed & Past Sessions History
                  </span>
                  <span>{previousNights.length} Total</span>
                </div>
                {previousNights.map((night, idx) => renderNightCard(night, idx, true))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* UPCOMING SESSIONS LIST (Next sessions in rotation) */}
      <div className="space-y-4">
        {!futureOnly && previousNights.length > 0 && (
          <div className="flex items-center justify-between px-1 pt-2 pb-1 text-xs uppercase font-mono tracking-wider text-zinc-400">
            <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <Clock className="w-3.5 h-3.5" />
              Upcoming Scheduled Sessions ({displayNights.length})
            </span>
            <span className="text-zinc-500">6-Session Host Rotation Cycle</span>
          </div>
        )}

        {displayNights.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 font-mono text-xs border border-dashed border-zinc-800/80 rounded-2xl bg-zinc-950/40">
            No upcoming future movie nights scheduled at the moment.
          </div>
        ) : (
          displayNights.map((night, index) => renderNightCard(night, index, false))
        )}

        {/* View Full Schedule CTA when limited */}
        {limit !== undefined && rawDisplayNights.length > limit && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3.5 p-4 sm:p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-200">
                  Showing next {limit} of {rawDisplayNights.length} upcoming sessions
                </p>
                <p className="text-[11px] text-zinc-500 font-sans">
                  The full 6-session pipeline is queued and available in the Schedule tab.
                </p>
              </div>
            </div>

            {onViewFullSchedule && (
              <button
                type="button"
                onClick={onViewFullSchedule}
                className="w-full sm:w-auto px-4 py-2.5 bg-zinc-900 hover:bg-amber-500 hover:text-zinc-950 text-amber-400 border border-amber-500/30 hover:border-amber-500 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm group shrink-0"
              >
                <span>View Full Schedule ({rawDisplayNights.length})</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}


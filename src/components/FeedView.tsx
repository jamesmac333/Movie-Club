import React, { useState } from "react";
import { MovieNight, Review, NightOverview, User, MOVIE_CLUB_USERS } from "../types.ts";
import { Star, MessageSquare, Trash2, Edit3, Plus, Image as ImageIcon, Heart, Calendar, Sparkles, BookOpen, Maximize2, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface FeedViewProps {
  nights: MovieNight[];
  reviews: Review[];
  overviews: NightOverview[];
  currentUser: User | null;
  onAddReview: (movieNightId: string, user: string, rating: number, comment: string) => Promise<void>;
  onEditReview: (id: string, rating: number, comment: string) => Promise<void>;
  onDeleteReview: (id: string) => Promise<void>;
  onToggleStarReview?: (id: string) => Promise<void>;
  onDeleteOverview?: (id: string) => Promise<void>;
  onOpenRecapModal?: (overview: NightOverview, night: MovieNight) => void;
}

export default function FeedView({
  nights,
  reviews,
  overviews,
  currentUser,
  onAddReview,
  onEditReview,
  onDeleteReview,
  onToggleStarReview,
  onDeleteOverview,
  onOpenRecapModal
}: FeedViewProps) {
  const [activeReviewFormId, setActiveReviewFormId] = useState<string | null>(null);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");

  // Collapsed state for Overviews and Reviews (both collapsed by default)
  const [expandedOverviewIds, setExpandedOverviewIds] = useState<Record<string, boolean>>({});
  const [expandedReviewIds, setExpandedReviewIds] = useState<Record<string, boolean>>({});

  const toggleOverviewExpand = (nightId: string) => {
    setExpandedOverviewIds(prev => ({
      ...prev,
      [nightId]: !prev[nightId]
    }));
  };

  const toggleReviewsExpand = (nightId: string) => {
    setExpandedReviewIds(prev => ({
      ...prev,
      [nightId]: !prev[nightId]
    }));
  };

  const handleToggleStar = async (reviewId: string) => {
    if (onToggleStarReview) {
      try {
        await onToggleStarReview(reviewId);
      } catch (err: any) {
        console.error("Failed to toggle review star", err);
      }
    }
  };

  // Editing review state
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState("");
  const [updatingReview, setUpdatingReview] = useState(false);

  // Group watched nights with overviews (chronologically, newest first)
  const watchedNights = nights
    .filter(n => n.movie !== null) // must have a movie selected
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const allOverviewsExpanded = watchedNights.length > 0 && watchedNights.every(n => !!expandedOverviewIds[n.id]);
  const allReviewsExpanded = watchedNights.length > 0 && watchedNights.every(n => !!expandedReviewIds[n.id]);

  const toggleAllOverviews = () => {
    if (allOverviewsExpanded) {
      setExpandedOverviewIds({});
    } else {
      const all: Record<string, boolean> = {};
      watchedNights.forEach(n => { all[n.id] = true; });
      setExpandedOverviewIds(all);
    }
  };

  const toggleAllReviews = () => {
    if (allReviewsExpanded) {
      setExpandedReviewIds({});
    } else {
      const all: Record<string, boolean> = {};
      watchedNights.forEach(n => { all[n.id] = true; });
      setExpandedReviewIds(all);
    }
  };

  const handlePostReviewSubmit = async (movieNightId: string) => {
    if (!currentUser) {
      setReviewError("You must be logged in to write a review");
      return;
    }
    if (!newComment.trim()) {
      setReviewError("Please write some thoughts first");
      return;
    }

    setReviewError("");
    setSubmittingReview(true);
    try {
      await onAddReview(movieNightId, currentUser.name, newRating, newComment);
      setNewComment("");
      setNewRating(5);
      setActiveReviewFormId(null);
      // Auto-expand reviews for this session so the user can see their submission
      setExpandedReviewIds(prev => ({ ...prev, [movieNightId]: true }));
    } catch (e: any) {
      setReviewError(e.message || "Failed to post review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleEditReviewClick = (review: Review) => {
    setEditingReviewId(review.id);
    setEditRating(review.rating);
    setEditComment(review.comment);
    // Ensure reviews section is visible while editing
    setExpandedReviewIds(prev => ({ ...prev, [review.movieNightId]: true }));
  };

  const handleSaveEditReview = async (id: string) => {
    if (!editComment.trim()) return;
    setUpdatingReview(true);
    try {
      await onEditReview(id, editRating, editComment);
      setEditingReviewId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingReview(false);
    }
  };

  const handleDeleteReviewClick = async (id: string) => {
    if (confirm("Are you sure you want to delete this review?")) {
      try {
        await onDeleteReview(id);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const formatNZTDateOnly = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-NZ", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  const renderStars = (rating: number, interactive = false, onClick?: (val: number) => void) => {
    return (
      <div className="flex items-center gap-1.5" style={{ touchAction: "manipulation" }}>
        {Array.from({ length: 5 }).map((_, idx) => {
          const val = idx + 1;
          const isFullyFilled = rating >= val;
          const isHalfFilled = !isFullyFilled && rating >= val - 0.5;

          return (
            <div
              key={idx}
              className={`relative select-none ${interactive ? "cursor-pointer hover:scale-110 transition-all" : ""}`}
              style={{ width: "16px", height: "16px" }}
            >
              {interactive && (
                <>
                  {/* Left half clickable area */}
                  <div
                    className="absolute left-0 top-0 w-1/2 h-full z-20"
                    onClick={() => onClick && onClick(idx + 0.5)}
                    title={`Rate ${idx + 0.5} Stars`}
                  />
                  {/* Right half clickable area */}
                  <div
                    className="absolute right-0 top-0 w-1/2 h-full z-20"
                    onClick={() => onClick && onClick(idx + 1)}
                    title={`Rate ${idx + 1} Stars`}
                  />
                </>
              )}

              {/* Visual star layers */}
              <div className="absolute inset-0 z-10 pointer-events-none">
                {/* Background empty star */}
                <Star className="w-4 h-4 text-zinc-700" />
                
                {/* Foreground filled/half-filled star */}
                {isFullyFilled ? (
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500 absolute inset-0" />
                ) : isHalfFilled ? (
                  <div className="absolute inset-0 w-[50%] overflow-hidden">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500 max-w-none" />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        {interactive && (
          <span className="text-xs text-amber-500 font-mono font-bold ml-1.5">
            {rating.toFixed(1)}
          </span>
        )}
      </div>
    );
  };

  if (watchedNights.length === 0) {
    return (
      <div className="bg-zinc-950/40 border border-zinc-900 rounded-3xl p-12 text-center text-zinc-500 font-serif">
        <MessageSquare className="w-12 h-12 mx-auto text-zinc-700 mb-3 animate-bounce" />
        <p className="text-zinc-400 font-medium">No movies watched yet.</p>
        <p className="text-sm text-zinc-600 mt-1">Once movies are watched and reviews are written, they will populate here!</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="border-b border-zinc-900 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl sm:text-4xl font-serif text-zinc-100 font-bold flex items-center gap-3">
            <Heart className="w-8 h-8 text-red-500 fill-red-500/20" />
            Nostalgic Feed & Memories
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Relive our club nights: Read Ash's overviews, see the photos, and check out everyone's reviews!
          </p>
        </div>

        {/* Global Expand / Collapse Quick Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={toggleAllOverviews}
            className="text-[11px] font-mono px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            title="Expand or collapse all night overviews"
          >
            {allOverviewsExpanded ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />}
            <span>{allOverviewsExpanded ? "Collapse Overviews" : "Expand All Overviews"}</span>
          </button>
          <button
            type="button"
            onClick={toggleAllReviews}
            className="text-[11px] font-mono px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            title="Expand or collapse all member reviews"
          >
            {allReviewsExpanded ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />}
            <span>{allReviewsExpanded ? "Collapse Reviews" : "Expand All Reviews"}</span>
          </button>
        </div>
      </div>

      <div className="space-y-12">
        {watchedNights.map((night) => {
          // Find associated night overview
          const overview = overviews.find(ov => ov.movieNightId === night.id);
          const isAsh = currentUser?.username?.toLowerCase() === "ash" || currentUser?.isAsh === true;
          const isAdmin = currentUser?.isAdmin || currentUser?.username?.toLowerCase() === "james" || currentUser?.username?.toLowerCase() === "ash";
          // Find associated reviews
          const nightReviews = reviews.filter(rev => rev.movieNightId === night.id);
          // Average rating
          const avgRating = nightReviews.length > 0 
            ? (nightReviews.reduce((acc, r) => acc + r.rating, 0) / nightReviews.length).toFixed(1)
            : null;

          const isOverviewExpanded = !!expandedOverviewIds[night.id];
          const isReviewsExpanded = !!expandedReviewIds[night.id] || activeReviewFormId === night.id || (editingReviewId !== null && nightReviews.some(r => r.id === editingReviewId));

          return (
            <motion.article
              key={night.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="bg-[#0c0c0c] border border-zinc-900/60 rounded-3xl overflow-hidden shadow-xl shadow-[0_0_24px_rgba(245,158,11,0.01)] transition-colors hover:border-zinc-800"
            >
              {/* Header metadata ribbon */}
              <div className="bg-[#080808]/50 border-b border-zinc-900/60 px-6 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-zinc-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-zinc-300">
                    <Calendar className="w-4 h-4 text-amber-500/80" />
                    {formatNZTDateOnly(night.date)}
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span>Selector: <strong className="text-zinc-200">{night.selector}</strong></span>
                </div>
                
                {avgRating && (
                  <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 px-2.5 py-1 rounded-lg">
                    <Star className="w-3.5 h-3.5 fill-amber-500" />
                    <span>Club Rating: {avgRating} / 5.0</span>
                  </div>
                )}
              </div>

              {/* Main Content Body */}
              <div className="p-6 sm:p-8 space-y-6">
                
                {/* Movie Details bar */}
                <div className="flex items-start gap-4 bg-[#080808]/80 border border-zinc-900/50 rounded-2xl p-4 sm:p-5">
                  {night.movie!.posterUrl && (
                    <img
                      src={night.movie!.posterUrl}
                      alt={night.movie!.title}
                      className="w-16 sm:w-20 rounded-lg object-cover border border-zinc-800 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">The Film watched</span>
                    <h3 className="text-xl font-serif text-zinc-50 font-bold italic leading-tight">
                      "{night.movie!.title}"
                      <span className="text-sm text-zinc-400 not-italic ml-1.5">({night.movie!.year})</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Dir: <strong className="text-zinc-300">{night.movie!.director}</strong> | Genre: <strong className="text-zinc-300">{night.movie!.genre}</strong> | Runtime: <strong className="text-zinc-300">{night.movie!.runtime} mins</strong>
                    </p>
                  </div>
                </div>

                {/* Night Overview Section (Collapsed by default, expand to read all) */}
                {overview ? (
                  <div className="space-y-3 bg-zinc-950/40 border border-zinc-900/80 rounded-2xl p-5 sm:p-6 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <span className="text-xs font-mono text-amber-500/80 tracking-widest uppercase">The Next Day Overview by Ash</span>
                        <div className="flex items-center gap-2">
                          {onOpenRecapModal && (
                            <button
                              type="button"
                              onClick={() => onOpenRecapModal(overview, night)}
                              className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg border border-amber-500/30 hover:border-amber-500/50 transition-all cursor-pointer flex items-center gap-1.5 text-[10px] font-mono font-semibold"
                              title="Read in Pop-up Window"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                              <span>Pop-up Window</span>
                            </button>
                          )}
                          {(isAdmin || isAsh) && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm("Are you sure you want to delete this overview recap?")) {
                                  if (onDeleteOverview) {
                                    await onDeleteOverview(overview.id);
                                  }
                                }
                              }}
                              className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-900/40 transition-all cursor-pointer flex items-center gap-1.5 text-[10px] font-mono font-semibold"
                              title="Delete Overview Recap"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Overview</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Overview Title: Clicking toggles expand/collapse */}
                      <h4 
                        onClick={() => toggleOverviewExpand(night.id)}
                        className="text-xl sm:text-2xl font-serif font-bold text-zinc-100 tracking-wide hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-2 group/title"
                        title={isOverviewExpanded ? "Click to collapse overview" : "Click to expand full overview"}
                      >
                        <span>{overview.title}</span>
                        <span className="text-zinc-600 group-hover/title:text-amber-400 transition-colors">
                          {isOverviewExpanded ? (
                            <ChevronUp className="w-4 h-4 inline" />
                          ) : (
                            <ChevronDown className="w-4 h-4 inline" />
                          )}
                        </span>
                      </h4>
                    </div>

                    {/* Overview Body with Truncation / Full Expand */}
                    <div 
                      onClick={() => !isOverviewExpanded && toggleOverviewExpand(night.id)}
                      className={`space-y-3 ${!isOverviewExpanded ? "cursor-pointer group/ov" : ""}`}
                    >
                      <p className={`text-zinc-300 text-sm sm:text-base leading-relaxed font-sans font-light transition-colors ${
                        !isOverviewExpanded ? "line-clamp-2 sm:line-clamp-3 group-hover/ov:text-zinc-100" : ""
                      }`}>
                        {overview.content}
                      </p>

                      {/* Expand / Collapse Action Button and Photo Note */}
                      <div className="flex items-center justify-between gap-3 pt-0.5 flex-wrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleOverviewExpand(night.id);
                          }}
                          className="text-amber-400 hover:text-amber-300 text-xs font-mono font-semibold flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all cursor-pointer"
                        >
                          {isOverviewExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              <span>Collapse Overview</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              <span>Read Full Overview</span>
                            </>
                          )}
                        </button>

                        {!isOverviewExpanded && overview.imageUrl && (
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleOverviewExpand(night.id);
                            }}
                            className="text-[11px] font-mono text-zinc-500 group-hover/ov:text-zinc-300 flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-amber-500/80" />
                            <span>Photo memory attached (click to expand)</span>
                          </span>
                        )}
                      </div>

                      {/* Ash's Memory Photo (the "friends" photo uploaded, revealed when overview is expanded) */}
                      <AnimatePresence>
                        {isOverviewExpanded && overview.imageUrl && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden pt-2"
                          >
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenRecapModal && onOpenRecapModal(overview, night);
                              }}
                              className={`relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 max-h-[400px] ${onOpenRecapModal ? 'cursor-pointer group hover:border-amber-500/50 transition-all' : ''}`}
                            >
                              <img
                                src={overview.imageUrl}
                                alt="Movie Club Friends Gathering"
                                className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute bottom-4 left-4 bg-black/75 backdrop-blur-md text-zinc-300 border border-zinc-800 rounded px-3 py-1 text-xs font-mono flex items-center gap-1.5">
                                <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                                Memory Captured by Ash Macintosh
                              </div>
                              {onOpenRecapModal && (
                                <div className="absolute top-4 right-4 bg-black/75 backdrop-blur-md text-amber-400 border border-amber-500/30 rounded px-2.5 py-1 text-[11px] font-mono opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shadow-lg">
                                  <Maximize2 className="w-3 h-3" />
                                  <span>Expand Recap</span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-900/10 border border-dashed border-zinc-900 rounded-2xl p-6 text-center space-y-2">
                    <ImageIcon className="w-8 h-8 text-zinc-700 mx-auto" />
                    <p className="text-sm font-serif text-zinc-500 italic">Ash Macintosh is preparing the night overview and gather image for this event...</p>
                    {(currentUser?.username?.toLowerCase() === "ash" || currentUser?.isAsh === true) && (
                      <p className="text-xs text-amber-500">
                        *Hint: Ash, use the Night Writer form below to post this night's overview!
                      </p>
                    )}
                  </div>
                )}

                {/* Reviews Section (Collapsed by default for rapid scrolling) */}
                <div className="pt-6 border-t border-zinc-900">
                  <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleReviewsExpand(night.id)}
                        className="flex items-center gap-2 group text-left cursor-pointer select-none"
                      >
                        <h5 className="text-sm font-mono font-bold tracking-wider uppercase text-zinc-400 group-hover:text-zinc-200 flex items-center gap-2 transition-colors">
                          <MessageSquare className="w-4 h-4 text-zinc-500 group-hover:text-amber-500 transition-colors" />
                          <span>Member Reviews ({nightReviews.length})</span>
                          {nightReviews.length > 0 && (
                            <span className="p-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-amber-400 group-hover:border-zinc-700 transition-all inline-flex items-center">
                              {isReviewsExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </span>
                          )}
                        </h5>
                      </button>

                      {nightReviews.length > 0 && !isReviewsExpanded && avgRating && (
                        <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline-flex items-center gap-1">
                          • Avg: <strong className="text-amber-400">{avgRating}★</strong>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {nightReviews.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleReviewsExpand(night.id)}
                          className="text-xs text-zinc-400 hover:text-zinc-200 font-mono py-1 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          {isReviewsExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              <span>Hide Reviews</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              <span>Show Reviews ({nightReviews.length})</span>
                            </>
                          )}
                        </button>
                      )}

                      {currentUser && !nightReviews.some(r => r.user === currentUser.name) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!isReviewsExpanded) {
                              setExpandedReviewIds(prev => ({ ...prev, [night.id]: true }));
                            }
                            setActiveReviewFormId(activeReviewFormId === night.id ? null : night.id);
                          }}
                          className="bg-zinc-900 hover:bg-zinc-800 hover:text-zinc-100 border border-zinc-800 text-zinc-300 text-xs px-3 py-1.5 rounded-lg font-mono flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Review
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Collapsed Reviews Teaser Preview */}
                  {!isReviewsExpanded && nightReviews.length > 0 && (
                    <div 
                      onClick={() => toggleReviewsExpand(night.id)}
                      className="mt-2 bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-900 hover:border-zinc-800 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-zinc-400 cursor-pointer transition-colors group"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span className="text-zinc-500 font-mono">{nightReviews.length} review{nightReviews.length > 1 ? "s" : ""} recorded</span>
                        {nightReviews.some(r => r.isStarred) && (
                          <span className="text-amber-400 font-mono text-[10px] bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-amber-400" />
                            Ash's Pick Included
                          </span>
                        )}
                      </span>
                      <span className="text-amber-500/80 group-hover:text-amber-400 font-mono text-[11px] flex items-center gap-1 shrink-0 ml-2">
                        Click to view reviews <ChevronDown className="w-3 h-3" />
                      </span>
                    </div>
                  )}

                  {/* Expanded Reviews Content (Forms + Review Cards) */}
                  <AnimatePresence>
                    {isReviewsExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden mt-3 space-y-4"
                      >
                        {/* Add Review inline form */}
                        {activeReviewFormId === night.id && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-5 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono font-semibold text-zinc-300">
                                Reviewing as: <strong className="text-zinc-100">{currentUser?.name}</strong>
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-400 font-mono">Rating:</span>
                                {renderStars(newRating, true, setNewRating)}
                              </div>
                            </div>

                            <textarea
                              placeholder="What did you think of this film? Write your review..."
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              rows={6}
                              className="w-full min-h-[150px] sm:min-h-[170px] bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-xl px-4 py-3.5 text-base sm:text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/80 font-sans leading-relaxed resize-y transition-all"
                            />

                            {reviewError && <p className="text-xs text-red-400">{reviewError}</p>}

                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[11px] text-zinc-500 font-mono">
                                {newComment.trim().length > 0 ? `${newComment.trim().length} characters` : ""}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveReviewFormId(null);
                                    setReviewError("");
                                  }}
                                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs px-3.5 py-2 rounded-lg font-medium transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePostReviewSubmit(night.id)}
                                  disabled={submittingReview}
                                  className="bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  {submittingReview ? "Posting..." : "Submit Review"}
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* Existing Reviews List */}
                        {nightReviews.length === 0 ? (
                          <p className="text-xs text-zinc-600 italic py-2">No reviews written for this movie yet. Click Add Review to start!</p>
                        ) : (
                          <div className="space-y-4">
                            {nightReviews.map((review, rIdx) => {
                              const isAuthor = review.user === currentUser?.name;
                              const isReviewEditing = editingReviewId === review.id;
                              const canModify = isAuthor || currentUser?.isAdmin;
                              const isAsh = currentUser?.username?.toLowerCase() === "ash" || currentUser?.isAsh === true;
                              const isStarred = review.isStarred || false;

                              return (
                                <motion.div 
                                  key={review.id}
                                  initial={{ opacity: 0, y: 15 }}
                                  whileInView={{ opacity: 1, y: 0 }}
                                  viewport={{ once: true }}
                                  transition={{ duration: 0.35, delay: Math.min(rIdx * 0.05, 0.25) }}
                                  whileHover={{ y: -2, transition: { duration: 0.15 } }}
                                  className={`border rounded-xl p-4 flex flex-col gap-3 transition-colors ${
                                    isStarred 
                                      ? "bg-amber-500/5 border-amber-500/30 shadow-lg shadow-amber-500/[0.02]" 
                                      : "bg-zinc-900/20 border-zinc-900/60 hover:border-zinc-800"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-7 h-7 bg-zinc-800 rounded-full flex items-center justify-center font-mono text-xs font-bold text-zinc-300 uppercase">
                                        {review.user.substring(0, 2)}
                                      </div>
                                      <div className="text-xs">
                                        <span className="font-semibold text-zinc-200 block flex items-center gap-1.5">
                                          {review.user}
                                        </span>
                                        <span className="text-zinc-500 text-[10px] font-mono">{formatNZTDateOnly(review.createdAt)}</span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      {/* Ash's Star Toggle / Favorite review badge */}
                                      {(isAsh || isStarred) && (
                                        <button
                                          type="button"
                                          disabled={!isAsh}
                                          onClick={() => handleToggleStar(review.id)}
                                          className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider ${
                                            isStarred
                                              ? "bg-amber-500/20 border-amber-500/40 text-amber-500 hover:bg-amber-500/30"
                                              : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-amber-500 hover:border-amber-500/30 hover:bg-zinc-900"
                                          } ${!isAsh ? "cursor-default opacity-90" : "cursor-pointer"}`}
                                          title={isAsh ? (isStarred ? "Unstar Review" : "Star as Ash's Favorite") : "Ash's Favorite Review"}
                                        >
                                          <Star className={`w-3.5 h-3.5 ${isStarred ? "fill-amber-500 text-amber-500" : "text-current"}`} />
                                          {isStarred && <span>Ash's Pick</span>}
                                        </button>
                                      )}

                                      {isReviewEditing ? (
                                        renderStars(editRating, true, setEditRating)
                                      ) : (
                                        renderStars(review.rating)
                                      )}
                                      
                                      {canModify && !isReviewEditing && (
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => handleEditReviewClick(review)}
                                            className="text-zinc-500 hover:text-amber-500 p-1 rounded hover:bg-zinc-900/80 transition-all cursor-pointer"
                                            title="Edit Review"
                                          >
                                            <Edit3 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteReviewClick(review.id)}
                                            className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-900/80 transition-all cursor-pointer"
                                            title="Delete Review"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {isReviewEditing ? (
                                    <div className="space-y-3 mt-2">
                                      <textarea
                                        value={editComment}
                                        onChange={(e) => setEditComment(e.target.value)}
                                        className="w-full min-h-[140px] sm:min-h-[160px] bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-xl px-4 py-3.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/80 font-sans leading-relaxed resize-y transition-all"
                                        rows={6}
                                        placeholder="Edit your review..."
                                      />
                                      <div className="flex items-center justify-between pt-1">
                                        <span className="text-[11px] text-zinc-500 font-mono">
                                          {editComment.trim().length > 0 ? `${editComment.trim().length} characters` : ""}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setEditingReviewId(null)}
                                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs px-3.5 py-2 rounded-lg font-medium transition-colors cursor-pointer"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleSaveEditReview(review.id)}
                                            disabled={updatingReview}
                                            className="bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                          >
                                            {updatingReview ? "Saving..." : "Save Changes"}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-zinc-300 text-sm font-sans pl-1">
                                      {review.comment}
                                    </p>
                                  )}
                                </motion.div>
                              );
                            })}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}

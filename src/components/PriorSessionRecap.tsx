import React, { useState, useRef } from "react";
import { MovieNight, Review, NightOverview, User, isAuthenticGatheringPhoto, isBeforeDataLoss } from "../types.ts";
import { Calendar, Star, MessageSquare, Image as ImageIcon, Film, Heart, BookOpen, Maximize2, Camera, Upload, Trash2, Loader2, ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import PaletteStrip from "./PaletteStrip.tsx";
import { FavouriteStamp, StarRow, dealt, useJustRevealed } from "./Motion.tsx";
import { Avatar } from "./OverlayPage.tsx";

interface PriorSessionRecapProps {
  nights: MovieNight[];
  reviews: Review[];
  sealedNightIds?: Set<string>;
  overviews: NightOverview[];
  currentUser?: User | null;
  onOpenRecapModal?: (overview: NightOverview, night: MovieNight) => void;
  onUpdateOverviewImage?: (overviewId: string, imageUrl: string) => Promise<void>;
  onDeleteOverviewImage?: (overviewId: string) => Promise<void>;
  onOpenFilm?: (nightId: string) => void;
  // Members, for the photos next to each review
  users?: User[];
}

export default function PriorSessionRecap({
  nights,
  reviews,
  sealedNightIds,
  overviews,
  currentUser,
  onOpenRecapModal,
  onUpdateOverviewImage,
  onDeleteOverviewImage,
  onOpenFilm,
  users = []
}: PriorSessionRecapProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<string>("");
  // Posting your review unlocks everyone else's: deal them out
  const justRevealed = useJustRevealed([...(sealedNightIds || [])]);
  const reduce = useReducedMotion();
  // Long reviews show a few lines until opened
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const isAsh = currentUser?.username?.toLowerCase() === "ash" || currentUser?.isAsh === true;
  const isAdmin = currentUser?.username?.toLowerCase() === "james" || currentUser?.isAdmin === true;
  const canManagePhotos = isAsh || isAdmin;

  const compressImage = (file: File, maxWidth = 1280, maxHeight = 1280, quality = 0.82): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawDataUrl = e.target?.result as string;
        if (!rawDataUrl) {
          reject(new Error("Empty image file"));
          return;
        }
        const img = new Image();
        img.onload = () => {
          try {
            let { width, height } = img;
            if (width > maxWidth || height > maxHeight) {
              if (width / maxWidth > height / maxHeight) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              } else {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
              }
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve(rawDataUrl);
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", quality);
            resolve(dataUrl);
          } catch (canvasErr) {
            resolve(rawDataUrl);
          }
        };
        img.onerror = () => {
          if (file.size < 10 * 1024 * 1024 && rawDataUrl) {
            resolve(rawDataUrl);
          } else {
            reject(new Error("Failed to load image"));
          }
        };
        img.src = rawDataUrl;
      };
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, overviewId: string) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateOverviewImage) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.");
      return;
    }

    setUploading(true);
    setFeedback("Compressing and uploading photo...");
    try {
      const dataUrl = await compressImage(file);
      await onUpdateOverviewImage(overviewId, dataUrl);
      setFeedback("Photo saved successfully!");
      setTimeout(() => setFeedback(""), 3000);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to upload photo");
      setFeedback("");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async (overviewId: string) => {
    if (!confirm("Are you sure you want to remove this gathering photo?")) return;
    if (!onDeleteOverviewImage) return;

    setUploading(true);
    try {
      await onDeleteOverviewImage(overviewId);
      setFeedback("Photo removed.");
      setTimeout(() => setFeedback(""), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to remove photo");
    } finally {
      setUploading(false);
    }
  };
  // 1. Find the most recently watched movie night
  const watchedNights = nights
    .filter((n) => n.status === "watched" && n.movie)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const priorNight = watchedNights[0] || null;

  if (!priorNight) {
    return (
      <div className="bg-zinc-900/5 border border-dashed border-zinc-900 rounded-3xl p-8 text-center space-y-2">
        <Film className="w-8 h-8 text-zinc-500 mx-auto animate-pulse" />
        <h4 className="text-sm font-semibold text-zinc-400 font-mono uppercase tracking-wider">No Prior Sessions Yet</h4>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
          Once we complete our first movie night and mark it as watched, its overview and member reviews will be highlighted here.
        </p>
      </div>
    );
  }

  // Find associated overview and reviews
  const overview = overviews.find((ov) => ov.movieNightId === priorNight.id);
  // Hidden until this member has posted their own review
  const sealed = !!sealedNightIds?.has(priorNight.id);
  const sealedCount = sealed ? reviews.filter((rev) => rev.movieNightId === priorNight.id).length : 0;
  const nightReviews = sealed ? [] : reviews.filter((rev) => rev.movieNightId === priorNight.id);

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


  return (
    <motion.div 
      initial={{ opacity: 0, y: 35 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="space-y-6"
    >
      {/* Title & Badge */}
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-3xl text-zinc-50">Last time</h2>
        {avgRating && (
          <p className="flex items-center gap-1 text-sm text-amber-500 shrink-0">
            <Star className="w-4 h-4 fill-amber-500" aria-hidden="true" />
            <span>
              {avgRating} <span className="text-zinc-400">from {nightReviews.length} {nightReviews.length === 1 ? "review" : "reviews"}</span>
            </span>
          </p>
        )}
      </div>

      {/* Main Container */}
      <div className="flex flex-col gap-8 bg-[#0c0c0c] border border-zinc-900/60 rounded-3xl p-6 sm:p-8 transition-all hover:border-zinc-800">
        
        {/* Left/Middle: Film details and recap */}
        <div className="space-y-6">
          
          {/* Film banner widget */}
          <div className="flex gap-4 items-end">
            {priorNight.movie!.posterUrl && (
              <img
                src={priorNight.movie!.posterUrl}
                alt={`${priorNight.movie!.title} poster`}
                className="w-24 sm:w-28 aspect-[2/3] rounded-xl object-cover border border-zinc-700 shadow-[0_12px_28px_rgba(0,0,0,0.45)] shrink-0"
                referrerPolicy="no-referrer"
              />
            )}
            <div className="space-y-1 min-w-0 pb-1">
              <span className="slate text-zinc-400 block">{formatNZTDate(priorNight.date)}</span>
              <h3 className="text-2xl font-serif text-zinc-50 break-words">{priorNight.movie!.title}</h3>
              <p className="text-sm text-zinc-400">{priorNight.selector.split(" ")[0]}'s pick · {priorNight.movie!.year}</p>
              {onOpenFilm && (
                <button type="button" onClick={() => onOpenFilm(priorNight.id)} className="min-h-11 -ml-1 px-1 text-sm font-semibold text-amber-500 hover:text-amber-400 inline-flex items-center gap-1 cursor-pointer">
                  Film page <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <PaletteStrip posterUrl={priorNight.movie!.posterUrl} className="h-2 rounded" />

          {/* Overview text content (Light/White Card with Dark Text for effortless reading) */}
          {overview ? (
            <div className="space-y-3 bg-amber-950 text-zinc-100 border border-amber-800 rounded-2xl p-5 sm:p-6 shadow-md">
              <div className="flex items-start justify-between gap-3 flex-wrap border-b border-amber-800 pb-2.5">
                <div className="space-y-0.5">
                  <span className="slate text-amber-500 block">Recap by {(overview.author || "Ash").split(" ")[0]}</span>
                  <h5 className="text-lg font-serif font-bold text-zinc-100">{overview.title}</h5>
                </div>
              </div>
              <p className="text-zinc-200 text-sm sm:text-base leading-relaxed font-sans font-normal line-clamp-4">
                {overview.content}
              </p>
              {onOpenRecapModal && (
                <button
                  type="button"
                  onClick={() => onOpenRecapModal(overview, priorNight)}
                  className="min-h-11 text-sm font-semibold text-amber-500 hover:text-amber-300 cursor-pointer"
                >
                  Read the full recap
                </button>
              )}
            </div>
          ) : (
            <div className="p-5 bg-zinc-900/10 border border-dashed border-zinc-900 rounded-2xl text-center">
              <p className="text-sm text-zinc-400">Ash's recap of this night is on its way.</p>
            </div>
          )}

          {/* Memory image or upload prompt */}
          {overview && (
            <div className="space-y-2">
              {isAuthenticGatheringPhoto(overview.imageUrl) ? (
                <div className="space-y-2">
                  <div 
                    onClick={() => onOpenRecapModal && onOpenRecapModal(overview, priorNight)}
                    className={`relative letterbox rounded-2xl overflow-hidden border border-zinc-800 ${onOpenRecapModal ? 'cursor-pointer group hover:border-amber-500/50 transition-all' : ''}`}
                  >
                    <img
                      src={overview.imageUrl}
                      alt="Movie Club friends at the gathering"
                      className="group-hover:scale-[1.01] transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    {onOpenRecapModal && (
                      <div className="absolute top-3 right-3 bg-black/75 backdrop-blur-md text-zinc-100 rounded-full w-9 h-9 flex items-center justify-center" aria-hidden="true">
                        <Maximize2 className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {canManagePhotos && (
                    <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                      <span className="text-sm text-zinc-400">
                        {feedback || "Photo from the night"}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="min-h-11 text-sm text-amber-500 font-semibold px-3 rounded-xl bg-amber-900/40 hover:bg-amber-900/70 border border-amber-800 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4 text-amber-500" />}
                          <span>Change photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(overview.id)}
                          disabled={uploading}
                          className="min-h-11 text-sm text-zinc-400 hover:text-red-400 px-3 rounded-xl hover:bg-zinc-900 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#080808] border border-dashed border-zinc-800/80 rounded-2xl p-5 text-center space-y-2">
                  <div className="flex items-center justify-center gap-2 text-zinc-400 text-sm">
                    <Camera className="w-4 h-4 text-amber-500" />
                    <span>No photo from the night yet</span>
                  </div>
                  {canManagePhotos && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="min-h-11 inline-flex items-center gap-2 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
                      >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        <span>Add a photo</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFileChange(e, overview.id)}
                accept="image/*"
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Right side: All reviews list */}
        <div className="flex flex-col border-t border-zinc-800 pt-6">
          <h3 className="font-serif text-2xl text-zinc-50 mb-4">
            Reviews <span className="text-zinc-400 text-lg">· {sealed ? sealedCount : nightReviews.length}</span>
          </h3>

          {nightReviews.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#080808] border border-zinc-900 rounded-2xl text-center space-y-1.5 my-auto">
              <Heart className="w-5 h-5 text-zinc-200" />
              {sealed ? (
                <>
                  <p className="text-sm text-zinc-300">
                    {sealedCount === 0 ? "No reviews yet." : `${sealedCount} review${sealedCount === 1 ? " is" : "s are"} in.`}
                  </p>
                  <p className="text-sm text-zinc-400">Post yours to see what everyone else thought.</p>
                </>
              ) : isBeforeDataLoss(priorNight.date) ? (
                <>
                  <p className="text-sm text-zinc-300">The original reviews for this night were lost.</p>
                  <p className="text-sm text-zinc-400">Google AI Studio wiped the club database on 14 October 2026. If you remember yours, add it again in Memories.</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-zinc-300">No reviews yet.</p>
                  <p className="text-sm text-zinc-400">Add yours in Memories.</p>
                </>
              )}
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-800">
              {nightReviews.map((review, i) => {
                const member = users.find((u) => u.name.toLowerCase() === review.user.toLowerCase());
                const isLong = (review.comment?.length || 0) > 180;
                const open = expanded.has(review.id);
                return (
                  <motion.li key={review.id} {...dealt(i, justRevealed.has(priorNight.id), reduce)} className="py-4 first:pt-0 last:pb-0 flex gap-3">
                    <Avatar user={member} name={review.user} className="w-10 h-10" badgeSize="sm" />
                    <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="font-semibold text-zinc-100">{review.user.split(" ")[0]}</span>
                        <span className="flex items-center gap-2">
                          <AnimatePresence initial={false}>{review.isStarred && <FavouriteStamp />}</AnimatePresence>
                          <StarRow rating={review.rating} size="sm" />
                        </span>
                      </div>
                      {review.comment && (
                        <>
                          <p className={`text-sm text-zinc-300 leading-relaxed whitespace-pre-line break-words ${isLong && !open ? "line-clamp-4" : ""}`}>
                            {review.comment}
                          </p>
                          {isLong && (
                            <button type="button" onClick={() => toggleExpanded(review.id)} className="self-start min-h-11 -my-2 text-sm font-semibold text-amber-500 hover:text-amber-400 cursor-pointer">
                              {open ? "Show less" : "Read more"}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>

      </div>
    </motion.div>
  );
}

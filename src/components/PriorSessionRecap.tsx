import React, { useState, useRef } from "react";
import { MovieNight, Review, NightOverview, User, isAuthenticGatheringPhoto } from "../types.ts";
import { Calendar, Star, MessageSquare, Image as ImageIcon, Film, Heart, BookOpen, Maximize2, Camera, Upload, Trash2, Loader2 } from "lucide-react";
import { motion } from "motion/react";

interface PriorSessionRecapProps {
  nights: MovieNight[];
  reviews: Review[];
  overviews: NightOverview[];
  currentUser?: User | null;
  onOpenRecapModal?: (overview: NightOverview, night: MovieNight) => void;
  onUpdateOverviewImage?: (overviewId: string, imageUrl: string) => Promise<void>;
  onDeleteOverviewImage?: (overviewId: string) => Promise<void>;
}

export default function PriorSessionRecap({
  nights,
  reviews,
  overviews,
  currentUser,
  onOpenRecapModal,
  onUpdateOverviewImage,
  onDeleteOverviewImage
}: PriorSessionRecapProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<string>("");

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
    <motion.div 
      initial={{ opacity: 0, y: 35 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="space-y-6"
    >
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-[#0c0c0c] border border-zinc-900/60 rounded-3xl p-6 sm:p-8 transition-all hover:border-zinc-800">
        
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

          {/* Overview text content (Light/White Card with Dark Text for effortless reading) */}
          {overview ? (
            <div className="space-y-3 bg-white text-zinc-900 border border-amber-200/90 rounded-2xl p-5 sm:p-6 shadow-md">
              <div className="flex items-start justify-between gap-3 flex-wrap border-b border-zinc-200 pb-2.5">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono text-amber-800 font-bold uppercase tracking-wider block">Recap by {overview.author || "Ash Macintosh"}</span>
                  <h5 className="text-lg font-serif font-bold text-zinc-900">{overview.title}</h5>
                </div>
                {onOpenRecapModal && (
                  <button
                    onClick={() => onOpenRecapModal(overview, priorNight)}
                    className="p-1.5 text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 rounded-lg border border-amber-300 transition-all cursor-pointer flex items-center gap-1.5 text-[10px] font-mono font-semibold"
                    title="Read in Pop-up Window"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                    <span>Pop-up Window</span>
                  </button>
                )}
              </div>
              <p className="text-zinc-800 text-sm sm:text-base leading-relaxed font-sans font-normal">
                {overview.content}
              </p>
            </div>
          ) : (
            <div className="p-5 bg-zinc-900/10 border border-dashed border-zinc-900 rounded-2xl text-center">
              <p className="text-xs text-zinc-500 font-serif italic">Ash Macintosh is preparing the final memory recap of this session...</p>
            </div>
          )}

          {/* Memory image or upload prompt */}
          {overview && (
            <div className="space-y-2">
              {isAuthenticGatheringPhoto(overview.imageUrl) ? (
                <div className="space-y-2">
                  <div 
                    onClick={() => onOpenRecapModal && onOpenRecapModal(overview, priorNight)}
                    className={`relative rounded-2xl overflow-hidden border border-zinc-900 max-h-72 bg-zinc-950 ${onOpenRecapModal ? 'cursor-pointer group hover:border-amber-500/50 transition-all' : ''}`}
                  >
                    <img
                      src={overview.imageUrl}
                      alt="Movie Night Gathering Memory"
                      className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md text-zinc-300 border border-zinc-800 rounded px-2.5 py-1 text-[10px] font-mono flex items-center gap-1.5">
                      <Camera className="w-3 h-3 text-amber-500" />
                      Gathering Memory • Documented by Ash
                    </div>
                    {onOpenRecapModal && (
                      <div className="absolute top-3 right-3 bg-black/75 backdrop-blur-md text-amber-400 border border-amber-500/30 rounded px-2 py-0.5 text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shadow-lg">
                        <Maximize2 className="w-3 h-3" />
                        <span>Pop-up</span>
                      </div>
                    )}
                  </div>

                  {canManagePhotos && (
                    <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                      <span className="text-[11px] text-zinc-500 font-mono">
                        {feedback || "Original gathering photo attached"}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="text-xs font-mono text-amber-800 hover:text-amber-950 font-semibold px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3 text-amber-700" />}
                          <span>Change Photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(overview.id)}
                          disabled={uploading}
                          className="text-xs font-mono text-zinc-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-200 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#080808] border border-dashed border-zinc-800/80 rounded-2xl p-5 text-center space-y-2">
                  <div className="flex items-center justify-center gap-2 text-zinc-400 text-xs font-mono">
                    <Camera className="w-4 h-4 text-amber-500" />
                    <span>No friends gathering photo attached to this recap yet</span>
                  </div>
                  {canManagePhotos && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-mono font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        <span>+ Upload Gathering Photo</span>
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
    </motion.div>
  );
}

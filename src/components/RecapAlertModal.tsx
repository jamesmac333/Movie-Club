import React, { useEffect, useState, useRef } from "react";
import { MovieNight, NightOverview, Review, User, isAuthenticGatheringPhoto } from "../types.ts";
import { motion } from "motion/react";
import PaletteStrip from "./PaletteStrip.tsx";
import { BookOpen, Sparkles, X, Calendar, User as UserIcon, Film, Clock, Star, Camera, Quote, Award, Trophy, Upload, Loader2, Trash2 } from "lucide-react";

interface RecapAlertModalProps {
  overview: NightOverview;
  night: MovieNight;
  reviews?: Review[];
  currentUser?: User | null;
  onClose: (overviewId: string) => void;
  onUpdateOverviewImage?: (overviewId: string, imageUrl: string) => Promise<void>;
  onDeleteOverviewImage?: (overviewId: string) => Promise<void>;
}

export default function RecapAlertModal({
  overview,
  night,
  reviews = [],
  currentUser,
  onClose,
  onUpdateOverviewImage,
  onDeleteOverviewImage
}: RecapAlertModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [photoFeedback, setPhotoFeedback] = useState("");

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateOverviewImage) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.");
      return;
    }

    setUploading(true);
    setPhotoFeedback("Compressing & saving photo...");
    try {
      const dataUrl = await compressImage(file);
      await onUpdateOverviewImage(overview.id, dataUrl);
      setPhotoFeedback("Photo updated successfully!");
      setTimeout(() => setPhotoFeedback(""), 3000);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to upload photo");
      setPhotoFeedback("");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!confirm("Are you sure you want to remove this gathering photo?")) return;
    if (!onDeleteOverviewImage) return;

    setUploading(true);
    try {
      await onDeleteOverviewImage(overview.id);
      setPhotoFeedback("Photo removed.");
      setTimeout(() => setPhotoFeedback(""), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to remove photo");
    } finally {
      setUploading(false);
    }
  };
  const movie = night.movie;

  // Calculate average review rating if any reviews exist for this night
  const nightReviews = reviews.filter((r) => r.movieNightId === night.id);
  const avgRating =
    nightReviews.length > 0
      ? (nightReviews.reduce((sum, r) => sum + r.rating, 0) / nightReviews.length).toFixed(1)
      : null;

  // Find top review: prioritize starred review by Ash, or highest rated review
  const topReview = 
    nightReviews.find((r) => r.isStarred) ||
    (nightReviews.length > 0
      ? [...nightReviews].sort((a, b) => b.rating - a.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      : null);

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

  const hasPhoto = isAuthenticGatheringPhoto(overview.imageUrl);
  const hostFirstName = night.selector.split(" ")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 overscroll-contain">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 backdrop-blur-sm"
        onClick={() => onClose(overview.id)}
      />

      <motion.article
        role="dialog"
        aria-modal="true"
        aria-labelledby="recap-title"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="relative w-full sm:max-w-2xl max-h-[94dvh] overflow-y-auto overscroll-contain bg-zinc-900 border border-zinc-800 rounded-t-[28px] sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={() => onClose(overview.id)}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-11 h-11 rounded-full bg-black/70 text-zinc-100 flex items-center justify-center cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Widescreen gathering photo */}
        <div className="letterbox">
          {hasPhoto ? (
            <img src={overview.imageUrl} alt={`Gathering photo for ${movie?.title || "the night"}`} referrerPolicy="no-referrer" />
          ) : (
            <div className="letterbox-frame bg-slate flex flex-col items-center justify-center gap-2 text-zinc-200 text-sm px-6 text-center">
              <Camera className="w-6 h-6" />
              {canManagePhotos ? "Add the gathering photo" : "No gathering photo yet"}
            </div>
          )}
        </div>
        {canManagePhotos && (
          <div className="flex flex-wrap gap-2 px-5 pt-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="min-h-11 px-4 rounded-xl border border-zinc-700 text-sm text-zinc-100 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {hasPhoto ? "Replace photo" : "Add photo"}
            </button>
            {hasPhoto && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={uploading}
                className="min-h-11 px-4 rounded-xl text-sm text-zinc-400 hover:text-red-400 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Remove photo
              </button>
            )}
            {photoFeedback && <p className="w-full text-sm text-emerald-400">{photoFeedback}</p>}
          </div>
        )}
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

        {/* Poster and night details */}
        <div className="px-5 sm:px-8 pt-5 flex gap-4 items-end">
          {movie?.posterUrl && (
            <img src={movie.posterUrl} alt={`${movie.title} poster`} className="w-24 sm:w-28 aspect-[2/3] object-cover rounded-xl border border-zinc-700 shadow-[0_12px_28px_rgba(0,0,0,0.5)] shrink-0" referrerPolicy="no-referrer" />
          )}
          <div className="min-w-0 pb-1 space-y-1">
            <p className="slate text-amber-500">Recap from {(overview.author || "Ash Macintosh").split(" ")[0]}</p>
            <p className="text-sm text-zinc-400">{formatNZTDate(night.date)} · {movie?.title} · {hostFirstName}'s pick</p>
            {avgRating && <p className="text-sm font-semibold text-amber-500">★ {avgRating} · {nightReviews.length} review{nightReviews.length === 1 ? "" : "s"}</p>}
          </div>
        </div>
        {movie?.posterUrl && <div className="px-5 sm:px-8 pt-4"><PaletteStrip posterUrl={movie.posterUrl} className="h-2 rounded" /></div>}

        {/* The recap itself */}
        <div className="px-5 sm:px-8 pt-5">
          <h2 id="recap-title" className="font-serif text-3xl sm:text-4xl leading-tight text-zinc-50">{overview.title}</h2>
          <p className="mt-4 text-base sm:text-[17px] leading-relaxed text-zinc-200 whitespace-pre-wrap">{overview.content}</p>
        </div>

        {/* Ash's pick of the reviews */}
        {topReview && (
          <figure className="mx-5 sm:mx-8 mt-6 p-5 rounded-2xl bg-amber-950 border border-amber-800">
            <figcaption className="slate text-amber-500">{topReview.isStarred ? "Ash's pick of the reviews" : "Top review"}</figcaption>
            <blockquote className="mt-3 font-serif text-lg leading-relaxed text-zinc-100">“{topReview.comment}”</blockquote>
            <p className="mt-3 text-sm text-zinc-300">{topReview.user.split(" ")[0]} · ★ {topReview.rating}</p>
          </figure>
        )}

        <div className="px-5 sm:px-8 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => onClose(overview.id)}
            className="w-full min-h-14 rounded-2xl bg-red-700 hover:bg-red-600 text-ticket font-semibold text-lg cursor-pointer"
          >
            Done
          </button>
        </div>
      </motion.article>
    </div>
  );
}

import React, { useState } from "react";
import { motion } from "motion/react";
import { X, Loader2 } from "lucide-react";
import { MovieNight } from "../types.ts";

interface ReviewSheetProps {
  night: MovieNight;
  initialRating?: number;
  onSubmit: (rating: number, comment: string) => Promise<void>;
  onClose: () => void;
}

// Slide-up panel for writing a review: big tappable stars (with halves) and a comment box
export default function ReviewSheet({ night, initialRating = 0, onSubmit, onClose }: ReviewSheetProps) {
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const title = night.movie?.title || "this film";
  const hostFirstName = night.selector.split(" ")[0];
  const date = new Date(night.date).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
  const whole = Math.floor(rating);
  const hasHalf = rating % 1 !== 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return setError("Tap the stars to give it a rating.");
    if (!comment.trim()) return setError("Add a few words about it.");
    setSaving(true);
    setError("");
    try {
      await onSubmit(rating, comment.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || "Couldn't post your review. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <motion.div
        className="absolute inset-0 bg-black/80"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.form
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-sheet-title"
        onSubmit={submit}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="relative w-full md:max-w-lg bg-zinc-900 border-t md:border border-zinc-800 rounded-t-[28px] md:rounded-3xl px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-5 max-h-[92dvh] overflow-y-auto"
      >
        <span aria-hidden="true" className="self-center w-10 h-1.5 rounded-full bg-zinc-700 md:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-zinc-400">{date} · {hostFirstName}'s pick</p>
            <h2 id="review-sheet-title" className="font-serif text-2xl text-zinc-50 mt-1">Your review of {title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 shrink-0 rounded-full bg-zinc-800 text-zinc-100 flex items-center justify-center cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="slate text-zinc-400 mb-2">Your rating · {rating ? `${rating} out of 5` : "tap a star"}</legend>
          <div className="flex justify-between max-w-xs">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                aria-pressed={whole >= n}
                onClick={() => setRating(n)}
                className={`w-14 h-14 text-5xl leading-none cursor-pointer ${n <= whole ? "text-amber-500" : n === whole + 1 && hasHalf ? "text-amber-700" : "text-zinc-700"}`}
              >
                ★
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!rating}
            onClick={() => setRating(hasHalf ? whole : Math.min(5, whole + 0.5))}
            className="self-start min-h-11 px-4 rounded-xl border border-zinc-700 text-sm text-zinc-200 disabled:opacity-40 cursor-pointer"
          >
            {hasHalf ? "Remove the half star" : "Add a half star"}
          </button>
        </fieldset>

        <div className="flex flex-col gap-2">
          <label htmlFor="review-comment" className="slate text-zinc-400">What did you think?</label>
          <textarea
            id="review-comment"
            rows={6}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="The bit that got you, the bit that didn't…"
            className="rounded-2xl border border-zinc-700 bg-zinc-950 text-zinc-100 text-base leading-relaxed p-4 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="min-h-14 rounded-2xl bg-red-700 hover:bg-red-600 disabled:opacity-60 text-ticket font-semibold text-lg flex items-center justify-center gap-2 cursor-pointer"
        >
          {saving && <Loader2 className="w-5 h-5 animate-spin" />}
          {saving ? "Posting…" : "Post review"}
        </button>
      </motion.form>
    </div>
  );
}

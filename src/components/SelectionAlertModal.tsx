import React from "react";
import { MovieNight } from "../types.ts";
import { motion } from "motion/react";
import PaletteStrip from "./PaletteStrip.tsx";

interface SelectionAlertModalProps {
  night: MovieNight;
  onAcknowledge: (nightId: string, movieTitle: string) => void;
}

// Shown once when a host picks the next film: the poster as a ticket
export default function SelectionAlertModal({ night, onAcknowledge }: SelectionAlertModalProps) {
  if (!night.movie) return null;

  const movie = night.movie;
  const hostFirstName = night.selector.split(" ")[0];
  const when = new Date(night.date);
  const date = when.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
  const time = when.toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit", hour12: true });
  const meta = [movie.year, movie.rating, movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : null, movie.genre].filter(Boolean).join(" · ");
  const close = () => onAcknowledge(night.id, movie.title);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overscroll-contain">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={close}
      />
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pick-title"
        initial={{ scale: 0.92, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1, transition: { type: "spring", damping: 22, stiffness: 120 } }}
        exit={{ scale: 0.95, y: 20, opacity: 0 }}
        className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto bg-zinc-900 border border-amber-800 rounded-3xl [--ticket-notch:var(--color-black)]"
      >
        <div className="flex justify-between items-baseline px-5 pt-5">
          <p className="slate text-amber-500">Now showing</p>
          <p className="slate text-zinc-400">{hostFirstName}'s pick</p>
        </div>

        <div className="px-5 pt-4">
          {movie.posterUrl ? (
            <img src={movie.posterUrl} alt={`${movie.title} poster`} className="w-full max-w-[300px] mx-auto aspect-[2/3] object-cover rounded-2xl border border-zinc-700 shadow-[0_20px_45px_rgba(0,0,0,0.55)]" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full max-w-[300px] mx-auto aspect-[2/3] rounded-2xl bg-slate border border-zinc-700 flex items-end p-5">
              <span className="font-serif text-5xl leading-[0.95] text-ticket">{movie.title}</span>
            </div>
          )}
          <PaletteStrip posterUrl={movie.posterUrl} className="h-2 rounded max-w-[300px] mx-auto mt-3" />
        </div>

        <div className="px-6 pt-5 text-center">
          <h2 id="pick-title" className="font-serif text-3xl text-zinc-50">{hostFirstName} picked {movie.title}</h2>
          {meta && <p className="text-sm text-zinc-400 mt-1">{meta}</p>}
          {movie.director && <p className="slate text-zinc-300 mt-2">A film by {movie.director}</p>}
        </div>

        <div className="ticket-tear mt-5" aria-hidden="true"><span /></div>

        <div className="px-5 pb-5 pt-2 flex flex-col gap-3">
          <p className="slate text-amber-500 text-center">Admit one · {date} · {time}</p>
          <button
            type="button"
            onClick={close}
            className="min-h-14 rounded-2xl bg-red-700 hover:bg-red-600 text-ticket font-semibold text-lg cursor-pointer"
          >
            See you there
          </button>
        </div>
      </motion.section>
    </div>
  );
}

import React, { useState } from "react";
import { MovieNight } from "../types.ts";
import { motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import PaletteStrip from "./PaletteStrip.tsx";

interface SelectionAlertModalProps {
  night: MovieNight;
  onAcknowledge: (nightId: string, movieTitle: string) => void;
}

// Fired when the torn ticket lands, so the next-film card on Home can light up to catch it
export const TICKET_LANDED_EVENT = "movieclub:ticket-landed";

// Shown once when a host picks the next film: the poster as a ticket.
// "See you there" tears it along the perforation: the stub drops away and the
// ticket flies into the next-film card on Home.
export default function SelectionAlertModal({ night, onAcknowledge }: SelectionAlertModalProps) {
  const reduce = useReducedMotion();
  // Where the ticket flies to, set when "See you there" is tapped
  const [flight, setFlight] = useState<{ x: number; y: number } | null>(null);

  if (!night.movie) return null;

  const movie = night.movie;
  const hostFirstName = night.selector.split(" ")[0];
  const when = new Date(night.date);
  const date = when.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
  const time = when.toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit", hour12: true });
  const meta = [movie.year, movie.rating, movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : null, movie.genre].filter(Boolean).join(" · ");
  const close = () => onAcknowledge(night.id, movie.title);

  const tear = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (flight) return;
    if (reduce) return close();
    // Aim for the top of the next-film card, kept on screen
    const ticket = e.currentTarget.closest("section")!.getBoundingClientRect();
    const card = document.querySelector('[aria-label="Next movie night"]')?.getBoundingClientRect();
    const targetY = card ? Math.min(Math.max(card.top + 80, 60), window.innerHeight - 60) : 60;
    setFlight({
      x: card ? card.left + card.width / 2 - (ticket.left + ticket.width / 2) : 0,
      y: targetY - (ticket.top + ticket.height / 3)
    });
  };
  const landed = () => {
    window.dispatchEvent(new Event(TICKET_LANDED_EVENT));
    close();
  };

  const part = "bg-zinc-900 border-amber-800 [--ticket-notch:var(--color-black)]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overscroll-contain">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: flight ? 0 : 1, transition: { duration: flight ? 0.6 : 0.3, delay: flight ? 0.35 : 0 } }}
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
        className="relative w-full max-w-md max-h-[92dvh] flex flex-col"
      >
        {/* The ticket */}
        <motion.div
          animate={flight ? { x: flight.x, y: flight.y, scale: 0.3, rotate: -4, opacity: [1, 1, 0] } : undefined}
          transition={{ duration: 0.75, delay: 0.3, ease: [0.5, 0, 0.2, 1] }}
          onAnimationComplete={() => flight && landed()}
          className={`min-h-0 flex flex-col border border-b-0 rounded-t-3xl pb-4 ${part}`}
        >
          <div className="flex justify-between items-center pl-5 pr-2 pt-2 shrink-0">
            <p className="slate text-amber-500">Now showing · {hostFirstName}'s pick</p>
            <button type="button" onClick={close} aria-label="Close" className="w-11 h-11 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="min-h-0 overflow-y-auto overscroll-contain">
            <div className="px-5 pt-2">
              {movie.posterUrl ? (
                <img src={movie.posterUrl} alt={`${movie.title} poster`} className="h-[min(40dvh,450px)] w-auto mx-auto aspect-[2/3] object-cover rounded-2xl border border-zinc-700 shadow-[0_20px_45px_rgba(0,0,0,0.55)]" referrerPolicy="no-referrer" />
              ) : (
                <div className="h-[min(40dvh,450px)] w-auto mx-auto aspect-[2/3] rounded-2xl bg-slate border border-zinc-700 flex items-end p-5">
                  <span className="font-serif text-5xl leading-[0.95] text-ticket">{movie.title}</span>
                </div>
              )}
              <PaletteStrip posterUrl={movie.posterUrl} className="h-2 rounded w-[min(26.7dvh,300px)] mx-auto mt-3" />
            </div>

            <div className="px-6 pt-5 text-center">
              <h2 id="pick-title" className="font-serif text-3xl text-zinc-50">{hostFirstName} picked {movie.title}</h2>
              {meta && <p className="text-sm text-zinc-400 mt-1">{meta}</p>}
              {movie.director && <p className="slate text-zinc-300 mt-2">A film by {movie.director}</p>}
            </div>
          </div>
        </motion.div>

        {/* The stub: a little tug, then it drops away */}
        <motion.div
          animate={flight ? { y: [0, -6, 420], x: [0, 0, 40], rotate: [0, -3, 14], opacity: [1, 1, 0] } : undefined}
          transition={{ duration: 0.8, times: [0, 0.2, 1], ease: "easeIn" }}
          className={`shrink-0 border border-t-0 rounded-b-3xl origin-top-left ${part}`}
        >
          <div className="ticket-tear" aria-hidden="true"><span /></div>
          <div className="px-5 pb-5 pt-2 flex flex-col gap-3">
            <p className="slate text-amber-500 text-center">Admit one · {date} · {time}</p>
            <button
              type="button"
              onClick={tear}
              className="min-h-14 rounded-2xl bg-red-700 hover:bg-red-600 text-ticket font-semibold text-lg cursor-pointer"
            >
              See you there
            </button>
          </div>
        </motion.div>
      </motion.section>
    </div>
  );
}

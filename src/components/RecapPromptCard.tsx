import React from "react";
import { Camera, PenLine } from "lucide-react";
import { MovieNight, NightOverview } from "../types.ts";
import { recapDueNight } from "../clubStats.ts";

interface RecapPromptCardProps {
  nights: MovieNight[];
  overviews: NightOverview[];
  onWrite: (nightId: string) => void;
}

// Ash's nudge on Home: appears at 7 pm on a movie night and stays until that night's recap is posted
export default function RecapPromptCard({ nights, overviews, onWrite }: RecapPromptCardProps) {
  const night = recapDueNight(nights, overviews.map((o) => o.movieNightId));
  if (!night) return null;

  const movie = night.movie!;
  const tonight = new Date(night.date).toDateString() === new Date().toDateString();

  return (
    <section aria-labelledby="recap-prompt" className="bg-zinc-900 border border-amber-800 rounded-3xl p-5 flex flex-col gap-4">
      <div className="flex gap-4 items-center">
        {movie.posterUrl ? (
          <img src={movie.posterUrl} alt="" className="w-16 aspect-[2/3] rounded-lg object-cover border border-zinc-700 shrink-0" referrerPolicy="no-referrer" />
        ) : (
          <span className="w-16 aspect-[2/3] rounded-lg bg-slate border border-zinc-700 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="slate text-amber-500">Recap time</p>
          <h2 id="recap-prompt" className="font-serif text-3xl leading-tight text-zinc-50 break-words">
            {tonight ? "Tonight's recap" : `Recap for ${movie.title}`}
          </h2>
          {tonight && <p className="text-sm text-zinc-400">{movie.title}</p>}
        </div>
      </div>

      {tonight && (
        <p className="text-zinc-300 flex gap-2">
          <Camera className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
          <span>While everyone's still there, grab a group photo for it.</span>
        </p>
      )}
      <p className="text-sm text-zinc-400">Write it up whenever suits. This stays here until the recap is posted.</p>

      <button
        type="button"
        onClick={() => onWrite(night.id)}
        className="min-h-14 rounded-2xl bg-red-700 hover:bg-red-600 text-ticket font-semibold text-lg flex items-center justify-center gap-2 cursor-pointer"
      >
        <PenLine className="w-5 h-5" aria-hidden="true" />
        Write the recap
      </button>
    </section>
  );
}

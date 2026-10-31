import React from "react";
import { MovieNight, Review, User, DATA_LOSS_DATE } from "../types.ts";
import { gapFillProgress } from "../clubStats.ts";
import { Avatar } from "./OverlayPage.tsx";

interface GapTrackerProps {
  nights: MovieNight[];
  reviews: Review[];
  members: User[];
  onOpenMember: (name: string) => void;
}

// Admin tab: how far each member has got with Fill in the gaps. Disappears once everyone has finished.
export default function GapTracker({ nights, reviews, members, onOpenMember }: GapTrackerProps) {
  const rows = members.map((member) => ({ member, progress: gapFillProgress(nights, reviews, member.name, DATA_LOSS_DATE) }));
  const total = rows[0]?.progress.total || 0;
  const finished = rows.filter((r) => r.progress.complete).length;
  if (!total || finished === rows.length) return null;

  // Furthest behind first, so it's clear who to nudge
  const sorted = [...rows].sort((a, b) => a.progress.done - b.progress.done || a.member.name.localeCompare(b.member.name));

  return (
    <section aria-labelledby="gap-tracker" className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="gap-tracker" className="font-serif text-3xl text-zinc-50">Gaps tracker</h2>
          <span className="text-sm text-zinc-400 shrink-0">{finished} of {rows.length} finished</span>
        </div>
        <p className="text-sm text-zinc-400">Each member's progress rating and reviewing the {total} lost nights. This goes away once everyone's done.</p>
      </div>

      <ul className="flex flex-col gap-3">
        {sorted.map(({ member, progress }) => {
          const percent = Math.round((progress.done / progress.total) * 100);
          const first = member.name.split(" ")[0];
          return (
            <li key={member.username}>
              <button type="button" onClick={() => onOpenMember(member.name)} className="w-full min-h-14 flex items-start gap-3 text-left cursor-pointer group">
                <Avatar user={member} name={member.name} className="w-10 h-10" badgeSize="sm" />
                <span className="min-w-0 flex-1 flex flex-col gap-1.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-zinc-100 group-hover:text-amber-500">{first}</span>
                    <span className={`text-sm shrink-0 ${progress.complete ? "text-emerald-400" : "text-zinc-400"}`}>
                      {progress.complete ? "Finished" : `${progress.done} of ${progress.total} · ${percent}%`}
                    </span>
                  </span>
                  <span
                    role="progressbar"
                    aria-label={`${first}'s progress`}
                    aria-valuemin={0}
                    aria-valuemax={progress.total}
                    aria-valuenow={progress.done}
                    className="h-2 rounded-full bg-zinc-800 overflow-hidden"
                  >
                    <span className={`block h-full rounded-full ${progress.complete ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${percent}%` }} />
                  </span>
                  {!progress.complete && (
                    <span className="text-xs text-zinc-500 break-words">
                      {progress.done === 0 ? "Not started yet" : `Still to do: ${progress.remaining.map((n) => n.movie!.title).join(", ")}`}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

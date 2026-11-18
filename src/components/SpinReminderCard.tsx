import React from "react";
import { Disc3 } from "lucide-react";
import { MovieNight, PublicRotationTheme } from "../types.ts";
import { rotationNumber, spinDue } from "../rotationThemes.ts";

// Admins' nudge on Home: from the morning of a rotation's last night until the next rotation's theme is locked in
export default function SpinReminderCard({ nights, rotationThemes, onOpenWheel }: { nights: MovieNight[]; rotationThemes: PublicRotationTheme[]; onOpenWheel: () => void }) {
  const due = spinDue(nights, rotationThemes);
  if (!due) return null;
  const host = due.finalNight.selector.split(" ")[0];
  const tonight = new Date(due.finalNight.date).toDateString() === new Date().toDateString();
  const next = rotationNumber(nights, due.nextStart.id, rotationThemes);
  // Tonight's rotation has no theme yet: spin before tonight's host picks
  const forTonight = due.finalNight.id === due.nextStart.id;
  if (forTonight) {
    return (
      <section aria-labelledby="spin-reminder" className="bg-zinc-900 border border-amber-500/60 rounded-3xl p-5 flex flex-col gap-4 shadow-[0_0_40px_rgba(227,190,138,0.08)]">
        <div className="flex gap-4 items-center">
          <Disc3 className="w-10 h-10 text-amber-500 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="slate text-amber-500">Theme needed tonight</p>
            <h2 id="spin-reminder" className="font-serif text-3xl leading-tight text-zinc-50">Spin the wheel before {host} picks</h2>
          </div>
        </div>
        <p className="text-zinc-300">This rotation doesn't have a theme yet. Put the wheel up on the TV, spin, and the theme runs from {host}'s night to the end of the rotation.</p>
        <button type="button" onClick={onOpenWheel} className="min-h-14 rounded-2xl bg-red-700 hover:bg-red-600 text-ticket font-semibold text-lg flex items-center justify-center gap-2 cursor-pointer">
          <Disc3 className="w-5 h-5" aria-hidden="true" />
          Open the wheel
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="spin-reminder" className="bg-zinc-900 border border-amber-500/60 rounded-3xl p-5 flex flex-col gap-4 shadow-[0_0_40px_rgba(227,190,138,0.08)]">
      <div className="flex gap-4 items-center">
        <Disc3 className="w-10 h-10 text-amber-500 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="slate text-amber-500">{tonight ? "Last night of the rotation" : "Theme needed"}</p>
          <h2 id="spin-reminder" className="font-serif text-3xl leading-tight text-zinc-50">Spin the wheel for Rotation {next}</h2>
        </div>
      </div>
      <p className="text-zinc-300">
        {tonight
          ? `${host}'s film tonight finishes this rotation. After it, put the wheel up on the TV and spin for the next theme.`
          : `Rotation ${next} doesn't have a theme yet, and ${due.nextStart.selector.split(" ")[0]} needs one to pick.`}
      </p>
      <button type="button" onClick={onOpenWheel} className="min-h-14 rounded-2xl bg-red-700 hover:bg-red-600 text-ticket font-semibold text-lg flex items-center justify-center gap-2 cursor-pointer">
        <Disc3 className="w-5 h-5" aria-hidden="true" />
        Open the wheel
      </button>
    </section>
  );
}

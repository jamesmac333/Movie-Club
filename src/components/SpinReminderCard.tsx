import React from "react";
import { Disc3 } from "lucide-react";
import { MovieNight, PublicRotationTheme } from "../types.ts";
import { rotationNumber, spinDue, themeForNight } from "../rotationThemes.ts";

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

// Pops up for James straight after he posts his review of a rotation's last night, so the spin isn't forgotten
export function SpinPromptSheet({ finalNight, nextStart, nights, rotationThemes, onOpenWheel, onClose }: { finalNight: MovieNight; nextStart: MovieNight; nights: MovieNight[]; rotationThemes: PublicRotationTheme[]; onOpenWheel: () => void; onClose: () => void }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const next = rotationNumber(nights, nextStart.id, rotationThemes);
  const ending = themeForNight(nights, finalNight.id, rotationThemes);
  const host = nextStart.selector.split(" ")[0];
  const when = new Date(nextStart.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="spin-prompt-title">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full md:max-w-lg bg-zinc-900 border-t md:border border-amber-500/60 rounded-t-[28px] md:rounded-3xl px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-4 shadow-[0_0_40px_rgba(227,190,138,0.08)]">
        <div className="flex gap-4 items-center">
          <Disc3 className="w-10 h-10 text-amber-500 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="slate text-amber-500">Review posted · {ending ? `Rotation ${ending.number} is done` : "That was the last night of the rotation"}</p>
            <h2 id="spin-prompt-title" className="font-serif text-3xl leading-tight text-zinc-50">Time to spin the wheel</h2>
          </div>
        </div>
        <p className="text-zinc-300">Put the wheel up on the TV and spin for Rotation {next}. It starts with {host}'s night on {when}.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button type="button" onClick={onOpenWheel} className="flex-1 min-h-14 rounded-2xl bg-red-700 hover:bg-red-600 text-ticket font-semibold text-lg flex items-center justify-center gap-2 cursor-pointer">
            <Disc3 className="w-5 h-5" aria-hidden="true" />
            Open the wheel
          </button>
          <button type="button" onClick={onClose} className="min-h-14 px-6 rounded-2xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 font-semibold cursor-pointer">
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

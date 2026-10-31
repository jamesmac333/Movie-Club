import React from "react";
import { Settings } from "lucide-react";
import { MovieNight, Review, User } from "../types.ts";
import { memberSummary, MemberFilm } from "../clubStats.ts";
import { Avatar, OverlayPage, Stars } from "./OverlayPage.tsx";
import GapBadge from "./GapBadge.tsx";

interface MemberPageProps {
  member: User;
  nights: MovieNight[];
  reviews: Review[];
  isSelf: boolean;
  canGoBack: boolean;
  onClose: () => void;
  onOpenFilm: (nightId: string) => void;
  onOpenSettings: () => void;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// One member's club history: what they've hosted, how they rate, and how that compares with everyone else
export default function MemberPage({ member, nights, reviews, isSelf, canGoBack, onClose, onOpenFilm, onOpenSettings }: MemberPageProps) {
  const first = member.name.split(" ")[0];
  const s = memberSummary(nights, reviews, member.name);
  const nextHosting = nights
    .filter((n) => n.status === "scheduled" && n.selector === member.name && new Date(n.date).getTime() > Date.now())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  const bestPick = [...s.hosted].filter((h) => h.average !== null).sort((a, b) => b.average! - a.average!)[0];
  const shortDate = (d: string) => new Date(d).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });

  const versus =
    s.versusClub === null
      ? "—"
      : Math.abs(s.versusClub) < 0.25
        ? "In line"
        : `${s.versusClub > 0 ? "+" : "−"}${Math.abs(s.versusClub).toFixed(1)}★`;
  const versusNote =
    s.versusClub === null
      ? "Needs films others have rated too"
      : Math.abs(s.versusClub) < 0.25
        ? "Rates about the same as everyone else"
        : s.versusClub > 0
          ? "Kinder than the rest of the club"
          : "Tougher than the rest of the club";

  const tiles = [
    { value: String(s.rated.length), label: "Films rated" },
    { value: s.averageGiven === null ? "—" : `★ ${s.averageGiven.toFixed(1)}`, label: "Average rating" },
    { value: String(s.hosted.length), label: `Film${s.hosted.length === 1 ? "" : "s"} hosted` },
    { value: versus, label: "Versus the club", note: versusNote },
  ];

  const FilmCard = ({ film, label }: { film: MemberFilm<MovieNight>; label: string }) => (
    <button type="button" onClick={() => onOpenFilm(film.night.id)} className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl p-3 flex gap-3 text-left min-w-0 cursor-pointer">
      {film.night.movie!.posterUrl ? (
        <img src={film.night.movie!.posterUrl} alt="" className="w-14 aspect-[2/3] rounded-lg object-cover shrink-0" referrerPolicy="no-referrer" />
      ) : (
        <span className="w-14 aspect-[2/3] rounded-lg bg-slate shrink-0" />
      )}
      <span className="min-w-0 flex flex-col gap-1">
        <span className="slate text-zinc-400">{label}</span>
        <span className="font-semibold text-zinc-100 break-words">{film.night.movie!.title}</span>
        <span className="text-sm text-amber-500">★ {fmt(film.rating)}</span>
      </span>
    </button>
  );

  return (
    <OverlayPage label={`${first}'s page`} canGoBack={canGoBack} onClose={onClose}>
      <header className="flex items-center gap-4 mt-2">
        <Avatar user={member} name={member.name} className="w-20 h-20 border-2 border-amber-500/50" badgeSize="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-4xl text-zinc-50 leading-tight">{isSelf ? "Your page" : member.name}</h1>
          {nextHosting && (
            <p className="text-sm text-zinc-400 mt-1">
              {isSelf ? "You host" : "Hosts"} next on {new Date(nextHosting.date).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" })}
              {nextHosting.movie ? ` · ${nextHosting.movie.title}` : ""}
            </p>
          )}
        </div>
      </header>
      {member.hasGapBadge && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-950 border border-amber-800 px-3 py-1.5 text-sm text-amber-500">
          <GapBadge size="sm" />
          Filled in every night lost in the data loss
        </p>
      )}
      {isSelf && (
        <button type="button" onClick={onOpenSettings} className="mt-4 flex min-h-11 px-4 rounded-xl border border-zinc-700 text-zinc-200 hover:text-amber-500 inline-flex items-center gap-2 cursor-pointer">
          <Settings className="w-4 h-4" />
          Profile and settings
        </button>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-1 min-w-0">
            <p className="font-serif text-3xl text-zinc-50 leading-tight">{t.value}</p>
            <p className="slate text-zinc-400">{t.label}</p>
            {t.note && <p className="text-xs text-zinc-500">{t.note}</p>}
          </div>
        ))}
      </div>

      {(s.highest || s.lowest) && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {s.highest && <FilmCard film={s.highest} label="Rated highest" />}
          {s.lowest && s.lowest.rating < s.highest!.rating && <FilmCard film={s.lowest} label="Rated lowest" />}
        </div>
      )}

      {s.hosted.length > 0 && (
        <section aria-labelledby="member-hosted" className="mt-10">
          <h2 id="member-hosted" className="font-serif text-3xl text-zinc-50">{isSelf ? "Your picks" : `${first}'s picks`}</h2>
          <ul className="mt-4 flex flex-col divide-y divide-zinc-800 border-y border-zinc-800">
            {[...s.hosted].reverse().map((h) => (
              <li key={h.night.id}>
                <button type="button" onClick={() => onOpenFilm(h.night.id)} className="w-full min-h-14 py-3 flex items-center gap-3 text-left cursor-pointer group">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-zinc-100 group-hover:text-amber-500 break-words">{h.night.movie!.title}</span>
                    <span className="block text-sm text-zinc-400">
                      {shortDate(h.night.date)}
                      {bestPick && bestPick.night.id === h.night.id && s.hosted.length > 1 ? " · the club's favourite" : ""}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-amber-500 font-semibold">{h.average === null ? "—" : `★ ${h.average.toFixed(1)}`}</span>
                    <span className="block text-xs text-zinc-500">{h.count ? `${h.count} rating${h.count === 1 ? "" : "s"}` : "no ratings"}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="member-ratings" className="mt-10">
        <h2 id="member-ratings" className="font-serif text-3xl text-zinc-50">{isSelf ? "Your ratings" : `${first}'s ratings`}</h2>
        {s.rated.length === 0 ? (
          <p className="mt-3 text-zinc-400">No ratings yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-zinc-800 border-y border-zinc-800">
            {[...s.rated].reverse().map((f) => (
              <li key={f.night.id}>
                <button type="button" onClick={() => onOpenFilm(f.night.id)} className="w-full min-h-14 py-3 flex items-center gap-3 text-left cursor-pointer group">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-zinc-100 group-hover:text-amber-500 break-words">{f.night.movie!.title}</span>
                    <span className="block text-sm text-zinc-400">
                      {f.othersAverage === null ? "Nobody else has rated it" : `Everyone else: ★ ${f.othersAverage.toFixed(1)}`}
                    </span>
                  </span>
                  <Stars rating={f.rating} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

    </OverlayPage>
  );
}

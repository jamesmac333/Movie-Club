// Rescheduling rules. Moving one night never shifts the rest of the schedule, except:
// - a night can't go on a day that already has one, and
// - if it lands less than a week before the next night, that night is pushed back a week
//   (and so on down the schedule, but only while nights are still under a week apart).
// Back-to-back Fridays (exactly a week apart) are fine.
import type { MovieNight } from "../src/types.ts";
import { nzDayKey, nzDaysLater, nzWallTime } from "./nzTime.ts";

const DAY = 24 * 60 * 60 * 1000;

// Whole NZ calendar days from a to b
export function nzDaysBetween(a: string, b: string): number {
  const [ay, am, ad] = nzDayKey(a).split("-").map(Number);
  const [by, bm, bd] = nzDayKey(b).split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY);
}

export interface Push {
  id: string;
  selector: string;
  from: string;
  to: string;
}

// clash: the night already on that day. pushes: the nights that would be pushed back a week.
export type ReschedulePlan = { clash: MovieNight | null; pushes: Push[] };

// What moving this night to newDate would do, without changing anything
export function planReschedule(nights: MovieNight[], id: string, newDate: string): ReschedulePlan {
  const active = nights.filter((n) => n.id !== id && n.status !== "skipped");
  const day = nzDayKey(newDate);
  const clash = active.find((n) => nzDayKey(n.date) === day);
  if (clash) return { clash, pushes: [] };

  // Upcoming nights after the new date, in order
  const later = active
    .filter((n) => n.status === "scheduled" && new Date(n.date).getTime() > new Date(newDate).getTime())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const pushes: Push[] = [];
  let previous = newDate;
  for (const night of later) {
    if (nzDaysBetween(previous, night.date) >= 7) break;
    const to = nzDaysLater(night.date, 7);
    pushes.push({ id: night.id, selector: night.selector, from: night.date, to });
    previous = to;
  }
  return { clash: null, pushes };
}

// Moves the night, and pushes the ones in the plan. Pushed nights move their planned Friday too,
// so nights added later carry on a fortnight after them.
export function applyReschedule(nights: MovieNight[], id: string, newDate: string, pushes: Push[]) {
  const night = nights.find((n) => n.id === id);
  if (!night) return null;
  if (!night.plannedDate) night.plannedDate = night.date;
  night.date = newDate;
  for (const p of pushes) {
    const n = nights.find((x) => x.id === p.id);
    if (!n) continue;
    n.plannedDate = nzDaysLater(n.plannedDate || n.date, 7);
    n.date = p.to;
  }
  return night;
}

// When the next new night should be: a fortnight after the last night's planned Friday, so moving
// that night by a day or two doesn't drag every later night with it. Never less than a week after
// the last night's actual date.
export function nextNightDate(last: MovieNight): string {
  let next = nzDaysLater(last.plannedDate || last.date, 14);
  while (nzDaysBetween(last.date, next) < 7) next = nzDaysLater(next, 7);
  return next;
}

// The Friday nearest this date, at 7 pm NZ (Saturday → the day before, Monday → the Friday before)
export function nearestFriday(date: string): string {
  const [y, m, d] = nzDayKey(date).split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Sunday … 5 Friday
  let shift = 5 - weekday;
  if (shift > 3) shift -= 7;
  return nzWallTime(y, m, d + shift);
}

// Put the schedule back on a fortnightly rhythm: the next night stays where it is, and every
// upcoming night after it is two weeks after the one before, on a Friday at 7 pm. Hosts don't change.
export function planRealignDates(nights: MovieNight[]): Push[] {
  const upcoming = nights
    .filter((n) => n.status === "scheduled")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (upcoming.length < 2) return [];
  let friday = nearestFriday(upcoming[0].date);
  const changes: Push[] = [];
  for (const night of upcoming.slice(1)) {
    friday = nzDaysLater(friday, 14);
    if (night.date !== friday) changes.push({ id: night.id, selector: night.selector, from: night.date, to: friday });
  }
  return changes;
}

export function applyRealignDates(nights: MovieNight[], changes: Push[]) {
  const upcoming = nights.filter((n) => n.status === "scheduled").sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (upcoming[0]) upcoming[0].plannedDate = nearestFriday(upcoming[0].date);
  for (const c of changes) {
    const n = nights.find((x) => x.id === c.id);
    if (!n) continue;
    n.date = c.to;
    n.plannedDate = c.to;
  }
  // Nights that were already on their Friday get it as their planned date too
  for (const n of upcoming.slice(1)) n.plannedDate = n.date;
}

// Club nights happen in New Zealand, but the server runs on UTC. These helpers work in NZ time,
// so a 7 pm night stays 7 pm in Auckland, across daylight saving, wherever the server runs.

const ZONE = "Pacific/Auckland";

const parts = new Intl.DateTimeFormat("en-NZ", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

// The NZ calendar date and time of an instant
export function nzParts(date: Date) {
  const p: Record<string, number> = {};
  for (const { type, value } of parts.formatToParts(date)) if (type !== "literal") p[type] = Number(value);
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second };
}

// How far NZ is ahead of UTC at this instant, in milliseconds
function nzOffset(ms: number): number {
  const p = nzParts(new Date(ms));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

// The instant that is this wall-clock time in NZ, as an ISO string. Day may overflow (e.g. 31 + 14).
export function nzWallTime(year: number, month: number, day: number, hour = 19, minute = 0): string {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  let ms = asUtc - nzOffset(asUtc);
  // Check again in case daylight saving changes between the guess and the answer
  ms = asUtc - nzOffset(ms);
  return new Date(ms).toISOString();
}

// "2026-11-20": the NZ calendar day of a night, for spotting two nights on the same day
export function nzDayKey(date: string | Date): string {
  const p = nzParts(new Date(date));
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

// The same time of day in NZ, a number of days later
export function nzDaysLater(date: string, days: number): string {
  const p = nzParts(new Date(date));
  return nzWallTime(p.year, p.month, p.day + days, p.hour, p.minute);
}

// Older nights were saved as "2026-09-11T19:00:00" with no timezone. Browsers read that as NZ time
// but the server reads it as UTC (8 am the next day in NZ). Returns the NZ instant it was meant as.
export function fixZonelessDate(date: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(date);
  if (!m) return null;
  return nzWallTime(+m[1], +m[2], +m[3], +m[4], +m[5]);
}

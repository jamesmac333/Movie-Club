// Rotation themes: each rotation (one pass through all six hosts, starting with Max) can have a theme
// that every pick in it must fit. Kept free of the app's other imports so the server and tests can load it.
//
// When a theme is locked in, the rotation is saved with a fixed number and how many nights it covers,
// so moving hosts around afterwards doesn't change which nights have the theme or what it's called.

interface NightLike {
  id: string;
  date: string;
  selector: string;
  status: string;
}

export interface RotationThemeLike {
  startNightId: string;
  name: string;
  description: string;
  // Saved when the theme is locked in; worked out from the hosts for older records
  number?: number;
  length?: number;
}

// The hosting order. Every full rotation starts with the first host's night.
export const HOST_ORDER = ["Max Smith", "Ash Macintosh", "Madison Hill", "Amy Walsh", "Tom Sakai", "James Macintosh"];
export const FIRST_HOST = HOST_ORDER[0];

const byDate = <T extends { date: string }>(a: T, b: T) => new Date(a.date).getTime() - new Date(b.date).getTime();
const firstName = (s: string) => s.trim().toLowerCase().split(" ")[0];
export const isFirstHost = (n: NightLike) => firstName(n.selector) === firstName(FIRST_HOST);

// How many nights a rotation starting with this host covers: 6 from Max, 5 from Ash (the rest of the rotation), and so on
export function rotationLengthFrom(selector: string): number {
  const index = HOST_ORDER.findIndex((h) => firstName(h) === firstName(selector));
  return HOST_ORDER.length - Math.max(0, index);
}

// Skipped nights stay in a rotation's list but don't use up one of its turns
const takesATurn = (n: NightLike) => n.status !== "skipped";

// The nights in the rotation that starts at this night
export function rotationNights<N extends NightLike>(nights: N[], startNightId: string, themes: RotationThemeLike[] = []): N[] {
  const sorted = [...nights].sort(byDate);
  const index = sorted.findIndex((n) => n.id === startNightId);
  if (index === -1) return [];
  const start = sorted[index];
  const length = themes.find((t) => t.startNightId === startNightId)?.length ?? rotationLengthFrom(start.selector);
  const otherStarts = new Set(themes.map((t) => t.startNightId).filter((id) => id !== startNightId));
  const out = [start];
  let turns = takesATurn(start) ? 1 : 0;
  for (let i = index + 1; i < sorted.length && turns < length; i++) {
    if (otherStarts.has(sorted[i].id)) break;
    out.push(sorted[i]);
    if (takesATurn(sorted[i])) turns++;
  }
  return out;
}

// The theme a night's pick has to fit, if its rotation has one
export function themeForNight<N extends NightLike, T extends RotationThemeLike>(nights: N[], nightId: string, themes: T[]): T | null {
  return themes.find((t) => rotationNights(nights, t.startNightId, themes).some((n) => n.id === nightId)) || null;
}

// The whole schedule split into rotations, in date order. A themed rotation covers the nights saved with
// its theme; a rotation without one runs from a Max night (or the first night) up to the next rotation.
export function groupIntoRotations<N extends NightLike, T extends RotationThemeLike>(nights: N[], themes: T[]): Array<{ start: N; theme: T | null; nights: N[] }> {
  const sorted = [...nights].sort(byDate);
  const themeStarts = new Set(themes.map((t) => t.startNightId));
  const groups: Array<{ start: N; theme: T | null; nights: N[] }> = [];
  let i = 0;
  while (i < sorted.length) {
    const start = sorted[i];
    const theme = themes.find((t) => t.startNightId === start.id) || null;
    let members: N[];
    if (theme) {
      members = rotationNights(sorted, start.id, themes);
    } else {
      members = [start];
      for (let j = i + 1; j < sorted.length && !isFirstHost(sorted[j]) && !themeStarts.has(sorted[j].id); j++) members.push(sorted[j]);
    }
    groups.push({ start, theme, nights: members });
    i += members.length;
  }
  return groups;
}

// Themes in the order their rotations happen
function inOrder<T extends RotationThemeLike>(nights: NightLike[], themes: T[]): T[] {
  const date = (t: T) => new Date(nights.find((n) => n.id === t.startNightId)?.date || 0).getTime();
  return [...themes].sort((a, b) => date(a) - date(b));
}

// Rotation 1 is the first one with a theme. A rotation's number is saved when its theme is locked in.
export function rotationNumber(nights: NightLike[], startNightId: string, themes: RotationThemeLike[] = []): number {
  const ordered = inOrder(nights, themes);
  const index = ordered.findIndex((t) => t.startNightId === startNightId);
  if (index !== -1) return ordered[index].number ?? index + 1;
  return nextRotationNumber(themes);
}

// The number the next theme to be locked in will get
export function nextRotationNumber(themes: RotationThemeLike[]): number {
  return themes.reduce((max, t, i) => Math.max(max, t.number ?? i + 1), 0) + 1;
}

// The next full rotation still waiting for its theme: the first Max night still to come that no theme covers
export function nextUnthemedStart<N extends NightLike>(nights: N[], themes: RotationThemeLike[]): N | null {
  return [...nights].sort(byDate).find((n) => n.status === "scheduled" && isFirstHost(n) && !themeForNight(nights, n.id, themes)) || null;
}

// A night still to come, or on today, counted as upcoming until the end of its day
function stillToCome(n: NightLike, now: Date) {
  const end = new Date(n.date);
  end.setHours(23, 59, 59, 999);
  return n.status === "scheduled" && end.getTime() >= now.getTime();
}

// Where the wheel can start a theme from: the next night, if no theme covers it yet (so the rest of
// its rotation gets one), and the next Max night without a theme. Earliest first.
export function spinStartOptions<N extends NightLike>(nights: N[], themes: RotationThemeLike[], now = new Date()): N[] {
  const sorted = [...nights].sort(byDate);
  const options: N[] = [];
  const next = sorted.find((n) => stillToCome(n, now));
  if (next && !themeForNight(nights, next.id, themes)) options.push(next);
  const nextMax = nextUnthemedStart(nights, themes);
  if (nextMax && !options.includes(nextMax)) options.push(nextMax);
  return options;
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

// Admins are reminded to spin from the morning of a rotation's last night until the next rotation has
// its theme, and on the day of any night that should have a theme but doesn't
export function spinDue<N extends NightLike>(nights: N[], themes: RotationThemeLike[], now = new Date()): { finalNight: N; nextStart: N } | null {
  const sorted = [...nights].sort(byDate);
  const today = sorted.find((n) => stillToCome(n, now));
  if (today && sameDay(new Date(today.date), now) && !isFirstHost(today) && !themeForNight(nights, today.id, themes)) {
    return { finalNight: today, nextStart: today };
  }
  const nextStart = nextUnthemedStart(nights, themes);
  if (!nextStart) return null;
  const finalNight = sorted[sorted.findIndex((n) => n.id === nextStart.id) - 1];
  if (!finalNight) return null;
  const morning = new Date(finalNight.date);
  morning.setHours(0, 0, 0, 0);
  return now.getTime() >= morning.getTime() ? { finalNight, nextStart } : null;
}

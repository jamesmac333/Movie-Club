import type { MovieNight } from "../src/types.ts";

// Builds the club's subscribable calendar (iCalendar format). Members subscribe once, and
// their calendar app re-fetches it, so moved dates and new picks show up on their own.

const NIGHT_LENGTH_MS = 3 * 60 * 60 * 1000;
const KEEP_PAST_MS = 60 * 24 * 60 * 60 * 1000;

function icsDate(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Lines longer than 75 bytes continue on the next line after a space
function fold(line: string): string {
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    if (Buffer.byteLength(current + ch) > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
    }
    current += ch;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function buildClubCalendar(nights: MovieNight[], siteUrl: string, now = Date.now()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Movie Club//Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Movie Club",
    "X-WR-TIMEZONE:Pacific/Auckland",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  const stamp = icsDate(now);
  for (const night of nights) {
    const start = new Date(night.date).getTime();
    if (night.status === "skipped" || Number.isNaN(start) || start < now - KEEP_PAST_MS) continue;

    const host = night.selector.split(" ")[0];
    const movie = night.movie;
    const summary = movie ? `Movie Club: ${movie.title}` : `Movie Club · ${host} hosts`;
    const details = movie
      ? [`${host}'s pick`, [movie.year, movie.runtime && `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m`, movie.director && `dir. ${movie.director}`].filter(Boolean).join(" · ")]
      : [`${host} is picking the film`];

    lines.push(
      "BEGIN:VEVENT",
      `UID:${night.id}@movieclub.co.nz`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(start + NIGHT_LENGTH_MS)}`,
      `SUMMARY:${icsText(summary)}`,
      `DESCRIPTION:${icsText([...details.filter(Boolean), siteUrl].join("\n"))}`,
      `URL:${siteUrl}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

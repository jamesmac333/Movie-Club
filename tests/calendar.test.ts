import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClubCalendar } from "../server/calendar.ts";

const now = Date.parse("2026-11-01T00:00:00Z");
const nights = [
  { id: "n1", date: "2026-11-06T06:00:00.000Z", selector: "Ash Macintosh", status: "scheduled", movie: { title: "Wildwood, Part; One", year: 2026, runtime: 131, director: "Travis Knight" } },
  { id: "n2", date: "2026-11-20T06:00:00.000Z", selector: "Madison Hill", status: "scheduled", movie: null },
  { id: "n3", date: "2026-11-27T06:00:00.000Z", selector: "Tom Sakai", status: "skipped", movie: null },
  { id: "n4", date: "2026-06-01T06:00:00.000Z", selector: "Max Smith", status: "watched", movie: null },
] as any;

test("lists upcoming nights with their film or host, and leaves out skipped and long-past nights", () => {
  const ics = buildClubCalendar(nights, "https://www.movieclub.co.nz", now);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 2);
  assert.match(ics, /UID:n1@movieclub\.co\.nz/);
  assert.match(ics, /DTSTART:20261106T060000Z\r\nDTEND:20261106T090000Z/);
  assert.match(ics, /SUMMARY:Movie Club: Wildwood\\, Part\\; One/);
  assert.match(ics, /2h 11m/);
  assert.match(ics, /SUMMARY:Movie Club · Madison hosts/);
  assert.doesNotMatch(ics, /n3@|n4@/);
});

test("long lines are folded for calendar apps", () => {
  const long = [{ ...nights[0], movie: { ...nights[0].movie, title: "A".repeat(200) } }];
  const ics = buildClubCalendar(long, "https://www.movieclub.co.nz", now);
  for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75, line);
});

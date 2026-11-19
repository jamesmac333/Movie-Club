// Nights are 7 pm in New Zealand, every second Friday, one per day, whatever timezone the server runs in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { nzWallTime, nzDaysLater, nzDayKey, fixZonelessDate, nzParts } from "../server/nzTime.ts";
import { ensureFutureNights } from "../server/db.ts";

const nzLocal = (iso: string) => {
  const p = nzParts(new Date(iso));
  return `${nzDayKey(iso)} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

test("7 pm in NZ is stored as the right instant in summer and winter", () => {
  assert.equal(nzWallTime(2026, 11, 20), "2026-11-20T06:00:00.000Z"); // NZDT, UTC+13
  assert.equal(nzWallTime(2027, 6, 4), "2027-06-04T07:00:00.000Z"); // NZST, UTC+12
});

test("two weeks later stays 7 pm in NZ across a daylight saving change", () => {
  // NZ daylight saving ends on Sunday 4 April 2027
  assert.equal(nzLocal(nzDaysLater("2027-03-26T06:00:00.000Z", 14)), "2027-04-09 19:00");
  // ...and starts on Sunday 26 September 2027
  assert.equal(nzLocal(nzDaysLater("2027-09-17T07:00:00.000Z", 14)), "2027-10-01 19:00");
  // Across the end of a month and a year
  assert.equal(nzLocal(nzDaysLater("2026-12-25T06:00:00.000Z", 14)), "2027-01-08 19:00");
});

test("older dates saved without a timezone are read as NZ time", () => {
  assert.equal(fixZonelessDate("2026-10-09T19:00:00"), "2026-10-09T06:00:00.000Z");
  assert.equal(fixZonelessDate("2026-11-20T06:00:00.000Z"), null, "dates with a timezone are left alone");
});

test("the day key uses the NZ calendar day", () => {
  // 6 am UTC on 20 Nov is 7 pm on 20 Nov in NZ; 11 am UTC on 20 Nov is already 21 Nov in NZ
  assert.equal(nzDayKey("2026-11-20T06:00:00.000Z"), "2026-11-20");
  assert.equal(nzDayKey("2026-11-20T11:30:00.000Z"), "2026-11-21");
});

test("new nights are added a fortnight apart at 7 pm NZ, carrying on the host order", () => {
  const db: any = {
    nights: [
      { id: "night-12", date: "2027-01-15T06:00:00.000Z", selector: "James Macintosh", movie: null, status: "scheduled" },
      { id: "night-13", date: "2027-01-29T06:00:00.000Z", selector: "Max Smith", movie: null, status: "scheduled" }
    ],
    reviews: [],
    overviews: []
  };
  ensureFutureNights(db);
  const added = db.nights.slice(2);
  assert.deepEqual(added.map((n: any) => n.selector.split(" ")[0]), ["Ash", "Madison", "Amy", "Tom"]);
  assert.deepEqual(added.map((n: any) => nzLocal(n.date)), ["2027-02-12 19:00", "2027-02-26 19:00", "2027-03-12 19:00", "2027-03-26 19:00"]);
  assert.deepEqual(added.map((n: any) => n.id), ["night-14", "night-15", "night-16", "night-17"]);
  // No two nights on the same day
  const days = db.nights.map((n: any) => nzDayKey(n.date));
  assert.equal(new Set(days).size, days.length);
});

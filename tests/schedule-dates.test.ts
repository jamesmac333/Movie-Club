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

// The live schedule as of 19 Nov 2026, all 7 pm NZ
import { planReschedule, applyReschedule, nextNightDate, nearestFriday, planRealignDates, applyRealignDates } from "../server/schedule.ts";
const fortnight = () => [
  ["night-8", "2026-11-20", "Ash Macintosh"],
  ["night-9", "2026-12-04", "Madison Hill"],
  ["night-10", "2026-12-18", "Amy Walsh"],
  ["night-11", "2027-01-01", "Tom Sakai"],
  ["night-12", "2027-01-15", "James Macintosh"],
  ["night-13", "2027-01-29", "Max Smith"]
].map(([id, day, selector]) => {
  const [y, m, d] = day.split("-").map(Number);
  return { id, date: nzWallTime(y, m, d), selector, movie: null, status: "scheduled" as const };
});
const at = (y: number, m: number, d: number, h = 19) => nzWallTime(y, m, d, h);

test("moving a night a day or two moves only that night", () => {
  const nights = fortnight();
  const plan = planReschedule(nights, "night-8", at(2026, 11, 21)); // Fri → Sat
  assert.equal(plan.clash, null);
  assert.deepEqual(plan.pushes, []);
});

test("back-to-back Fridays are fine", () => {
  const plan = planReschedule(fortnight(), "night-8", at(2026, 11, 27)); // a week before Madison's 4 Dec
  assert.deepEqual(plan.pushes, []);
});

test("landing under a week before the next night pushes it back a week, and stops once there's a week's gap", () => {
  const nights = fortnight();
  const plan = planReschedule(nights, "night-8", at(2026, 11, 28)); // Sat 28 Nov, 6 days before Madison
  assert.deepEqual(plan.pushes.map((p) => [p.id, nzLocal(p.to)]), [["night-9", "2026-12-11 19:00"]]);
  applyReschedule(nights, "night-8", at(2026, 11, 28), plan.pushes);
  assert.equal(nzLocal(nights[1].date), "2026-12-11 19:00");
  assert.equal(nzLocal(nights[2].date), "2026-12-18 19:00", "Amy stays: back to back with Madison");
});

test("the push carries on down the schedule only while nights are under a week apart", () => {
  const nights = fortnight();
  nights[2].date = at(2026, 12, 12); // Amy already moved to Sat 12 Dec
  const plan = planReschedule(nights, "night-8", at(2026, 12, 2)); // Ash to Wed 2 Dec
  assert.deepEqual(plan.pushes.map((p) => [p.selector.split(" ")[0], nzLocal(p.to)]), [["Madison", "2026-12-11 19:00"], ["Amy", "2026-12-19 19:00"]]);
});

test("a night can't go on a day another night already has, but a skipped night's day is free", () => {
  const nights = fortnight();
  assert.equal(planReschedule(nights, "night-8", at(2026, 12, 4, 20)).clash?.id, "night-9");
  nights[1].status = "skipped" as any;
  assert.equal(planReschedule(nights, "night-8", at(2026, 12, 4)).clash, null);
});

test("new nights follow the last night's planned Friday, not a one-off move", () => {
  const nights = fortnight();
  // Max's 29 Jan night moves to Saturday 30 Jan: the next night is still Friday 12 Feb
  applyReschedule(nights, "night-13", at(2027, 1, 30), []);
  assert.equal(nzLocal(nextNightDate(nights[5])), "2027-02-12 19:00");
  // Moved a week later to Fri 5 Feb: the next night is a week after that, Fri 12 Feb (back to back)
  const later = fortnight();
  applyReschedule(later, "night-13", at(2027, 2, 5), []);
  assert.equal(nzLocal(nextNightDate(later[5])), "2027-02-12 19:00");
  // Moved to Wed 10 Feb: 12 Feb would be too close, so the next night is Fri 19 Feb
  const muchLater = fortnight();
  applyReschedule(muchLater, "night-13", at(2027, 2, 10), []);
  assert.equal(nzLocal(nextNightDate(muchLater[5])), "2027-02-19 19:00");
});

test("a pushed night's planned Friday moves too, so the schedule carries on from it", () => {
  const nights = fortnight();
  const plan = planReschedule(nights, "night-12", at(2027, 1, 23)); // James to Sat 23 Jan, 6 days before Max
  applyReschedule(nights, "night-12", at(2027, 1, 23), plan.pushes);
  assert.equal(nzLocal(nights[5].date), "2027-02-05 19:00");
  assert.equal(nzLocal(nextNightDate(nights[5])), "2027-02-19 19:00");
});

test("the nearest Friday to a date", () => {
  assert.equal(nzLocal(nearestFriday(at(2026, 11, 28))), "2026-11-27 19:00"); // Saturday → the day before
  assert.equal(nzLocal(nearestFriday(at(2026, 11, 30))), "2026-11-27 19:00"); // Monday → the Friday before
  assert.equal(nzLocal(nearestFriday(at(2026, 12, 2))), "2026-12-04 19:00"); // Wednesday → the Friday after
  assert.equal(nzLocal(nearestFriday(at(2026, 11, 20, 18))), "2026-11-20 19:00"); // a Friday stays, at 7 pm
});

test("re-aligning dates keeps the next night and puts the rest a fortnight apart on Fridays", () => {
  const nights = fortnight();
  nights[0].date = at(2026, 11, 28); // Ash moved to Saturday
  nights[1].date = at(2026, 12, 12); // Madison pushed around
  nights[3].date = at(2027, 1, 7); // Tom on a Thursday
  const changes = planRealignDates(nights);
  assert.deepEqual(changes.map((c) => [c.selector.split(" ")[0], nzLocal(c.to)]), [
    ["Madison", "2026-12-11 19:00"],
    ["Amy", "2026-12-25 19:00"],
    ["Tom", "2027-01-08 19:00"],
    ["James", "2027-01-22 19:00"],
    ["Max", "2027-02-05 19:00"]
  ]);
  applyRealignDates(nights, changes);
  assert.equal(nzLocal(nights[0].date), "2026-11-28 19:00", "the next night doesn't move");
  assert.deepEqual(nights.map((n) => n.selector.split(" ")[0]), ["Ash", "Madison", "Amy", "Tom", "James", "Max"], "hosts don't change");
  // The schedule carries on a fortnight after the last one
  assert.equal(nzLocal(nextNightDate(nights[5])), "2027-02-19 19:00");
  // Nothing more to do the second time
  assert.deepEqual(planRealignDates(nights), []);
});

test("watched and skipped nights are left alone when re-aligning", () => {
  const nights: any[] = fortnight();
  nights.unshift({ id: "night-7", date: at(2026, 10, 9), selector: "Max Smith", movie: null, status: "watched" });
  nights[2].status = "skipped";
  const changes = planRealignDates(nights);
  assert.ok(!changes.some((c) => c.id === "night-7" || c.id === "night-9"));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { filmRatings, memberSummary } from "../src/clubStats.ts";
import { isBeforeDataLoss } from "../src/dataLoss.ts";

const film = (title: string) => ({ title });
const nights = [
  { id: "a", date: "2026-08-01T07:00:00Z", selector: "Ash Macintosh", status: "watched", movie: film("Prisoners") },
  { id: "b", date: "2026-08-21T07:00:00Z", selector: "Madison Hill", status: "watched", movie: film("Heavenly Creatures") },
  { id: "c", date: "2026-09-11T07:00:00Z", selector: "Ash Macintosh", status: "watched", movie: film("Parasite") },
  { id: "d", date: "2026-11-06T07:00:00Z", selector: "Ash Macintosh", status: "scheduled", movie: film("Wildwood") },
];
const reviews = [
  { movieNightId: "a", user: "Ash Macintosh", rating: 4 },
  { movieNightId: "a", user: "Tom Sakai", rating: 2 },
  { movieNightId: "a", user: "Amy Walsh", rating: 3 },
  { movieNightId: "b", user: "Ash Macintosh", rating: 5 },
  { movieNightId: "b", user: "Tom Sakai", rating: 4 },
  { movieNightId: "c", user: "Tom Sakai", rating: 5 },
];

test("a film's ratings come highest first, with the average and who split on it", () => {
  const r = filmRatings(reviews, "a");
  assert.deepEqual(r.ratings.map((x) => x.user), ["Ash Macintosh", "Amy Walsh", "Tom Sakai"]);
  assert.equal(r.average, 3);
  assert.equal(r.split?.lovedMost.user, "Ash Macintosh");
  assert.equal(r.split?.likedLeast.user, "Tom Sakai");
  assert.equal(r.split?.gap, 2);
  assert.equal(filmRatings(reviews, "c").split, null);
  assert.equal(filmRatings(reviews, "zzz").average, null);
});

test("a member's summary covers their picks, their ratings and how they compare", () => {
  const ash = memberSummary(nights, reviews, "ash macintosh");
  assert.deepEqual(ash.hosted.map((h) => h.night.id), ["a", "c"]); // the scheduled night isn't counted yet
  assert.equal(ash.hosted[0].average, 3);
  assert.equal(ash.hosted[1].count, 1);
  assert.equal(ash.rated.length, 2);
  assert.equal(ash.averageGiven, 4.5);
  assert.equal(ash.highest?.night.id, "b");
  assert.equal(ash.lowest?.night.id, "a");
  // Film a: 4 against the others' 2.5 (+1.5). Film b: 5 against 4 (+1). Average +1.25
  assert.equal(ash.versusClub, 1.25);

  const max = memberSummary(nights, reviews, "Max Smith");
  assert.equal(max.rated.length, 0);
  assert.equal(max.averageGiven, null);
  assert.equal(max.highest, null);
  assert.equal(max.versusClub, null);
});

test("nights before 14 October 2026 count as lost in the data loss", () => {
  assert.equal(isBeforeDataLoss("2026-10-09T06:00:00.000Z"), true);
  assert.equal(isBeforeDataLoss("2026-10-14T06:00:00.000Z"), false);
});

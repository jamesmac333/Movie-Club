import { test } from "node:test";
import assert from "node:assert/strict";
import { filmRatings, memberSummary, gapFillProgress, recapDueNight } from "../src/clubStats.ts";
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

test("Fill in the gaps counts a lost night as done once it has stars and words", () => {
  const lostNights = [...nights, { id: "e", date: "2026-10-20T07:00:00Z", selector: "Max Smith", status: "watched", movie: film("After the loss") }];
  const withWords = [
    { movieNightId: "a", user: "Amy Walsh", rating: 3, comment: "Tense." },
    { movieNightId: "b", user: "Amy Walsh", rating: 4, comment: "  " },
  ];
  const p = gapFillProgress(lostNights, withWords, "Amy Walsh", "2026-10-14");
  assert.equal(p.total, 3); // the scheduled night and the night after the loss don't count
  assert.equal(p.done, 1); // stars without words isn't finished yet
  assert.deepEqual(p.remaining.map((n) => n.id), ["b", "c"]);
  assert.equal(p.complete, false);

  const finished = gapFillProgress(
    lostNights,
    [...withWords, { movieNightId: "b", user: "Amy Walsh", rating: 4, comment: "Lovely." }, { movieNightId: "c", user: "Amy Walsh", rating: 5, comment: "Best yet." }],
    "Amy Walsh",
    "2026-10-14"
  );
  assert.equal(finished.done, 3);
  assert.equal(finished.complete, true);
});

test("Ash is asked for a recap from 7 pm on the night until it's written", () => {
  const at = (iso: string) => new Date(iso).getTime();
  // 6 Nov, 7 pm NZDT is 06:00 UTC
  const night = [{ id: "n", date: "2026-11-06T06:00:00.000Z", selector: "Ash Macintosh", status: "scheduled", movie: film("Wildwood") }];
  assert.equal(recapDueNight(night, [], at("2026-11-06T05:59:00Z")), undefined, "not before 7 pm");
  assert.equal(recapDueNight(night, [], at("2026-11-06T06:00:00Z"))?.id, "n", "from 7 pm");
  assert.equal(recapDueNight(night, [], at("2026-11-10T09:00:00Z"))?.id, "n", "still there days later");
  assert.equal(recapDueNight(night, ["n"], at("2026-11-07T09:00:00Z")), undefined, "gone once written");
  assert.equal(recapDueNight(night, [], at("2026-11-14T06:00:00Z")), undefined, "gone after a week");
  assert.equal(recapDueNight([{ ...night[0], status: "skipped" }], [], at("2026-11-06T08:00:00Z")), undefined, "not for a skipped night");
});

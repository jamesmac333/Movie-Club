import { test } from "node:test";
import assert from "node:assert/strict";
import { getSealedNightIds } from "../src/reviewSeal.ts";

const day = 86400000;
const night = (id: string, daysAgo: number) => ({ id, date: new Date(Date.now() - daysAgo * day).toISOString() }) as any;
const review = (movieNightId: string, user: string) => ({ id: `${movieNightId}-${user}`, movieNightId, user, rating: 4, comment: "" }) as any;

test("a recent night's reviews are hidden until the member posts their own", () => {
  const nights = [night("recent", 1)];
  assert.ok(getSealedNightIds(nights, [review("recent", "Tom")], "James").has("recent"));
  assert.ok(!getSealedNightIds(nights, [review("recent", "James")], "James").has("recent"));
});

test("older and upcoming nights are never hidden", () => {
  const nights = [night("old", 8), night("upcoming", -3)];
  assert.equal(getSealedNightIds(nights, [], "James").size, 0);
});

test("nothing is hidden when nobody is signed in", () => {
  assert.equal(getSealedNightIds([night("recent", 1)], [], undefined).size, 0);
});

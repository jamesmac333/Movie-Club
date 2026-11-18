import { test } from "node:test";
import assert from "node:assert/strict";
import { themeForNight, rotationNights, rotationNumber, nextUnthemedStart, spinDue, spinStartOptions, groupIntoRotations } from "../src/rotationThemes.ts";

const hosts = ["Max Smith", "Ash Macintosh", "Madison Hill", "Amy Walsh", "Tom Sakai", "James Macintosh"];
// Two full rotations, a fortnight apart, starting 1 Jan 2027
const nights = Array.from({ length: 13 }, (_, i) => {
  const d = new Date(2027, 0, 1 + i * 14, 19);
  return { id: `n${i + 1}`, date: d.toISOString(), selector: hosts[i % 6], status: i < 3 ? "watched" : "scheduled" };
});

test("a rotation is Max's night and the five after it", () => {
  assert.deepEqual(rotationNights(nights, "n1").map((n) => n.id), ["n1", "n2", "n3", "n4", "n5", "n6"]);
  assert.deepEqual(rotationNights(nights, "n13").map((n) => n.id), ["n13"]);
  assert.equal(rotationNumber(nights, "n7"), 1, "the first themed rotation is Rotation 1");
  assert.equal(rotationNumber(nights, "n7", [{ startNightId: "n1", name: "A", description: "" }, { startNightId: "n7", name: "B", description: "" }]), 2);
});

test("every night in a rotation shares its theme, and only that rotation", () => {
  const themes = [{ startNightId: "n7", name: "Heists", description: "" }];
  assert.equal(themeForNight(nights, "n6", themes), null);
  for (const id of ["n7", "n9", "n12"]) assert.equal(themeForNight(nights, id, themes)?.name, "Heists");
  assert.equal(themeForNight(nights, "n13", themes), null);
});

test("the next rotation to spin for is the first upcoming Max night without a theme", () => {
  assert.equal(nextUnthemedStart(nights, [])?.id, "n7");
  assert.equal(nextUnthemedStart(nights, [{ startNightId: "n7", name: "Heists", description: "" }])?.id, "n13");
});

test("admins are reminded to spin from the morning of a rotation's last night until it has a theme", () => {
  const lastNight = new Date(nights[5].date);
  const dayBefore = new Date(lastNight.getTime() - 24 * 3600000);
  const morning = new Date(lastNight);
  morning.setHours(8, 0, 0, 0);
  assert.equal(spinDue(nights, [], dayBefore), null);
  assert.equal(spinDue(nights, [], morning)?.finalNight.id, "n6");
  const both = [{ startNightId: "n1", name: "Space", description: "" }, { startNightId: "n7", name: "Heists", description: "" }];
  assert.equal(spinDue(nights, both, morning), null);
});

test("a rotation already under way can get a theme from its next night to its end", () => {
  // Max's night (n1) has been and gone; Ash's (n2) is next
  const midway = nights.map((n, i) => ({ ...n, status: i < 1 ? "watched" : "scheduled" }));
  const ashDay = new Date(midway[1].date);
  ashDay.setHours(10, 0, 0, 0);
  const options = spinStartOptions(midway, [], ashDay).map((n) => n.id);
  assert.deepEqual(options, ["n2", "n7"]);

  // On Ash's day, admins are reminded to spin before the pick
  assert.equal(spinDue(midway, [], ashDay)?.nextStart.id, "n2");

  const themes = [{ startNightId: "n2", name: "Creature Feature", description: "" }];
  assert.equal(themeForNight(midway, "n1", themes), null, "Max's night that already happened has no theme");
  for (const id of ["n2", "n4", "n6"]) assert.equal(themeForNight(midway, id, themes)?.name, "Creature Feature");
  assert.equal(themeForNight(midway, "n7", themes), null, "the next rotation spins for its own");
  assert.deepEqual(rotationNights(midway, "n2", themes).map((n) => n.id), ["n2", "n3", "n4", "n5", "n6"]);
  assert.equal(rotationNumber(midway, "n2", themes), 1);
  assert.deepEqual(spinStartOptions(midway, themes, ashDay).map((n) => n.id), ["n7"]);
});

test("a locked-in rotation keeps its nights and number when hosts are moved around later", () => {
  const themes = [{ startNightId: "n7", name: "Heists", description: "", number: 1, length: 6 }];
  // Someone makes Max host n9 as well: it doesn't start a new rotation
  const moved = nights.map((n) => (n.id === "n9" ? { ...n, selector: "Max Smith" } : n));
  assert.deepEqual(rotationNights(moved, "n7", themes).map((n) => n.id), ["n7", "n8", "n9", "n10", "n11", "n12"]);
  assert.equal(themeForNight(moved, "n12", themes)?.number, 1);
  assert.equal(themeForNight(moved, "n13", themes), null);
});

test("a skipped night stays in its rotation without using up a turn", () => {
  const themes = [{ startNightId: "n7", name: "Heists", description: "", number: 1, length: 6 }];
  const skipped = nights.map((n) => (n.id === "n8" ? { ...n, status: "skipped" } : n));
  assert.deepEqual(rotationNights(skipped, "n7", themes).map((n) => n.id), ["n7", "n8", "n9", "n10", "n11", "n12", "n13"]);
});

test("the schedule splits into rotations, themed ones with their theme and older ones with none", () => {
  // Rotation 1's theme started from Ash's night (n2), after Max's night (n1) had been
  const themes = [{ startNightId: "n2", name: "Creature Feature", description: "", number: 1, length: 5 }];
  const groups = groupIntoRotations(nights, themes).map((g) => ({ theme: g.theme?.name ?? null, nights: g.nights.map((n) => n.id) }));
  assert.deepEqual(groups, [
    { theme: null, nights: ["n1"] },
    { theme: "Creature Feature", nights: ["n2", "n3", "n4", "n5", "n6"] },
    { theme: null, nights: ["n7", "n8", "n9", "n10", "n11", "n12"] },
    { theme: null, nights: ["n13"] }
  ]);
  // Every night appears exactly once
  assert.equal(groups.flatMap((g) => g.nights).length, nights.length);
});

test("nights before the first Max night form their own rotation", () => {
  const early = [{ id: "e1", date: new Date(2026, 11, 18, 19).toISOString(), selector: "Tom Sakai", status: "watched" }, ...nights];
  const groups = groupIntoRotations(early, []);
  assert.deepEqual(groups[0].nights.map((n) => n.id), ["e1"]);
  assert.equal(groups[1].start.id, "n1");
});

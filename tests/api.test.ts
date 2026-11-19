// End-to-end checks against the production build (run "npm run build" first).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { makeSampleDb, fakePhoto, testPassword } from "./fixtures/sample-db.ts";

const PORT = 3000 + Math.floor(Math.random() * 1000) + 100;
const BASE = `http://127.0.0.1:${PORT}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-api-"));
const dbFile = path.join(dir, "server-db.json");
let server: ChildProcess;

before(async () => {
  fs.writeFileSync(dbFile, JSON.stringify(makeSampleDb()));
  server = spawn(process.execPath, [path.join(import.meta.dirname, "..", "dist", "server.cjs")], {
    env: { ...process.env, NODE_ENV: "production", PORT: String(PORT), DB_PATH: dbFile, SESSION_SECRET: "test-secret", SMTP_HOST: "" },
    stdio: "ignore"
  });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${BASE}/api/nights`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("server did not start");
});

after(() => server?.kill());

const json = (body: unknown, token?: string) => ({
  method: "POST",
  headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body)
});

async function login(username: string) {
  const res = await fetch(`${BASE}/api/auth/login`, json({ username, password: testPassword(username) }));
  assert.equal(res.status, 200);
  return (await res.json()).token as string;
}

test("public pages load", async () => {
  for (const p of ["/", "/api/users", "/api/nights", "/api/reviews", "/api/overviews"]) {
    assert.equal((await fetch(BASE + p)).status, 200, p);
  }
});

test("security headers are sent", async () => {
  const res = await fetch(`${BASE}/`);
  assert.match(res.headers.get("content-security-policy") || "", /default-src 'self'/);
  assert.equal(res.headers.get("x-frame-options"), "DENY");
});

test("strangers cannot change data or read admin data", async () => {
  assert.equal((await fetch(`${BASE}/api/edm`)).status, 401);
  assert.equal((await fetch(`${BASE}/api/admin/backup/download?requester=james`)).status, 401);
  assert.equal((await fetch(`${BASE}/api/auth/change-password`, json({ username: "James", newPassword: "x" }))).status, 401);
  assert.equal((await fetch(`${BASE}/api/reviews`, json({ movieNightId: "night-1", user: "Tom Sakai", rating: 1, comment: "x" }))).status, 401);
});

test("members cannot use admin features by claiming to be James", async () => {
  const tom = await login("Tom");
  const res = await fetch(`${BASE}/api/edm`, { headers: { Authorization: `Bearer ${tom}` } });
  assert.equal(res.status, 403);
  const reset = await fetch(`${BASE}/api/auth/admin-set-password`, json({ adminUsername: "james", targetUsername: "James", newPassword: "x" }, tom));
  assert.equal(reset.status, 403);
});

test("a review is always saved under the signed-in member's name", async () => {
  const max = await login("Max");
  const res = await fetch(`${BASE}/api/reviews`, json({ movieNightId: "night-1", user: "Ash Macintosh", rating: 4, comment: "mine" }, max));
  assert.equal(res.status, 200);
  const reviews = await (await fetch(`${BASE}/api/reviews`)).json();
  assert.ok(reviews.some((r: { user: string; comment: string }) => r.user === "Max Smith" && r.comment === "mine"));
});

test("films from before the data loss can be rated with stars only; newer ones need words", async () => {
  const amy = await login("Amy");
  assert.equal((await fetch(`${BASE}/api/reviews`, json({ movieNightId: "night-2", rating: 3.5, comment: "" }, amy))).status, 200);
  const saved = (await (await fetch(`${BASE}/api/reviews`)).json()).find((r: { user: string; movieNightId: string }) => r.user === "Amy Walsh" && r.movieNightId === "night-2");
  assert.equal(saved.rating, 3.5);
  assert.equal(saved.comment, "");
  assert.equal((await fetch(`${BASE}/api/reviews`, json({ movieNightId: "night-3", rating: 4, comment: "" }, amy))).status, 400);
  assert.equal((await fetch(`${BASE}/api/reviews`, json({ movieNightId: "night-2", rating: 9, comment: "x" }, amy))).status, 400);
});

test("repeated wrong passwords are blocked", async () => {
  for (let i = 0; i < 5; i++) {
    assert.equal((await fetch(`${BASE}/api/auth/login`, json({ username: "Amy", password: "wrong" }))).status, 401);
  }
  const blocked = await fetch(`${BASE}/api/auth/login`, json({ username: "Amy", password: testPassword("Amy") }));
  assert.equal(blocked.status, 429);
});

test("a member's own photo stays locked until they've filled in the gaps", async () => {
  const madison = await login("Madison");
  const locked = await fetch(`${BASE}/api/users/Madison/avatar`, { ...json({ avatarUrl: fakePhoto(0.2) }, madison), method: "PUT" });
  assert.equal(locked.status, 403);
  assert.equal((await locked.json()).code, "PHOTO_LOCKED");

  // Admins can still set someone else's photo
  const ash = await login("Ash");
  const byAdmin = await fetch(`${BASE}/api/users/Tom/avatar`, { ...json({ avatarUrl: fakePhoto(0.2) }, ash), method: "PUT" });
  assert.equal(byAdmin.status, 200);
});

test("profile photos are stored as files and cached by browsers", async () => {
  const madison = await login("Madison");
  // Both lost nights reviewed with words, so Madison's photo is unlocked
  for (const night of ["night-1", "night-2"]) {
    const saved = await fetch(`${BASE}/api/reviews`, json({ movieNightId: night, user: "Madison Hill", rating: 4, comment: "Loved it." }, madison));
    assert.equal(saved.status, 200);
  }
  const upload = await fetch(`${BASE}/api/users/Madison/avatar`, { ...json({ avatarUrl: fakePhoto(0.2) }, madison), method: "PUT" });
  assert.equal(upload.status, 200);
  const users = await (await fetch(`${BASE}/api/users`)).json();
  const url = users.find((u: { username: string }) => u.username === "Madison").avatarUrl as string;
  assert.match(url, /\?v=/);
  const img = await fetch(BASE + url);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get("content-type"), "image/jpeg");
  assert.match(img.headers.get("cache-control") || "", /immutable/);
  assert.ok(fs.readdirSync(path.join(dir, "images")).length > 0);
});

test("a recap with a large photo saves without bloating the database", async () => {
  const ash = await login("Ash");
  const res = await fetch(`${BASE}/api/overviews`, json({ movieNightId: "night-1", title: "Photo night", content: "Recap", imageUrl: fakePhoto(9) }, ash));
  assert.equal(res.status, 200);
  const overview = (await res.json()).overview;
  assert.match(overview.imageUrl, /^\/api\/overviews\/.+\/image\?v=/);
  assert.equal((await fetch(BASE + overview.imageUrl)).status, 200);
  await new Promise((r) => setTimeout(r, 500)); // email log is written in the background
  assert.ok(fs.statSync(dbFile).size < 200_000, "photo is not stored inside the database");
});

const authed = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });
const send = (method: string, body: unknown, token: string) => ({ ...json(body, token), method });

test("only admins can manage themes and spin the wheel", async () => {
  const tom = await login("Tom");
  assert.equal((await fetch(`${BASE}/api/admin/themes`, authed(tom))).status, 403);
  assert.equal((await fetch(`${BASE}/api/admin/themes`, json({ name: "Sneaky" }, tom))).status, 403);
  assert.equal((await fetch(`${BASE}/api/admin/themes/spin`, json({}, tom))).status, 403);
});

test("members suggest themes and admins add them with their own wording", async () => {
  const tom = await login("Tom");
  const james = await login("James");
  assert.equal((await fetch(`${BASE}/api/theme-suggestions`, json({ name: "Heists", description: "Robberies and cons" }, tom))).status, 200);
  assert.equal((await fetch(`${BASE}/api/theme-suggestions`, json({ name: "heists" }, tom))).status, 409, "duplicates are refused");
  const mine = await (await fetch(`${BASE}/api/theme-suggestions/mine`, authed(tom))).json();
  assert.equal(mine.length, 1);

  const state = await (await fetch(`${BASE}/api/admin/themes`, authed(james))).json();
  const res = await fetch(`${BASE}/api/admin/theme-suggestions/${state.suggestions[0].id}/accept`, json({ name: "Heists & Cons", description: "Robberies and cons" }, james));
  const after = await res.json();
  assert.equal(res.status, 200);
  assert.equal(after.suggestions.length, 0);
  assert.equal(after.themes[0].name, "Heists & Cons");
  assert.equal(after.themes[0].suggestedBy, "Tom Sakai");
});

test("the wheel: one veto, then the next spin is final and the theme never comes round again", async () => {
  const james = await login("James");
  for (const name of ["Space", "Musicals", "Debuts"]) {
    assert.equal((await fetch(`${BASE}/api/admin/themes`, json({ name }, james))).status, 200);
  }

  // Ash's night is next and this rotation has no theme, so it's offered first, then the next Max rotation
  const before = await (await fetch(`${BASE}/api/admin/themes`, authed(james))).json();
  assert.equal(before.startOptions.length, 2);
  assert.equal(before.startOptions[0].startNightId, "night-3");
  assert.equal(before.startOptions[0].partial, true);
  assert.equal(before.startOptions[1].partial, false, "a Max night starts a whole rotation");
  assert.equal((await fetch(`${BASE}/api/admin/themes/spin`, json({ startNightId: "night-1" }, james))).status, 409, "a past night can't start a theme");

  const first = await (await fetch(`${BASE}/api/admin/themes/spin`, json({ startNightId: before.startOptions[1].startNightId }, james))).json();
  assert.equal(first.final, false);
  assert.equal(first.wheel.length, 4);
  assert.equal((await fetch(`${BASE}/api/admin/themes/spin`, json({}, james))).status, 409, "can't re-roll without deciding");

  assert.equal((await fetch(`${BASE}/api/admin/themes/spin/veto`, json({ removeForGood: true }, james))).status, 200);
  assert.equal((await fetch(`${BASE}/api/admin/themes/spin/veto`, json({}, james))).status, 409, "only one veto");

  const second = await (await fetch(`${BASE}/api/admin/themes/spin`, json({}, james))).json();
  assert.equal(second.final, true);
  assert.equal(second.wheel.length, 3);
  assert.notEqual(second.winner.id, first.winner.id);
  assert.ok(!second.themes.some((t: { id: string }) => t.id === first.winner.id), "vetoed for good");
  assert.equal(second.themes.find((t: { id: string }) => t.id === second.winner.id).status, "used");

  const publicThemes = await (await fetch(`${BASE}/api/rotation-themes`)).json();
  assert.equal(publicThemes.length, 1);
  assert.equal(publicThemes[0].number, 1, "the first themed rotation is Rotation 1");
  assert.equal(publicThemes[0].length, 6);
  assert.equal(publicThemes[0].name, second.winner.name);
  const nights = await (await fetch(`${BASE}/api/nights`)).json();
  assert.match(nights.find((n: { id: string }) => n.id === publicThemes[0].startNightId).selector, /^Max/);

  // Ash's night can still be spun for, and the used theme isn't on the wheel
  const state = await (await fetch(`${BASE}/api/admin/themes`, authed(james))).json();
  assert.deepEqual(state.startOptions.map((o: { startNightId: string }) => o.startNightId), ["night-3"]);
  // A spin pressed by mistake can be cancelled, and the veto comes back
  const oops = await (await fetch(`${BASE}/api/admin/themes/spin`, json({}, james))).json();
  assert.equal(oops.final, false);
  const cancelled = await (await fetch(`${BASE}/api/admin/themes/spin/cancel`, json({}, james))).json();
  assert.equal(cancelled.spin, null);
  assert.equal((await fetch(`${BASE}/api/admin/themes/spin/cancel`, json({}, james))).status, 409);

  const third = await (await fetch(`${BASE}/api/admin/themes/spin`, json({}, james))).json();
  assert.ok(!third.wheel.some((t: { id: string }) => t.id === second.winner.id));
  assert.equal(third.spin.startNightId, "night-3");
  assert.equal(third.spin.vetoed, false);
  assert.equal((await fetch(`${BASE}/api/admin/themes/spin/lock`, json({}, james))).status, 200);
  const after = await (await fetch(`${BASE}/api/rotation-themes`)).json();
  assert.equal(after.length, 2);
  const ash = after.find((t: { startNightId: string }) => t.startNightId === "night-3");
  assert.equal(ash.number, 2);
  assert.equal(ash.length, 5, "the rest of the rotation, Ash to James");
});

test("an admin can send a pick back to the host", async () => {
  const tom = await login("Tom");
  const ash = await login("Ash");
  assert.equal((await fetch(`${BASE}/api/nights/night-1/send-back`, json({ note: "x" }, tom))).status, 403);
  // A night that has already happened keeps its pick
  assert.equal((await fetch(`${BASE}/api/nights/night-1/send-back`, json({ note: "x" }, ash))).status, 409);
  const reopen = await fetch(`${BASE}/api/nights/night-1/status`, { ...json({ status: "scheduled", requester: "Ash" }, ash), method: "PUT" });
  assert.equal(reopen.status, 200);
  const res = await fetch(`${BASE}/api/nights/night-1/send-back`, json({ note: "Not a heist" }, ash));
  assert.equal(res.status, 200);
  const { night } = await res.json();
  assert.equal(night.movie, null);
  assert.equal(night.sentBack.title, "Parasite");
  assert.equal(night.sentBack.note, "Not a heist");
});

test("admins see how many theme suggestions are waiting", async () => {
  const madison = await login("Madison");
  const james = await login("James");
  assert.equal((await fetch(`${BASE}/api/admin/themes/summary`, authed(madison))).status, 403);
  assert.equal((await fetch(`${BASE}/api/theme-suggestions`, json({ name: "Road trips" }, madison))).status, 200);
  const summary = await (await fetch(`${BASE}/api/admin/themes/summary`, authed(james))).json();
  assert.equal(summary.suggestions, 1);
});

test("a night can't be moved onto a day that already has one", async () => {
  const james = await login("James");
  const move = (date: string) => fetch(`${BASE}/api/nights/night-3/date`, { ...json({ date, requester: "James" }, james), method: "PUT" });
  // 8:30 pm on 9 Oct in NZ, the same day as Max's night
  const clash = await move("2026-10-09T07:30:00.000Z");
  assert.equal(clash.status, 409);
  assert.match((await clash.json()).error, /Max's night is already on that day/);
  assert.equal((await move("not a date")).status, 400);
  const nights = await (await fetch(`${BASE}/api/nights`, { headers: { Authorization: `Bearer ${james}` } })).json();
  assert.equal(nights.find((n: { id: string }) => n.id === "night-3").date, "2099-01-01T06:00:00.000Z", "the night didn't move (and its old zoneless date now reads as 7 pm NZ)");
});

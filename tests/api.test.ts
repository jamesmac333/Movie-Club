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

test("members can mark lost nights they weren't at, and everyone can see it", async () => {
  const tom = await login("Tom");
  const mark = (nightId: string, missed: boolean) => fetch(`${BASE}/api/me/missed-nights`, json({ nightId, missed }, tom));
  assert.equal((await mark("night-1", true)).status, 200);
  assert.equal((await mark("night-3", true)).status, 404); // only nights from before the data loss
  assert.equal((await fetch(`${BASE}/api/me/missed-nights`, json({ nightId: "night-1", missed: true }))).status, 401);
  let users = await (await fetch(`${BASE}/api/users`)).json();
  assert.deepEqual(users.find((u: { username: string }) => u.username === "Tom").missedNights, ["night-1"]);
  assert.equal((await mark("night-1", false)).status, 200);
  users = await (await fetch(`${BASE}/api/users`)).json();
  assert.deepEqual(users.find((u: { username: string }) => u.username === "Tom").missedNights, []);
});

test("repeated wrong passwords are blocked", async () => {
  for (let i = 0; i < 5; i++) {
    assert.equal((await fetch(`${BASE}/api/auth/login`, json({ username: "Amy", password: "wrong" }))).status, 401);
  }
  const blocked = await fetch(`${BASE}/api/auth/login`, json({ username: "Amy", password: testPassword("Amy") }));
  assert.equal(blocked.status, 429);
});

test("profile photos are stored as files and cached by browsers", async () => {
  const madison = await login("Madison");
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

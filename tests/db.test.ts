// Database loading must never replace real data with defaults (see the 14 Oct 2026 data loss).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { makeSampleDb, fakePhoto } from "./fixtures/sample-db.ts";

const scenario = path.join(import.meta.dirname, "fixtures", "db-scenario.ts");

function setup(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-db-"));
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
  return { dir, file: path.join(dir, "server-db.json") };
}

function run(file: string, action: "read" | "write", nodeEnv = "production") {
  const out = execFileSync(process.execPath, ["--import", "tsx", scenario, action], {
    env: { ...process.env, DB_PATH: file, NODE_ENV: nodeEnv },
    encoding: "utf8"
  });
  return JSON.parse(out.trim().split("\n").pop()!);
}

const sample = () => JSON.stringify(makeSampleDb());

test("an email log holding a large photo loads and saves without crashing", () => {
  const db = makeSampleDb();
  db.edmLogs.push({ id: "log-1", type: "overview", subject: "Recap", sentAt: "2026-10-14T00:00:00.000Z", recipients: [], status: "sent", htmlContent: `<img src="${fakePhoto(8)}"><p>recap</p>` });
  const { file } = setup({ "server-db.json": JSON.stringify(db) });
  const result = run(file, "write");
  assert.equal(result.ok, true, result.error);
  assert.equal(result.reviewsOnDisk, 3);
  assert.ok(result.largestEmailLog < 5000, "photo should be stripped from the email log");
});

test("an unreadable database is recovered from the .bak copy", () => {
  const { dir, file } = setup({ "server-db.json": "{broken", "server-db.json.bak": sample() });
  const result = run(file, "write");
  assert.equal(result.ok, true, result.error);
  assert.equal(result.reviewsOnDisk, 3);
  assert.ok(fs.readdirSync(dir).some((f) => f.startsWith("server-db.json.unreadable-")), "unreadable file is kept");
});

test("when nothing can be read, the server refuses and leaves the file untouched", () => {
  const { file } = setup({ "server-db.json": "{broken", "server-db.json.bak": "also broken" });
  const result = run(file, "write");
  assert.equal(result.ok, false);
  assert.equal(fs.readFileSync(file, "utf8"), "{broken");
});

test("a database with no members is refused, not re-seeded", () => {
  const empty = JSON.stringify({ users: [], nights: [], reviews: [] });
  const { file } = setup({ "server-db.json": empty });
  const result = run(file, "write");
  assert.equal(result.ok, false);
  assert.equal(fs.readFileSync(file, "utf8"), empty);
});

test("a missing database is an error in production and is not created", () => {
  const { file } = setup({});
  const result = run(file, "read");
  assert.equal(result.ok, false);
  assert.match(result.error, /Refusing to create/);
  assert.equal(fs.existsSync(file), false);
});

test("a missing database is created with starter data in development", () => {
  const { file } = setup({});
  const result = run(file, "read", "development");
  assert.equal(result.ok, true, result.error);
  assert.ok(result.members > 0);
});

test("photos stored inside the database are moved out to image files", () => {
  const db = makeSampleDb();
  (db.users[0] as { avatarUrl?: string }).avatarUrl = fakePhoto(1);
  const { dir, file } = setup({ "server-db.json": JSON.stringify(db) });
  const result = run(file, "read");
  assert.equal(result.ok, true, result.error);
  assert.match(result.avatars[0], /^img:[0-9a-f]{24}\.jpg$/);
  assert.ok(fs.existsSync(path.join(dir, "images", result.avatars[0].slice(4))));
  assert.ok(fs.statSync(file).size < 50_000, "database no longer contains the photo");
});

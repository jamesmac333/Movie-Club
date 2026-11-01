import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { configureImageStore, storeImage, shrinkAvatar } from "../server/images.ts";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movie-club-images-"));
configureImageStore(path.join(dir, "server-db.json"));

// Random pixels don't compress, so this PNG is well over the size limit
async function bigPhoto(): Promise<string> {
  const size = 600;
  const png = await sharp(crypto.randomBytes(size * size * 3), { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
  return storeImage(`data:image/png;base64,${png.toString("base64")}`);
}

test("a full-size member photo is shrunk to a small square JPEG, keeping the original", async () => {
  const original = await bigPhoto();
  const originalFile = path.join(dir, "images", original.slice(4));
  const shrunk = await shrinkAvatar(original);

  assert.notEqual(shrunk, original);
  assert.match(shrunk, /^img:[0-9a-f]+\.jpg$/);
  const file = path.join(dir, "images", shrunk.slice(4));
  const meta = await sharp(file).metadata();
  assert.equal(meta.width, 320);
  assert.equal(meta.height, 320);
  assert.ok(fs.statSync(file).size < fs.statSync(originalFile).size / 4);
  assert.ok(fs.existsSync(originalFile));
});

test("a photo that's already small, or isn't a stored file, is left alone", async () => {
  const small = await sharp({ create: { width: 320, height: 320, channels: 3, background: "#2f4a55" } }).jpeg().toBuffer();
  const ref = storeImage(`data:image/jpeg;base64,${small.toString("base64")}`);
  assert.equal(await shrinkAvatar(ref), ref);
  assert.equal(await shrinkAvatar("https://example.com/photo.jpg"), "https://example.com/photo.jpg");
  assert.equal(await shrinkAvatar(""), "");
});

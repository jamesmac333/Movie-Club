import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { Response } from "express";

// Photos are stored as files in an "images" folder next to the database (in the
// mounted storage bucket on the live site) instead of as base64 inside server-db.json.
// The database keeps a short reference: "img:<content hash>.<ext>".

const PREFIX = "img:";
const DATA_URL = /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i;
const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

let imagesDir = "";

export function configureImageStore(dbFile: string): void {
  imagesDir = path.join(path.dirname(dbFile), "images");
}

export function isStoredImage(value?: string): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function isInlineImage(value?: string): boolean {
  return typeof value === "string" && DATA_URL.test(value);
}

// Saves an inline data: URL as a file and returns its "img:" reference.
// Anything that is not an inline image (web URLs, "", existing references) is returned unchanged.
export function storeImage(value: string): string {
  const match = typeof value === "string" ? value.match(DATA_URL) : null;
  if (!match) return value;
  const ext = match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
  const data = Buffer.from(value.slice(match[0].length), "base64");
  const name = `${crypto.createHash("sha256").update(data).digest("hex").slice(0, 24)}.${ext}`;
  const file = path.join(imagesDir, name);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(imagesDir, { recursive: true });
    const temp = `${file}.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(temp, data);
    fs.renameSync(temp, file);
  }
  return PREFIX + name;
}

// Short fingerprint used in ?v= so browsers can cache an image until it changes
export function imageVersion(value: string): string {
  if (isStoredImage(value)) return value.slice(PREFIX.length, PREFIX.length + 12);
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
}

// Sends a stored or inline image. Returns false if the value is neither.
export function sendImage(res: Response, value: string, cacheControl: string): boolean {
  res.setHeader("Cache-Control", cacheControl);
  if (isStoredImage(value)) {
    const name = path.basename(value.slice(PREFIX.length));
    const file = path.join(imagesDir, name);
    if (!fs.existsSync(file)) {
      res.status(404).send("Image file missing");
      return true;
    }
    res.setHeader("Content-Type", MIME[path.extname(name).slice(1)] || "application/octet-stream");
    res.sendFile(file);
    return true;
  }
  const match = value.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  if (match) {
    res.setHeader("Content-Type", `image/${match[1] === "jpg" ? "jpeg" : match[1]}`);
    res.send(Buffer.from(match[2], "base64"));
    return true;
  }
  return false;
}

// Moves any inline photos in the database out to files. Returns true if anything changed.
// A photo that fails to save stays inline, so nothing is ever lost.
export function moveInlineImagesToFiles(db: { users?: { avatarUrl?: string }[]; overviews?: { imageUrl?: string }[] }): boolean {
  let changed = false;
  const move = (value?: string): string | undefined => {
    if (!isInlineImage(value)) return value;
    try {
      const ref = storeImage(value!);
      changed = true;
      return ref;
    } catch (err) {
      console.error("Could not move a photo out of the database, keeping it inline:", err);
      return value;
    }
  };
  for (const u of db.users || []) u.avatarUrl = move(u.avatarUrl);
  for (const o of db.overviews || []) o.imageUrl = move(o.imageUrl);
  return changed;
}

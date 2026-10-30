// Member-entered text must be escaped in club emails, and photo stripping must handle any size.
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "os";
import path from "path";

process.env.DB_PATH = path.join(os.tmpdir(), "mc-email-test", "server-db.json");
const { generateNightOverviewEmailHtml, generateMovieSelectedEmailHtml } = await import("../server/edm.ts");
const { stripInlineImages } = await import("../server/db.ts");

const evil = `<script>alert(1)</script><a href="https://evil.test">click</a>`;
const night = {
  id: "n1", date: "2026-10-09T19:00:00", selector: "Tom Sakai", status: "watched" as const,
  movie: { title: "Heat " + evil, year: 1995, director: "Michael Mann", genre: "Crime", runtime: 170, overview: "Plot " + evil, posterUrl: "javascript:alert(1)", selectedBy: "Tom" }
};

test("recap emails escape member text and reject unsafe image sources", () => {
  const html = generateNightOverviewEmailHtml(
    { id: "o1", movieNightId: "n1", title: "Recap " + evil, content: "Line one\n" + evil, imageUrl: 'https://example.test/a.jpg" onerror="alert(1)', author: "Ash Macintosh", createdAt: "2026-10-14" },
    night,
    [{ id: "r1", movieNightId: "n1", user: "Tom Sakai", rating: 5, comment: "Great " + evil, createdAt: "2026-10-14" }]
  );
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes('href="https://evil.test"'));
  assert.ok(!html.includes('" onerror="'));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("Line one\n"));
});

test("movie selection emails escape movie details", () => {
  const html = generateMovieSelectedEmailHtml(night);
  assert.ok(!html.includes("<script>"));
  assert.ok(!/src="javascript:/i.test(html));
});

test("photo stripping handles a multi-megabyte photo", () => {
  const html = `<p>a</p><img src="data:image/jpeg;base64,${"A".repeat(8 * 1024 * 1024)}"><img src="data:image/png;base64,AAAA"><p>b</p>`;
  const out = stripInlineImages(html);
  assert.ok(out.length < 300);
  assert.ok(out.includes("[Attached high-res photo in email]"));
  assert.ok(out.includes('src="data:image/png;base64,AAAA"'), "small images are kept");
  assert.ok(out.endsWith("<p>b</p>"));
});

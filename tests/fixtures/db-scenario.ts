// Runs one database operation in a fresh process (DB_PATH is read when db.ts loads)
// and prints the outcome as JSON for tests/db.test.ts.
import fs from "fs";

const action = process.argv[2];
const file = process.env.DB_PATH!;

async function main() {
  const db = await import("../../server/db.ts");
  try {
    if (action === "write") {
      await db.mutateDb((d) => {
        d.reviews.push({ id: "rev-test", movieNightId: "night-1", user: "Tom Sakai", rating: 3, comment: "test", createdAt: new Date().toISOString() });
      });
    }
    const d = db.readDb();
    const onDisk = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
    console.log(JSON.stringify({
      ok: true,
      reviews: d.reviews.length,
      members: d.users.length,
      largestEmailLog: Math.max(0, ...(d.edmLogs || []).map((l) => (l.htmlContent || "").length)),
      avatars: d.users.map((u) => u.avatarUrl || ""),
      reviewsOnDisk: onDisk ? onDisk.reviews.length : null
    }));
  } catch (err) {
    console.log(JSON.stringify({ ok: false, error: String((err as Error).message) }));
  }
}

main();

import fs from "fs";
import path from "path";
import { MovieNight, Review, NightOverview, User } from "../src/types.ts";

function getDbFile(): string {
  if (process.env.DB_PATH) {
    return process.env.DB_PATH;
  }
  // Auto-detect mounted GCS volumes
  if (fs.existsSync("/app/db-volume")) {
    return "/app/db-volume/server-db.json";
  }
  if (fs.existsSync("/app/server-db-volume")) {
    return "/app/server-db-volume/server-db.json";
  }
  // Default to local server-db.json in current working directory
  return path.join(process.cwd(), "server-db.json");
}

const DB_FILE = getDbFile();

export interface UserWithPassword extends User {
  password?: string;
}

interface DatabaseSchema {
  nights: MovieNight[];
  reviews: Review[];
  overviews: NightOverview[];
  users: UserWithPassword[];
}

// Clean launch initial data: starting rotation with Max Smith first on July 17, 2026.
// Strict perpetual rotation order: Max, Ash, Madison, Amy, Tom, James
export const HOST_ROTATION = [
  "Max Smith",
  "Ash Macintosh",
  "Madison Hill",
  "Amy Walsh",
  "Tom Sakai",
  "James Macintosh"
];

export function getRotationIndex(selectorName: string): number {
  if (!selectorName) return -1;
  const s = selectorName.trim().toLowerCase();
  return HOST_ROTATION.findIndex((r) => {
    const rLower = r.toLowerCase();
    const rFirst = rLower.split(" ")[0];
    return rLower === s || s.startsWith(rFirst) || rLower.startsWith(s);
  });
}

const getInitialData = (): DatabaseSchema => {
  const initialNights: MovieNight[] = [
    {
      id: "night-1",
      date: "2026-07-17T19:00:00",
      selector: "Max Smith",
      movie: null,
      status: "scheduled"
    },
    {
      id: "night-2",
      date: "2026-07-31T19:00:00",
      selector: "Ash Macintosh",
      movie: null,
      status: "scheduled"
    },
    {
      id: "night-3",
      date: "2026-08-14T19:00:00",
      selector: "Madison Hill",
      movie: null,
      status: "scheduled"
    },
    {
      id: "night-4",
      date: "2026-08-28T19:00:00",
      selector: "Amy Walsh",
      movie: null,
      status: "scheduled"
    },
    {
      id: "night-5",
      date: "2026-09-11T19:00:00",
      selector: "Tom Sakai",
      movie: null,
      status: "scheduled"
    },
    {
      id: "night-6",
      date: "2026-09-25T19:00:00",
      selector: "James Macintosh",
      movie: null,
      status: "scheduled"
    }
  ];

  const initialUsers: UserWithPassword[] = [
    { username: "James", name: "James Macintosh", isAdmin: true, isAsh: false, password: "Admin" },
    { username: "Ash", name: "Ash Macintosh", isAdmin: true, isAsh: true, password: "Admin" },
    { username: "Tom", name: "Tom Sakai", isAdmin: false, isAsh: false, password: "movienight" },
    { username: "Madison", name: "Madison Hill", isAdmin: false, isAsh: false, password: "movienight" },
    { username: "Max", name: "Max Smith", isAdmin: false, isAsh: false, password: "movienight" },
    { username: "Amy", name: "Amy Walsh", isAdmin: false, isAsh: false, password: "movienight" }
  ];

  return {
    nights: initialNights,
    reviews: [],
    overviews: [],
    users: initialUsers
  };
};

export function ensureFutureNights(db: DatabaseSchema) {
  // Sort nights chronologically by date
  db.nights.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Count how many scheduled nights we have in the pipeline
  let scheduledCount = db.nights.filter(n => n.status === "scheduled").length;

  // If there are more than 6 scheduled nights, safely trim unselected trailing placeholder nights
  // NEVER remove any nights that have watched status, movies selected, reviews, or overviews!
  if (scheduledCount > 6) {
    for (let i = db.nights.length - 1; i >= 0 && scheduledCount > 6; i--) {
      const n = db.nights[i];
      const hasReview = (db.reviews || []).some(r => r.movieNightId === n.id);
      const hasOverview = (db.overviews || []).some(o => o.movieNightId === n.id);
      if (n.status === "scheduled" && !n.movie && !hasReview && !hasOverview) {
        db.nights.splice(i, 1);
        scheduledCount--;
      }
    }
  }
  
  let attempts = 0;
  // Always keep exactly the next 6 sessions scheduled in the rotation cycle
  while (scheduledCount < 6 && attempts < 20) {
    attempts++;
    const lastNight = db.nights[db.nights.length - 1];
    if (!lastNight) {
      db.nights.push({
        id: "night-1",
        date: "2026-07-17T19:00:00",
        selector: HOST_ROTATION[0],
        movie: null,
        status: "scheduled"
      });
      scheduledCount++;
      continue;
    }
    
    // Calculate the next date (exactly 14 days later at 19:00:00)
    const lastDate = new Date(lastNight.date);
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + 14);
    
    const year = nextDate.getFullYear();
    const month = String(nextDate.getMonth() + 1).padStart(2, '0');
    const day = String(nextDate.getDate()).padStart(2, '0');
    const nextDateStr = `${year}-${month}-${day}T19:00:00`;
    
    // Determine next selector in perpetual cycle: Max -> Ash -> Madison -> Amy -> Tom -> James
    const lastIndex = getRotationIndex(lastNight.selector);
    const nextIndex = lastIndex === -1 ? 0 : (lastIndex + 1) % HOST_ROTATION.length;
    const nextSelector = HOST_ROTATION[nextIndex];
    
    // Determine next sequential ID
    const maxIdNum = db.nights.reduce((max, n) => {
      const match = n.id.match(/^night-(\d+)/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    const nextId = `night-${maxIdNum + 1}`;
    
    db.nights.push({
      id: nextId,
      date: nextDateStr,
      selector: nextSelector,
      movie: null,
      status: "scheduled"
    });
    
    scheduledCount++;
  }
}

import crypto from "crypto";

// Guaranteed unique ID generator combining timestamp and random cryptographic bytes
export function generateUniqueId(prefix: string = "id"): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

// In-memory database cache to eliminate disk-read race conditions
let cachedDb: DatabaseSchema | null = null;

// Serialized mutation queue promise chain
let mutationQueue: Promise<unknown> = Promise.resolve();

// Helper to save database atomically using a temp file and fs.renameSync
function saveDbToDiskAtomic(data: DatabaseSchema): void {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.error("Failed to create directory for DB_FILE:", e);
    }
  }

  const tempFile = `${DB_FILE}.tmp.${Date.now()}.${crypto.randomBytes(3).toString("hex")}`;
  const bakFile = `${DB_FILE}.bak`;

  try {
    const json = JSON.stringify(data, null, 2);
    // Write full contents to temp file first
    fs.writeFileSync(tempFile, json, "utf8");

    // Keep a backup of current database if it exists
    if (fs.existsSync(DB_FILE)) {
      try {
        fs.copyFileSync(DB_FILE, bakFile);
      } catch (bakErr) {
        // Backup copy is best-effort
      }
    }

    // Atomic rename replaces DB_FILE instantly without truncation or reader race conditions
    fs.renameSync(tempFile, DB_FILE);
  } catch (error) {
    console.error("Error atomically writing to database file:", error);
    if (fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch {}
    }
  }
}

// Internal loader from disk
function loadDbFromDisk(): DatabaseSchema {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const localFile = path.join(process.cwd(), "server-db.json");
      if (fs.existsSync(localFile) && localFile !== DB_FILE) {
        console.log(`DB_FILE not found at ${DB_FILE}. Copying initial state from bundled ${localFile}...`);
        fs.copyFileSync(localFile, DB_FILE);
      } else {
        const data = getInitialData();
        saveDbToDiskAtomic(data);
        return data;
      }
    }

    const raw = fs.readFileSync(DB_FILE, "utf8");
    let parsed: DatabaseSchema;
    try {
      parsed = JSON.parse(raw) as DatabaseSchema;
    } catch (parseErr) {
      console.warn("Failed to parse DB_FILE, checking for backup file...", parseErr);
      const bakFile = `${DB_FILE}.bak`;
      if (fs.existsSync(bakFile)) {
        const bakRaw = fs.readFileSync(bakFile, "utf8");
        parsed = JSON.parse(bakRaw) as DatabaseSchema;
        console.log("Successfully recovered database from .bak backup file!");
      } else {
        throw parseErr;
      }
    }
    
    // Auto-migration if users are missing in the saved JSON file
    if (!parsed.users || parsed.users.length === 0) {
      const initial = getInitialData();
      parsed.users = initial.users;
      parsed.nights = initial.nights;
      parsed.reviews = parsed.reviews || [];
      parsed.overviews = parsed.overviews || [];
      saveDbToDiskAtomic(parsed);
    }

    if (!Array.isArray(parsed.reviews)) parsed.reviews = [];
    if (!Array.isArray(parsed.overviews)) parsed.overviews = [];
    if (!Array.isArray(parsed.nights)) parsed.nights = [];

    // Auto-schedule future nights to ensure at least 8 are always in the pipeline
    const originalLength = parsed.nights.length;
    ensureFutureNights(parsed);
    if (parsed.nights.length !== originalLength) {
      saveDbToDiskAtomic(parsed);
    }

    return parsed;
  } catch (error) {
    console.error("Error reading database file, returning defaults:", error);
    if (cachedDb) {
      return cachedDb;
    }
    return getInitialData();
  }
}

// Helper to load database (reads memory cache first, or loads once from disk)
export function readDb(): DatabaseSchema {
  if (!cachedDb) {
    cachedDb = loadDbFromDisk();
  }
  return cachedDb;
}

// Helper to write database (updates memory cache and saves atomically to disk)
export function writeDb(data: DatabaseSchema): void {
  cachedDb = data;
  saveDbToDiskAtomic(data);
}

// Fully serialized mutation helper to prevent race conditions during concurrent user actions
export function mutateDb<T>(mutator: (db: DatabaseSchema) => T | Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    mutationQueue = mutationQueue
      .then(async () => {
        try {
          if (!cachedDb) {
            cachedDb = loadDbFromDisk();
          }
          const result = await mutator(cachedDb);
          // Persist changes atomically
          saveDbToDiskAtomic(cachedDb);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      })
      .catch((queueErr) => {
        console.error("Mutation queue internal error:", queueErr);
        reject(queueErr);
      });
  });
}

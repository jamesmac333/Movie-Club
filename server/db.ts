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

// Clean launch initial data: starting rotation with Tom Sakai first on July 17, 2026.
// No previous watched movies, no dummy reviews, and no dummy overviews.
const getInitialData = (): DatabaseSchema => {
  const initialNights: MovieNight[] = [
    {
      id: "night-1",
      date: "2026-07-17T19:00:00",
      selector: "Tom Sakai",
      movie: null,
      status: "scheduled"
    },
    {
      id: "night-2",
      date: "2026-07-31T19:00:00",
      selector: "Madison Hill",
      movie: null,
      status: "scheduled"
    },
    {
      id: "night-3",
      date: "2026-08-14T19:00:00",
      selector: "Max Smith",
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
      selector: "James Macintosh",
      movie: null,
      status: "scheduled"
    },
    {
      id: "night-6",
      date: "2026-09-25T19:00:00",
      selector: "Ash Macintosh",
      movie: null,
      status: "scheduled"
    },
    {
      id: "night-7",
      date: "2026-10-09T19:00:00",
      selector: "Tom Sakai",
      movie: null,
      status: "scheduled"
    },
    {
      id: "night-8",
      date: "2026-10-23T19:00:00",
      selector: "Madison Hill",
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

// Helper to load database
export function readDb(): DatabaseSchema {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const localFile = path.join(process.cwd(), "server-db.json");
      if (fs.existsSync(localFile) && localFile !== DB_FILE) {
        console.log(`DB_FILE not found at ${DB_FILE}. Copying initial state from bundled ${localFile}...`);
        fs.copyFileSync(localFile, DB_FILE);
      } else {
        const data = getInitialData();
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
        return data;
      }
    }
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as DatabaseSchema;
    
    // Auto-migration if users are missing in the saved JSON file
    if (!parsed.users || parsed.users.length === 0) {
      const initial = getInitialData();
      parsed.users = initial.users;
      parsed.nights = initial.nights; // reset nights as well to launch cleanly
      parsed.reviews = [];
      parsed.overviews = [];
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), "utf8");
    }
    return parsed;
  } catch (error) {
    console.error("Error reading database file, returning defaults:", error);
    return getInitialData();
  }
}

// Helper to write database
export function writeDb(data: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing to database file:", error);
  }
}

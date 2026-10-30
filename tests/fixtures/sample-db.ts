// A small club database for tests. Every member's password is "test-<username in lower case>".
import { hashPassword } from "../../server/passwords.ts";

export const MEMBERS = [
  { username: "James", name: "James Macintosh", isAdmin: true, isAsh: false },
  { username: "Ash", name: "Ash Macintosh", isAdmin: true, isAsh: true },
  { username: "Tom", name: "Tom Sakai", isAdmin: false, isAsh: false },
  { username: "Madison", name: "Madison Hill", isAdmin: false, isAsh: false },
  { username: "Max", name: "Max Smith", isAdmin: false, isAsh: false },
  { username: "Amy", name: "Amy Walsh", isAdmin: false, isAsh: false }
];

export const testPassword = (username: string) => `test-${username.toLowerCase()}`;

const movie = (title: string) => ({ title, year: 2020, director: "Someone", genre: "Drama", runtime: 100, overview: "A film.", selectedBy: "Tom" });

export function makeSampleDb() {
  return {
    users: MEMBERS.map((m) => ({ ...m, password: hashPassword(testPassword(m.username)) })),
    nights: [
      { id: "night-1", date: "2026-09-11T19:00:00", selector: "Tom Sakai", movie: movie("Parasite"), status: "watched" },
      { id: "night-2", date: "2026-10-09T19:00:00", selector: "Max Smith", movie: movie("The Long Walk"), status: "watched" },
      { id: "night-3", date: "2099-01-01T19:00:00", selector: "Ash Macintosh", movie: null, status: "scheduled" }
    ],
    reviews: [
      { id: "rev-1", movieNightId: "night-1", user: "Tom Sakai", rating: 4, comment: "Great.", createdAt: "2026-09-12T00:00:00.000Z" },
      { id: "rev-2", movieNightId: "night-2", user: "James Macintosh", rating: 4.5, comment: "Moving.", createdAt: "2026-10-10T00:00:00.000Z" }
    ],
    overviews: [
      { id: "ov-1", movieNightId: "night-2", title: "Recap", content: "A night to remember.", imageUrl: "", author: "Ash Macintosh", createdAt: "2026-10-14T00:00:00.000Z" }
    ],
    edmRecipients: [{ email: "test@example.test", name: "Test", addedAt: "2026-10-01T00:00:00.000Z" }],
    edmLogs: [] as unknown[]
  };
}

// A base64 data URL of roughly the given size, shaped like an uploaded JPEG
export function fakePhoto(megabytes: number): string {
  return "data:image/jpeg;base64," + Buffer.alloc(Math.floor(megabytes * 1024 * 1024 * 0.75), 7).toString("base64");
}

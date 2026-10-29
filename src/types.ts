import jamesAvatar from "./assets/images/avatar_james_photo_1782723740133.jpg";
import ashAvatar from "./assets/images/avatar_ash_photo_1782723670472.jpg";
import tomAvatar from "./assets/images/avatar_tom_photo_1782723727773.jpg";
import madisonAvatar from "./assets/images/avatar_madison_photo_1782723690492.jpg";
import maxAvatar from "./assets/images/avatar_max_photo_1782723701420.jpg";
import amyAvatar from "./assets/images/avatar_amy_photo_1782723714069.jpg";

export interface MovieMetadata {
  title: string;
  year: number;
  director: string;
  genre: string;
  runtime: number; // in minutes
  overview: string;
  posterUrl?: string;
  rating?: string; // e.g. "PG-13", "R"
  selectedBy: string;
  trailerUrl?: string;
}

export interface MovieNight {
  id: string;
  date: string; // ISO date format, e.g. '2026-07-17T19:00:00'
  selector: string; // e.g., 'James Macintosh'
  movie: MovieMetadata | null; // null if not chosen yet
  status: 'scheduled' | 'watched' | 'skipped';
}

export interface Review {
  id: string;
  movieNightId: string;
  user: string; // Name of the reviewer
  rating: number; // 1-5
  comment: string;
  createdAt: string;
  isStarred?: boolean;
}

export interface NightOverview {
  id: string;
  movieNightId: string;
  title: string;
  content: string;
  imageUrl: string; // Image URL or Base64
  author: string; // e.g. 'Ash Macintosh'
  createdAt: string;
}

export function isAuthenticGatheringPhoto(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "none") return false;
  // Ignore any legacy stock / AI placeholders from Unsplash
  if (trimmed.includes("unsplash.com")) return false;
  return true;
}

export interface User {
  username: string;
  name: string;
  isAdmin: boolean;
  isAsh: boolean;
  avatarUrl?: string;
}

export interface EdmRecipient {
  email: string;
  name?: string;
  addedAt?: string;
}

export interface EdmLog {
  id: string;
  type: "overview" | "movie_selection" | "test";
  subject: string;
  sentAt: string;
  recipients: string[];
  status: "sent" | "failed" | "simulated";
  previewText?: string;
  htmlContent?: string;
  error?: string;
}

export interface EdmConfig {
  recipients: EdmRecipient[];
}

export const MOVIE_CLUB_USERS: User[] = [
  { username: "James", name: "James Macintosh", isAdmin: true, isAsh: false, avatarUrl: jamesAvatar },
  { username: "Ash", name: "Ash Macintosh", isAdmin: true, isAsh: true, avatarUrl: ashAvatar },
  { username: "Tom", name: "Tom Sakai", isAdmin: false, isAsh: false, avatarUrl: tomAvatar },
  { username: "Madison", name: "Madison Hill", isAdmin: false, isAsh: false, avatarUrl: madisonAvatar },
  { username: "Max", name: "Max Smith", isAdmin: false, isAsh: false, avatarUrl: maxAvatar },
  { username: "Amy", name: "Amy Walsh", isAdmin: false, isAsh: false, avatarUrl: amyAvatar },
];

export const HOST_ROTATION = [
  "Max Smith",
  "Ash Macintosh",
  "Madison Hill",
  "Amy Walsh",
  "Tom Sakai",
  "James Macintosh"
] as const;

export const ROTATION_MEMBERS = [
  { shortName: "Max", fullName: "Max Smith", username: "Max" },
  { shortName: "Ash", fullName: "Ash Macintosh", username: "Ash" },
  { shortName: "Madi", fullName: "Madison Hill", username: "Madison" },
  { shortName: "Amy", fullName: "Amy Walsh", username: "Amy" },
  { shortName: "Tom", fullName: "Tom Sakai", username: "Tom" },
  { shortName: "James", fullName: "James Macintosh", username: "James" },
];


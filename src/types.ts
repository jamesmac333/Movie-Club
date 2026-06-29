const jamesAvatar = "/src/assets/images/avatar_james_photo_1782723740133.jpg";
const ashAvatar = "/src/assets/images/avatar_ash_photo_1782723670472.jpg";
const tomAvatar = "/src/assets/images/avatar_tom_photo_1782723727773.jpg";
const madisonAvatar = "/src/assets/images/avatar_madison_photo_1782723690492.jpg";
const maxAvatar = "/src/assets/images/avatar_max_photo_1782723701420.jpg";
const amyAvatar = "/src/assets/images/avatar_amy_photo_1782723714069.jpg";

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
}

export interface MovieNight {
  id: string;
  date: string; // ISO date format, e.g. '2026-07-17T19:00:00'
  selector: string; // e.g., 'James Macintosh'
  movie: MovieMetadata | null; // null if not chosen yet
  status: 'scheduled' | 'watched';
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

export interface User {
  username: string;
  name: string;
  isAdmin: boolean;
  isAsh: boolean;
  avatarUrl?: string;
}

export const MOVIE_CLUB_USERS: User[] = [
  { username: "James", name: "James Macintosh", isAdmin: true, isAsh: false, avatarUrl: jamesAvatar },
  { username: "Ash", name: "Ash Macintosh", isAdmin: true, isAsh: true, avatarUrl: ashAvatar },
  { username: "Tom", name: "Tom Sakai", isAdmin: false, isAsh: false, avatarUrl: tomAvatar },
  { username: "Madison", name: "Madison Hill", isAdmin: false, isAsh: false, avatarUrl: madisonAvatar },
  { username: "Max", name: "Max Smith", isAdmin: false, isAsh: false, avatarUrl: maxAvatar },
  { username: "Amy", name: "Amy Walsh", isAdmin: false, isAsh: false, avatarUrl: amyAvatar },
];

import type { MovieNight, Review } from "./types.ts";

// For a week after a night, its reviews stay hidden from a member until they've posted their
// own, so everyone rates the film without being swayed by the others
export const REVIEW_SEAL_DAYS = 7;

export function getSealedNightIds(nights: MovieNight[], reviews: Review[], userName?: string): Set<string> {
  const sealed = new Set<string>();
  if (!userName) return sealed;
  const now = Date.now();
  for (const night of nights) {
    const age = now - new Date(night.date).getTime();
    if (age < 0 || age >= REVIEW_SEAL_DAYS * 86400000) continue;
    if (!reviews.some((r) => r.movieNightId === night.id && r.user === userName)) sealed.add(night.id);
  }
  return sealed;
}

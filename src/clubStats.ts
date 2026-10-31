// Ratings maths shared by the film pages and member pages.
// Kept free of the app's other imports so the tests can load it on its own.

interface NightLike {
  id: string;
  date: string;
  selector: string;
  status: string;
  movie: { title: string } | null;
}

interface ReviewLike {
  movieNightId: string;
  user: string;
  rating: number;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const average = (values: number[]) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null);
const byDate = <T extends { date: string }>(a: T, b: T) => new Date(a.date).getTime() - new Date(b.date).getTime();

export function watchedFilms<N extends NightLike>(nights: N[]): N[] {
  return nights.filter((n) => n.status === "watched" && n.movie).sort(byDate);
}

// Everyone's ratings for one night, highest first, with the average and who liked it most and least
export function filmRatings<R extends ReviewLike>(reviews: R[], nightId: string) {
  const ratings = reviews.filter((r) => r.movieNightId === nightId).sort((a, b) => b.rating - a.rating);
  const avg = average(ratings.map((r) => r.rating));
  const top = ratings[0];
  const bottom = ratings[ratings.length - 1];
  const split = ratings.length >= 2 && top.rating !== bottom.rating ? { lovedMost: top, likedLeast: bottom, gap: top.rating - bottom.rating } : null;
  return { ratings, average: avg, split };
}

export interface MemberFilm<N> {
  night: N;
  rating: number;
  othersAverage: number | null;
}

export interface MemberSummary<N> {
  hosted: Array<{ night: N; average: number | null; count: number }>;
  rated: MemberFilm<N>[];
  averageGiven: number | null;
  highest: MemberFilm<N> | null;
  lowest: MemberFilm<N> | null;
  // How far above (positive) or below (negative) everyone else this member rates, on average
  versusClub: number | null;
}

export function memberSummary<N extends NightLike, R extends ReviewLike>(nights: N[], reviews: R[], memberName: string): MemberSummary<N> {
  const films = watchedFilms(nights);

  const hosted = films
    .filter((n) => sameName(n.selector, memberName))
    .map((night) => {
      const r = reviews.filter((x) => x.movieNightId === night.id);
      return { night, average: average(r.map((x) => x.rating)), count: r.length };
    });

  const rated: MemberFilm<N>[] = [];
  for (const night of films) {
    const nightReviews = reviews.filter((r) => r.movieNightId === night.id);
    const mine = nightReviews.find((r) => sameName(r.user, memberName));
    if (!mine) continue;
    const others = nightReviews.filter((r) => r !== mine).map((r) => r.rating);
    rated.push({ night, rating: mine.rating, othersAverage: average(others) });
  }

  // Ties go to the most recent film
  const ranked = [...rated].reverse().sort((a, b) => b.rating - a.rating);
  const compared = rated.filter((f) => f.othersAverage !== null).map((f) => f.rating - f.othersAverage!);

  return {
    hosted,
    rated,
    averageGiven: average(rated.map((f) => f.rating)),
    highest: ranked[0] || null,
    lowest: ranked.length > 1 ? ranked[ranked.length - 1] : null,
    versusClub: average(compared),
  };
}

// Fill in the gaps: a lost night is done once the member has rated it and written a few words,
// or said they weren't there
export function gapFillProgress<N extends NightLike, R extends ReviewLike & { comment?: string }>(
  nights: N[],
  reviews: R[],
  memberName: string,
  missedNights: string[] = [],
  lossDate: string
) {
  const lost = watchedFilms(nights).filter((n) => n.date.slice(0, 10) < lossDate);
  const isDone = (n: N) =>
    missedNights.includes(n.id) || reviews.some((r) => r.movieNightId === n.id && sameName(r.user, memberName) && !!r.comment?.trim());
  const remaining = lost.filter((n) => !isDone(n));
  return { total: lost.length, done: lost.length - remaining.length, remaining, complete: lost.length > 0 && remaining.length === 0 };
}

// On 14 Oct 2026 a Google AI Studio update wiped the club database. Reviews, recaps and
// photos for nights before then were lost, so the app explains gaps for those nights.
export const DATA_LOSS_DATE = "2026-10-14";
export const DATA_LOSS_NOTE =
  "On 14 October 2026 a Google AI Studio update wiped the Movie Club database. The original reviews, recaps and gathering photos from earlier nights were lost and couldn't be recovered from Google. If you remember your review, please add it again.";

export function isBeforeDataLoss(nightDate: string): boolean {
  return nightDate.slice(0, 10) < DATA_LOSS_DATE;
}

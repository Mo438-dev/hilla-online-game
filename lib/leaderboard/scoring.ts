// Leaderboard scoring (hulla-leaderboard-spec.md §3). Every tunable number lives here.
//   points = 10 × beaten + 10 × won + 2 × finished
// beaten = humans who ended with MORE cards than you (ties beat nobody and share the place).
// Bots are excluded from everything: they aren't ranked and aren't beaten.

export const PER_BEATEN = 10;
export const WIN_BONUS = 10;
export const FINISH_BONUS = 2;

// When a game counts (§3.1).
export const MIN_HUMANS = 2;
export const MIN_DURATION_MS = 90_000;
export const MIN_TURNS_PER_HUMAN = 2;
export const DAILY_CAP = 15; // counted games per player per Riyadh day
export const SAME_GROUP_DAILY_CAP = 3; // counted games per day for the exact same set of humans

export type Seat = { id: string; cardsLeft: number; inactive: boolean };
export type Score = { place: number; beaten: number; won: boolean; finished: boolean; points: number };

export function scoreHumans(humans: Seat[], winnerId: string | null): Map<string, Score> {
  const out = new Map<string, Score>();
  for (const h of humans) {
    const beaten = humans.filter((o) => o.cardsLeft > h.cardsLeft).length;
    const place = 1 + humans.filter((o) => o.cardsLeft < h.cardsLeft).length;
    const won = h.id === winnerId;
    const finished = !h.inactive;
    out.set(h.id, { place, beaten, won, finished, points: PER_BEATEN * beaten + (won ? WIN_BONUS : 0) + (finished ? FINISH_BONUS : 0) });
  }
  return out;
}

// Start of the current day in Asia/Riyadh (UTC+3, no DST), as an ISO timestamp.
export function riyadhDayStart(now = new Date()): string {
  const shifted = new Date(now.getTime() + 3 * 3600_000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - 3 * 3600_000).toISOString();
}

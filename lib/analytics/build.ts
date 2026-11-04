import { allRows, cached, loadEvents, loadSessions } from './data';
import { computeCell } from './rules';
import { findings } from './findings';

const COUNTS = [2, 3, 4, 5, 6];
const EVENT_TYPES = ['coord_changed', 'turn_started', 'items_played', 'action_played', 'block_used', 'end_snapshot', 'card_entered'];
const DAY = 86_400_000;
export const ACCOUNTS_SINCE = Date.parse('2026-10-25T00:00:00Z');

// «أبرز ملاحظة»: the latest comment from someone who rated fun 3 or less or wouldn't play again. Never praise.
function topNote(rows: any[]) {
  const unhappy = rows
    .filter((f) => f.comment?.trim() && ((f.fun != null && f.fun <= 3) || f.play_again === false))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return unhappy[0]?.comment.trim() ?? null;
}

export function buildRules(version: string, humans: boolean) {
  return cached(`rules|${version}|${humans}`, async () => {
    const all = await loadSessions();
    const versions = [...new Set(all.filter((s) => s.completed).map((s) => s.ruleset_version))].filter(Boolean).sort().reverse();
    const sessions = all.filter((s) => s.completed && s.ruleset_version === version && (!humans || s.bot_count === 0));
    const ids = sessions.map((s) => s.id);
    const events = await loadEvents(ids, EVENT_TYPES);

    // replay is per account (game_players.user_id), since accounts exist; feedback by game
    const seats = await allRows('game_players', 'id, game_id, user_id', (q) => q.not('user_id', 'is', null));
    const startedAt = new Map(all.map((s) => [s.id, Date.parse(s.started_at)]));
    const gamesOf = new Map<string, number[]>();
    for (const r of seats) {
      const t = startedAt.get(r.game_id);
      if (t != null) gamesOf.set(r.user_id, [...(gamesOf.get(r.user_id) ?? []), t]);
    }
    const feedback = await allRows('game_feedback', 'id, game_id, fun, clarity, play_again, comment, created_at');

    const cells: Record<string, any> = {};
    let zero = 0, covered = 0, entered = 0, hands = 0;
    for (const n of COUNTS) {
      const group = sessions.filter((s) => s.player_count === n);
      const cell: any = computeCell(group, events);
      zero += cell._counts.zeroTurns; covered += cell._counts.covered; entered += cell._counts.gamesEntered; hands += cell._counts.gamesHands;
      delete cell._counts;

      // accounts whose first game in this cell has a full 7 days behind it
      const inCell = new Set(group.map((s) => s.id));
      const first = new Map<string, number>();
      for (const r of seats) {
        const t = startedAt.get(r.game_id);
        if (t == null || !inCell.has(r.game_id) || t < ACCOUNTS_SINCE) continue;
        if (!first.has(r.user_id) || t < first.get(r.user_id)!) first.set(r.user_id, t);
      }
      const cohort = [...first.entries()].filter(([, t]) => t <= Date.now() - 7 * DAY);
      const back = cohort.filter(([u, t]) => (gamesOf.get(u) ?? []).some((x) => x > t && x <= t + 7 * DAY));
      cell.replay7 = cohort.length ? back.length / cohort.length : null;
      cell.replayN = cohort.length;

      const fb = feedback.filter((f) => inCell.has(f.game_id));
      const avg = (k: string) => { const v = fb.map((f) => f[k]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
      const yn = fb.filter((f) => f.play_again != null);
      const humanSeats = group.reduce((a, s) => a + (s.human_count ?? 0), 0);
      cell.fun = avg('fun');
      cell.clarity = avg('clarity');
      cell.wouldReplay = yn.length ? yn.filter((f) => f.play_again).length / yn.length : null;
      cell.surveyN = fb.length;
      cell.response = humanSeats ? fb.length / humanSeats : null;
      cell.note = topNote(fb);
      cells[n] = cell;
    }
    const games = sessions.length;
    return {
      cells,
      versions,
      coverage: {
        turnPayload: zero ? covered / zero : null,
        cardEntered: games ? entered / games : null,
        hands: games ? hands / games : null,
        games,
      },
    };
  });
}

export async function buildFindings(version: string, humans: boolean) {
  const cur = await buildRules(version, humans);
  // the version before this one; v1 is never a comparison base
  const i = cur.versions.indexOf(version);
  const before = i >= 0 ? cur.versions[i + 1] : null;
  const prevVersion = before && before !== 'v1' ? before : null;
  const prev = prevVersion ? await buildRules(prevVersion, humans) : null;
  return { version, prevVersion, findings: findings(cur.cells, prev?.cells) };
}

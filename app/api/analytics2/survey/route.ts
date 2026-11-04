export const dynamic = 'force-dynamic';

import { allRows, cached, filterKey, filterSessions, isAdmin, json, loadSessions } from '@/lib/analytics/data';

async function build(url: URL) {
  const sessions = filterSessions(await loadSessions(), url);
  const byGame = new Map(sessions.map((s) => [s.id, s]));
  const fb = (await allRows('game_feedback', '*')).filter((f) => byGame.has(f.game_id));
  const seats = await allRows('game_players', 'id, game_id, player_id, player_name');
  const nameOf = new Map(seats.map((s) => [`${s.game_id}|${s.player_id}`, s.player_name]));
  const avg = (k: string) => { const v = fb.map((f) => f[k]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const yn = fb.filter((f) => f.play_again != null);
  const humanSeats = sessions.filter((s) => s.completed).reduce((a, s) => a + (s.human_count ?? 0), 0);

  // drop-off exists only since delta-14 added steps_answered
  const tracked = fb.filter((f) => f.steps_answered != null);
  const dropoff = [0, 1, 2, 3, 4].map((steps) => ({ steps, n: tracked.filter((f) => f.steps_answered === steps).length }));
  const skippedAt = [0, 1, 2, 3].map((step) => ({ step, n: tracked.filter((f) => f.skipped_at_step === step).length }));

  return {
    kpis: {
      n: fb.length, fun: avg('fun'), clarity: avg('clarity'),
      wouldReplay: yn.length ? yn.filter((f) => f.play_again).length / yn.length : null, wouldReplayN: yn.length,
      comments: fb.filter((f) => f.comment?.trim()).length, response: humanSeats ? fb.length / humanSeats : null, humanSeats,
    },
    tracked: tracked.length, dropoff, skippedAt,
    comments: fb
      .filter((f) => f.comment?.trim())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((f) => {
        const s = byGame.get(f.game_id);
        return { text: f.comment.trim(), name: nameOf.get(`${f.game_id}|${f.player_id}`) ?? null, version: s.ruleset_version, players: s.player_count, at: Date.parse(f.created_at), fun: f.fun };
      }),
  };
}

// GET /api/analytics2/survey?version=
export async function GET(request: Request) {
  if (!(await isAdmin())) return json({ error: 'unauthorized' }, 401);
  try {
    const url = new URL(request.url);
    return json(await cached(`survey|${filterKey(url)}`, () => build(url)));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'unknown_error' }, 500);
  }
}

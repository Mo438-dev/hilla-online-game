export const dynamic = 'force-dynamic';

import { allRows, cached, filterKey, filterSessions, isAdmin, json, loadAccounts, loadSessions } from '@/lib/analytics/data';
import { median } from '@/lib/analytics/rules';

async function build(url: URL) {
  const sessions = filterSessions(await loadSessions(), url);
  const ids = new Set(sessions.map((s) => s.id));
  const done = sessions.filter((s) => s.completed);
  const { profiles, resolve } = await loadAccounts();
  const seats = (await allRows('game_players', 'id, game_id, user_id', (q) => q.not('user_id', 'is', null))).filter((r) => ids.has(r.game_id));
  const startedAt = new Map(sessions.map((s) => [s.id, s]));

  const played = new Set<string>(), finished = new Set<string>(), days = new Map<string, Set<string>>();
  for (const r of seats) {
    const p = resolve(r.user_id);
    if (!p) continue;
    const s = startedAt.get(r.game_id);
    played.add(p.user_id);
    if (s.completed) finished.add(p.user_id);
    const d = new Date(Date.parse(s.started_at) + 3 * 3600_000).toISOString().slice(0, 10);
    days.set(p.user_id, (days.get(p.user_id) ?? new Set()).add(d));
  }
  const returned = [...days.values()].filter((d) => d.size >= 2).length;

  const versions: Record<string, number> = {};
  for (const s of sessions) versions[s.ruleset_version] = (versions[s.ruleset_version] ?? 0) + 1;

  return {
    // no ids: just when each game started and whether it finished, for the daily bars and the heatmap
    games: sessions.map((s) => ({ t: Date.parse(s.started_at), done: !!s.completed })),
    kpis: {
      started: sessions.length, finished: done.length,
      medianMin: median(done.filter((s) => s.duration_seconds != null).map((s) => s.duration_seconds / 60)),
      medianTurns: median(done.filter((s) => s.total_turns != null).map((s) => s.total_turns)),
      humanSeats: done.reduce((a, s) => a + (s.human_count ?? 0), 0),
    },
    funnel: [
      { label: 'حساب انفتح', n: profiles.filter((p) => !p.merged_into).length },
      { label: 'لعب مباراة', n: played.size },
      { label: 'خلّص مباراة', n: finished.size },
      { label: 'رجع بيوم ثاني', n: returned },
    ],
    versions,
  };
}

// GET /api/analytics2/activity: aggregates for the النشاط tab (added next to the five spec routes)
export async function GET(request: Request) {
  if (!(await isAdmin())) return json({ error: 'unauthorized' }, 401);
  try {
    const url = new URL(request.url);
    return json(await cached(`activity|${filterKey(url)}`, () => build(url)));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'unknown_error' }, 500);
  }
}

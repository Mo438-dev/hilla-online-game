export const dynamic = 'force-dynamic';

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { allRows, cached, isAdmin, json, loadAccounts, loadSessions } from '@/lib/analytics/data';

async function build() {
  const errors = await allRows('client_errors', 'id, created_at, session_id, user_id, platform, standalone, message, app_build');
  const { resolve } = await loadAccounts();
  const groups = new Map<string, any>();
  for (const e of errors) {
    const g = groups.get(e.message) ?? { message: e.message, count: 0, _players: new Set(), lastSeen: 0, _platforms: new Set() };
    groups.set(e.message, g);
    g.count++;
    const name = resolve(e.user_id)?.nickname;
    if (name) g._players.add(name);
    g.lastSeen = Math.max(g.lastSeen, Date.parse(e.created_at));
    if (e.platform) g._platforms.add(e.platform === 'ios' ? (e.standalone ? 'ios_app' : 'ios_safari') : e.platform);
  }
  const sessions = await loadSessions();
  const { count: rejected } = await getSupabaseAdmin().from('game_events').select('id', { count: 'exact', head: true }).eq('event_type', 'state_rejected');
  return {
    totals: {
      errors: errors.length,
      players: new Set(errors.map((e) => e.user_id).filter(Boolean)).size,
      gamesWithError: new Set(errors.map((e) => e.session_id).filter(Boolean)).size,
      games: sessions.length,
      rejected: rejected ?? 0,
    },
    groups: [...groups.values()]
      .sort((a, b) => b.count - a.count)
      .map((g) => ({ message: g.message, count: g.count, players: [...g._players], lastSeen: g.lastSeen, platforms: [...g._platforms] })),
  };
}

// GET /api/analytics2/errors: client_errors grouped by message
export async function GET() {
  if (!(await isAdmin())) return json({ error: 'unauthorized' }, 401);
  try {
    return json(await cached('errors', build));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'unknown_error' }, 500);
  }
}

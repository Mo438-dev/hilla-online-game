export const dynamic = 'force-dynamic';

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { allRows, cached, clearCache, filterKey, filterSessions, isAdmin, json, loadAccounts, loadEvents } from '@/lib/analytics/data';
import { ACCOUNTS_SINCE } from '@/lib/analytics/build';

const UUID = /^[0-9a-f-]{36}$/i;

// Why a game did or didn't count. The first four are the spec's; the rest say what the results really hold.
function countState(s: any, results: any[], humanSeats: number) {
  const online = !!s.room_code;
  const after = Date.parse(s.started_at) >= ACCOUNTS_SINCE;
  const missing = !!s.completed && online && after && (s.human_count ?? 0) >= 2 && results.length < humanSeats;
  if (!s.completed) return { counted: false, reason: 'not_finished', missing_results: false };
  if ((s.human_count ?? 0) < 2) return { counted: false, reason: 'bots_only', missing_results: false };
  if (!online) return { counted: false, reason: 'same_device', missing_results: false };
  if (!after) return { counted: false, reason: 'before_accounts', missing_results: false };
  if (results.some((r) => r.counted)) return { counted: true, reason: null, missing_results: missing };
  const raw = results.find((r) => r.reason)?.reason ?? null;
  const reason = raw === 'same_group_cap' || raw === 'daily_cap' ? 'group_limit' : raw === 'too_few_humans' ? 'bots_only' : raw;
  return { counted: false, reason, missing_results: missing };
}

async function build(url: URL) {
  const show = url.searchParams.get('show') || 'all';
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50));
  const before = url.searchParams.get('before');
  // test games are listed so the toggle can be undone, but stay out of the totals
  const sessions = filterSessions(await allRows('game_sessions', '*'), url).sort((a, b) => b.started_at.localeCompare(a.started_at));
  const ids = new Set(sessions.map((s) => s.id));
  const { resolve } = await loadAccounts();
  const seats = (await allRows('game_players', '*')).filter((r) => ids.has(r.game_id));
  const results = (await allRows('game_results', 'id, game_id, user_id, points, counted, reason')).filter((r) => ids.has(r.game_id));
  const group = (rows: any[]) => { const m = new Map<string, any[]>(); for (const r of rows) m.set(r.game_id, [...(m.get(r.game_id) ?? []), r]); return m; };
  const seatsOf = group(seats), resultsOf = group(results);

  const list = sessions.map((s) => {
    const humans = (seatsOf.get(s.id) ?? []).filter((x) => !x.is_bot).length;
    return { s, ...countState(s, resultsOf.get(s.id) ?? [], humans) };
  });
  const real = list.filter((x) => !x.s.is_test);
  const totals = {
    started: real.length,
    counted: real.filter((x) => x.counted && !x.missing_results).length,
    missing: real.filter((x) => x.missing_results).length,
    notFinished: real.filter((x) => !x.s.completed).length,
  };
  const shown = list.filter((x) => (show === 'missing' ? x.missing_results : show === 'nocount' ? !x.counted && x.s.completed : show === 'open' ? !x.s.completed : true));
  const after = before ? shown.filter((x) => x.s.started_at < before) : shown;
  const page = after.slice(0, limit);

  // Seat numbers older than delta-14 come from the events of the games on this page.
  const events = await loadEvents(page.map((x) => x.s.id), ['end_snapshot', 'items_played', 'action_played']);
  const sessionsOut = page.map(({ s, counted, reason, missing_results }) => {
    const ev = events.get(s.id) ?? [];
    const standings = ev.find((e) => e.event_type === 'end_snapshot')?.payload?.standings ?? [];
    const lastItems = ev.filter((e) => e.event_type === 'items_played').sort((a, b) => (a.turn_number ?? 0) - (b.turn_number ?? 0)).pop()?.items ?? [];
    const res = new Map<string, any>();
    for (const r of resultsOf.get(s.id) ?? []) { const p = resolve(r.user_id); if (p) res.set(p.user_id, r); }
    const left = [...standings].map((x: any) => x.hand_size).sort((a: number, b: number) => a - b);
    const seatsOut = (seatsOf.get(s.id) ?? []).map((x) => {
      const p = resolve(x.user_id);
      const st = standings.find((y: any) => y.player_id === x.player_id);
      const r = p ? res.get(p.user_id) : null;
      const actions = x.actions_played ?? ev.filter((e) => e.event_type === 'action_played' && e.player_id === x.player_id).reduce((o: any, e) => ({ ...o, [e.action_type]: (o[e.action_type] ?? 0) + 1 }), {});
      return {
        name: x.is_bot ? x.player_name : p?.nickname ?? x.player_name,
        ref: p?.public_id ?? null,
        bot: !!x.is_bot,
        place: x.place ?? (st ? left.indexOf(st.hand_size) + 1 : null),
        cards_left: x.cards_left ?? st?.hand_size ?? null,
        items_played: x.items_played ?? ev.filter((e) => e.event_type === 'items_played' && e.player_id === x.player_id).reduce((n, e) => n + (e.items?.length ?? 0), 0),
        actions,
        points: r?.counted ? r.points : null,
        hasResult: !!r,
      };
    });
    return {
      id: s.id, code: s.room_code, startedAt: Date.parse(s.started_at), version: s.ruleset_version, finished: !!s.completed,
      durMin: s.duration_seconds != null ? s.duration_seconds / 60 : null, turns: s.total_turns, bots: s.bot_count, winner: s.winner_name,
      lastItem: lastItems[lastItems.length - 1]?.name ?? null, counted, reason, missing_results, is_test: !!s.is_test, seats: seatsOut,
    };
  });
  return { totals, sessions: sessionsOut, total: after.length, nextBefore: after.length > limit ? page[page.length - 1].s.started_at : null };
}

// GET /api/analytics2/matches?limit=50&before=…&show=all|missing|nocount|open
export async function GET(request: Request) {
  if (!(await isAdmin())) return json({ error: 'unauthorized' }, 401);
  try {
    const url = new URL(request.url);
    const key = `matches|${filterKey(url)}|${url.searchParams.get('show')}|${url.searchParams.get('limit')}|${url.searchParams.get('before')}`;
    return json(await cached(key, () => build(url)));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'unknown_error' }, 500);
  }
}

// POST { id, is_test }: the «تجربة» toggle. Clears the cache so every metric drops the game right away.
export async function POST(request: Request) {
  if (!(await isAdmin())) return json({ error: 'unauthorized' }, 401);
  try {
    const body = (await request.json()) as { id?: unknown; is_test?: unknown };
    if (typeof body.id !== 'string' || !UUID.test(body.id) || typeof body.is_test !== 'boolean') return json({ error: 'bad_request' }, 400);
    const { error } = await getSupabaseAdmin().from('game_sessions').update({ is_test: body.is_test }).eq('id', body.id);
    if (error) throw new Error(error.message);
    clearCache();
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'unknown_error' }, 500);
  }
}

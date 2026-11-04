export const dynamic = 'force-dynamic';

import { allRows, allRowsNoId, cached, filterKey, filterSessions, isAdmin, json, loadAccounts, loadSessions } from '@/lib/analytics/data';
import { median } from '@/lib/analytics/rules';
import { ACCOUNTS_SINCE } from '@/lib/analytics/build';

const device = (platform: string | null, standalone: boolean | null) => (platform === 'ios' ? (standalone ? 'ios_app' : 'ios_safari') : platform);

// Two accounts that are probably one person: similar names, never at the same table. Information only.
function duplicateSuspects(rows: any[]) {
  const norm = (s: string | null) => (s || '').replace(/[^ء-ي]/g, '').replace(/[ةه]$/, '').replace(/ي$/, '').replace(/ت$/, '');
  const out: { a: string; b: string; commonFriends: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j];
      const na = norm(a.name), nb = norm(b.name);
      if (!na || !nb) continue;
      const similar = na.startsWith(nb) || nb.startsWith(na) || a.otherNames.some((x: string) => norm(x) === nb);
      if (!similar || a.opponents.some((o: any) => o.ref === b.ref)) continue;
      const theirs = new Set(b.opponents.map((o: any) => o.ref));
      out.push({ a: a.ref, b: b.ref, commonFriends: a.opponents.filter((o: any) => theirs.has(o.ref)).length });
    }
  }
  return out;
}

async function build(url: URL) {
  const sessions = filterSessions(await loadSessions(), url);
  const byGame = new Map(sessions.map((s) => [s.id, s]));
  const { resolve } = await loadAccounts();
  const seats = (await allRows('game_players', '*')).filter((r) => byGame.has(r.game_id));
  const results = await allRows('game_results', 'id, game_id, user_id, points, counted, finished_at');
  const feedback = await allRows('game_feedback', 'id, game_id, player_id, fun, comment, created_at');
  const identity = await allRows('game_events', 'id, game_id, player_id, payload', (q) => q.eq('event_type', 'player_identity'));
  const seasons = await allRowsNoId('seasons', 'starts_at, ends_at');
  const now = new Date().toISOString();
  const season = seasons.find((s) => s.starts_at <= now && now < s.ends_at);

  const seatsByGame = new Map<string, any[]>();
  for (const r of seats) seatsByGame.set(r.game_id, [...(seatsByGame.get(r.game_id) ?? []), r]);
  const resultOf = new Map<string, any>();
  const rows = new Map<string, any>();
  for (const r of results) {
    const p = resolve(r.user_id);
    if (p) resultOf.set(`${r.game_id}|${p.user_id}`, r);
  }
  const clientOf = new Map<string, string>();
  for (const e of identity) if (e.payload?.client_pid) clientOf.set(`${e.game_id}|${e.player_id}`, e.payload.client_pid);

  for (const seat of seats) {
    const p = resolve(seat.user_id);
    if (!p) continue;
    const s = byGame.get(seat.game_id);
    const t = Date.parse(s.started_at);
    const row =
      rows.get(p.user_id) ??
      {
        ref: p.public_id ?? null, name: p.nickname ?? null, username: p.username ?? null, createdAt: Date.parse(p.created_at),
        firstAt: t, lastAt: t, lastSeat: 0, platform: device(p.created_platform, p.created_standalone),
        games: 0, completed: 0, wins: 0, points: 0, _days: new Set(), _left: [], actions: {}, _names: new Set(), _clients: new Set(), _opp: new Map(), _recent: [], _fb: [],
      };
    rows.set(p.user_id, row);
    row.games++;
    row.firstAt = Math.min(row.firstAt, t);
    row.lastAt = Math.max(row.lastAt, t);
    if (seat.platform && t >= row.lastSeat) { row.platform = device(seat.platform, seat.standalone); row.lastSeat = t; }
    row._days.add(new Date(t + 3 * 3600_000).toISOString().slice(0, 10));
    if (seat.player_name && seat.player_name !== p.nickname) row._names.add(seat.player_name);
    const client = clientOf.get(`${seat.game_id}|${seat.player_id}`);
    if (client) row._clients.add(client);
    for (const [k, v] of Object.entries<any>(seat.actions_played ?? {})) row.actions[k] = (row.actions[k] ?? 0) + v;
    const result = resultOf.get(`${seat.game_id}|${p.user_id}`);
    if (s.completed) {
      row.completed++;
      if (seat.won) row.wins++;
      else if (seat.cards_left != null) row._left.push(seat.cards_left);
      for (const q of seatsByGame.get(seat.game_id) ?? []) {
        const other = resolve(q.user_id);
        if (!other || other.user_id === p.user_id) continue;
        const o = row._opp.get(other.user_id) ?? { ref: other.public_id ?? null, name: other.nickname ?? null, together: 0, myWins: 0, theirWins: 0 };
        o.together++;
        if (seat.won) o.myWins++;
        if (q.won) o.theirWins++;
        row._opp.set(other.user_id, o);
      }
    }
    row._recent.push({
      at: t,
      place: seat.place ?? (seat.won ? 1 : null),
      others: (seatsByGame.get(seat.game_id) ?? []).filter((q) => q.id !== seat.id).map((q) => (q.is_bot ? q.player_name : resolve(q.user_id)?.nickname ?? q.player_name)),
      durMin: s.duration_seconds != null ? s.duration_seconds / 60 : null,
      finished: !!s.completed,
      points: result?.counted ? result.points : null,
      hasResult: !!result,
      missing: !!s.completed && !result && !!s.room_code && t >= ACCOUNTS_SINCE,
    });
    for (const f of feedback) if (f.game_id === seat.game_id && f.player_id === seat.player_id) row._fb.push(f);
  }
  // season points are the season's, whatever the header filters say
  for (const r of results) {
    const p = resolve(r.user_id);
    const row = p && rows.get(p.user_id);
    if (row && r.counted && season && r.finished_at >= season.starts_at && r.finished_at < season.ends_at) row.points += r.points;
  }

  const out = [...rows.values()].map((r) => {
    const funs = r._fb.map((f: any) => f.fun).filter((x: any) => x != null);
    return {
      ref: r.ref, name: r.name, username: r.username, createdAt: r.createdAt, firstAt: r.firstAt, lastAt: r.lastAt, platform: r.platform,
      games: r.games, completed: r.completed, wins: r.wins, points: r.points, days: r._days.size, leftOnLoss: median(r._left), actions: r.actions,
      otherNames: [...r._names], browsers: r._clients.size,
      surveyCount: r._fb.length, avgFun: funs.length ? funs.reduce((a: number, b: number) => a + b, 0) / funs.length : null,
      comments: r._fb.filter((f: any) => f.comment).map((f: any) => ({ text: f.comment, at: Date.parse(f.created_at) })),
      opponents: [...r._opp.values()].sort((a: any, b: any) => b.together - a.together),
      recent: r._recent.sort((a: any, b: any) => b.at - a.at).slice(0, 14),
    };
  });
  return { rows: out, duplicates: duplicateSuspects(out) };
}

// GET /api/analytics2/players: one row per account, keyed by ref. Never a user id or an email.
export async function GET(request: Request) {
  if (!(await isAdmin())) return json({ error: 'unauthorized' }, 401);
  try {
    const url = new URL(request.url);
    return json(await cached(`players|${filterKey(url)}`, () => build(url)));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'unknown_error' }, 500);
  }
}

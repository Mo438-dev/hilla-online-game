export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getRequestUser } from '@/lib/auth-server';

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' };
const DAY_MS = 86_400_000;

// GET /api/leaderboard?period=season|all&season=1448&limit=50
// Top N plus the caller's own row and rank (even outside the top N), and for the season view the
// days left. Rows carry nickname, points, games, wins and rank only: never user_id or email.
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') === 'all' ? 'all' : 'season';
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50));
    const supabase = getSupabaseAdmin();

    let from: string | null = null;
    let to: string | null = null;
    let season: { hijriYear: number; daysLeft: number } | null = null;
    if (period === 'season') {
      const asked = Number(url.searchParams.get('season'));
      const q = supabase.from('seasons').select('hijri_year, starts_at, ends_at');
      const nowIso = new Date().toISOString();
      const { data: s, error } =
        Number.isInteger(asked) && asked > 0 ? await q.eq('hijri_year', asked).maybeSingle() : await q.lte('starts_at', nowIso).gt('ends_at', nowIso).maybeSingle();
      if (error) throw error;
      if (!s) return NextResponse.json({ error: 'no_season' }, { status: 404, headers: noStore });
      from = s.starts_at;
      to = s.ends_at;
      season = { hijriYear: s.hijri_year, daysLeft: Math.max(0, Math.ceil((Date.parse(s.ends_at) - Date.now()) / DAY_MS)) };
    }

    const user = await getRequestUser(request);

    // ?scope=friends: the caller plus everyone who shared at least one counted online game with them
    // this season, ranked among themselves. Same row shape and nickname rule as the global board.
    if (url.searchParams.get('scope') === 'friends') {
      return NextResponse.json(await friendsBoard(supabase, user?.id ?? null, from, to, season, limit), { headers: noStore });
    }

    const { data, error } = await supabase.rpc('leaderboard_rows', { p_from: from, p_to: to });
    if (error) throw error;    const rows = ((data ?? []) as any[]).sort((a, b) => a.rank - b.rank || b.wins - a.wins);
    const handles = await usernamesFor(supabase, rows.slice(0, limit).map((r) => r.user_id).concat(user ? [user.id] : []));
    const strip = (r: any) => ({ nickname: r.nickname, username: handles.get(r.user_id) ?? null, points: Number(r.points), games: Number(r.games), wins: Number(r.wins), rank: Number(r.rank) });

    const mine = user ? rows.find((r) => r.user_id === user.id) : null;
    // «باقي لك ١٢ نقطة توصل للمركز ٤٠»: points to the next rank up.
    const above = mine ? [...rows].reverse().find((r) => Number(r.points) > Number(mine.points)) : null;

    return NextResponse.json(
      {
        period,
        season,
        top: rows.slice(0, limit).map(strip),
        me: mine ? { ...strip(mine), toNext: above ? { points: Number(above.points) - Number(mine.points), rank: Number(above.rank) } : null } : null,
        total: rows.length
      },
      { headers: noStore }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    return NextResponse.json({ error: message }, { status: 500, headers: noStore });
  }
}

type BoardRow = { user_id: string; nickname: string; points: number; games: number; wins: number; rank: number };

async function friendsBoard(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string | null,
  from: string | null,
  to: string | null,
  season: { hijriYear: number; daysLeft: number } | null,
  limit: number
) {
  const empty = { scope: 'friends', season, top: [], me: null, total: 0, friends: 0 };
  if (!userId || !from || !to) return empty;
  const inSeason = (q: any) => q.eq('counted', true).gte('finished_at', from).lt('finished_at', to);

  // my counted games this season → everyone with a counted row in those games
  const { data: mine, error: e1 } = await inSeason(supabase.from('game_results').select('game_id').eq('user_id', userId));
  if (e1) throw e1;
  const gameIds = [...new Set((mine ?? []).map((r: any) => r.game_id))];
  if (!gameIds.length) return empty;
  const { data: shared, error: e2 } = await inSeason(supabase.from('game_results').select('user_id').in('game_id', gameIds));
  if (e2) throw e2;
  const circle = [...new Set([userId, ...(shared ?? []).map((r: any) => r.user_id)])];

  // their whole season (not only the shared games), summed per player
  const { data: results, error: e3 } = await inSeason(supabase.from('game_results').select('user_id, points, place').in('user_id', circle));
  if (e3) throw e3;
  const { data: profiles, error: e4 } = await supabase.from('profiles').select('user_id, nickname, username, hidden').in('user_id', circle);
  if (e4) throw e4;
  const nick = new Map((profiles ?? []).filter((p: any) => p.nickname && !p.hidden).map((p: any) => [p.user_id, p.nickname]));
  const handle = new Map((profiles ?? []).map((p: any) => [p.user_id, p.username ?? null]));

  const totals = new Map<string, { points: number; games: number; wins: number }>();
  for (const r of results ?? []) {
    if (!nick.has(r.user_id)) continue;
    const t = totals.get(r.user_id) ?? { points: 0, games: 0, wins: 0 };
    t.points += r.points;
    t.games += 1;
    if (r.place === 1) t.wins += 1;
    totals.set(r.user_id, t);
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1].points - a[1].points || b[1].wins - a[1].wins);
  const rows: BoardRow[] = [];
  sorted.forEach(([id, t], i) => {
    // rank() semantics: equal points share a rank
    const rank = i > 0 && t.points === sorted[i - 1][1].points ? rows[i - 1].rank : i + 1;
    rows.push({ user_id: id, nickname: nick.get(id)!, ...t, rank });
  });

  const strip = (r: BoardRow) => ({ nickname: r.nickname, username: handle.get(r.user_id) ?? null, points: r.points, games: r.games, wins: r.wins, rank: r.rank });
  const me = rows.find((r) => r.user_id === userId) ?? null;
  const above = me ? [...rows].reverse().find((r) => r.points > me.points) : null;
  return {
    scope: 'friends',
    season,
    top: rows.slice(0, limit).map(strip),
    me: me ? { ...strip(me), toNext: above ? { points: above.points - me.points, rank: above.rank } : null } : null,
    total: rows.length,
    friends: rows.filter((r) => r.user_id !== userId).length
  };
}

async function usernamesFor(supabase: ReturnType<typeof getSupabaseAdmin>, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, string | null>();
  const { data } = await supabase.from('profiles').select('user_id, username').in('user_id', unique);
  return new Map((data ?? []).map((p: any) => [p.user_id, p.username ?? null]));
}

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

    const { data, error } = await supabase.rpc('leaderboard_rows', { p_from: from, p_to: to });
    if (error) throw error;
    const rows = ((data ?? []) as any[]).sort((a, b) => a.rank - b.rank || b.wins - a.wins);
    const strip = (r: any) => ({ nickname: r.nickname, points: Number(r.points), games: Number(r.games), wins: Number(r.wins), rank: Number(r.rank) });

    const user = await getRequestUser(request);
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

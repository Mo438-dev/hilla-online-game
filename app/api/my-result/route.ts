export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getRequestUser } from '@/lib/auth-server';
import { headToHead } from '@/lib/leaderboard/duel';

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' };

// GET /api/my-result?gameId=<uuid> — the caller's own result for one game, for the win screen
// («+٣ نقاط في الترتيب», or why it didn't count). When exactly one other real player with an account
// was in the game, also the season head-to-head with them («المواجهة: أنت ٥ · نجودي ٣»).
// 204 while it isn't written yet (or there is no account/row).
export async function GET(request: Request) {
  const gameId = new URL(request.url).searchParams.get('gameId') || '';
  if (!/^[0-9a-f-]{36}$/i.test(gameId)) return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: noStore });
  const user = await getRequestUser(request);
  if (!user) return new NextResponse(null, { status: 204, headers: noStore });
  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase.from('game_results').select('user_id, points, counted, place, reason, humans').eq('game_id', gameId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noStore });
  const mine = (rows ?? []).find((r) => r.user_id === user.id);
  if (!mine) return new NextResponse(null, { status: 204, headers: noStore });

  let duel: { name: string; me: number; them: number } | null = null;
  const others = (rows ?? []).filter((r) => r.user_id !== user.id);
  if (mine.humans === 2 && others.length === 1) {
    try {
      const { data: prof } = await supabase.from('profiles').select('nickname, hidden').eq('user_id', others[0].user_id).maybeSingle();
      if (prof?.nickname && !prof.hidden) {
        const d = await headToHead(user.id, others[0].user_id);
        if (d.games > 0) duel = { name: prof.nickname, me: d.myWins, them: d.theirWins };
      }
    } catch {
      // the head-to-head line is extra; never fail the result over it
    }
  }
  const { points, counted, place, reason } = mine;
  return NextResponse.json({ points, counted, place, reason, duel }, { headers: noStore });
}

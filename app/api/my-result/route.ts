export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getRequestUser } from '@/lib/auth-server';

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' };

// GET /api/my-result?gameId=<uuid> — the caller's own result for one game, for the win screen line
// «+٣٢ نقطة في الترتيب». 204 while it isn't written yet (or there is no account/row).
export async function GET(request: Request) {
  const gameId = new URL(request.url).searchParams.get('gameId') || '';
  if (!/^[0-9a-f-]{36}$/i.test(gameId)) return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: noStore });
  const user = await getRequestUser(request);
  if (!user) return new NextResponse(null, { status: 204, headers: noStore });
  const { data, error } = await getSupabaseAdmin()
    .from('game_results')
    .select('points, counted, place, reason')
    .eq('game_id', gameId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noStore });
  if (!data) return new NextResponse(null, { status: 204, headers: noStore });
  return NextResponse.json(data, { headers: noStore });
}

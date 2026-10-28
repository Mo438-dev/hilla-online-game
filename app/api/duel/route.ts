export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getRequestUser } from '@/lib/auth-server';
import { nicknameKey } from '@/lib/leaderboard/nickname';
import { headToHead } from '@/lib/leaderboard/duel';

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' };

// GET /api/duel?with=<userId> (win screen: the seat's account) or ?nick=<nickname> (leaderboard).
// The caller's head-to-head with that player: counted games they played together this season.
export async function GET(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: noStore });
    const url = new URL(request.url);
    let themId = url.searchParams.get('with') || '';
    const nick = url.searchParams.get('nick');
    if (!themId && nick) {
      const { data } = await getSupabaseAdmin().from('profiles').select('user_id').eq('nickname_key', nicknameKey(nick)).maybeSingle();
      themId = data?.user_id || '';
    }
    if (!/^[0-9a-f-]{36}$/i.test(themId)) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore });
    return NextResponse.json(await headToHead(user.id, themId), { headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    return NextResponse.json({ error: message }, { status: 500, headers: noStore });
  }
}

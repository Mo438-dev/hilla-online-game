export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getRequestUser } from '@/lib/auth-server';
import { nicknameKey } from '@/lib/leaderboard/nickname';
import { headToHead } from '@/lib/leaderboard/duel';

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' };

// GET /api/duel?with=<userId> (win screen: the seat's account) or ?user=<username> (leaderboard).
// ?nick= is a fallback for rows without a username. Returns the head-to-head plus both @handles.
export async function GET(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: noStore });
    const url = new URL(request.url);
    const supabase = getSupabaseAdmin();
    let themId = url.searchParams.get('with') || '';
    const handle = url.searchParams.get('user');
    const nick = url.searchParams.get('nick');
    if (!themId && handle) {
      const { data } = await supabase.from('profiles').select('user_id').eq('username', handle.toLowerCase()).maybeSingle();
      themId = data?.user_id || '';
    } else if (!themId && nick) {
      // names can repeat now: only answer when exactly one player has it
      const { data } = await supabase.from('profiles').select('user_id').eq('nickname_key', nicknameKey(nick)).limit(2);
      if ((data ?? []).length > 1) return NextResponse.json({ error: 'ambiguous' }, { status: 409, headers: noStore });
      themId = data?.[0]?.user_id || '';
    }
    if (!/^[0-9a-f-]{36}$/i.test(themId)) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore });
    const { data: profs } = await supabase.from('profiles').select('user_id, username').in('user_id', [user.id, themId]);
    const handleOf = (id: string) => (profs ?? []).find((p: any) => p.user_id === id)?.username ?? null;
    return NextResponse.json({ ...(await headToHead(user.id, themId)), meUser: handleOf(user.id), themUser: handleOf(themId) }, { headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    return NextResponse.json({ error: message }, { status: 500, headers: noStore });
  }
}

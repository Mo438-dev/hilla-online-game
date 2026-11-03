export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getRequestUser } from '@/lib/auth-server';
import { headToHead } from '@/lib/leaderboard/duel';

const UUID = /^[0-9a-f-]{36}$/i;
const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' };

// GET /api/duel?with=<userId> (win screen: the seat's account), or from the leaderboard ?user=<username>
// or ?ref=<public id>. Anyone not found gets the empty record, never an error. Returns the head-to-head
// plus both @handles.
export async function GET(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: noStore });
    const url = new URL(request.url);
    const supabase = getSupabaseAdmin();
    let themId = url.searchParams.get('with') || '';
    const handle = url.searchParams.get('user');
    const ref = url.searchParams.get('ref');
    if (!themId && handle) {
      const { data } = await supabase.from('profiles').select('user_id').eq('username', handle.toLowerCase()).maybeSingle();
      themId = data?.user_id || '';
    } else if (!themId && ref && UUID.test(ref)) {
      const { data } = await supabase.from('profiles').select('user_id').eq('public_id', ref).maybeSingle();
      themId = data?.user_id || '';
    }
    if (!UUID.test(themId)) return NextResponse.json({ games: 0, myWins: 0, theirWins: 0, myPts: 0, theirPts: 0, last: [], meUser: null, themUser: null }, { headers: noStore });
    const { data: profs } = await supabase.from('profiles').select('user_id, username').in('user_id', [user.id, themId]);
    const handleOf = (id: string) => (profs ?? []).find((p: any) => p.user_id === id)?.username ?? null;
    return NextResponse.json({ ...(await headToHead(user.id, themId)), meUser: handleOf(user.id), themUser: handleOf(themId) }, { headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    return NextResponse.json({ error: message }, { status: 500, headers: noStore });
  }
}

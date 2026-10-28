export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getRequestUser } from '@/lib/auth-server';

// POST /api/account/merge-guest {guestToken} — a guest who signs into an EXISTING account on this
// device. The caller's Bearer token is the account; guestToken is the guest session captured before
// switching, which proves the guest id. The guest's results move to the account (skipping games the
// account already has a row for), then the guest is deleted. The account keeps its own nickname; if
// it has none, it takes the guest's.
export async function POST(request: Request) {
  try {
    const account = await getRequestUser(request);
    if (!account) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as { guestToken?: unknown };
    if (typeof body.guestToken !== 'string') return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    const guest = await getRequestUser(new Request(request.url, { headers: { authorization: `Bearer ${body.guestToken}` } }));
    if (!guest || !guest.isAnonymous) return NextResponse.json({ error: 'bad_guest' }, { status: 400 });
    if (guest.id === account.id) return NextResponse.json({ ok: true, moved: 0 });

    const supabase = getSupabaseAdmin();
    const { data: mine } = await supabase.from('game_results').select('game_id').eq('user_id', account.id);
    const have = new Set((mine ?? []).map((r: any) => r.game_id));
    const { data: theirs } = await supabase.from('game_results').select('id, game_id').eq('user_id', guest.id);
    const move = (theirs ?? []).filter((r: any) => !have.has(r.game_id)).map((r: any) => r.id);
    if (move.length) {
      const { error } = await supabase.from('game_results').update({ user_id: account.id }).in('id', move);
      if (error) throw error;
    }

    const { data: accProfile } = await supabase.from('profiles').select('nickname, username').eq('user_id', account.id).maybeSingle();
    const { data: guestProfile } = await supabase.from('profiles').select('nickname, nickname_key, username, username_changed_at').eq('user_id', guest.id).maybeSingle();

    // Deleting the guest cascades its profile and any rows left behind (duplicates).
    const { error: delErr } = await supabase.auth.admin.deleteUser(guest.id);
    if (delErr) throw delErr;

    // The username moves too when the account has none (the guest is deleted first, so it's free).
    if (!accProfile?.username && guestProfile?.username) {
      await supabase
        .from('profiles')
        .upsert({ user_id: account.id, username: guestProfile.username, username_changed_at: guestProfile.username_changed_at }, { onConflict: 'user_id' });
    }
    if (!accProfile?.nickname && guestProfile?.nickname) {
      await supabase
        .from('profiles')
        .upsert({ user_id: account.id, nickname: guestProfile.nickname, nickname_key: guestProfile.nickname_key, nickname_changed_at: new Date().toISOString() }, { onConflict: 'user_id' });
    }
    return NextResponse.json({ ok: true, moved: move.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getRequestUser } from '@/lib/auth-server';
import { validateNickname } from '@/lib/leaderboard/nickname';

const MIN_CHANGE_GAP_MS = 30_000; // rate limit: one change per 30s per account

// GET: the caller's own profile (nickname + account type). POST {nickname}: set or change it.
// Errors: 401 no account, 400 length|chars|blocked, 409 taken, 429 too_fast.
export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data } = await getSupabaseAdmin().from('profiles').select('nickname').eq('user_id', user.id).maybeSingle();
  return NextResponse.json({ nickname: data?.nickname ?? null, provider: user.provider });
}

export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as { nickname?: unknown };
    const check = validateNickname(body.nickname);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase.from('profiles').select('nickname, nickname_changed_at').eq('user_id', user.id).maybeSingle();
    if (existing?.nickname === check.nickname) return NextResponse.json({ nickname: check.nickname });
    if (existing?.nickname_changed_at && Date.now() - Date.parse(existing.nickname_changed_at) < MIN_CHANGE_GAP_MS) {
      return NextResponse.json({ error: 'too_fast' }, { status: 429 });
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({ user_id: user.id, nickname: check.nickname, nickname_key: check.key, nickname_changed_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'taken' }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ nickname: check.nickname });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

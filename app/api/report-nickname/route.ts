export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getRequestUser } from '@/lib/auth-server';
import { nicknameKey } from '@/lib/leaderboard/nickname';

const HIDE_AFTER = 3; // distinct reporters before a nickname is hidden pending review

// POST /api/report-nickname {nickname} — «بلّغ» on a leaderboard row. One report per reporter per
// target; after HIDE_AFTER distinct reporters the profile is hidden until someone reviews it.
export async function POST(request: Request) {
  try {
    const reporter = await getRequestUser(request);
    if (!reporter) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as { nickname?: unknown };
    if (typeof body.nickname !== 'string') return NextResponse.json({ error: 'bad_request' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: target } = await supabase.from('profiles').select('user_id').eq('nickname_key', nicknameKey(body.nickname)).maybeSingle();
    if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (target.user_id === reporter.id) return NextResponse.json({ ok: true });

    await supabase.from('nickname_reports').upsert({ reporter_id: reporter.id, target_id: target.user_id }, { onConflict: 'reporter_id,target_id', ignoreDuplicates: true });
    const { count } = await supabase.from('nickname_reports').select('reporter_id', { count: 'exact', head: true }).eq('target_id', target.user_id);
    if ((count ?? 0) >= HIDE_AFTER) await supabase.from('profiles').update({ hidden: true }).eq('user_id', target.user_id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

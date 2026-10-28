export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getRequestUser } from '@/lib/auth-server';
import { validateUsername } from '@/lib/leaderboard/username';

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' };

// GET /api/profile/username-available?u= → { ok } or { ok: false, reason: taken|reserved|chars|length }.
// The caller's own current handle counts as available.
export async function GET(request: Request) {
  const check = validateUsername(new URL(request.url).searchParams.get('u'));
  if (!check.ok) return NextResponse.json({ ok: false, reason: check.reason }, { headers: noStore });
  const user = await getRequestUser(request);
  const { data, error } = await getSupabaseAdmin().from('profiles').select('user_id').eq('username', check.username).maybeSingle();
  if (error) return NextResponse.json({ ok: false, reason: 'error' }, { status: 500, headers: noStore });
  if (data && data.user_id !== user?.id) return NextResponse.json({ ok: false, reason: 'taken' }, { headers: noStore });
  return NextResponse.json({ ok: true }, { headers: noStore });
}

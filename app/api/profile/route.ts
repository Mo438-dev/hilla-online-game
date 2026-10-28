export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getRequestUser } from '@/lib/auth-server';
import { validateNickname } from '@/lib/leaderboard/nickname';
import { USERNAME_CHANGE_DAYS, validateUsername } from '@/lib/leaderboard/username';

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' };
const DAY_MS = 86_400_000;
const PLATFORMS = new Set(['ios', 'android', 'desktop']);

// Coarse device info the client may send with its profile calls (never anything more specific).
function device(src: { platform?: unknown; standalone?: unknown }) {
  return {
    platform: typeof src.platform === 'string' && PLATFORMS.has(src.platform) ? src.platform : null,
    standalone: typeof src.standalone === 'boolean' ? src.standalone : null
  };
}

// GET /api/profile?platform=&standalone= — the caller's profile, on app open. Also notes when the
// player was last seen, and the device they first played on.
export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: noStore });
  const url = new URL(request.url);
  const dev = device({ platform: url.searchParams.get('platform'), standalone: url.searchParams.get('standalone') === '1' ? true : url.searchParams.get('standalone') === '0' ? false : undefined });
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('profiles').select('nickname, username, username_changed_at, created_platform').eq('user_id', user.id).maybeSingle();
  const seen: Record<string, unknown> = { user_id: user.id, last_seen_at: new Date().toISOString() };
  if (!data?.created_platform && dev.platform) Object.assign(seen, { created_platform: dev.platform, created_standalone: dev.standalone });
  await supabase.from('profiles').upsert(seen, { onConflict: 'user_id' });
  return NextResponse.json(
    { nickname: data?.nickname ?? null, username: data?.username ?? null, usernameChangedAt: data?.username_changed_at ?? null, provider: user.provider },
    { headers: noStore }
  );
}

// POST /api/profile {nickname, username, platform?, standalone?} — save the display name and the
// username together. Errors: 400 name_<length|chars|blocked> / user_<length|chars|reserved>,
// 409 user_taken, 429 cooldown {daysLeft}.
export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: noStore });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const name = validateNickname(body.nickname);
    if (!name.ok) return NextResponse.json({ error: `name_${name.error}` }, { status: 400, headers: noStore });
    const handle = validateUsername(body.username);
    if (!handle.ok) return NextResponse.json({ error: `user_${handle.reason}` }, { status: 400, headers: noStore });

    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase.from('profiles').select('username, username_changed_at, created_platform').eq('user_id', user.id).maybeSingle();
    const changing = (existing?.username || '') !== handle.username;
    if (changing && existing?.username && existing.username_changed_at) {
      const since = Date.now() - Date.parse(existing.username_changed_at);
      if (since < USERNAME_CHANGE_DAYS * DAY_MS) {
        return NextResponse.json({ error: 'cooldown', daysLeft: Math.ceil((USERNAME_CHANGE_DAYS * DAY_MS - since) / DAY_MS) }, { status: 429, headers: noStore });
      }
    }
    const row: Record<string, unknown> = { user_id: user.id, nickname: name.nickname, nickname_key: name.key, nickname_changed_at: new Date().toISOString(), username: handle.username };
    if (changing) row.username_changed_at = new Date().toISOString();
    const dev = device(body);
    if (!existing?.created_platform && dev.platform) Object.assign(row, { created_platform: dev.platform, created_standalone: dev.standalone });
    const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'user_id' });
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'user_taken' }, { status: 409, headers: noStore }); // lost the race for that handle
      throw error;
    }
    return NextResponse.json({ nickname: name.nickname, username: handle.username }, { headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    return NextResponse.json({ error: message }, { status: 500, headers: noStore });
  }
}

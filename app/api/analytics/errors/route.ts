export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getRequestUser } from '@/lib/auth-server';

const PLATFORMS = new Set(['ios', 'android', 'desktop']);
const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
const text = (v: unknown, max: number) => (typeof v === 'string' && v ? v.slice(0, max) : null);

// POST /api/analytics/errors — an uncaught error from a player's device (already rate-limited there).
// Never fails loudly: error reporting must not cause errors of its own.
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const message = text(body.message, 500);
    if (!message) return NextResponse.json({ ok: true });
    const user = await getRequestUser(request);
    await getSupabaseAdmin()
      .from('client_errors')
      .insert({
        session_id: isUuid(body.sessionId) ? body.sessionId : null,
        user_id: user?.id ?? null,
        app_build: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 12) || null,
        platform: typeof body.platform === 'string' && PLATFORMS.has(body.platform) ? body.platform : null,
        standalone: typeof body.standalone === 'boolean' ? body.standalone : null,
        message,
        stack: text(body.stack, 2000),
        url_path: text(body.path, 200)
      });
  } catch {}
  return NextResponse.json({ ok: true });
}

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

// Google sign-in through our own button (GIS OAuth code flow), so Google's screen names our domain.
// The browser gets a one-time code from Google; this route swaps it for an ID token at Google's
// token endpoint using GOOGLE_CLIENT_SECRET (server-only, never sent back or logged) and returns
// ONLY the id_token. No session is created here: the browser hands the token to Supabase
// (linkIdentity / signInWithIdToken). The code client has no nonce option, so the token has no
// nonce and Supabase checks it without one.
//   POST {code}  — popup mode (redirect_uri "postmessage"); only from our own origins.
//   GET ?code&state — installed-app redirect mode: back to the app with the token in the URL
//                     fragment (#gid=…), which never reaches a server or its logs.

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '175478021265-9gvhm0ifb4ni74o5cpdlnmaatus2v1op.apps.googleusercontent.com';
const ALLOWED_ORIGINS = new Set([
  'https://playhulla.com',
  'https://www.playhulla.com',
  'https://hilla-online-game.vercel.app',
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000', 'http://localhost:3001'] : [])
]);
const noStore = { 'Cache-Control': 'no-store' };

// Returns the ID token, or why not: "no_secret" (GOOGLE_CLIENT_SECRET isn't in this deployment) or
// Google's own error code (invalid_grant, invalid_client, redirect_uri_mismatch, …). Never the secret.
async function exchange(code: string, redirectUri: string): Promise<{ idToken: string | null; reason: string | null }> {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) {
    console.error('[auth/google] GOOGLE_CLIENT_SECRET is not set in this deployment');
    return { idToken: null, reason: 'no_secret' };
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: secret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    cache: 'no-store'
  });
  const body = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!res.ok) {
    const reason = typeof body.error === 'string' ? body.error.slice(0, 60) : `http_${res.status}`;
    console.error(`[auth/google] token exchange refused: ${res.status} ${reason}`); // Google's error code only
    return { idToken: null, reason };
  }
  return typeof body.id_token === 'string' ? { idToken: body.id_token, reason: null } : { idToken: null, reason: 'no_id_token' };
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin') || '';
  if (!ALLOWED_ORIGINS.has(origin)) return NextResponse.json({ error: 'bad_origin' }, { status: 403, headers: noStore });
  const body = (await request.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === 'string' ? body.code : '';
  if (!code || code.length > 2048) return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: noStore });
  try {
    const { idToken, reason } = await exchange(code, 'postmessage');
    if (!idToken) return NextResponse.json({ error: 'exchange_failed', reason }, { status: 502, headers: noStore });
    return NextResponse.json({ id_token: idToken }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: 'exchange_failed' }, { status: 502, headers: noStore });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const state = (url.searchParams.get('state') || '').slice(0, 200);
  const back = (frag: string) => NextResponse.redirect(`${origin}/?acct=gis#${frag}`, { status: 303, headers: noStore });
  if (!ALLOWED_ORIGINS.has(origin)) return NextResponse.json({ error: 'bad_origin' }, { status: 403, headers: noStore });
  const code = url.searchParams.get('code') || '';
  if (!code) return back(`gerr=${encodeURIComponent(url.searchParams.get('error') || 'no_code')}&gstate=${encodeURIComponent(state)}`);
  try {
    const { idToken, reason } = await exchange(code, `${origin}/api/auth/google`);
    if (!idToken) return back(`gerr=${encodeURIComponent(reason || 'exchange_failed')}&gstate=${encodeURIComponent(state)}`);
    return back(`gid=${encodeURIComponent(idToken)}&gstate=${encodeURIComponent(state)}`);
  } catch {
    return back(`gerr=exchange_failed&gstate=${encodeURIComponent(state)}`);
  }
}

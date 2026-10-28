'use client';
// Browser auth for the leaderboard (hulla-leaderboard-spec.md §2). Everything here is off until
// NEXT_PUBLIC_SUPABASE_ANON_KEY is set: without it there is no client, no sign-in, and every helper
// returns null, so the game behaves exactly as before. Google and email are separately gated by
// NEXT_PUBLIC_AUTH_GOOGLE=1 / NEXT_PUBLIC_AUTH_EMAIL=1, for when those providers are configured.
// The browser only ever holds the public anon key; result rows are written by server routes.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { deviceInfo } from '@/lib/device';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const AUTH_ENABLED = !!(URL && ANON_KEY);
export const GOOGLE_ENABLED = AUTH_ENABLED && process.env.NEXT_PUBLIC_AUTH_GOOGLE === '1';
export const EMAIL_ENABLED = AUTH_ENABLED && process.env.NEXT_PUBLIC_AUTH_EMAIL === '1';

let client: SupabaseClient | null = null;
function sb(): SupabaseClient | null {
  if (!AUTH_ENABLED || typeof window === 'undefined') return null;
  if (!client) client = createClient(URL!, ANON_KEY!, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'hulla-auth' } });
  return client;
}

let guestAttempt: Promise<void> | null = null;
// Silent guest on first open. Never blocks play: on a rate limit (shared IPs on mobile networks and
// campus Wi-Fi) we log it and try again on the next open or before the next online game.
export function ensureGuest(): Promise<void> {
  const c = sb();
  if (!c) return Promise.resolve();
  if (guestAttempt) return guestAttempt;
  guestAttempt = (async () => {
    try {
      const { data } = await c.auth.getSession();
      if (data.session) return;
      const { error } = await c.auth.signInAnonymously();
      if (error) {
        if ((error as any).status === 429) {
          fetch('/api/analytics/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events: [{ event_id: `auth-rl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, event_type: 'auth_rate_limited' }] }),
            keepalive: true
          }).catch(() => {});
        }
        guestAttempt = null; // retry later
      }
    } catch {
      guestAttempt = null;
    }
  })();
  return guestAttempt;
}

// Authorization header for our own API routes, or {} when not signed in.
export async function authHeaders(): Promise<Record<string, string>> {
  const c = sb();
  if (!c) return {};
  try {
    await ensureGuest();
    const { data } = await c.auth.getSession();
    return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
  } catch {
    return {};
  }
}

// Leaderboard nickname on the server. Returns {ok:true,nickname} or {ok:false,error} where error is
// the route's code (length | chars | blocked | taken | too_fast | offline).
export async function saveNicknameRemote(nickname: string): Promise<{ ok: true; nickname: string } | { ok: false; error: string }> {
  const headers = await authHeaders();
  if (!headers.Authorization) return { ok: false, error: 'offline' };
  try {
    const res = await fetch('/api/profile/nickname', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ nickname }) });
    const body = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, nickname: body.nickname } : { ok: false, error: body.error || 'offline' };
  } catch {
    return { ok: false, error: 'offline' };
  }
}

// On open: the server is the source of truth for the leaderboard name, the phone's copy is a cache.
// A name typed before accounts existed (or while offline) only lives on the phone, so the leaderboard
// can't list that player; if the server has none, send the phone's up. Returns the name to show, or
// null when there's nothing to change (no account, offline, or the phone's name was refused).
export async function syncNickname(localNick: string): Promise<{ nickname: string | null; username: string | null } | null> {
  const headers = await authHeaders();
  if (!headers.Authorization) return null;
  try {
    const d = deviceInfo();
    const res = await fetch(`/api/profile?platform=${d.platform}&standalone=${d.standalone ? 1 : 0}`, { headers, cache: 'no-store' });
    if (!res.ok) return null;
    const { nickname, username } = await res.json();
    if (nickname || !localNick) return { nickname: nickname ?? null, username: username ?? null };
    const saved = await saveNicknameRemote(localNick);
    return { nickname: saved.ok ? saved.nickname : null, username: username ?? null };
  } catch {
    return null;
  }
}

// Live check for the username field (debounced by the caller).
export async function usernameAvailable(u: string): Promise<{ ok: boolean; reason?: string }> {
  const headers = await authHeaders();
  try {
    const res = await fetch(`/api/profile/username-available?u=${encodeURIComponent(u)}`, { headers, cache: 'no-store' });
    return await res.json();
  } catch {
    return { ok: false, reason: 'offline' };
  }
}

// Save the display name and the username together. Returns {ok, nickname, username} or {ok:false,
// error, daysLeft?} with the server's error code (name_*, user_*, user_taken, cooldown, offline).
export async function saveProfile(nickname: string, username: string) {
  const headers = await authHeaders();
  if (!headers.Authorization) return { ok: false as const, error: 'offline' };
  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ nickname, username, ...deviceInfo() })
    });
    const body = await res.json().catch(() => ({}));
    return res.ok ? { ok: true as const, nickname: body.nickname as string, username: body.username as string } : { ok: false as const, error: body.error || 'offline', daysLeft: body.daysLeft };
  } catch {
    return { ok: false as const, error: 'offline' };
  }
}

// «احفظ تقدّمك» with Google: links Google to the SAME (guest) user, so nickname and points carry over.
export async function linkGoogle() {
  const c = sb();
  if (!c || !GOOGLE_ENABLED) return { error: 'disabled' };
  const { error } = await c.auth.linkIdentity({ provider: 'google', options: { redirectTo: window.location.origin } });
  return { error: error?.message ?? null };
}

// «احفظ تقدّمك» with email: attach the address, then verify the 6-digit code (not a link — on iOS a
// link opens Safari outside the installed app). The email template must show {{ .Token }}.
export async function startEmailLink(email: string) {
  const c = sb();
  if (!c || !EMAIL_ENABLED) return { error: 'disabled' };
  const { error } = await c.auth.updateUser({ email });
  return { error: error?.message ?? null };
}
export async function verifyEmailCode(email: string, token: string) {
  const c = sb();
  if (!c || !EMAIL_ENABLED) return { error: 'disabled' };
  const { error } = await c.auth.verifyOtp({ email, token, type: 'email_change' });
  return { error: error?.message ?? null };
}

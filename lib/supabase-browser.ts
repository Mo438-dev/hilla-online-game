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
// Google and email accounts are on wherever auth is (delta-18); set NEXT_PUBLIC_AUTH_GOOGLE=0 or
// NEXT_PUBLIC_AUTH_EMAIL=0 to switch one off again.
export const GOOGLE_ENABLED = AUTH_ENABLED && process.env.NEXT_PUBLIC_AUTH_GOOGLE !== '0';
export const EMAIL_ENABLED = AUTH_ENABLED && process.env.NEXT_PUBLIC_AUTH_EMAIL !== '0';

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
export async function syncNickname(localNick: string): Promise<{ nickname: string | null; username: string | null; games: number } | null> {
  const headers = await authHeaders();
  if (!headers.Authorization) return null;
  try {
    const d = deviceInfo();
    const res = await fetch(`/api/profile?platform=${d.platform}&standalone=${d.standalone ? 1 : 0}`, { headers, cache: 'no-store' });
    if (!res.ok) return null;
    const { nickname, username, games } = await res.json();
    const played = typeof games === 'number' ? games : 0;
    if (nickname || !localNick) return { nickname: nickname ?? null, username: username ?? null, games: played };
    const saved = await saveNicknameRemote(localNick);
    return { nickname: saved.ok ? saved.nickname : null, username: username ?? null, games: played };
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

// ── Accounts (delta-18) ──────────────────────────────────────────────────────────────────────
// "link" saves the current guest (same uuid, games and points); "signin" switches to an existing
// account (this phone's guest games stay behind). Errors come back as Supabase's error code (e.g.
// email_exists, identity_already_exists, otp_expired, otp_disabled, over_email_send_rate_limit).
type AuthResult = { error: string | null; status?: number };
const fail = (e: any): AuthResult => ({ error: e?.code || e?.message || 'unknown', status: e?.status });

// The account behind this phone: signed = not a guest. The email stays on this device's sheet only.
export async function getAccount(): Promise<{ signed: boolean; method: 'google' | 'email' | null; email: string | null }> {
  const c = sb();
  if (!c) return { signed: false, method: null, email: null };
  try {
    const { data } = await c.auth.getUser();
    const u = data?.user as any;
    if (!u || u.is_anonymous) return { signed: false, method: null, email: null };
    const google = (u.identities || []).some((i: any) => i.provider === 'google');
    return { signed: true, method: google ? 'google' : 'email', email: u.email ?? null };
  } catch {
    return { signed: false, method: null, email: null };
  }
}

export async function googleAccount(purpose: 'link' | 'signin'): Promise<AuthResult> {
  const c = sb();
  if (!c || !GOOGLE_ENABLED) return { error: 'disabled' };
  const redirectTo = `${window.location.origin}/?acct=${purpose}`;
  const { error } = purpose === 'link' ? await c.auth.linkIdentity({ provider: 'google', options: { redirectTo } }) : await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  return error ? fail(error) : { error: null };
}

// Sends the 6-digit code. A sign-in with an email that has no account quietly becomes a link, so
// the player just gets a code and this guest account is saved with that email (purpose comes back).
export async function sendEmailCode(email: string, purpose: 'link' | 'signin'): Promise<AuthResult & { purpose: 'link' | 'signin' }> {
  const c = sb();
  if (!c || !EMAIL_ENABLED) return { error: 'disabled', purpose };
  if (purpose === 'signin') {
    const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (!error) return { error: null, purpose };
    const code = (error as any).code || '';
    if (code !== 'otp_disabled' && code !== 'signup_disabled' && !/signups? not allowed/i.test(error.message || '')) return { ...fail(error), purpose };
    purpose = 'link';
  }
  await ensureGuest();
  const { error } = await c.auth.updateUser({ email });
  return error ? { ...fail(error), purpose } : { error: null, purpose };
}

export async function verifyEmailCode(email: string, token: string, purpose: 'link' | 'signin'): Promise<AuthResult> {
  const c = sb();
  if (!c || !EMAIL_ENABLED) return { error: 'disabled' };
  const { error } = await c.auth.verifyOtp({ email, token, type: purpose === 'link' ? 'email_change' : 'email' });
  return error ? fail(error) : { error: null };
}

// Google Identity Services (the button on our own page, so Google shows playhulla.com): the ID
// token from Google either links Google to this guest, or signs in to the account that has it.
// rawNonce is the one whose SHA-256 went to Google.
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '175478021265-9gvhm0ifb4ni74o5cpdlnmaatus2v1op.apps.googleusercontent.com';
export async function googleIdToken(purpose: 'link' | 'signin', token: string, rawNonce: string): Promise<AuthResult> {
  const c = sb();
  if (!c || !GOOGLE_ENABLED) return { error: 'disabled' };
  if (purpose === 'link') {
    await ensureGuest();
    const { error } = await c.auth.linkIdentity({ provider: 'google', token, nonce: rawNonce });
    return error ? fail(error) : { error: null };
  }
  const { error } = await c.auth.signInWithIdToken({ provider: 'google', token, nonce: rawNonce });
  return error ? fail(error) : { error: null };
}

// Sign out, then carry on as a brand-new guest on this phone.
export async function signOutToGuest(): Promise<void> {
  const c = sb();
  if (!c) return;
  try {
    await c.auth.signOut();
  } catch {}
  guestAttempt = null;
  await ensureGuest();
}

// Supabase's error after coming back from Google, from the query or the hash (#error_code=…).
export function readAuthReturn(): { purpose: 'link' | 'signin' | null; error: string | null } {
  if (typeof window === 'undefined') return { purpose: null, error: null };
  const q = new URLSearchParams(window.location.search);
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const acct = q.get('acct');
  const purpose = acct === 'link' || acct === 'signin' ? acct : null;
  const error = q.get('error_code') || h.get('error_code') || q.get('error') || h.get('error');
  if (purpose || error) {
    // keep the session tokens Supabase may have put in the hash until the client has read them
    q.delete('acct');
    ['error', 'error_code', 'error_description'].forEach((k) => q.delete(k));
    const rest = q.toString();
    const hashLeft = h.has('access_token') ? window.location.hash : '';
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : '') + hashLeft);
  }
  return { purpose, error };
}

// A guest's nickname only (guests can't set a username; delta-18).
export async function saveNickOnly(nickname: string) {
  return saveNicknameRemote(nickname);
}

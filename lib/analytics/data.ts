import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, isValidAdminToken } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' };
export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStore });

// Same gate as the current dashboard: the admin cookie, and nothing without it.
export async function isAdmin() {
  return isValidAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

// Server-side cache: 60s per response. It's a small dataset and these pages are opened by one person.
const CACHE = new Map<string, { at: number; value: unknown }>();
export async function cached<T>(key: string, make: () => Promise<T>): Promise<T> {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.value as T;
  const value = await make();
  CACHE.set(key, { at: Date.now(), value });
  return value;
}
export const clearCache = () => CACHE.clear();

// Every row of a query, past Supabase's 1000-row page.
export async function allRows(table: string, columns: string, filter: (q: any) => any = (q) => q): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(getSupabaseAdmin().from(table).select(columns)).order('id').range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

// Non-test sessions. Filtered here, not in SQL, so the page keeps working in the moments before
// delta-15.sql has added is_test.
export async function loadSessions(): Promise<any[]> {
  return (await allRows('game_sessions', '*')).filter((s) => !s.is_test);
}

const EVENT_COLUMNS = 'id, game_id, event_type, player_id, is_bot, turn_number, action_type, coord_type, items, payload';
export async function loadEvents(gameIds: string[], types: string[]) {
  const byGame = new Map<string, any[]>();
  for (let i = 0; i < gameIds.length; i += 200) {
    const chunk = gameIds.slice(i, i + 200);
    const rows = await allRows('game_events', EVENT_COLUMNS, (q) => q.in('game_id', chunk).in('event_type', types));
    for (const e of rows) {
      const list = byGame.get(e.game_id);
      if (list) list.push(e);
      else byGame.set(e.game_id, [e]);
    }
  }
  return byGame;
}

// Header filters shared by every tab except مؤشرات القواعد.
export function filterSessions(sessions: any[], url: URL) {
  const period = url.searchParams.get('period');
  const pop = url.searchParams.get('pop');
  const n = Number(url.searchParams.get('n'));
  const version = url.searchParams.get('version');
  const since = period === '7' || period === '30' ? Date.now() - Number(period) * 86_400_000 : 0;
  return sessions.filter(
    (s) =>
      (!since || Date.parse(s.started_at) >= since) &&
      (pop !== 'humans' || s.bot_count === 0) &&
      (pop !== 'bots' || s.bot_count > 0) &&
      (!n || s.player_count === n) &&
      (!version || version === 'all' || s.ruleset_version === version)
  );
}
export const filterKey = (url: URL) => ['period', 'pop', 'n', 'version'].map((k) => url.searchParams.get(k) ?? '').join('|');

// Accounts by user id, with a merged account standing in for its target. Stays on the server: routes
// send `ref` (public_id) to the browser, never the user id.
export async function loadAccounts() {
  const profiles = await allRowsNoId('profiles', '*');
  const byId = new Map<string, any>(profiles.map((p) => [p.user_id, p]));
  const resolve = (id: string | null | undefined) => {
    let p = id ? byId.get(id) : null;
    for (let i = 0; p?.merged_into && i < 5; i++) p = byId.get(p.merged_into);
    return p ?? null;
  };
  return { profiles, resolve };
}

export async function allRowsNoId(table: string, columns: string, filter: (q: any) => any = (q) => q): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(getSupabaseAdmin().from(table).select(columns)).range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

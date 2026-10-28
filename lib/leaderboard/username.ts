// Usernames: a unique English handle (@mohammed_w). Display names can repeat; the handle can't.
// Accounts, points and rankings stay keyed by the account id; the handle is the public, unique way to
// tell two «محمد»s apart (and later, to add friends).
import { nicknameKey } from '@/lib/leaderboard/nickname';

export const USERNAME_CHANGE_DAYS = 30;
const RESERVED = ['admin', 'hulla', 'hilla', 'support', 'root', 'system', 'bot', 'guest', 'moderator', 'mod', 'staff', 'official', 'help', 'api', 'null', 'undefined'];
// same word filter as nicknames, on the handle
const BLOCKED = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'nigga', 'nigger', 'whore', 'slut', 'porn'];

export type UserCheck = { ok: true; username: string } | { ok: false; reason: 'length' | 'chars' | 'reserved' };

export function cleanUsername(v: unknown): string {
  return typeof v === 'string' ? v.trim().toLowerCase().replace(/^@/, '') : '';
}

// 3–15 chars, a–z / 0–9 / _, starts with a letter
export function validateUsername(raw: unknown): UserCheck {
  const u = cleanUsername(raw);
  if (!/^[a-z][a-z0-9_]*$/.test(u)) return u.length && /^[a-z0-9_]+$/.test(u) ? { ok: false, reason: 'chars' } : { ok: false, reason: u ? 'chars' : 'length' };
  if (u.length < 3 || u.length > 15) return { ok: false, reason: 'length' };
  const key = nicknameKey(u);
  if (RESERVED.includes(u) || BLOCKED.some((w) => key.includes(w))) return { ok: false, reason: 'reserved' };
  return { ok: true, username: u };
}

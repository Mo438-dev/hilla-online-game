import { createHash, timingSafeEqual } from 'crypto';

// Cookie-based gate for /admin/analytics. The cookie stores a SHA-256 digest
// of ADMIN_ANALYTICS_PASSWORD (never the password itself, never any Supabase
// credential). If the env var is unset, access is always denied.

export const ADMIN_COOKIE = 'hilla_admin_token';

export function adminPasswordConfigured(): boolean {
  return typeof process.env.ADMIN_ANALYTICS_PASSWORD === 'string' && process.env.ADMIN_ANALYTICS_PASSWORD.length > 0;
}

export function adminTokenFor(password: string): string {
  return createHash('sha256').update(password, 'utf8').digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function isValidAdminPassword(candidate: unknown): boolean {
  if (!adminPasswordConfigured() || typeof candidate !== 'string') return false;
  return safeEqualHex(adminTokenFor(candidate), adminTokenFor(process.env.ADMIN_ANALYTICS_PASSWORD as string));
}

export function isValidAdminToken(token: unknown): boolean {
  if (!adminPasswordConfigured() || typeof token !== 'string') return false;
  return safeEqualHex(token, adminTokenFor(process.env.ADMIN_ANALYTICS_PASSWORD as string));
}

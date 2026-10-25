import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type AuthUser = { id: string; isAnonymous: boolean; provider: 'guest' | 'google' | 'email' };

// Resolves the Supabase user behind `Authorization: Bearer <access token>`. The token is verified
// by Supabase (never trusted as-is). Returns null when there's no token or it isn't valid, so
// callers can treat "not signed in" and "bad token" the same way.
export async function getRequestUser(request: Request): Promise<AuthUser | null> {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(match[1]);
    if (error || !data?.user) return null;
    const u = data.user as any;
    const providers: string[] = (u.identities || []).map((i: any) => i.provider);
    const provider = providers.includes('google') ? 'google' : u.email && !u.is_anonymous ? 'email' : 'guest';
    return { id: u.id, isAnonymous: !!u.is_anonymous, provider };
  } catch {
    return null;
  }
}

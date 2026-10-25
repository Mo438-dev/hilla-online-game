export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getRequestUser } from '@/lib/auth-server';

// DELETE /api/account — «احذف حسابي». Deletes the auth user with the admin API; the profile and all
// results cascade with it, so the player leaves every leaderboard.
export async function DELETE(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { error } = await getSupabaseAdmin().auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

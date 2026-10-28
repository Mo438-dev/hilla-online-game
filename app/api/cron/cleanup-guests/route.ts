export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Daily (vercel.json cron): delete anonymous guests whose last sign-in was more than a year ago.
// Vercel sends `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET set the route stays closed.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('delete_stale_guests');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // device error reports are kept for 90 days
  const { count: errorsDeleted } = await supabase
    .from('client_errors')
    .delete({ count: 'exact' })
    .lt('created_at', new Date(Date.now() - 90 * 86_400_000).toISOString());
  // games nobody finished within a day are marked abandoned (analytics only)
  const { count: abandoned } = await supabase
    .from('game_sessions')
    .update({ ended_reason: 'abandoned' }, { count: 'exact' })
    .eq('completed', false)
    .is('ended_reason', null)
    .lt('started_at', new Date(Date.now() - 86_400_000).toISOString());
  return NextResponse.json({ deleted: data ?? 0, errorsDeleted: errorsDeleted ?? 0, abandoned: abandoned ?? 0 });
}

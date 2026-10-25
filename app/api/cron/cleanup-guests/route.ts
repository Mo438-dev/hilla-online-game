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
  const { data, error } = await getSupabaseAdmin().rpc('delete_stale_guests');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: data ?? 0 });
}

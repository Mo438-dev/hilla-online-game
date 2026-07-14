export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { recordFeedback } from '@/lib/analytics-server';

// Optional post-game survey sink. Best-effort like the rest of analytics:
// always 200, never blocks or breaks gameplay.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    await recordFeedback(body);
    return NextResponse.json({ ok: true });
  } catch {
    console.error('[analytics] feedback route failed: bad_request');
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { insertEvents } from '@/lib/analytics-server';

// Append-only raw event sink. Always answers 200 with a minimal body:
// analytics is best-effort and the game client ignores the response anyway.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { events?: unknown[] };
    const events = Array.isArray(body.events) ? body.events : [];
    const { accepted } = await insertEvents(events);
    return NextResponse.json({ ok: true, accepted });
  } catch {
    // Sanitized: no payload echo, no stack.
    console.error('[analytics] events route failed: bad_request');
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { recordGameStarted, recordGameFinished } from '@/lib/analytics-server';

// Session lifecycle sink: creates the game_sessions/game_players rows at
// game start and finalizes them once at game end. Idempotent on both sides
// (PK/unique upserts + "only if ended_at is null"), so duplicate calls from
// retries or multiple clients are harmless.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { type?: string } & Record<string, unknown>;
    if (body.type === 'started') {
      await recordGameStarted(body as never);
    } else if (body.type === 'finished') {
      await recordGameFinished(body as never);
    }
    return NextResponse.json({ ok: true });
  } catch {
    console.error('[analytics] games route failed: bad_request');
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

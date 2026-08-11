export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { claimTurnTimeout, type RoomDoc, type TimeoutGuard } from '@/lib/room-store';

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' };

// Guarded turn-timeout claim. Any client may POST; the conditional write in claimTurnTimeout
// makes the first valid attempt win and every stale/duplicate one lose cleanly (409). Normal
// moves keep using PUT (blind last-write-wins) — this endpoint is timeout-only.
export async function POST(request: Request, { params }: { params: { code: string } }) {
  try {
    const body = (await request.json()) as { room?: RoomDoc; expected?: TimeoutGuard };
    const { room, expected } = body;

    if (
      !room ||
      !expected ||
      typeof expected.updatedAt !== 'string' ||
      typeof expected.turnSerial !== 'number' ||
      typeof expected.currentPlayerIndex !== 'number' ||
      typeof expected.turnStartedAt !== 'number'
    ) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: noStore });
    }

    const result = await claimTurnTimeout(params.code, room, expected);
    if (!result.ok) {
      // Lost the race / stale snapshot — a real move or another client's skip landed first.
      return NextResponse.json({ error: 'stale' }, { status: 409, headers: noStore });
    }
    return NextResponse.json(result.room, { headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    return NextResponse.json({ error: message }, { status: 500, headers: noStore });
  }
}

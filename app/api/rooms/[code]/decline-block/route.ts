export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { declineBlock } from '@/lib/room-store';

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' };

// #58 — record a pass on «لا ما تقدر» for one player. Guarded server-side (see declineBlock), so it
// never overwrites a concurrent resolution or block. 409 = that action already resolved.
export async function POST(request: Request, { params }: { params: { code: string } }) {
  try {
    const body = (await request.json()) as { playerId?: string; pendingActionId?: string };
    if (typeof body.playerId !== 'string' || typeof body.pendingActionId !== 'string') {
      return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: noStore });
    }
    const result = await declineBlock(params.code, body.playerId, body.pendingActionId);
    if (!result.ok) {
      const status = result.reason === 'not_found' ? 404 : result.reason === 'not_player' ? 403 : 409;
      return NextResponse.json({ error: result.reason }, { status, headers: noStore });
    }
    return NextResponse.json(result.room, { headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    return NextResponse.json({ error: message }, { status: 500, headers: noStore });
  }
}

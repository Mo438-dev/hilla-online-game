export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sendReaction } from '@/lib/room-store';

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' };

// POST /api/rooms/[code]/react {playerId, emoji, single, id} — a reaction, as its own small guarded
// update (see sendReaction): it never goes through the game-state save, so it can't cancel a move.
// The caller must hold a human seat in the game. 429 = over the reaction limit.
export async function POST(request: Request, { params }: { params: { code: string } }) {
  try {
    const body = (await request.json().catch(() => ({}))) as { playerId?: unknown; emoji?: unknown; single?: unknown; id?: unknown };
    if (typeof body.playerId !== 'string' || typeof body.emoji !== 'string') return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: noStore });
    const result = await sendReaction(params.code, body.playerId, body.emoji, !!body.single, typeof body.id === 'string' ? body.id : '');
    if (!result.ok) {
      const status = result.reason === 'not_found' ? 404 : result.reason === 'not_player' ? 403 : result.reason === 'too_fast' ? 429 : result.reason === 'bad_reaction' ? 400 : 409;
      return NextResponse.json({ error: result.reason }, { status, headers: noStore });
    }
    return NextResponse.json(result.room, { headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    return NextResponse.json({ error: message }, { status: 500, headers: noStore });
  }
}

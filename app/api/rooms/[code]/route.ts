export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getRoom, guardedSaveRoom, type RoomDoc } from '@/lib/room-store';

export async function GET(_: Request, { params }: { params: { code: string } }) {
  try {
    const room = await getRoom(params.code);
    if (!room) {
      return NextResponse.json(
        { error: 'not_found' },
        {
          status: 404,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
          }
        }
      );
    }

    return NextResponse.json(room, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'unknown_error';
    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        }
      }
    );
  }
}

export async function PUT(request: Request, { params }: { params: { code: string } }) {
  try {
    const body = (await request.json()) as { room?: RoomDoc; baseUpdatedAt?: unknown };

    if (!body.room) {
      return NextResponse.json({ error: 'missing_room' }, { status: 400 });
    }

    // Checked against the previous save (lib/integrity.ts); a save that breaks a rule is refused.
    const base = typeof body.baseUpdatedAt === 'string' ? body.baseUpdatedAt : null;
    const result = await guardedSaveRoom(params.code, body.room, base);
    if (!result.ok) {
      if (result.reason === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });
      if (result.reason === 'stale') return NextResponse.json({ error: 'stale' }, { status: 409 });
      return NextResponse.json({ error: result.rejected ? 'state_rejected' : 'busy', reason: result.reason }, { status: 409 });
    }

    return NextResponse.json(result.room);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'unknown_error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

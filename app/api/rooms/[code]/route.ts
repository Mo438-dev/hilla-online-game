export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getRoom, updateRoom, type RoomDoc } from '@/lib/room-store';

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
    const body = (await request.json()) as { room?: RoomDoc };

    if (!body.room) {
      return NextResponse.json({ error: 'missing_room' }, { status: 400 });
    }

    const updated = await updateRoom(params.code, body.room);
    if (!updated) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json(updated);
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

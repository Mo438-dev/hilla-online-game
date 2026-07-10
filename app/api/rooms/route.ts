import { NextResponse } from 'next/server';
import { createRoom, type RoomDoc } from '@/lib/room-store';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { room?: RoomDoc };

    if (!body.room) {
      return NextResponse.json({ error: 'missing_room' }, { status: 400 });
    }

    const created = await createRoom(body.room);
    if (!created) {
      return NextResponse.json({ error: 'room_exists' }, { status: 409 });
    }

    return NextResponse.json(created);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'unknown_error';
    const status = 500;
    return NextResponse.json({ error: message }, { status });
  }
}

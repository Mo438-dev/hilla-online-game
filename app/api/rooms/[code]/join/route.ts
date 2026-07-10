import { NextResponse } from 'next/server';
import { joinRoom, type PlayerMeta } from '@/lib/room-store';

export async function POST(request: Request, { params }: { params: { code: string } }) {
  try {
    const body = (await request.json()) as { player?: PlayerMeta };

    if (!body.player) {
      return NextResponse.json({ error: 'missing_player' }, { status: 400 });
    }

    const result = await joinRoom(params.code, body.player);

    if ('error' in result) {
      const status = result.error === 'not_found' ? 404 : result.error === 'started' ? 409 : 410;
      return NextResponse.json({ error: result.error }, { status });
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

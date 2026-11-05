import { NextResponse } from 'next/server';
import { createRoom, getRoom, claimRematch } from '@/lib/room-store';
import { getRequestUser } from '@/lib/auth-server';
import { insertEvents } from '@/lib/analytics-server';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

// Best-effort: analytics never break the rematch.
async function logRematch(type: 'rematch_opened' | 'rematch_joined', roomCode: string, gameId: unknown, playerId: string) {
  try {
    await insertEvents([
      { event_id: `${type}-${roomCode}-${playerId}`, event_type: type, game_id: gameId, room_code: roomCode, player_id: playerId }
    ]);
  } catch {}
}

// «العب من جديد» online: one new room per finished game. The first caller opens it; everyone else,
// including a caller who loses the race, gets the same code. The client then joins it the normal way.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: string; playerId?: string };
    const code = String(body.code || '').trim().toUpperCase();
    const playerId = String(body.playerId || '');
    if (!code || !playerId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

    const room = await getRoom(code);
    if (!room) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const game = room.game as { winner?: string | null; analyticsId?: string; rematch?: { code?: string } } | null;
    if (!game?.winner) return NextResponse.json({ error: 'not_finished' }, { status: 409 });

    // The caller must hold a human seat in this room; a seat with an account needs that account's token.
    const seat = room.lobby.find((p) => p.id === playerId && !p.isBot);
    if (!seat) return NextResponse.json({ error: 'not_seated' }, { status: 403 });
    const user = await getRequestUser(request);
    if (seat.userId && seat.userId !== user?.id) return NextResponse.json({ error: 'not_seated' }, { status: 403 });

    if (game.rematch?.code) {
      await logRematch('rematch_joined', code, game.analyticsId, playerId);
      return NextResponse.json({ code: game.rematch.code });
    }

    let created = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const newCode = genCode();
      created = await createRoom(
        { code: newCode, hostId: playerId, perPlayer: room.perPlayer, maxPlayers: room.maxPlayers, started: false, lobby: [{ id: playerId, name: seat.name }], game: null },
        user?.id ?? null
      );
    }
    if (!created) return NextResponse.json({ error: 'create_failed' }, { status: 500 });

    const claim = await claimRematch(code, { code: created.code, hostId: playerId, hostName: seat.name });
    if (!claim) return NextResponse.json({ error: 'busy' }, { status: 503 });
    // Lost the race: their room wins; the empty one just made goes with the usual expiry.
    await logRematch(claim.won ? 'rematch_opened' : 'rematch_joined', code, game.analyticsId, playerId);
    return NextResponse.json({ code: claim.code });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

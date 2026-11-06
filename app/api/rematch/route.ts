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

// Every refusal is logged (status + reason, no ids beyond the room code) so a failed press shows up.
function fail(status: number, error: string, code: string) {
  console.error(`[rematch] ${status} ${error} room=${code}`);
  return NextResponse.json({ error }, { status });
}

// «العب من جديد» online: one new room per finished game. The first caller opens it; everyone else,
// including a caller who loses the race, gets the same code. The client then joins it the normal way.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: string; playerId?: string };
    const code = String(body.code || '').trim().toUpperCase();
    const playerId = String(body.playerId || '');
    if (!code || !playerId) return fail(400, 'bad_request', code);

    const room = await getRoom(code);
    if (!room) return fail(404, 'not_found', code);
    const game = room.game as { winner?: string | null; analyticsId?: string; rematch?: { code?: string } } | null;
    if (!game?.winner) return fail(409, 'not_finished', code);

    // The caller must hold a human seat in this room. The seat id is the proof, as for every other room
    // call (a phone whose sign-in token is missing or mid-refresh must not lose the rematch). A token for
    // a different account than the seat's is still refused.
    const seat = room.lobby.find((p) => p.id === playerId && !p.isBot);
    if (!seat) return fail(403, 'not_seated', code);
    const user = await getRequestUser(request);
    if (seat.userId && user?.id && seat.userId !== user.id) return fail(403, 'other_account', code);
    // The new room's host seat keeps the account: the verified token, else the account the server
    // already recorded on this seat.
    const hostUserId = user?.id ?? seat.userId ?? null;

    if (game.rematch?.code) {
      await logRematch('rematch_joined', code, game.analyticsId, playerId);
      return NextResponse.json({ code: game.rematch.code });
    }

    let created = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const newCode = genCode();
      created = await createRoom(
        { code: newCode, hostId: playerId, perPlayer: room.perPlayer, maxPlayers: room.maxPlayers, started: false, lobby: [{ id: playerId, name: seat.name }], game: null },
        hostUserId
      );
    }
    if (!created) return fail(500, 'create_failed', code);

    const claim = await claimRematch(code, { code: created.code, hostId: playerId, hostName: seat.name });
    if (!claim) return fail(503, 'busy', code);
    // Lost the race: their room wins; the empty one just made goes with the usual expiry.
    await logRematch(claim.won ? 'rematch_opened' : 'rematch_joined', code, game.analyticsId, playerId);
    return NextResponse.json({ code: claim.code });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    return fail(500, message, '');
  }
}

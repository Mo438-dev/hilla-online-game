import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type PlayerMeta = {
  id: string;
  name: string;
  isBot?: boolean;
};

export type RoomDoc = {
  code: string;
  hostId: string;
  perPlayer: number;
  maxPlayers: number;
  started: boolean;
  lobby: PlayerMeta[];
  game: unknown;
  updatedAt?: string | null;
};

type RoomRow = {
  code: string;
  host_id: string;
  per_player: number;
  max_players: number;
  started: boolean;
  lobby: PlayerMeta[];
  game: unknown;
  expires_at: string;
  updated_at: string;
};

const ROOMS_TABLE = 'hilla_rooms';

function toRoomDoc(row: RoomRow): RoomDoc {
  return {
    code: row.code,
    hostId: row.host_id,
    perPlayer: row.per_player,
    maxPlayers: row.max_players,
    started: row.started,
    lobby: row.lobby ?? [],
    game: row.game ?? null,
    updatedAt: row.updated_at ?? null
  };
}

function toRoomRow(room: RoomDoc): Omit<RoomRow, 'expires_at' | 'updated_at'> {
  return {
    code: room.code,
    host_id: room.hostId,
    per_player: room.perPlayer,
    max_players: room.maxPlayers,
    started: room.started,
    lobby: room.lobby,
    game: room.game
  };
}

async function deleteExpiredRoom(code: string) {
  const supabase = getSupabaseAdmin();
  await supabase.from(ROOMS_TABLE).delete().eq('code', code);
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() <= Date.now();
}

export async function createRoom(room: RoomDoc) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(ROOMS_TABLE)
    .insert({
      ...toRoomRow(room),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return null;
    throw error;
  }

  return toRoomDoc(data as RoomRow);
}

export async function getRoom(code: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(ROOMS_TABLE)
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  if (isExpired((data as RoomRow).expires_at)) {
    await deleteExpiredRoom(code);
    return null;
  }

  return toRoomDoc(data as RoomRow);
}

export async function updateRoom(code: string, room: RoomDoc) {
  const supabase = getSupabaseAdmin();
  const existing = await getRoom(code);
  if (!existing) return null;

  const { data, error } = await supabase
    .from(ROOMS_TABLE)
    .update(toRoomRow(room))
    .eq('code', code)
    .select()
    .single();

  if (error) throw error;
  return toRoomDoc(data as RoomRow);
}

export type TimeoutGuard = {
  updatedAt: string;
  turnSerial: number;
  currentPlayerIndex: number;
  turnStartedAt: number;
};

// Atomic compare-and-swap for the online turn-timeout skip. Any connected client may attempt it;
// the conditional UPDATE only applies when the row is byte-for-byte the turn the client based its
// timeout on. `updated_at` is the version guard (bumped by the DB trigger on every write) — it is
// what rejects a stale timeout after a same-turn action card that changed state WITHOUT advancing
// turnSerial. The three turn fields are semantic assertions that we're skipping the exact intended
// turn. A mismatch on any of them → 0 rows updated → the claim lost (someone else moved/skipped
// first). Normal moves stay on the blind updateRoom path, so this changes nothing for them.
export async function claimTurnTimeout(code: string, nextRoom: RoomDoc, expected: TimeoutGuard) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(ROOMS_TABLE)
    .update(toRoomRow(nextRoom))
    .eq('code', code)
    .eq('updated_at', expected.updatedAt)
    .eq('game->>turnSerial', String(expected.turnSerial))
    .eq('game->>currentPlayerIndex', String(expected.currentPlayerIndex))
    .eq('game->>turnStartedAt', String(expected.turnStartedAt))
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ok: false as const };
  return { ok: true as const, room: toRoomDoc(data as RoomRow) };
}

export async function joinRoom(code: string, player: PlayerMeta) {
  const room = await getRoom(code);
  if (!room) return { error: 'not_found' as const };
  if (room.started) return { error: 'started' as const };
  if (room.lobby.length >= room.maxPlayers) return { error: 'full' as const };

  const nextRoom = room.lobby.some((entry) => entry.id === player.id)
    ? room
    : { ...room, lobby: [...room.lobby, player] };

  const updated = await updateRoom(code, nextRoom);
  if (!updated) return { error: 'not_found' as const };
  return { room: updated };
}

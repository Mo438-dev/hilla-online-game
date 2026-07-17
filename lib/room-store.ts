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

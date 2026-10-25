import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { checkFreshDeal, checkTransition } from '@/lib/integrity';
import { writeResults } from '@/lib/leaderboard/results';

export type PlayerMeta = {
  id: string;
  name: string;
  isBot?: boolean;
  userId?: string | null; // Supabase auth uid, set by the server from the bearer token, never the client
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
  game_id?: string | null;
  game_started_at?: string | null;
  integrity_rejects?: number;
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

function toRoomRow(room: RoomDoc): Omit<RoomRow, 'expires_at' | 'updated_at' | 'game_id' | 'game_started_at' | 'integrity_rejects'> {
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

export async function createRoom(room: RoomDoc, userId: string | null = null) {
  // The host's account comes from the verified token only.
  room = { ...room, lobby: (room.lobby || []).map(({ userId: _ignored, ...p }) => (userId && p.id === room.hostId ? { ...p, userId } : p)) };
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
export async function claimTurnTimeout(code: string, incomingRoom: RoomDoc, expected: TimeoutGuard) {
  const supabase = getSupabaseAdmin();
  // Same integrity checks as a normal save, against the row the timeout is based on.
  const { data: current, error: readErr } = await supabase.from(ROOMS_TABLE).select('*').eq('code', code).maybeSingle();
  if (readErr) throw readErr;
  if (!current || (current as RoomRow).updated_at !== expected.updatedAt) return { ok: false as const };
  const prev = toRoomDoc(current as RoomRow);
  const nextRoom = keepServerFields(prev, incomingRoom);
  const check = prev.game ? checkTransition(prev.game, nextRoom.game) : { ok: false as const, reason: 'no_game' };
  const counter: Partial<RoomRow> = {};
  if (!check.ok) {
    if (INTEGRITY_ENFORCE) {
      await bumpRejects(current as RoomRow);
      await logRejection(current as RoomRow, check.reason);
      return { ok: false as const, rejected: true, reason: check.reason };
    }
    // log-only: accept, and mark the game in the same write
    if ('integrity_rejects' in (current as RoomRow)) counter.integrity_rejects = ((current as RoomRow).integrity_rejects ?? 0) + 1;
  }
  const { data, error } = await supabase
    .from(ROOMS_TABLE)
    .update({ ...toRoomRow(nextRoom), ...counter })
    .eq('code', code)
    .eq('updated_at', expected.updatedAt)
    .eq('game->>turnSerial', String(expected.turnSerial))
    .eq('game->>currentPlayerIndex', String(expected.currentPlayerIndex))
    .eq('game->>turnStartedAt', String(expected.turnStartedAt))
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ok: false as const };
  if (!check.ok) await logRejection(data as RoomRow, check.reason);
  return { ok: true as const, room: toRoomDoc(data as RoomRow) };
}

// #58 — a player passes on «لا ما تقدر» ("لا، ما راح أستخدمه"). Read-modify-write guarded by the
// row version (updated_at) and the pending action's id, retried on a concurrent write. It only ever
// adds the player to pendingAction.declinedIds, and refuses if that action has already resolved, so
// a late pass can never resurrect or overwrite a resolution (unlike a blind full-room save).
export async function declineBlock(code: string, playerId: string, pendingActionId: string) {
  const supabase = getSupabaseAdmin();
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: row, error } = await supabase.from(ROOMS_TABLE).select('*').eq('code', code).maybeSingle();
    if (error) throw error;
    if (!row) return { ok: false as const, reason: 'not_found' as const };
    const game = (row as RoomRow).game as any;
    const pa = game?.pendingAction;
    if (!pa || pa.id !== pendingActionId) return { ok: false as const, reason: 'stale' as const };
    if (!Array.isArray(game.players) || !game.players.some((p: any) => p.id === playerId)) {
      return { ok: false as const, reason: 'not_player' as const };
    }
    const declined: string[] = Array.isArray(pa.declinedIds) ? pa.declinedIds : [];
    if (declined.includes(playerId)) return { ok: true as const, room: toRoomDoc(row as RoomRow) };
    const nextGame = { ...game, pendingAction: { ...pa, declinedIds: [...declined, playerId] } };
    const { data, error: upErr } = await supabase
      .from(ROOMS_TABLE)
      .update({ game: nextGame })
      .eq('code', code)
      .eq('updated_at', (row as RoomRow).updated_at)
      .select()
      .maybeSingle();
    if (upErr) throw upErr;
    if (data) return { ok: true as const, room: toRoomDoc(data as RoomRow) };
  }
  return { ok: false as const, reason: 'busy' as const };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Account ids on lobby seats are server-owned: whatever the client sent is replaced by what the row
// already had for that seat (set at create/join from a verified token). The host can't change either.
function keepServerFields(prev: RoomDoc, incoming: RoomDoc): RoomDoc {
  const userIdOf = new Map(prev.lobby.map((p) => [p.id, p.userId ?? null]));
  return {
    ...incoming,
    code: prev.code,
    hostId: prev.hostId,
    lobby: (incoming.lobby || []).map(({ userId: _ignored, ...p }) => {
      const uid = userIdOf.get(p.id);
      return uid ? { ...p, userId: uid } : p;
    })
  };
}

// INTEGRITY_ENFORCE=1: a save that fails a check is refused (409). Anything else (the default):
// log-only — the save is accepted, but it's still logged and the game's results are stored with
// counted=false, reason "integrity". Run log-only first, read integrity_rejections, then enforce.
const INTEGRITY_ENFORCE = process.env.INTEGRITY_ENFORCE === '1';

// Enforce mode only: the refused save leaves the row as it was, so the counter is bumped on its own.
// (In log-only mode it rides along in the accepted save, so the save's version check isn't tripped.)
async function bumpRejects(row: RoomRow) {
  if (!('integrity_rejects' in row)) return;
  try {
    await getSupabaseAdmin()
      .from(ROOMS_TABLE)
      .update({ integrity_rejects: (row.integrity_rejects ?? 0) + 1 })
      .eq('code', row.code);
  } catch (e) {
    console.error('integrity counter failed', e instanceof Error ? e.message : e);
  }
}

// The rejection log + the state_rejected analytics event. Never throws.
async function logRejection(row: RoomRow, reason: string) {
  const supabase = getSupabaseAdmin();
  const gameId = row.game_id && UUID_RE.test(row.game_id) ? row.game_id : null;
  try {
    await supabase.from('integrity_rejections').insert({ room_code: row.code, game_id: gameId, reason });
    if (gameId) {
      const g = row.game as any;
      await supabase.from('game_events').insert({
        event_id: `${gameId}-rejected-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        game_id: gameId,
        room_code: row.code,
        event_type: 'state_rejected',
        turn_number: typeof g?.turnSerial === 'number' ? g.turnSerial : null,
        payload: { reason, enforced: INTEGRITY_ENFORCE }
      });
    }
  } catch (e) {
    console.error('integrity log failed', e instanceof Error ? e.message : e);
  }
}

export type GuardedSave =
  | { ok: true; room: RoomDoc }
  | { ok: false; reason: 'not_found' | 'busy' | 'stale' | string; rejected?: boolean };

// Every client save of a room goes through here (PUT /api/rooms/[code]). The incoming room is checked
// against the row it replaces (lib/integrity.ts); a failing save is logged, and refused when
// INTEGRITY_ENFORCE=1 (otherwise accepted, with the game marked so its results don't count). The write is
// conditional on the row version, so the check is always against the true previous save: if another
// save landed in between, the incoming room is re-checked against that one.
export async function guardedSaveRoom(code: string, incoming: RoomDoc, baseUpdatedAt?: string | null): Promise<GuardedSave> {
  const supabase = getSupabaseAdmin();
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.from(ROOMS_TABLE).select('*').eq('code', code).maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, reason: 'not_found' };
    const row = data as RoomRow;
    // Built on an older version than the row: another save landed first. That's a timing race,
    // not cheating, so it's refused as "stale" without touching the integrity log or the results.
    // (A client that sends no base, e.g. an old cached app, is checked against the current row.)
    if (baseUpdatedAt && row.updated_at !== baseUpdatedAt) return { ok: false, reason: 'stale' };
    if (isExpired(row.expires_at)) {
      await deleteExpiredRoom(code);
      return { ok: false, reason: 'not_found' };
    }
    const prev = toRoomDoc(row);
    const next = keepServerFields(prev, incoming);
    const extra: Partial<RoomRow> = {};

    let check: { ok: true } | { ok: false; reason: string } = { ok: true };
    if (prev.started && prev.game) {
      check = next.started && next.game ? checkTransition(prev.game, next.game) : { ok: false, reason: 'game_removed' };
    } else if (next.started || next.game) {
      check = next.started && next.game ? checkFreshDeal(next.game) : { ok: false, reason: 'bad_deal' };
      // Only once leaderboard-schema.sql has added these columns; before that, saves work as before.
      if (check.ok && 'game_id' in row) {
        const gid = (next.game as any)?.analyticsId;
        extra.game_id = typeof gid === 'string' && UUID_RE.test(gid) ? gid : null;
        extra.game_started_at = new Date().toISOString();
        extra.integrity_rejects = 0;
      }
    }
    if (!check.ok) {
      if (INTEGRITY_ENFORCE) {
        await bumpRejects(row);
        await logRejection(row, check.reason);
        return { ok: false, reason: check.reason, rejected: true };
      }
      // log-only: accept the save, and mark the game in the same write
      if ('integrity_rejects' in row) {
        const freshDeal = !(prev.started && prev.game) && next.started && next.game;
        if (freshDeal) {
          const gid = (next.game as any)?.analyticsId;
          extra.game_id = typeof gid === 'string' && UUID_RE.test(gid) ? gid : null;
          extra.game_started_at = new Date().toISOString();
          extra.integrity_rejects = 1;
        } else {
          extra.integrity_rejects = (row.integrity_rejects ?? 0) + 1;
        }
      }
    }

    const { data: saved, error: upErr } = await supabase
      .from(ROOMS_TABLE)
      .update({ ...toRoomRow(next), ...extra })
      .eq('code', code)
      .eq('updated_at', row.updated_at)
      .select()
      .maybeSingle();
    if (upErr) throw upErr;
    if (!saved) continue; // another save landed first: re-check against it

    const savedRow = saved as RoomRow;
    if (!check.ok) await logRejection(savedRow, check.reason);
    const prevWinner = (prev.game as any)?.winner;
    const nextWinner = (next.game as any)?.winner;
    if (prev.started && !prevWinner && nextWinner) {
      try {
        await writeResults({
          code,
          lobby: savedRow.lobby ?? [],
          game: savedRow.game,
          gameId: savedRow.game_id ?? null,
          gameStartedAt: savedRow.game_started_at ?? null,
          integrityRejects: savedRow.integrity_rejects ?? 0
        });
      } catch (e) {
        // Results must never break the game; a failed write is logged and the game goes on.
        console.error('writeResults failed', e instanceof Error ? e.message : e);
      }
    }
    return { ok: true, room: toRoomDoc(savedRow) };
  }
  return { ok: false, reason: 'busy' };
}

export async function joinRoom(code: string, rawPlayer: PlayerMeta, userId: string | null = null) {
  const { userId: _ignored, ...base } = rawPlayer;
  const player: PlayerMeta = userId ? { ...base, userId } : base;
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

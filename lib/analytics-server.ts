import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ANALYTICS_EVENT_TYPES, type AnalyticsEventType } from '@/lib/analytics-config';

// Server-side analytics writer. All inserts are idempotent (unique event_id /
// primary keys + ignoreDuplicates), raw events are append-only, and every
// failure is swallowed after logging a sanitized message — analytics must
// never break gameplay.

const MAX_EVENTS_PER_REQUEST = 40;
const MAX_ITEMS_PER_EVENT = 12;
// Snapshot events legitimately carry one entry per card in the game.
const MAX_ITEMS_PER_SNAPSHOT = 160;
const MAX_TEXT = 120;
const RARITIES = new Set(['common', 'medium', 'rare']);
const ITEM_EVENT_TYPES = new Set(['items_played', 'deal_snapshot', 'end_snapshot']);

export type AnalyticsEventRow = {
  event_id: string;
  game_id: string;
  room_code: string | null;
  player_id: string | null;
  player_name: string | null;
  is_bot: boolean | null;
  event_type: AnalyticsEventType;
  turn_number: number | null;
  round_number: number | null;
  coord_type: string | null;
  coord_region: string | null;
  coord_item_count: number | null;
  coord_card_id: string | null;
  cards_played_count: number | null;
  items: Array<{ name: string; region: string; rarity: string; cid?: string }> | null;
  action_type: string | null;
  skip_reason: string | null;
  payload: Record<string, unknown> | null;
};

function asText(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v.slice(0, MAX_TEXT) : null;
}

function asInt(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null;
}

function asBool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// items payload: only what is printed on the card face — never anything else
// about a hand. cid is the opaque card-instance id used for lifecycle tracing
// (deal_snapshot carries no player attribution, so cid links deal → play).
function sanitizeItems(v: unknown, max: number): AnalyticsEventRow['items'] {
  if (!Array.isArray(v)) return null;
  const out: Array<{ name: string; region: string; rarity: string; cid?: string }> = [];
  for (const raw of v.slice(0, max)) {
    if (!raw || typeof raw !== 'object') continue;
    const name = asText((raw as Record<string, unknown>).name);
    const region = asText((raw as Record<string, unknown>).region);
    const rarity = asText((raw as Record<string, unknown>).rarity);
    if (!name || !region || !rarity || !RARITIES.has(rarity)) continue;
    const cid = asText((raw as Record<string, unknown>).cid);
    out.push(cid ? { name, region, rarity, cid } : { name, region, rarity });
  }
  return out.length > 0 ? out : null;
}

// payload is allowlisted per event type; everything else is dropped.
function sanitizePayload(eventType: string, v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const p = v as Record<string, unknown>;
  if (eventType === 'action_played') {
    const out: Record<string, unknown> = {};
    const target = asText(p.target_player_id);
    if (target) out.target_player_id = target;
    const targetBot = asBool(p.target_is_bot);
    if (targetBot !== null) out.target_is_bot = targetBot;
    return Object.keys(out).length ? out : null;
  }
  if (eventType === 'block_used') {
    const out: Record<string, unknown> = {};
    const blockedType = asText(p.blocked_action_type);
    if (blockedType) out.blocked_action_type = blockedType;
    const blockedActor = asText(p.blocked_actor_player_id);
    if (blockedActor) out.blocked_actor_player_id = blockedActor;
    return Object.keys(out).length ? out : null;
  }
  if (eventType === 'coord_changed') {
    const locked = asBool(p.locked_by_freeze);
    return locked === null ? null : { locked_by_freeze: locked };
  }
  if (eventType === 'turn_started') {
    const out: Record<string, unknown> = {};
    const handSize = asInt(p.hand_size);
    if (handSize !== null) out.hand_size = handSize;
    const hadValid = asBool(p.had_valid_move);
    if (hadValid !== null) out.had_valid_move = hadValid;
    if (Array.isArray(p.playable_items)) {
      const names = p.playable_items.map(asText).filter((s): s is string => !!s).slice(0, MAX_ITEMS_PER_EVENT);
      if (names.length) out.playable_items = names;
    }
    return Object.keys(out).length ? out : null;
  }
  if (eventType === 'end_snapshot') {
    if (!Array.isArray(p.standings)) return null;
    const standings = p.standings
      .slice(0, 6)
      .map((s) => {
        if (!s || typeof s !== 'object') return null;
        const r = s as Record<string, unknown>;
        const playerId = asText(r.player_id);
        const handSize = asInt(r.hand_size);
        if (!playerId || handSize === null) return null;
        return { player_id: playerId, is_bot: !!r.is_bot, is_winner: !!r.is_winner, hand_size: handSize };
      })
      .filter((s) => s !== null);
    return standings.length ? { standings } : null;
  }
  if (eventType === 'player_identity') {
    const pid = asText(p.client_pid);
    return pid ? { client_pid: pid } : null;
  }
  return null;
}

export function sanitizeEvent(raw: unknown): AnalyticsEventRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  const eventId = asText(e.event_id);
  const eventType = asText(e.event_type) as AnalyticsEventType | null;
  if (!eventId || !eventType || !ANALYTICS_EVENT_TYPES.includes(eventType)) return null;
  if (!isUuid(e.game_id)) return null;
  return {
    event_id: eventId,
    game_id: e.game_id,
    room_code: asText(e.room_code),
    player_id: asText(e.player_id),
    player_name: asText(e.player_name),
    is_bot: asBool(e.is_bot),
    event_type: eventType,
    turn_number: asInt(e.turn_number),
    round_number: asInt(e.round_number),
    coord_type: asText(e.coord_type),
    coord_region: asText(e.coord_region),
    coord_item_count: asInt(e.coord_item_count),
    coord_card_id: asText(e.coord_card_id),
    cards_played_count: asInt(e.cards_played_count),
    items: ITEM_EVENT_TYPES.has(eventType)
      ? sanitizeItems(e.items, eventType === 'items_played' ? MAX_ITEMS_PER_EVENT : MAX_ITEMS_PER_SNAPSHOT)
      : null,
    action_type: asText(e.action_type),
    skip_reason: asText(e.skip_reason),
    payload: sanitizePayload(eventType, e.payload),
  };
}

function logAnalyticsError(where: string, error: unknown) {
  // Sanitized: message only, never row contents or keys.
  const message = error instanceof Error ? error.message : 'unknown_error';
  console.error(`[analytics] ${where} failed: ${message}`);
}

export async function insertEvents(rawEvents: unknown[]): Promise<{ accepted: number }> {
  const rows = rawEvents
    .slice(0, MAX_EVENTS_PER_REQUEST)
    .map(sanitizeEvent)
    .filter((r): r is AnalyticsEventRow => r !== null);
  if (rows.length === 0) return { accepted: 0 };
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('game_events')
      .upsert(rows, { onConflict: 'event_id', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  } catch (error) {
    logAnalyticsError('insertEvents', error);
  }
  return { accepted: rows.length };
}

type GameStartedBody = {
  gameId: string;
  roomCode?: string | null;
  rulesetVersion?: string;
  players?: Array<{ id?: string; name?: string; isBot?: boolean }>;
  firstCoord?: { type?: string; region?: string | null; itemCount?: number } | null;
};

export async function recordGameStarted(body: GameStartedBody) {
  if (!isUuid(body.gameId)) return;
  const players = Array.isArray(body.players) ? body.players.slice(0, 6) : [];
  if (players.length === 0) return;
  const roomCode = asText(body.roomCode);
  const bots = players.filter((p) => !!p.isBot).length;
  try {
    const supabase = getSupabaseAdmin();
    const { error: sessionError } = await supabase.from('game_sessions').upsert(
      {
        id: body.gameId,
        room_code: roomCode,
        ruleset_version: asText(body.rulesetVersion) ?? 'v1',
        started_at: new Date().toISOString(),
        player_count: players.length,
        human_count: players.length - bots,
        bot_count: bots,
        completed: false,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );
    if (sessionError) throw new Error(sessionError.message);

    const playerRows = players
      .map((p) => ({
        game_id: body.gameId,
        player_id: asText(p.id),
        player_name: asText(p.name),
        is_bot: !!p.isBot,
        won: false,
      }))
      .filter((p) => p.player_id !== null);
    const { error: playersError } = await supabase
      .from('game_players')
      .upsert(playerRows, { onConflict: 'game_id,player_id', ignoreDuplicates: true });
    if (playersError) throw new Error(playersError.message);

    const firstPlayer = players[0];
    const startEvents: unknown[] = [
      {
        event_id: `${body.gameId}-game_started`,
        game_id: body.gameId,
        room_code: roomCode,
        event_type: 'game_started',
        turn_number: 0,
        round_number: 1,
      },
      ...players.map((p) => ({
        event_id: `${body.gameId}-join-${p.id}`,
        game_id: body.gameId,
        room_code: roomCode,
        player_id: p.id,
        player_name: p.name,
        is_bot: !!p.isBot,
        event_type: 'player_joined',
        turn_number: 0,
        round_number: 1,
      })),
      {
        event_id: `${body.gameId}-t0-start`,
        game_id: body.gameId,
        room_code: roomCode,
        player_id: firstPlayer?.id,
        player_name: firstPlayer?.name,
        is_bot: !!firstPlayer?.isBot,
        event_type: 'turn_started',
        turn_number: 0,
        round_number: 1,
        coord_type: asText(body.firstCoord?.type),
        coord_region: asText(body.firstCoord?.region),
        coord_item_count: asInt(body.firstCoord?.itemCount),
      },
    ];
    await insertEvents(startEvents);
  } catch (error) {
    logAnalyticsError('recordGameStarted', error);
  }
}

type GameFinishedBody = {
  gameId: string;
  roomCode?: string | null;
  winnerPlayerId?: string;
  winnerName?: string;
  winnerIsBot?: boolean;
  totalTurns?: number;
  totalRounds?: number;
};

export async function recordGameFinished(body: GameFinishedBody) {
  if (!isUuid(body.gameId)) return;
  try {
    const supabase = getSupabaseAdmin();
    // Idempotent: only the first finish call finds ended_at null.
    const { data: session, error: readError } = await supabase
      .from('game_sessions')
      .select('id, started_at, ended_at')
      .eq('id', body.gameId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!session || session.ended_at) return;

    const endedAt = new Date();
    const startedAt = new Date(session.started_at);
    const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
    const { error: updateError } = await supabase
      .from('game_sessions')
      .update({
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
        winner_player_id: asText(body.winnerPlayerId),
        winner_name: asText(body.winnerName),
        winner_is_bot: asBool(body.winnerIsBot),
        total_turns: asInt(body.totalTurns),
        total_rounds: asInt(body.totalRounds),
        completed: true,
      })
      .eq('id', body.gameId)
      .is('ended_at', null);
    if (updateError) throw new Error(updateError.message);

    const winnerId = asText(body.winnerPlayerId);
    if (winnerId) {
      const { error: wonError } = await supabase
        .from('game_players')
        .update({ won: true })
        .eq('game_id', body.gameId)
        .eq('player_id', winnerId);
      if (wonError) throw new Error(wonError.message);
    }

    await insertEvents([
      {
        event_id: `${body.gameId}-winner`,
        game_id: body.gameId,
        room_code: body.roomCode,
        player_id: body.winnerPlayerId,
        player_name: body.winnerName,
        is_bot: body.winnerIsBot,
        event_type: 'winner_declared',
        turn_number: body.totalTurns,
        round_number: body.totalRounds,
      },
      {
        event_id: `${body.gameId}-game_finished`,
        game_id: body.gameId,
        room_code: body.roomCode,
        event_type: 'game_finished',
        turn_number: body.totalTurns,
        round_number: body.totalRounds,
      },
    ]);
  } catch (error) {
    logAnalyticsError('recordGameFinished', error);
  }
}

type FeedbackBody = {
  gameId?: string;
  playerId?: string;
  clientPid?: string;
  fun?: number;
  clarity?: number;
  playAgain?: boolean;
  comment?: string;
};

// Optional post-game survey. First submission per (game, player) wins;
// duplicates are ignored. Comment is length-capped, everything sanitized.
export async function recordFeedback(body: FeedbackBody) {
  if (!isUuid(body.gameId)) return;
  const playerId = asText(body.playerId);
  if (!playerId) return;
  const rating = (v: unknown) => {
    const n = asInt(v);
    return n !== null && n >= 1 && n <= 5 ? n : null;
  };
  const fun = rating(body.fun);
  const clarity = rating(body.clarity);
  const playAgain = asBool(body.playAgain);
  const comment = typeof body.comment === 'string' ? body.comment.slice(0, 280).trim() || null : null;
  if (fun === null && clarity === null && playAgain === null && !comment) return;
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('game_feedback').upsert(
      {
        game_id: body.gameId,
        player_id: playerId,
        client_pid: asText(body.clientPid),
        fun,
        clarity,
        play_again: playAgain,
        comment,
      },
      { onConflict: 'game_id,player_id', ignoreDuplicates: true }
    );
    if (error) throw new Error(error.message);
  } catch (error) {
    logAnalyticsError('recordFeedback', error);
  }
}

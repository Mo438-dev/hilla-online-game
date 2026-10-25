import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  DAILY_CAP,
  MIN_DURATION_MS,
  MIN_HUMANS,
  MIN_TURNS_PER_HUMAN,
  SAME_GROUP_DAILY_CAP,
  riyadhDayStart,
  scoreHumans
} from '@/lib/leaderboard/scoring';

type LobbyEntry = { id: string; userId?: string | null; isBot?: boolean };
type FinishedRoom = {
  code: string;
  lobby: LobbyEntry[];
  game: any;
  gameId: string | null;
  gameStartedAt: string | null;
  integrityRejects: number;
};

const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// Writes one game_results row per human seat that has an account, the moment a save first sets the
// winner (called from the server, never the client). Idempotent on (game_id, user_id), so a repeated
// final save is harmless. Every row is stored; rows that fail a rule keep counted=false + a reason.
// Duration comes from the server's own clock (game_started_at, set when it accepted the deal), not
// from timestamps inside the client-written game.
export async function writeResults(room: FinishedRoom) {
  const game = room.game;
  const gameId = room.gameId;
  if (!game?.winner || !isUuid(gameId)) return;

  const supabase = getSupabaseAdmin();
  const players: any[] = game.players || [];
  const humans = players.filter((p) => !p.isBot);
  const userOf = new Map(room.lobby.filter((e) => isUuid(e.userId)).map((e) => [e.id, e.userId as string]));
  const accounted = humans.filter((p) => userOf.has(p.id));
  if (!accounted.length) return;

  // game_results.game_id references game_sessions, which is normally written by the client's
  // analytics call. If that never arrived (blocked, offline), create a minimal row first so the
  // results can't fail on the foreign key. Insert-if-missing: a row the client already wrote is left
  // as it is, and the client's own later insert is a no-op on the same columns.
  const { error: sessionError } = await supabase.from('game_sessions').upsert(
    {
      id: gameId,
      room_code: room.code,
      ruleset_version: game.rulesetVersion ?? 'v2.1',
      started_at: room.gameStartedAt ?? new Date().toISOString(),
      player_count: players.length,
      human_count: humans.length,
      bot_count: players.length - humans.length,
      completed: false
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );
  if (sessionError) throw sessionError;

  const now = Date.now();
  const durationMs = room.gameStartedAt ? now - Date.parse(room.gameStartedAt) : null;
  const turns = typeof game.turnSerial === 'number' ? game.turnSerial : 0;
  const H = humans.length;
  const scores = scoreHumans(
    humans.map((p) => ({ id: p.id, cardsLeft: (p.hand || []).length, inactive: !!p.inactive })),
    game.winner
  );
  const groupKey = humans
    .map((p) => userOf.get(p.id) || `seat:${p.id}`)
    .sort()
    .join(',');

  // Game-level reasons first; they apply to every seat.
  let gameReason: string | null = null;
  if (room.integrityRejects > 0) gameReason = 'integrity';
  else if (H < MIN_HUMANS) gameReason = 'too_few_humans';
  else if (durationMs === null || durationMs < MIN_DURATION_MS) gameReason = 'too_short';
  else if (turns < H * MIN_TURNS_PER_HUMAN) gameReason = 'too_few_turns';
  else if (!(game.players.find((p: any) => p.id === game.winner)?.hand?.length === 0)) gameReason = 'integrity';

  const dayStart = riyadhDayStart(new Date(now));
  const rows = [];
  for (const p of accounted) {
    const userId = userOf.get(p.id)!;
    const s = scores.get(p.id)!;
    let reason = gameReason;
    if (!reason) {
      const { count: today } = await supabase
        .from('game_results')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('counted', true)
        .gte('finished_at', dayStart);
      if ((today ?? 0) >= DAILY_CAP) reason = 'daily_cap';
    }
    if (!reason) {
      const { count: sameGroup } = await supabase
        .from('game_results')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('group_key', groupKey)
        .eq('counted', true)
        .gte('finished_at', dayStart);
      if ((sameGroup ?? 0) >= SAME_GROUP_DAILY_CAP) reason = 'same_group_cap';
    }
    rows.push({
      game_id: gameId,
      room_code: room.code,
      user_id: userId,
      place: s.place,
      humans: H,
      total_players: players.length,
      cards_left: (p.hand || []).length,
      beaten: s.beaten,
      won: s.won,
      finished: s.finished,
      points: s.points, // what the seat earned; only counted rows are summed on the board
      counted: !reason,
      reason,
      group_key: groupKey,
      duration_ms: durationMs,
      turns,
      ruleset_version: game.rulesetVersion ?? 'v2.1'
    });
  }

  const { error } = await supabase.from('game_results').upsert(rows, { onConflict: 'game_id,user_id', ignoreDuplicates: true });
  if (error) throw error;

  // Analytics: link the seats to accounts.
  for (const p of accounted) {
    await supabase.from('game_players').update({ user_id: userOf.get(p.id) }).eq('game_id', gameId).eq('player_id', p.id);
  }
}

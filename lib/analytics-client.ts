// Browser-side analytics emitter. Fire-and-forget only: every call swallows
// all errors — a failed or missing analytics backend must never block or
// break gameplay. No secrets here; the browser only ever talks to our own
// /api/analytics routes.
import { deviceInfo } from '@/lib/device';

export function newAnalyticsGameId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  // RFC4122-ish v4 fallback for older browsers.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function post(path: string, body: unknown) {
  try {
    fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never throw into gameplay code */
  }
}

export function sendAnalyticsEvents(events: unknown[]) {
  if (!Array.isArray(events) || events.length === 0) return;
  post('/api/analytics/events', { events });
}

// Pseudonymous, browser-local player id used only to distinguish first-time
// vs returning players. Random uuid in localStorage — no emails, IPs, or
// fingerprinting. Returns null when storage is unavailable (private mode).
export function getClientPid(): string | null {
  try {
    const KEY = 'hilla_analytics_pid';
    let pid = localStorage.getItem(KEY);
    if (!pid) {
      pid = newAnalyticsGameId();
      localStorage.setItem(KEY, pid);
    }
    return pid;
  } catch {
    return null;
  }
}

export function sendFeedback(body: {
  gameId: string;
  playerId: string;
  clientPid?: string | null;
  fun?: number | null;
  clarity?: number | null;
  playAgain?: boolean | null;
  comment?: string;
  stepsAnswered?: number;
  skippedAtStep?: number | null;
}) {
  if (!body || !body.gameId || !body.playerId) return;
  post('/api/analytics/feedback', body);
}

// One event per game listing every dealt item card (name/region/rarity/cid).
// Entries are sorted by cid so the order carries no information about which
// player holds which card.
export function sendDealSnapshot(game: any, roomCode: string | null) {
  if (!game || !game.analyticsId) return;
  const items = (game.players || [])
    .flatMap((p: any) => (p.hand || []).filter((c: any) => c.kind === 'item'))
    .map((c: any) => ({ name: c.name, region: c.region, rarity: c.rarity, cid: c.id }))
    .sort((a: any, b: any) => String(a.cid).localeCompare(String(b.cid)));
  if (!items.length) return;
  sendAnalyticsEvents([
    {
      event_id: `${game.analyticsId}-deal`,
      game_id: game.analyticsId,
      room_code: roomCode || null,
      event_type: 'deal_snapshot',
      turn_number: 0,
      round_number: 1,
      items,
    },
  ]);
}

export function sendGameStarted(game: any, roomCode: string | null) {
  if (!game || !game.analyticsId) return;
  post('/api/analytics/games', {
    type: 'started',
    gameId: game.analyticsId,
    roomCode: roomCode || null,
    rulesetVersion: game.rulesetVersion ?? 'v2.1',
    mode: roomCode ? 'online' : 'local',
    cardsPerPlayer: game.cardsPerPlayer ?? (game.players?.[0]?.hand?.length || null),
    players: (game.players || []).map((p: any, seat: number) => ({ id: p.id, name: p.name, isBot: !!p.isBot, seat })),
    firstCoord: game.currentCoord
      ? {
          type: game.currentCoord.type,
          region: game.currentCoord.region || null,
          itemCount: Array.isArray(game.currentCoord.items) ? game.currentCoord.items.length : null,
        }
      : null,
  });
}

export function sendGameFinished(game: any, roomCode: string | null) {
  if (!game || !game.analyticsId || !game.winner) return;
  const winner = (game.players || []).find((p: any) => p.id === game.winner);
  post('/api/analytics/games', {
    type: 'finished',
    gameId: game.analyticsId,
    roomCode: roomCode || null,
    winnerPlayerId: game.winner,
    winnerName: winner ? winner.name : null,
    winnerIsBot: winner ? !!winner.isBot : null,
    totalTurns: typeof game.turnSerial === 'number' ? game.turnSerial : null,
    totalRounds:
      typeof game.turnSerial === 'number' && Array.isArray(game.players) && game.players.length > 0
        ? Math.floor(game.turnSerial / game.players.length) + 1
        : null,
    coordRounds: typeof game.coordRounds === 'number' ? game.coordRounds : null,
    durationMs: game.endedAtMs && game.startedAtMs ? game.endedAtMs - game.startedAtMs : null,
    // per seat: where they finished; the server adds what they played from the game's events
    players: (game.players || []).map((p: any) => ({
      id: p.id,
      cardsLeft: (p.hand || []).length,
      inactive: !!p.inactive,
      timesTargeted: game.stats?.targetedByPlayerId?.[p.id] || 0,
    })),
  });
}

// What only this phone knows about its own seat (premoves, reactions) plus coarse device info.
export function sendSeatStats(game: any, roomCode: string | null, seatId: string, local: { premovesSet: number; premovesPlayed: number; reactionsSent: number }, lang: string) {
  if (!game || !game.analyticsId || !seatId) return;
  post('/api/analytics/games', { type: 'seat', gameId: game.analyticsId, roomCode: roomCode || null, playerId: seatId, ...local, ...deviceInfo(), lang });
}

// App-level events (premoves, received cards, head-to-head, share, resume pill, leaderboard,
// username, survey steps). gameId is null for the ones that happen outside a game.
export function sendAppEvent(type: string, gameId: string | null, fields: Record<string, unknown> = {}) {
  sendAnalyticsEvents([{ event_id: `${type}-${newAnalyticsGameId()}`, event_type: type, game_id: gameId, ...fields }]);
}

// Uncaught errors from this device: a few per minute at most, and only a capped amount per page load.
let errorTimes: number[] = [];
let errorsSent = 0;
export function reportClientError(message: string, stack: string | null, sessionId: string | null, headers: Record<string, string> = {}) {
  const now = Date.now();
  errorTimes = errorTimes.filter((t) => now - t < 60_000);
  if (errorTimes.length >= 3 || errorsSent >= 20) return;
  errorTimes.push(now);
  errorsSent++;
  try {
    fetch('/api/analytics/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ message: String(message || '').slice(0, 500), stack: stack ? String(stack).slice(0, 2000) : null, sessionId, path: location.pathname, ...deviceInfo() }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

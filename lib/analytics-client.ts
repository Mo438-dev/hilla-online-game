// Browser-side analytics emitter. Fire-and-forget only: every call swallows
// all errors — a failed or missing analytics backend must never block or
// break gameplay. No secrets here; the browser only ever talks to our own
// /api/analytics routes.
import { RULESET_VERSION } from '@/lib/analytics-config';

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
}) {
  if (!body || !body.gameId || !body.playerId) return;
  post('/api/analytics/feedback', body);
}

export function sendGameStarted(game: any, roomCode: string | null) {
  if (!game || !game.analyticsId) return;
  post('/api/analytics/games', {
    type: 'started',
    gameId: game.analyticsId,
    roomCode: roomCode || null,
    rulesetVersion: RULESET_VERSION,
    players: (game.players || []).map((p: any) => ({ id: p.id, name: p.name, isBot: !!p.isBot })),
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
  });
}

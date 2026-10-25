// Per-save integrity checks for online rooms. Every PUT to hilla_rooms is compared against the row
// it replaces; a save that breaks one of these rules is rejected (409) and logged as
// "state_rejected". These are cheap structural checks, not a full replay of the move reducers:
// they stop cards being invented, deleted or duplicated, turns being skipped or rewound, other
// players' hands being emptied, and the winner being forged or changed.

type Card = { id: string };
type Player = { id: string; hand: Card[]; isBot?: boolean; inactive?: boolean };
export type Game = {
  analyticsId?: string;
  players: Player[];
  drawPile: Card[];
  discardPile: Card[];
  digOptions?: { playerId: string; cards: Card[] } | null;
  pendingAction?: { id: string } | null;
  currentPlayerIndex: number;
  turnSerial?: number;
  winner?: string | null;
};

export type IntegrityResult = { ok: true } | { ok: false; reason: string };

const MAX_HAND = 20;

function isGame(g: unknown): g is Game {
  const x = g as Game;
  return (
    !!x &&
    typeof x === 'object' &&
    Array.isArray(x.players) &&
    x.players.every((p) => p && typeof p.id === 'string' && Array.isArray(p.hand)) &&
    Array.isArray(x.drawPile) &&
    Array.isArray(x.discardPile) &&
    typeof x.currentPlayerIndex === 'number'
  );
}

// Every play card in the game: hands + draw + discard + the open «فتّش الصندوق» choice.
export function allCardIds(g: Game): string[] {
  const ids: string[] = [];
  for (const p of g.players) for (const c of p.hand) ids.push(c?.id);
  for (const c of g.drawPile) ids.push(c?.id);
  for (const c of g.discardPile) ids.push(c?.id);
  for (const c of g.digOptions?.cards ?? []) ids.push(c?.id);
  return ids;
}

function uniqueIds(ids: string[]): boolean {
  return ids.every((id) => typeof id === 'string' && id.length > 0) && new Set(ids).size === ids.length;
}

// A brand-new deal (room going from lobby to started). Nothing to compare against, so check that it
// looks like a fresh deal: unique cards, equal hands within the cap, nothing played yet.
export function checkFreshDeal(g: unknown): IntegrityResult {
  if (!isGame(g)) return { ok: false, reason: 'malformed_game' };
  const ids = allCardIds(g);
  if (!uniqueIds(ids)) return { ok: false, reason: 'duplicate_card' };
  const size = g.players[0]?.hand.length ?? 0;
  if (g.players.length < 2 || size < 1 || size > MAX_HAND) return { ok: false, reason: 'bad_deal' };
  if (g.players.some((p) => p.hand.length !== size)) return { ok: false, reason: 'bad_deal' };
  if (g.discardPile.length || g.digOptions || g.pendingAction || g.winner) return { ok: false, reason: 'bad_deal' };
  if ((g.turnSerial ?? 0) !== 0 || g.currentPlayerIndex !== 0) return { ok: false, reason: 'bad_deal' };
  if (new Set(g.players.map((p) => p.id)).size !== g.players.length) return { ok: false, reason: 'bad_deal' };
  return { ok: true };
}

// One save of a game in progress, against the save it replaces.
export function checkTransition(prevRaw: unknown, nextRaw: unknown): IntegrityResult {
  if (!isGame(prevRaw) || !isGame(nextRaw)) return { ok: false, reason: 'malformed_game' };
  const prev = prevRaw;
  const next = nextRaw;

  if (next.analyticsId !== prev.analyticsId) return { ok: false, reason: 'game_replaced' };

  // Seats are fixed once the game starts.
  if (next.players.length !== prev.players.length || next.players.some((p, i) => p.id !== prev.players[i].id)) {
    return { ok: false, reason: 'seats_changed' };
  }
  if (next.players.some((p, i) => !!p.isBot !== !!prev.players[i].isBot)) return { ok: false, reason: 'seats_changed' };

  // Cards: same count, still unique, nothing new.
  const prevIds = allCardIds(prev);
  const nextIds = allCardIds(next);
  if (nextIds.length !== prevIds.length) return { ok: false, reason: 'card_count' };
  if (!uniqueIds(nextIds)) return { ok: false, reason: 'duplicate_card' };
  const known = new Set(prevIds);
  if (nextIds.some((id) => !known.has(id))) return { ok: false, reason: 'unknown_card' };

  // Turns only move forward, one at a time.
  const prevTurn = prev.turnSerial ?? 0;
  const nextTurn = next.turnSerial ?? 0;
  if (nextTurn < prevTurn) return { ok: false, reason: 'turn_backwards' };
  if (nextTurn > prevTurn + 1) return { ok: false, reason: 'turn_skipped' };

  // Winner: set once, never changed or cleared, and only for an empty hand.
  if (prev.winner) {
    if (next.winner !== prev.winner) return { ok: false, reason: 'winner_changed' };
  } else if (next.winner) {
    const w = next.players.find((p) => p.id === next.winner);
    if (!w || w.hand.length !== 0) return { ok: false, reason: 'winner_not_empty' };
  }

  // Hands: only the player whose turn it was may lose cards, except while an action is resolving
  // (a block from anyone, or عطني وأعطيك taking from the target).
  if (!prev.pendingAction) {
    const mover = prev.players[prev.currentPlayerIndex]?.id;
    for (let i = 0; i < prev.players.length; i++) {
      const p = prev.players[i];
      if (p.id === mover) continue;
      const nextHand = new Set(next.players[i].hand.map((c) => c.id));
      if (p.hand.some((c) => !nextHand.has(c.id))) return { ok: false, reason: 'hand_shrank' };
    }
  }

  return { ok: true };
}

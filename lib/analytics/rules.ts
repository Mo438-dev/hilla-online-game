import { canonicalItem, RETIRED_ITEMS, ITEM_INFO, type Rarity } from './roster';

// Field names follow what the game really logs: item lists are in the `items` column, the coordination
// card in `coord_type`, standings carry `hand_size` / `is_winner`, and `playable_items` is left out when
// empty, so `had_valid_move` is what tells "no match" from "no payload".
export type Ev = {
  game_id: string;
  event_type: string;
  player_id: string | null;
  is_bot: boolean | null;
  turn_number: number | null;
  action_type: string | null;
  coord_type: string | null;
  items: any[] | null;
  payload: any;
};
export type Sess = { id: string; player_count: number; bot_count: number; duration_seconds: number | null; winner_player_id: string | null };

const RAR: Rarity[] = ['common', 'medium', 'rare'];
const ACTS = ['drawTwo', 'stealTwo', 'giveTake', 'freeze', 'dig'] as const;
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
export const median = (a: number[]) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const ratio = (n: number, d: number) => (d ? n / d : null);
const unload = (p: number, l: number) => ratio(p, p + l);

// Within one turn: the coordination change happens first, then the turn starts, then plays.
const ORDER: Record<string, number> = { card_entered: 0, coord_changed: 1, turn_started: 2 };
const rank = (e: Ev) => ORDER[e.event_type] ?? 3;

export function computeCell(sessions: Sess[], eventsByGame: Map<string, Ev[]>) {
  const games = sessions.length;
  const dur: number[] = [], rounds: number[] = [], turns: number[] = [];
  let tTurns = 0, tZero = 0, tNoMatch = 0, tChose = 0, tActOnly = 0, tCovered = 0, gamesEntered = 0, gamesHands = 0;
  const closest: number[] = [], others: number[] = [];
  let close3 = 0, closeN = 0;
  const rarPlayed: Record<Rarity, number> = { common: 0, medium: 0, rare: 0 };
  const rarLeft: Record<Rarity, number> = { common: 0, medium: 0, rare: 0 };
  const rarStuck: Record<Rarity, number[]> = { common: [], medium: [], rare: [] };
  const rarHeld: Record<Rarity, number[]> = { common: [], medium: [], rare: [] };
  const regPlayed: Record<string, number> = {}, regLeft: Record<string, number> = {};
  const cyc: any = { region: { n: 0, cards: 0, turns: 0, noMatch: 0 }, random: { n: 0, cards: 0, turns: 0, noMatch: 0 } };
  const act: any = Object.fromEntries(ACTS.map((a) => [a, { uses: 0, blocked: 0, users: 0, won: 0, base: 0, flips: 0 }]));

  for (const s of sessions) {
    const ev = [...(eventsByGame.get(s.id) ?? [])].sort((a, b) => (a.turn_number ?? 0) - (b.turn_number ?? 0) || rank(a) - rank(b));
    if (s.duration_seconds != null) dur.push(s.duration_seconds / 60);
    rounds.push(ev.filter((e) => e.event_type === 'coord_changed').length + 1);
    const started = ev.filter((e) => e.event_type === 'turn_started');
    turns.push(started.length);

    // turns: zero-card split (action only first, then no match, else chose not to play)
    const key = (e: Ev) => `${e.turn_number}|${e.player_id}`;
    const itemsOn = new Set(ev.filter((e) => e.event_type === 'items_played').map(key));
    const actOn = new Set(ev.filter((e) => e.event_type === 'action_played').map(key));
    for (const t of started) {
      tTurns++;
      if (itemsOn.has(key(t))) continue;
      tZero++;
      if (actOn.has(key(t))) { tActOnly++; tCovered++; continue; }
      const valid = t.payload?.had_valid_move;
      if (valid == null) continue; // no payload: counted as zero, left out of the split
      tCovered++;
      if (valid) tChose++; else tNoMatch++;
    }

    // one walk in game order: cycles, cards entered and played, action cards with the hands at that moment
    let cur: { type: string | null; cards: number; turns: number; noMatch: number } | null = null;
    const flush = () => {
      if (cur?.type && cyc[cur.type]) { const c = cyc[cur.type]; c.n++; c.cards += cur.cards; c.turns += cur.turns; c.noMatch += cur.noMatch; }
    };
    const entered: Record<string, number> = {};
    const lastHand: Record<string, number> = {};
    const usersHere = new Set<string>();
    for (const e of ev) {
      if (e.event_type === 'coord_changed') { flush(); cur = null; continue; }
      if (e.event_type === 'card_entered') { if (e.payload?.cid) entered[e.payload.cid] = e.payload.turn_number ?? e.turn_number ?? 0; continue; }
      if (e.event_type === 'turn_started') {
        if (!cur) cur = { type: e.coord_type, cards: 0, turns: 0, noMatch: 0 };
        cur.turns++;
        if (e.payload?.had_valid_move === false) cur.noMatch++;
        if (e.player_id && e.payload?.hand_size != null) lastHand[e.player_id] = e.payload.hand_size;
        continue;
      }
      if (e.event_type === 'items_played') {
        if (!cur) cur = { type: e.coord_type, cards: 0, turns: 0, noMatch: 0 };
        cur.cards += (e.items ?? []).length;
        for (const it of e.items ?? []) {
          const name = canonicalItem(it.name);
          if (RETIRED_ITEMS.has(name) || !ITEM_INFO[name]) continue;
          const { rarity, region } = ITEM_INFO[name];
          rarPlayed[rarity]++;
          regPlayed[region] = (regPlayed[region] ?? 0) + 1;
          if (it.cid && entered[it.cid] != null) rarHeld[rarity].push((e.turn_number ?? 0) - entered[it.cid]);
        }
        continue;
      }
      if (e.event_type === 'block_used') {
        const b = act[e.payload?.blocked_action_type];
        if (b) b.blocked++;
        continue;
      }
      if (e.event_type === 'action_played' && e.action_type && act[e.action_type] && e.player_id) {
        const a = act[e.action_type];
        a.uses++;
        const k = `${e.action_type}|${e.player_id}`;
        const won = e.player_id === s.winner_player_id;
        if (!usersHere.has(k)) { usersHere.add(k); a.users++; a.base += 1 / s.player_count; if (won) a.won++; }
        // estimate: others' hands come from their last turn
        const mine = lastHand[e.player_id];
        const rest = Object.entries(lastHand).filter(([p]) => p !== e.player_id).map(([, v]) => v);
        if (won && mine != null && rest.length && mine - Math.min(...rest) >= 3) a.flips++;
      }
    }
    flush();
    if (Object.keys(entered).length) gamesEntered++;

    // end of game: closeness, cards left, stuck by rarity (hands: from delta-15)
    const end = ev.find((e) => e.event_type === 'end_snapshot');
    if (end) {
      const losers = (end.payload?.standings ?? []).filter((x: any) => !x.is_winner).map((x: any) => x.hand_size).sort((a: number, b: number) => a - b);
      if (losers.length) {
        closest.push(losers[0]);
        closeN++;
        if (losers[0] <= 3) close3++;
        if (losers.length > 1) others.push(mean(losers.slice(1))!);
      }
      for (const it of end.items ?? []) {
        const name = canonicalItem(it.name);
        if (RETIRED_ITEMS.has(name) || !ITEM_INFO[name]) continue;
        const { rarity, region } = ITEM_INFO[name];
        rarLeft[rarity]++;
        regLeft[region] = (regLeft[region] ?? 0) + 1;
      }
      const hands = end.payload?.hands ?? [];
      if (hands.length) gamesHands++;
      for (const h of hands) if (h.seat !== s.winner_player_id) RAR.forEach((r) => rarStuck[r].push(h.rarity?.[r] ?? 0));
    }
  }

  const regAvg = ratio(cyc.region.cards, cyc.region.n), rndAvg = ratio(cyc.random.cards, cyc.random.n);
  return {
    games,
    durMin: median(dur), rounds: median(rounds), turns: median(turns),
    zero: ratio(tZero, tTurns), noMatch: ratio(tNoMatch, tCovered), chose: ratio(tChose, tCovered), act: ratio(tActOnly, tCovered),
    splitCoverage: ratio(tCovered, tZero),
    closest: median(closest), others: mean(others), close3: ratio(close3, closeN),
    rarPlayed: Object.fromEntries(RAR.map((r) => [r, unload(rarPlayed[r], rarLeft[r])])),
    rarStuck: Object.fromEntries(RAR.map((r) => [r, mean(rarStuck[r])])),
    rarTurns: Object.fromEntries(RAR.map((r) => [r, median(rarHeld[r])])),
    region: Object.fromEntries(['najdi', 'sharqi', 'janoubi', 'gharbi'].map((g) => [g, unload(regPlayed[g] ?? 0, regLeft[g] ?? 0)])),
    reg: { avg: regAvg, noMatch: ratio(cyc.region.noMatch, cyc.region.turns), speed: regAvg && rndAvg ? regAvg / rndAvg : null },
    rnd: { avg: rndAvg, noMatch: ratio(cyc.random.noMatch, cyc.random.turns) },
    actions: Object.fromEntries(ACTS.map((k) => {
      const a = act[k];
      return [k, { perGame: ratio(a.uses, games), blocked: ratio(a.blocked, a.uses), win: ratio(a.won, a.users), base: ratio(a.base, a.users), flip: ratio(a.flips, a.uses), users: a.users }];
    })),
    _counts: { zeroTurns: tZero, covered: tCovered, gamesEntered, gamesHands },
  };
}

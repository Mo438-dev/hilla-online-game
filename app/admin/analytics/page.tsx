export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ADMIN_COOKIE, adminPasswordConfigured, isValidAdminToken } from '@/lib/admin-auth';
import { Bars, Card, Distribution, Empty, Flag, Kpi, PALETTE, StackedBar, Trend, tableTd, tableTh } from './charts';

// Private, server-rendered game-balance dashboard. All Supabase access stays
// on the server (service role key); the browser receives rendered HTML only.
// Every section aggregates the raw events of the *filtered* game set, so the
// global filters apply consistently across the whole page.

type SP = { [key: string]: string | string[] | undefined };
const p = (sp: SP, k: string): string => (typeof sp[k] === 'string' ? (sp[k] as string) : '');

type Session = {
  id: string;
  room_code: string | null;
  ruleset_version: string;
  started_at: string;
  duration_seconds: number | null;
  player_count: number;
  human_count: number;
  bot_count: number;
  winner_player_id: string | null;
  winner_name: string | null;
  winner_is_bot: boolean | null;
  total_turns: number | null;
  completed: boolean;
};

type Ev = {
  game_id: string;
  player_id: string | null;
  is_bot: boolean | null;
  event_type: string;
  turn_number: number | null;
  coord_type: string | null;
  coord_region: string | null;
  coord_item_count: number | null;
  coord_card_id: string | null;
  cards_played_count: number | null;
  items: Array<{ name: string; region: string; rarity: string; cid?: string }> | null;
  action_type: string | null;
  skip_reason: string | null;
  payload: any;
};

const fmt = (n: number | null | undefined, d = 1) => (n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : Number(n).toFixed(d));
const pct = (n: number | null | undefined, d = 1) => (n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : `${(Number(n) * 100).toFixed(d)}%`);
const mins = (s: number | null | undefined) => (s === null || s === undefined || Number.isNaN(Number(s)) ? '—' : `${(Number(s) / 60).toFixed(1)}m`);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const ACTION_LABELS: Record<string, string> = {
  giveTake: 'عطني وأعطيك (give-take)',
  drawTwo: 'اقدع (draw two)',
  stealTwo: 'افزع لي (steal two)',
  block: 'لا ما تقدر (block)',
  freeze: 'ثبّت الحَلّة (freeze)',
  dig: 'فتّش الصندوق (dig)',
};
const REGION_LABELS: Record<string, string> = { najdi: 'نجدي', sharqi: 'شرقي', janoubi: 'جنوبي', gharbi: 'غربي' };
const RARITY_COLORS: Record<string, string> = { common: PALETTE.gray, medium: PALETTE.gold, rare: PALETTE.maroon };

export default async function AnalyticsAdminPage({ searchParams }: { searchParams: SP }) {
  const configured = adminPasswordConfigured();
  const authed = configured && isValidAdminToken(cookies().get(ADMIN_COOKIE)?.value);

  if (!authed) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 420, margin: '80px auto', padding: 16 }}>
        <h1 style={{ fontSize: 20 }}>Hilla analytics — admin</h1>
        {!configured ? (
          <p style={{ color: '#a00' }}>ADMIN_ANALYTICS_PASSWORD is not configured on the server.</p>
        ) : (
          <form method="post" action="/api/analytics/admin-login" style={{ background: '#fff', border: '1px solid #e8e4dc', borderRadius: 12, padding: 16 }}>
            {p(searchParams, 'error') && <p style={{ color: '#a00', fontSize: 13 }}>Wrong password.</p>}
            <input type="password" name="password" placeholder="Admin password" style={{ width: '100%', padding: 8, marginBottom: 8, boxSizing: 'border-box' }} />
            <button type="submit" style={{ padding: '8px 16px' }}>Sign in</button>
          </form>
        )}
      </div>
    );
  }

  // ---- global filters (defaults: completed, all-human) ----
  const hasParams = Object.keys(searchParams).length > 0;
  const from = p(searchParams, 'from');
  const to = p(searchParams, 'to');
  const pop = p(searchParams, 'pop') || (hasParams ? 'all' : 'human'); // human | mixed | bots | all
  const players = p(searchParams, 'players');
  const done = p(searchParams, 'done') || (hasParams ? 'all' : 'yes');
  const version = p(searchParams, 'version');
  const vA = p(searchParams, 'va');
  const vB = p(searchParams, 'vb');

  let warning = '';
  let sessions: Session[] = [];
  let events: Ev[] = [];
  let feedback: any[] = [];
  let identityAll: any[] = [];
  let versions: string[] = [];
  let truncated = false;

  try {
    const supabase = getSupabaseAdmin();
    let q = supabase
      .from('game_sessions')
      .select('id, room_code, ruleset_version, started_at, duration_seconds, player_count, human_count, bot_count, winner_player_id, winner_name, winner_is_bot, total_turns, completed')
      .order('started_at', { ascending: false })
      .limit(300);
    if (from) q = q.gte('started_at', `${from}T00:00:00Z`);
    if (to) q = q.lte('started_at', `${to}T23:59:59Z`);
    if (pop === 'human') q = q.eq('bot_count', 0);
    if (pop === 'bots') q = q.eq('human_count', 0);
    if (pop === 'mixed') q = q.gt('bot_count', 0).gt('human_count', 0);
    if (players) q = q.eq('player_count', Number(players));
    if (done === 'yes') q = q.eq('completed', true);
    if (done === 'no') q = q.eq('completed', false);
    if (version) q = q.eq('ruleset_version', version);
    const sRes = await q;
    if (sRes.error) throw new Error(sRes.error.message);
    sessions = (sRes.data as Session[]) ?? [];

    const ids = sessions.map((s) => s.id);
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const eRes = await supabase
        .from('game_events')
        .select('game_id, player_id, is_bot, event_type, turn_number, coord_type, coord_region, coord_item_count, coord_card_id, cards_played_count, items, action_type, skip_reason, payload')
        .in('game_id', chunk)
        .limit(9000);
      if (eRes.error) throw new Error(eRes.error.message);
      events.push(...((eRes.data as Ev[]) ?? []));
      if ((eRes.data ?? []).length === 9000) truncated = true;
    }

    if (ids.length) {
      const fRes = await supabase.from('game_feedback').select('game_id, player_id, client_pid, fun, clarity, play_again, comment, created_at').in('game_id', ids.slice(0, 300)).limit(1500);
      if (!fRes.error) feedback = fRes.data ?? [];
    }

    const iRes = await supabase
      .from('game_events')
      .select('game_id, player_id, payload, created_at')
      .eq('event_type', 'player_identity')
      .order('created_at', { ascending: true })
      .limit(20000);
    if (!iRes.error) identityAll = iRes.data ?? [];

    const vRes = await supabase.from('game_sessions').select('ruleset_version').limit(2000);
    if (!vRes.error) versions = [...new Set((vRes.data ?? []).map((r: any) => r.ruleset_version))].sort();
  } catch (e) {
    warning = `Analytics tables not reachable (${e instanceof Error ? e.message : 'unknown'}). Run supabase/analytics-schema.sql and analytics-v2-schema.sql in the Supabase SQL editor.`;
  }

  // ================= aggregation =================
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const completed = sessions.filter((s) => s.completed);
  const tk = (e: Ev) => `${e.game_id}:${e.turn_number}`;

  const turnStarts: Ev[] = [];
  const itemsByTurn = new Map<string, Ev[]>();
  const skipsByTurn = new Map<string, Ev>();
  const actionsByTurn = new Map<string, Ev[]>();
  const dealByGame = new Map<string, Ev>();
  const endByGame = new Map<string, Ev>();
  const blockEvents: Ev[] = [];
  const actionEvents: Ev[] = [];
  const itemEvents: Ev[] = [];
  const coordChanged: Ev[] = [];

  for (const e of events) {
    if (e.event_type === 'turn_started') turnStarts.push(e);
    else if (e.event_type === 'items_played') {
      itemEvents.push(e);
      const k = tk(e);
      itemsByTurn.set(k, [...(itemsByTurn.get(k) || []), e]);
    } else if (e.event_type === 'turn_skipped') skipsByTurn.set(tk(e), e);
    else if (e.event_type === 'action_played') {
      actionEvents.push(e);
      const k = tk(e);
      actionsByTurn.set(k, [...(actionsByTurn.get(k) || []), e]);
    } else if (e.event_type === 'block_used') blockEvents.push(e);
    else if (e.event_type === 'deal_snapshot') dealByGame.set(e.game_id, e);
    else if (e.event_type === 'end_snapshot') endByGame.set(e.game_id, e);
    else if (e.event_type === 'coord_changed') coordChanged.push(e);
  }

  // ---- turn outcomes ----
  const outcomes = { played: 0, action_only: 0, no_valid: 0, chose_not: 0, bot_no_move: 0, other: 0 };
  for (const ts of turnStarts) {
    const k = tk(ts);
    if (itemsByTurn.has(k)) outcomes.played++;
    else {
      const skip = skipsByTurn.get(k);
      const acted = actionsByTurn.has(k);
      if (skip?.skip_reason === 'bot_no_valid_move') outcomes.bot_no_move++;
      else if (acted) outcomes.action_only++;
      else if (skip?.skip_reason === 'no_valid_card') outcomes.no_valid++;
      else if (skip?.skip_reason === 'manual_skip') outcomes.chose_not++;
      else outcomes.other++;
    }
  }
  const totalTurns = turnStarts.length;

  // ---- item / rarity lifecycle (restricted to games that have a deal_snapshot) ----
  const v2Games = new Set(dealByGame.keys());
  type Life = { region: string; rarity: string; dealt: number; opps: number; played: number; stuck: number; held: number[] };
  const life = new Map<string, Life>();
  const getLife = (name: string, region: string, rarity: string) => {
    let l = life.get(name);
    if (!l) life.set(name, (l = { region, rarity, dealt: 0, opps: 0, played: 0, stuck: 0, held: [] }));
    return l;
  };
  const dealtCids = new Map<string, Set<string>>();
  for (const [gid, e] of dealByGame) {
    const set = new Set<string>();
    for (const it of e.items || []) {
      getLife(it.name, it.region, it.rarity).dealt++;
      if (it.cid) set.add(it.cid);
    }
    dealtCids.set(gid, set);
  }
  for (const ts of turnStarts) {
    if (!v2Games.has(ts.game_id)) continue;
    for (const name of ts.payload?.playable_items || []) {
      const l = life.get(name);
      if (l) l.opps++;
    }
  }
  for (const e of itemEvents) {
    if (!v2Games.has(e.game_id)) continue;
    for (const it of e.items || []) {
      const l = getLife(it.name, it.region, it.rarity);
      l.played++;
      if (it.cid && dealtCids.get(e.game_id)?.has(it.cid) && e.turn_number !== null) l.held.push(e.turn_number);
    }
  }
  for (const [gid, e] of endByGame) {
    if (!v2Games.has(gid)) continue;
    for (const it of e.items || []) getLife(it.name, it.region, it.rarity).stuck++;
  }
  const lifeRows = [...life.entries()]
    .map(([name, l]) => ({ name, ...l, unload: l.dealt ? l.played / l.dealt : null, heldAvg: avg(l.held) }))
    .sort((a, b) => (a.unload ?? 2) - (b.unload ?? 2));
  const rarityAgg = ['common', 'medium', 'rare'].map((r) => {
    const rows = lifeRows.filter((x) => x.rarity === r);
    const dealt = rows.reduce((a, x) => a + x.dealt, 0);
    const played = rows.reduce((a, x) => a + x.played, 0);
    return {
      rarity: r,
      dealt,
      opps: rows.reduce((a, x) => a + x.opps, 0),
      played,
      stuck: rows.reduce((a, x) => a + x.stuck, 0),
      unload: dealt ? played / dealt : null,
      heldAvg: avg(rows.flatMap((x) => x.held)),
    };
  });
  const regionAgg = Object.keys(REGION_LABELS).map((rg) => {
    const rows = lifeRows.filter((x) => x.region === rg);
    const dealt = rows.reduce((a, x) => a + x.dealt, 0);
    const played = rows.reduce((a, x) => a + x.played, 0);
    return { region: rg, dealt, played, stuck: rows.reduce((a, x) => a + x.stuck, 0), unload: dealt ? played / dealt : null };
  });

  // ---- coordination cycles ----
  type Cycle = { type: string; region: string | null; itemCount: number | null; turns: number; noValid: number; plays: number; cards: number; players: Set<string>; frozen: boolean };
  const cycles = new Map<string, Cycle>();
  const cyc = (e: Ev) => {
    if (!e.coord_card_id) return null;
    const key = `${e.game_id}:${e.coord_card_id}`;
    let c = cycles.get(key);
    if (!c) cycles.set(key, (c = { type: e.coord_type || '?', region: e.coord_region, itemCount: e.coord_item_count, turns: 0, noValid: 0, plays: 0, cards: 0, players: new Set(), frozen: false }));
    return c;
  };
  for (const e of turnStarts) {
    const c = cyc(e);
    if (c) c.turns++;
  }
  for (const [, skip] of skipsByTurn) {
    const c = cyc(skip);
    if (c && skip.skip_reason !== 'manual_skip') c.noValid++;
  }
  for (const e of itemEvents) {
    const c = cyc(e);
    if (c) {
      c.plays++;
      c.cards += e.cards_played_count || 0;
      if (e.player_id) c.players.add(e.player_id);
    }
  }
  for (const e of coordChanged) if (e.payload?.locked_by_freeze) {
    const c = cyc(e);
    if (c) c.frozen = true;
  }
  const cycleList = [...cycles.values()].filter((c) => c.turns > 0);
  const coordStats = (list: Cycle[]) => ({
    n: list.length,
    avgCards: avg(list.map((c) => c.cards)),
    nobody: list.length ? list.filter((c) => c.plays === 0).length / list.length : null,
    avgPlayers: avg(list.map((c) => c.players.size)),
    forcedSkip: (() => {
      const t = list.reduce((a, c) => a + c.turns, 0);
      return t ? list.reduce((a, c) => a + c.noValid, 0) / t : null;
    })(),
  });
  const regionCycles = cycleList.filter((c) => c.type === 'region');
  const randomCycles = cycleList.filter((c) => c.type === 'random');
  const byItemCount = [...new Set(cycleList.map((c) => c.itemCount).filter((n) => n !== null))]
    .sort()
    .map((count) => ({ count, ...coordStats(cycleList.filter((c) => c.itemCount === count)) }));
  const coordByRegion = Object.keys(REGION_LABELS)
    .map((rg) => ({ region: rg, ...coordStats(regionCycles.filter((c) => c.region === rg)) }))
    .filter((r) => r.n > 0);
  const frozenStats = coordStats(cycleList.filter((c) => c.frozen));
  const normalStats = coordStats(cycleList.filter((c) => !c.frozen));

  // ---- action cards ----
  const actionAgg = Object.keys(ACTION_LABELS).map((t) => {
    const uses = actionEvents.filter((e) => e.action_type === t);
    const blocked = blockEvents.filter((e) => e.payload?.blocked_action_type === t).length;
    const timing = uses
      .map((e) => {
        const s = byId.get(e.game_id);
        return s?.total_turns && e.turn_number !== null ? e.turn_number / s.total_turns : null;
      })
      .filter((x): x is number => x !== null);
    const userKeys = new Set(uses.map((e) => `${e.game_id}|${e.player_id}`));
    let wins = 0;
    let baselineSum = 0;
    for (const k of userKeys) {
      const [gid, pid] = k.split('|');
      const s = byId.get(gid);
      if (!s?.completed) continue;
      if (s.winner_player_id === pid) wins++;
      baselineSum += 1 / s.player_count;
    }
    const nUsers = [...userKeys].filter((k) => byId.get(k.split('|')[0])?.completed).length;
    return { type: t, uses: uses.length, blocked, timing: avg(timing), nUsers, winRate: nUsers ? wins / nUsers : null, baseline: nUsers ? baselineSum / nUsers : null };
  });
  const blockUses = blockEvents.length;
  // dig follow-up: same player played items in the same turn after digging
  const digEvents = actionEvents.filter((e) => e.action_type === 'dig');
  const digFollow = digEvents.filter((e) => (itemsByTurn.get(tk(e)) || []).some((ie) => ie.player_id === e.player_id)).length;

  // ---- closeness ----
  const gaps: number[] = [];
  const loserAvgs: number[] = [];
  for (const [gid, e] of endByGame) {
    if (!byId.get(gid)?.completed) continue;
    const losers = (e.payload?.standings || []).filter((s: any) => !s.is_winner).map((s: any) => s.hand_size);
    if (!losers.length) continue;
    gaps.push(Math.min(...losers));
    loserAvgs.push(losers.reduce((a: number, b: number) => a + b, 0) / losers.length);
  }
  const gapBuckets = [
    { label: '0–1', value: gaps.filter((g) => g <= 1).length, color: PALETTE.green },
    { label: '2–3', value: gaps.filter((g) => g >= 2 && g <= 3).length, color: PALETTE.teal },
    { label: '4–5', value: gaps.filter((g) => g >= 4 && g <= 5).length, color: PALETTE.gold },
    { label: '6–7', value: gaps.filter((g) => g >= 6 && g <= 7).length, color: '#c77b3d' },
    { label: '8+', value: gaps.filter((g) => g >= 8).length, color: PALETTE.red },
  ];

  // ---- player experience (lifetime timeline per pseudonymous pid) ----
  const pidTimeline = new Map<string, string[]>();
  for (const r of identityAll) {
    const pid = r.payload?.client_pid;
    if (!pid) continue;
    const list = pidTimeline.get(pid) || [];
    if (!list.includes(r.game_id)) list.push(r.game_id);
    pidTimeline.set(pid, list);
  }
  type Cohort = { players: number; wins: number; completedGames: number };
  const cohorts: Record<string, Cohort> = { 'First game': { players: 0, wins: 0, completedGames: 0 }, 'Games 2–3': { players: 0, wins: 0, completedGames: 0 }, 'Games 4+': { players: 0, wins: 0, completedGames: 0 } };
  const filteredPids = new Set<string>();
  for (const r of identityAll) {
    const pid = r.payload?.client_pid;
    const s = byId.get(r.game_id);
    if (!pid || !s) continue;
    filteredPids.add(pid);
    const prior = (pidTimeline.get(pid) || []).indexOf(r.game_id);
    const cohort = prior <= 0 ? 'First game' : prior <= 2 ? 'Games 2–3' : 'Games 4+';
    cohorts[cohort].players++;
    if (s.completed) cohorts[cohort].completedGames++;
    if (s.completed && s.winner_player_id === r.player_id) cohorts[cohort].wins++;
  }
  const returningPids = [...filteredPids].filter((pid) => (pidTimeline.get(pid) || []).length >= 2).length;
  const replayRate = filteredPids.size ? returningPids / filteredPids.size : null;

  // ---- survey ----
  const funs = feedback.map((f) => f.fun).filter((x) => x !== null);
  const clars = feedback.map((f) => f.clarity).filter((x) => x !== null);
  const agains = feedback.map((f) => f.play_again).filter((x) => x !== null);
  const comments = feedback.filter((f) => f.comment).slice(0, 6);

  // ---- headline ----
  const humanWins = completed.filter((s) => s.winner_is_bot === false).length;
  const botWins = completed.filter((s) => s.winner_is_bot === true).length;
  const cardsTotal = itemEvents.reduce((a, e) => a + (e.cards_played_count || 0), 0);
  const zeroCardTurns = totalTurns - new Set([...itemsByTurn.keys()]).size;

  // ---- trend (games per UTC day) ----
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    const d = s.started_at.slice(0, 10);
    byDay.set(d, (byDay.get(d) || 0) + 1);
  }
  const trendPoints = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-30).map(([label, value]) => ({ label: label.slice(5), value }));

  // ---- version comparison ----
  const perVersion = (v: string) => {
    const ss = sessions.filter((s) => s.ruleset_version === v);
    const cc = ss.filter((s) => s.completed);
    const ids = new Set(ss.map((s) => s.id));
    const ie = itemEvents.filter((e) => ids.has(e.game_id));
    const tt = turnStarts.filter((e) => ids.has(e.game_id)).length;
    const sk = [...skipsByTurn.values()].filter((e) => ids.has(e.game_id)).length;
    const fb = feedback.filter((f) => ids.has(f.game_id));
    return {
      games: ss.length,
      completionRate: ss.length ? cc.length / ss.length : null,
      dur: avg(cc.map((s) => s.duration_seconds || 0)),
      turns: avg(cc.map((s) => s.total_turns || 0)),
      humanWin: cc.length ? cc.filter((s) => s.winner_is_bot === false).length / cc.length : null,
      cardsPerPlay: ie.length ? ie.reduce((a, e) => a + (e.cards_played_count || 0), 0) / ie.length : null,
      skipRate: tt ? sk / tt : null,
      fun: avg(fb.map((f) => f.fun).filter((x: any) => x !== null)),
    };
  };
  const cmpA = vA ? perVersion(vA) : null;
  const cmpB = vB ? perVersion(vB) : null;
  const cmpRows: Array<{ label: string; key: keyof ReturnType<typeof perVersion>; render: (v: any) => string }> = [
    { label: 'Games', key: 'games', render: (v) => String(v ?? '—') },
    { label: 'Completion rate', key: 'completionRate', render: pct },
    { label: 'Avg duration', key: 'dur', render: mins },
    { label: 'Avg turns', key: 'turns', render: (v) => fmt(v) },
    { label: 'Human win rate', key: 'humanWin', render: pct },
    { label: 'Cards per item play', key: 'cardsPerPlay', render: (v) => fmt(v, 2) },
    { label: 'Skip rate', key: 'skipRate', render: pct },
    { label: 'Avg fun (survey)', key: 'fun', render: (v) => fmt(v, 2) },
  ];
  const dlt = (a: any, b: any) => {
    const na = Number(a), nb = Number(b);
    if (!Number.isFinite(na) || !Number.isFinite(nb) || na === 0) return '—';
    const d = ((nb - na) / Math.abs(na)) * 100;
    return `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`;
  };

  const hiddenFilters = (
    <>
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <input type="hidden" name="pop" value={pop} />
      <input type="hidden" name="players" value={players} />
      <input type="hidden" name="done" value={done} />
      <input type="hidden" name="version" value={version} />
    </>
  );
  const selStyle: React.CSSProperties = { padding: '6px 8px', borderRadius: 8, border: '1px solid #ddd6c9', background: '#fff', fontSize: 13 };

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", background: '#f6f4ef', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: PALETTE.maroon, margin: 0 }}>حُلّة · Game analytics</h1>
            <p style={{ fontSize: 12.5, color: '#7d766c', margin: '4px 0 0' }}>
              Balance & experience dashboard — {sessions.length} game{sessions.length === 1 ? '' : 's'} in view
              {truncated ? ' (event sample truncated for very large sets)' : ''}
            </p>
          </div>
          <form method="post" action="/api/analytics/admin-login">
            <input type="hidden" name="intent" value="logout" />
            <button type="submit" style={{ fontSize: 12, background: 'none', border: '1px solid #ddd6c9', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#7d766c' }}>
              Sign out
            </button>
          </form>
        </div>

        {warning && (
          <div style={{ background: '#fdf0ee', border: '1px solid #eac6c0', color: '#8c2f24', borderRadius: 12, padding: 14, margin: '16px 0', fontSize: 13 }}>{warning}</div>
        )}

        {/* -------- global filters -------- */}
        <form method="get" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', background: '#fff', border: '1px solid #e8e4dc', borderRadius: 14, padding: '14px 16px', margin: '16px 0', fontSize: 12 }}>
          {[
            ['From', <input key="f" type="date" name="from" defaultValue={from} style={selStyle} />],
            ['To', <input key="t" type="date" name="to" defaultValue={to} style={selStyle} />],
            [
              'Population',
              <select key="p" name="pop" defaultValue={pop} style={selStyle}>
                <option value="human">All-human</option>
                <option value="mixed">Mixed human/bot</option>
                <option value="bots">All-bot</option>
                <option value="all">All games</option>
              </select>,
            ],
            [
              'Players',
              <select key="n" name="players" defaultValue={players} style={selStyle}>
                <option value="">Any</option>
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>,
            ],
            [
              'Status',
              <select key="d" name="done" defaultValue={done} style={selStyle}>
                <option value="yes">Completed</option>
                <option value="no">Incomplete</option>
                <option value="all">All</option>
              </select>,
            ],
            [
              'Ruleset',
              <select key="v" name="version" defaultValue={version} style={selStyle}>
                <option value="">All versions</option>
                {versions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>,
            ],
          ].map(([label, control], i) => (
            <label key={i} style={{ display: 'grid', gap: 4, color: '#7d766c', fontWeight: 600 }}>
              {label as string}
              {control as React.ReactNode}
            </label>
          ))}
          <button type="submit" style={{ padding: '7px 18px', background: PALETTE.maroon, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
            Apply
          </button>
          <a href="/admin/analytics?pop=all&done=all" style={{ fontSize: 11.5, color: '#7d766c' }}>reset</a>
        </form>

        {/* -------- KPI row -------- */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
          <Kpi label="Games" value={String(sessions.length)} sub={`${completed.length} completed (${pct(sessions.length ? completed.length / sessions.length : null, 0)})`} />
          <Kpi label="Avg duration" value={mins(avg(completed.map((s) => s.duration_seconds || 0)))} sub={`${fmt(avg(completed.map((s) => s.total_turns || 0)), 0)} turns avg`} />
          <Kpi label="Human vs bot wins" value={`${humanWins} / ${botWins}`} sub={`of ${completed.length} completed`} />
          <Kpi label="Replay rate" value={pct(replayRate, 0)} sub={`${returningPids}/${filteredPids.size} browsers return`} tone={replayRate !== null && replayRate >= 0.4 ? 'good' : undefined} />
          <Kpi label="Fun rating" value={funs.length ? `${fmt(avg(funs), 2)} / 5` : '—'} sub={funs.length ? `n=${funs.length}` : 'no survey data yet'} tone={funs.length && avg(funs)! >= 4 ? 'good' : undefined} />
          <Kpi label="Rules clarity" value={clars.length ? `${fmt(avg(clars), 2)} / 5` : '—'} sub={clars.length ? `n=${clars.length}` : 'no survey data yet'} />
          <Kpi label="Would play again" value={agains.length ? pct(agains.filter(Boolean).length / agains.length, 0) : '—'} sub={agains.length ? `n=${agains.length}` : 'no survey data yet'} />
          <Kpi label="Zero-card turn rate" value={pct(totalTurns ? zeroCardTurns / totalTurns : null)} sub={`${zeroCardTurns} of ${totalTurns} turns`} tone={totalTurns && zeroCardTurns / totalTurns > 0.45 ? 'bad' : undefined} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(480px, 100%), 1fr))', gap: 16 }}>
          <Card title="Games per day" sub="Volume trend across the filtered set (UTC days).">
            <Trend points={trendPoints} />
          </Card>

          <Card title="Turn outcomes" sub="What actually happens on a turn — the stuck-player signal. “Chose not to play” needs V2 games.">
            <StackedBar
              segments={[
                { label: 'Played items', value: outcomes.played, color: PALETTE.green },
                { label: 'Action only', value: outcomes.action_only, color: PALETTE.blue },
                { label: 'No matching item', value: outcomes.no_valid, color: PALETTE.red },
                { label: 'Had a play, skipped anyway', value: outcomes.chose_not, color: PALETTE.gold },
                { label: 'Bot: no valid move', value: outcomes.bot_no_move, color: PALETTE.gray },
                { label: 'Other', value: outcomes.other, color: '#d8d2c6' },
              ]}
            />
            <p style={{ fontSize: 11, color: '#9a948a', marginTop: 8 }}>
              High “no matching item” = players are starved by the coordination deck; high “skipped anyway” = hoarding or unclear incentives.
            </p>
          </Card>

          <Card title="Rarity balance" sub={`Lifecycle from ${v2Games.size} V2 game(s) with deal snapshots — older games excluded.`} wide>
            {v2Games.size === 0 ? (
              <Empty text="No V2 games yet — rarity lifecycle needs games played after this update." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#7d766c', marginBottom: 6 }}>Unload rate (played ÷ dealt)</div>
                  <Bars data={rarityAgg.map((r) => ({ label: r.rarity, value: r.unload ?? 0, color: RARITY_COLORS[r.rarity], hint: `${r.played}/${r.dealt}` }))} format={(v) => pct(v)} maxOverride={1} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#7d766c', marginBottom: 6 }}>Avg turn a card gets played</div>
                  <Bars data={rarityAgg.map((r) => ({ label: r.rarity, value: r.heldAvg ?? 0, color: RARITY_COLORS[r.rarity] }))} format={(v) => fmt(v, 1)} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#7d766c', marginBottom: 6 }}>Stuck with losers at game end</div>
                  <Bars data={rarityAgg.map((r) => ({ label: r.rarity, value: r.stuck, color: RARITY_COLORS[r.rarity] }))} format={(v) => String(v)} />
                </div>
              </div>
            )}
          </Card>

          <Card title="Item lifecycle — hardest to unload first" sub="Dealt → playable opportunities → played → stuck. V2 games only." wide>
            {lifeRows.length === 0 ? (
              <Empty text="No V2 games yet." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={tableTh}>Item</th>
                      <th style={tableTh}>Region</th>
                      <th style={tableTh}>Rarity</th>
                      <th style={tableTh}>Dealt</th>
                      <th style={tableTh}>Opportunities</th>
                      <th style={tableTh}>Played</th>
                      <th style={tableTh}>Unload rate</th>
                      <th style={tableTh}>Avg turn played</th>
                      <th style={tableTh}>Stuck w/ losers</th>
                      <th style={tableTh}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lifeRows.map((r) => (
                      <tr key={r.name}>
                        <td style={{ ...tableTd, fontWeight: 700 }}>{r.name}</td>
                        <td style={tableTd}>{REGION_LABELS[r.region] || r.region}</td>
                        <td style={{ ...tableTd, color: RARITY_COLORS[r.rarity] }}>{r.rarity}</td>
                        <td style={tableTd}>{r.dealt}</td>
                        <td style={tableTd}>{r.opps}</td>
                        <td style={tableTd}>{r.played}</td>
                        <td style={tableTd}>{pct(r.unload)}</td>
                        <td style={tableTd}>{fmt(r.heldAvg)}</td>
                        <td style={tableTd}>{r.stuck}</td>
                        <td style={tableTd}>{r.unload !== null && r.unload < 0.35 && r.dealt >= 6 ? <Flag kind="warn" text="hard to unload" /> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Region balance" sub="Unload rate per region (V2 games).">
            <Bars data={regionAgg.map((r) => ({ label: REGION_LABELS[r.region], value: r.unload ?? 0, hint: `${r.played}/${r.dealt} · ${r.stuck} stuck`, color: PALETTE.purple }))} format={(v) => pct(v)} maxOverride={1} />
          </Card>

          <Card title="Coordination cards — region vs random" sub="Cycles = one coordination card's lifetime on the table.">
            {cycleList.length === 0 ? (
              <Empty text="Needs V2 games (cycle tracing was added in V2)." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={tableTh}></th>
                      <th style={tableTh}>Cycles</th>
                      <th style={tableTh}>Avg cards played</th>
                      <th style={tableTh}>Nobody played</th>
                      <th style={tableTh}>Avg players benefiting</th>
                      <th style={tableTh}>Forced-skip rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Region cards', s: coordStats(regionCycles) },
                      { label: 'Random cards', s: coordStats(randomCycles) },
                    ].map((row) => (
                      <tr key={row.label}>
                        <td style={{ ...tableTd, fontWeight: 700 }}>{row.label}</td>
                        <td style={tableTd}>{row.s.n}</td>
                        <td style={tableTd}>{fmt(row.s.avgCards, 2)}</td>
                        <td style={tableTd}>{pct(row.s.nobody)}</td>
                        <td style={tableTd}>{fmt(row.s.avgPlayers, 2)}</td>
                        <td style={tableTd}>{pct(row.s.forcedSkip)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: '#7d766c' }}>By items shown on the card</div>
                <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 4 }}>
                  <thead>
                    <tr>
                      <th style={tableTh}>Items</th>
                      <th style={tableTh}>Cycles</th>
                      <th style={tableTh}>Avg cards played</th>
                      <th style={tableTh}>Nobody played</th>
                      <th style={tableTh}>Forced-skip rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byItemCount.map((r) => (
                      <tr key={String(r.count)}>
                        <td style={{ ...tableTd, fontWeight: 700 }}>{String(r.count)}</td>
                        <td style={tableTd}>{r.n}</td>
                        <td style={tableTd}>{fmt(r.avgCards, 2)}</td>
                        <td style={tableTd}>{pct(r.nobody)}</td>
                        <td style={tableTd}>{pct(r.forcedSkip)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="ثبّت الحَلّة — freeze impact" sub="Do frozen (repeated) coordination cycles actually pay off?">
            {frozenStats.n === 0 ? (
              <Empty text="No frozen cycles recorded yet." />
            ) : (
              <Bars
                data={[
                  { label: `Frozen cycles (${frozenStats.n})`, value: frozenStats.avgCards ?? 0, color: PALETTE.gold },
                  { label: `Normal cycles (${normalStats.n})`, value: normalStats.avgCards ?? 0, color: PALETTE.teal },
                ]}
                format={(v) => `${fmt(v, 2)} cards`}
              />
            )}
          </Card>

          <Card title="Action cards" sub="Usage, blocks, timing and outcome advantage vs the 1/players baseline. Flags need ≥5 users." wide>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={tableTh}>Action</th>
                    <th style={tableTh}>Uses</th>
                    <th style={tableTh}>Blocked by لا ما تقدر</th>
                    <th style={tableTh}>Avg timing in game</th>
                    <th style={tableTh}>Users (completed games)</th>
                    <th style={tableTh}>Win rate when used</th>
                    <th style={tableTh}>Baseline</th>
                    <th style={tableTh}>Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {actionAgg
                    .filter((a) => a.type !== 'block')
                    .map((a) => {
                      const strong = a.nUsers >= 5 && a.winRate !== null && a.baseline !== null && a.winRate > a.baseline * 1.25;
                      const weak = a.nUsers >= 5 && a.winRate !== null && a.baseline !== null && a.winRate < a.baseline * 0.75;
                      return (
                        <tr key={a.type}>
                          <td style={{ ...tableTd, fontWeight: 700 }}>{ACTION_LABELS[a.type]}</td>
                          <td style={tableTd}>{a.uses}</td>
                          <td style={tableTd}>{a.blocked}</td>
                          <td style={tableTd}>{a.timing !== null ? pct(a.timing, 0) : '—'}</td>
                          <td style={tableTd}>{a.nUsers}</td>
                          <td style={tableTd}>{pct(a.winRate)}</td>
                          <td style={tableTd}>{pct(a.baseline)}</td>
                          <td style={tableTd}>
                            {strong ? <Flag kind="warn" text="possibly too strong" /> : weak ? <Flag kind="info" text="possibly too weak" /> : a.nUsers >= 5 ? <Flag kind="ok" text="balanced" /> : <Flag kind="info" text="small sample" />}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: 12.5, color: '#5b554b', flexWrap: 'wrap' }}>
              <span>🛡️ لا ما تقدر used <b>{blockUses}</b> times</span>
              <span>
                🔍 فتّش الصندوق: <b>{digEvents.length}</b> digs, <b>{digEvents.length ? pct(digFollow / digEvents.length, 0) : '—'}</b> immediately followed by an item play
              </span>
            </div>
          </Card>

          <Card title="Game closeness" sub="Nearest competitor's remaining cards when someone wins (completed V2 games).">
            {gaps.length === 0 ? (
              <Empty text="Needs completed V2 games (final standings snapshot)." />
            ) : (
              <>
                <Distribution buckets={gapBuckets} />
                <div style={{ display: 'flex', gap: 20, marginTop: 10, fontSize: 12.5, color: '#5b554b', flexWrap: 'wrap' }}>
                  <span>Close (≤3): <b>{pct(gaps.filter((g) => g <= 3).length / gaps.length, 0)}</b></span>
                  <span>One-sided (≥8): <b>{pct(gaps.filter((g) => g >= 8).length / gaps.length, 0)}</b></span>
                  <span>Avg loser cards left: <b>{fmt(avg(loserAvgs))}</b></span>
                  <span style={{ color: '#9a948a' }}>n={gaps.length}</span>
                </div>
              </>
            )}
          </Card>

          <Card title="Player experience" sub="Pseudonymous browser ids only — no accounts, emails or fingerprints.">
            {filteredPids.size === 0 ? (
              <Empty text="No identity events yet (V2 games only)." />
            ) : (
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={tableTh}>Cohort</th>
                    <th style={tableTh}>Seats</th>
                    <th style={tableTh}>Win rate</th>
                    <th style={tableTh}>Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(cohorts).map(([label, c]) => (
                    <tr key={label}>
                      <td style={{ ...tableTd, fontWeight: 700 }}>{label}</td>
                      <td style={tableTd}>{c.players}</td>
                      <td style={tableTd}>{c.completedGames ? pct(c.wins / c.completedGames) : '—'}</td>
                      <td style={tableTd}>{c.players ? pct(c.completedGames / c.players) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Survey comments" sub={`Latest free-text feedback (${feedback.length} responses in view).`}>
            {comments.length === 0 ? (
              <Empty text="No comments yet." />
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {comments.map((c, i) => (
                  <div key={i} style={{ background: '#faf8f4', border: '1px solid #f1ede5', borderRadius: 10, padding: '8px 12px', fontSize: 13 }} dir="auto">
                    {c.comment}
                    <div style={{ fontSize: 10.5, color: '#9a948a', marginTop: 4 }}>
                      fun {c.fun ?? '—'}/5 · clarity {c.clarity ?? '—'}/5 · {c.play_again === true ? 'would replay' : c.play_again === false ? 'would not replay' : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Compare ruleset versions" sub="Side-by-side balance metrics over the current filtered set." wide>
            <form method="get" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12, fontSize: 12 }}>
              {hiddenFilters}
              <label style={{ display: 'grid', gap: 4, color: '#7d766c', fontWeight: 600 }}>
                Version A
                <select name="va" defaultValue={vA} style={selStyle}>
                  <option value="">—</option>
                  {versions.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 4, color: '#7d766c', fontWeight: 600 }}>
                Version B
                <select name="vb" defaultValue={vB} style={selStyle}>
                  <option value="">—</option>
                  {versions.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <button type="submit" style={{ padding: '7px 16px', background: PALETTE.teal, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                Compare
              </button>
            </form>
            {cmpA && cmpB ? (
              <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 640 }}>
                <thead>
                  <tr>
                    <th style={tableTh}>Metric</th>
                    <th style={tableTh}>{vA}</th>
                    <th style={tableTh}>{vB}</th>
                    <th style={tableTh}>Δ B vs A</th>
                  </tr>
                </thead>
                <tbody>
                  {cmpRows.map((m) => (
                    <tr key={m.key}>
                      <td style={{ ...tableTd, fontWeight: 700 }}>{m.label}</td>
                      <td style={tableTd}>{m.render((cmpA as any)[m.key])}</td>
                      <td style={tableTd}>{m.render((cmpB as any)[m.key])}</td>
                      <td style={tableTd}>{dlt((cmpA as any)[m.key], (cmpB as any)[m.key])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty text="Pick two versions to compare (both need games in the current filter)." />
            )}
          </Card>

          <Card title="Recent games" wide>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={tableTh}>Started (UTC)</th>
                    <th style={tableTh}>Room</th>
                    <th style={tableTh}>Version</th>
                    <th style={tableTh}>Players</th>
                    <th style={tableTh}>Bots</th>
                    <th style={tableTh}>Turns</th>
                    <th style={tableTh}>Duration</th>
                    <th style={tableTh}>Winner</th>
                    <th style={tableTh}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.slice(0, 15).map((g) => (
                    <tr key={g.id}>
                      <td style={tableTd}>{g.started_at.replace('T', ' ').slice(0, 16)}</td>
                      <td style={tableTd}>{g.room_code || 'local'}</td>
                      <td style={tableTd}>{g.ruleset_version}</td>
                      <td style={tableTd}>{g.player_count}</td>
                      <td style={tableTd}>{g.bot_count}</td>
                      <td style={tableTd}>{g.total_turns ?? '—'}</td>
                      <td style={tableTd}>{mins(g.duration_seconds)}</td>
                      <td style={tableTd}>{g.winner_name ? `${g.winner_name}${g.winner_is_bot ? ' 🤖' : ''}` : '—'}</td>
                      <td style={tableTd}>{g.completed ? <Flag kind="ok" text="completed" /> : <Flag kind="info" text="incomplete" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <p style={{ fontSize: 11, color: '#9a948a', marginTop: 18 }}>
          All sections respect the global filters. Metrics marked “V2” require games played after the V2 update; older games show as unavailable rather than zero.
          Definitions: unload rate = played ÷ dealt · one-sided = nearest competitor still holds ≥8 cards · replay rate = share of browsers seen in ≥2 lifetime games.
        </p>
      </div>
    </div>
  );
}

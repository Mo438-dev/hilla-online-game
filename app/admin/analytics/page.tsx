export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ADMIN_COOKIE, adminPasswordConfigured, isValidAdminToken } from '@/lib/admin-auth';

// Private, server-rendered analytics dashboard. All Supabase access happens
// here on the server with the service role key; the browser only ever
// receives rendered HTML. Access requires ADMIN_ANALYTICS_PASSWORD.

type SearchParams = { [key: string]: string | string[] | undefined };

type GameRow = {
  id: string;
  room_code: string | null;
  ruleset_version: string;
  started_at: string;
  duration_seconds: number | null;
  player_count: number;
  human_count: number;
  bot_count: number;
  winner_name: string | null;
  winner_is_bot: boolean | null;
  total_turns: number | null;
  completed: boolean;
  turns_started: number;
  item_play_events: number;
  cards_played_total: number;
  zero_card_turns: number;
  skip_count: number;
  no_valid_card_skips: number;
  random_coord_count: number;
  region_coord_count: number;
};

function param(sp: SearchParams, key: string): string {
  const v = sp[key];
  return typeof v === 'string' ? v : '';
}

function fmt(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n).toFixed(digits);
}

function pct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${(Number(n) * 100).toFixed(1)}%`;
}

function mins(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '—';
  return `${(Number(seconds) / 60).toFixed(1)} min`;
}

function delta(a: number | null | undefined, b: number | null | undefined): string {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb) || na === 0) return '—';
  const d = ((nb - na) / Math.abs(na)) * 100;
  return `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`;
}

const box: React.CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16, background: '#fff' };
const th: React.CSSProperties = { textAlign: 'left', borderBottom: '1px solid #ccc', padding: '4px 8px', fontSize: 12 };
const td: React.CSSProperties = { borderBottom: '1px solid #eee', padding: '4px 8px', fontSize: 13 };
const statBox: React.CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: '10px 14px', minWidth: 140, background: '#fff' };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={statBox}>
      <div style={{ fontSize: 11, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

export default async function AnalyticsAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const configured = adminPasswordConfigured();
  const token = cookies().get(ADMIN_COOKIE)?.value;
  const authed = configured && isValidAdminToken(token);

  if (!authed) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 420, margin: '80px auto', padding: 16 }}>
        <h1 style={{ fontSize: 20 }}>Hilla analytics — admin</h1>
        {!configured ? (
          <p style={{ color: '#a00' }}>
            ADMIN_ANALYTICS_PASSWORD is not configured on the server. Set it in the environment (Vercel project settings /
            .env.local) to enable this dashboard.
          </p>
        ) : (
          <form method="post" action="/api/analytics/admin-login" style={box}>
            {param(searchParams, 'error') && <p style={{ color: '#a00', fontSize: 13 }}>Wrong password.</p>}
            <input
              type="password"
              name="password"
              placeholder="Admin password"
              style={{ width: '100%', padding: 8, marginBottom: 8, boxSizing: 'border-box' }}
            />
            <button type="submit" style={{ padding: '8px 16px' }}>
              Sign in
            </button>
          </form>
        )}
      </div>
    );
  }

  // ---- filters ----
  const from = param(searchParams, 'from');
  const to = param(searchParams, 'to');
  const bots = param(searchParams, 'bots') || 'all'; // all | human | withbots
  const players = param(searchParams, 'players'); // '' | 2..6
  const done = param(searchParams, 'done') || 'all'; // all | yes | no
  const version = param(searchParams, 'version'); // '' = all
  const vA = param(searchParams, 'va');
  const vB = param(searchParams, 'vb');

  let setupWarning = '';
  let games: GameRow[] = [];
  let versions: string[] = [];
  let rarityRows: any[] = [];
  let coordRows: any[] = [];
  let durationRows: any[] = [];
  let advantageRows: any[] = [];
  let comparisonRows: any[] = [];
  let actionUsage: Record<string, number> = {};

  try {
    const supabase = getSupabaseAdmin();

    let q = supabase.from('analytics_game_summary').select('*').order('started_at', { ascending: false }).limit(500);
    if (from) q = q.gte('started_at', `${from}T00:00:00Z`);
    if (to) q = q.lte('started_at', `${to}T23:59:59Z`);
    if (bots === 'human') q = q.eq('bot_count', 0);
    if (bots === 'withbots') q = q.gt('bot_count', 0);
    if (players) q = q.eq('player_count', Number(players));
    if (done === 'yes') q = q.eq('completed', true);
    if (done === 'no') q = q.eq('completed', false);
    if (version) q = q.eq('ruleset_version', version);
    const gamesRes = await q;
    if (gamesRes.error) throw new Error(gamesRes.error.message);
    games = (gamesRes.data as GameRow[]) ?? [];

    const versionsRes = await supabase.from('game_sessions').select('ruleset_version').limit(1000);
    if (!versionsRes.error) versions = [...new Set((versionsRes.data ?? []).map((r: any) => r.ruleset_version))].sort();

    const withVersion = (qq: any) => (version ? qq.eq('ruleset_version', version) : qq);
    const [rarityRes, coordRes, durationRes, advantageRes, comparisonRes] = await Promise.all([
      withVersion(supabase.from('analytics_rarity_summary').select('*')),
      withVersion(supabase.from('analytics_coord_summary').select('*')).order('turns_skipped_under', { ascending: false }).limit(12),
      withVersion(supabase.from('analytics_duration_estimate').select('*')).limit(20),
      withVersion(supabase.from('analytics_action_advantage').select('*')),
      supabase.from('analytics_version_comparison').select('*'),
    ]);
    rarityRows = rarityRes.data ?? [];
    coordRows = coordRes.data ?? [];
    durationRows = durationRes.data ?? [];
    advantageRows = advantageRes.data ?? [];
    comparisonRows = comparisonRes.data ?? [];

    // Action usage, filter-consistent: counted over the filtered games.
    const gameIds = games.slice(0, 200).map((g) => g.id);
    if (gameIds.length) {
      const usageRes = await supabase
        .from('game_events')
        .select('action_type')
        .eq('event_type', 'action_played')
        .in('game_id', gameIds)
        .limit(5000);
      if (!usageRes.error) {
        for (const row of usageRes.data ?? []) {
          const t = (row as any).action_type || '?';
          actionUsage[t] = (actionUsage[t] || 0) + 1;
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    setupWarning = `Analytics tables are not reachable (${message}). Run supabase/analytics-schema.sql in the Supabase SQL editor.`;
  }

  // ---- headline aggregates over the filtered games ----
  const completedGames = games.filter((g) => g.completed);
  const sum = (rows: GameRow[], f: (g: GameRow) => number) => rows.reduce((a, g) => a + (f(g) || 0), 0);
  const totalTurnsStarted = sum(games, (g) => g.turns_started);
  const humanWins = completedGames.filter((g) => g.winner_is_bot === false).length;
  const botWins = completedGames.filter((g) => g.winner_is_bot === true).length;
  const randomCoords = sum(games, (g) => g.random_coord_count);
  const regionCoords = sum(games, (g) => g.region_coord_count);
  const itemEvents = sum(games, (g) => g.item_play_events);
  const cardsTotal = sum(games, (g) => g.cards_played_total);
  const byPlayerCount = new Map<number, { games: number; completed: number }>();
  for (const g of games) {
    const e = byPlayerCount.get(g.player_count) || { games: 0, completed: 0 };
    e.games += 1;
    if (g.completed) e.completed += 1;
    byPlayerCount.set(g.player_count, e);
  }

  const rarityAgg = new Map<string, number>();
  let rarityTotal = 0;
  for (const r of rarityRows) {
    rarityAgg.set(r.rarity, (rarityAgg.get(r.rarity) || 0) + Number(r.times_played));
    rarityTotal += Number(r.times_played);
  }

  const compareA = comparisonRows.find((r: any) => r.ruleset_version === vA);
  const compareB = comparisonRows.find((r: any) => r.ruleset_version === vB);
  const compareMetrics: Array<{ label: string; key: string; render: (v: any) => string }> = [
    { label: 'Games played', key: 'games_played', render: (v) => String(v ?? '—') },
    { label: 'Avg duration', key: 'avg_duration_seconds', render: (v) => mins(v) },
    { label: 'Avg turns', key: 'avg_total_turns', render: (v) => fmt(v) },
    { label: 'Human win rate', key: 'human_win_rate', render: (v) => pct(v) },
    { label: 'Avg cards / item play', key: 'avg_cards_per_item_play', render: (v) => fmt(v, 2) },
    { label: 'Skip rate', key: 'skip_rate', render: (v) => pct(v) },
    { label: 'Random coord share', key: 'random_coord_share', render: (v) => pct(v) },
  ];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1100, margin: '0 auto', padding: 16, background: '#f7f5f0', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 22 }}>Hilla game analytics</h1>
        <form method="post" action="/api/analytics/admin-login">
          <input type="hidden" name="intent" value="logout" />
          <button type="submit" style={{ fontSize: 12 }}>Sign out</button>
        </form>
      </div>

      {setupWarning && (
        <div style={{ ...box, background: '#fff3f3', borderColor: '#e0a0a0', color: '#900' }}>{setupWarning}</div>
      )}

      <form method="get" style={{ ...box, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', fontSize: 13 }}>
        <label>
          From
          <br />
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label>
          To
          <br />
          <input type="date" name="to" defaultValue={to} />
        </label>
        <label>
          Players
          <br />
          <select name="bots" defaultValue={bots}>
            <option value="all">All games</option>
            <option value="human">Human-only</option>
            <option value="withbots">With bots</option>
          </select>
        </label>
        <label>
          Player count
          <br />
          <select name="players" defaultValue={players}>
            <option value="">Any</option>
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <br />
          <select name="done" defaultValue={done}>
            <option value="all">All</option>
            <option value="yes">Completed</option>
            <option value="no">Incomplete</option>
          </select>
        </label>
        <label>
          Ruleset version
          <br />
          <select name="version" defaultValue={version}>
            <option value="">All</option>
            {versions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" style={{ padding: '6px 14px' }}>Apply</button>
      </form>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Stat label="Total games" value={String(games.length)} />
        <Stat label="Completed" value={String(completedGames.length)} />
        <Stat label="Avg duration (completed)" value={mins(completedGames.length ? sum(completedGames, (g) => g.duration_seconds || 0) / completedGames.length : null)} />
        <Stat label="Avg turns / game" value={fmt(completedGames.length ? sum(completedGames, (g) => g.total_turns || 0) / completedGames.length : null)} />
        <Stat label="Human wins" value={`${humanWins} (${pct(completedGames.length ? humanWins / completedGames.length : null)})`} />
        <Stat label="Bot wins" value={`${botWins} (${pct(completedGames.length ? botWins / completedGames.length : null)})`} />
        <Stat label="Avg cards / item play" value={fmt(itemEvents ? cardsTotal / itemEvents : null, 2)} />
        <Stat label="Zero-card turn rate" value={pct(totalTurnsStarted ? sum(games, (g) => g.zero_card_turns) / totalTurnsStarted : null)} />
        <Stat label="Skip rate" value={pct(totalTurnsStarted ? sum(games, (g) => g.skip_count) / totalTurnsStarted : null)} />
        <Stat label="No-valid-card skips" value={String(sum(games, (g) => g.no_valid_card_skips))} />
        <Stat label="Random coords" value={`${randomCoords} (${pct(randomCoords + regionCoords ? randomCoords / (randomCoords + regionCoords) : null)})`} />
        <Stat label="Region coords" value={String(regionCoords)} />
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15 }}>Games by player count</h2>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Players</th>
              <th style={th}>Games</th>
              <th style={th}>Completed</th>
            </tr>
          </thead>
          <tbody>
            {[...byPlayerCount.entries()].sort((a, b) => a[0] - b[0]).map(([n, e]) => (
              <tr key={n}>
                <td style={td}>{n}</td>
                <td style={td}>{e.games}</td>
                <td style={td}>{e.completed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15 }}>Rarity breakdown (cards actually unloaded{version ? `, ${version}` : ', all versions'})</h2>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Rarity</th>
              <th style={th}>Times played</th>
              <th style={th}>Share of unloads</th>
            </tr>
          </thead>
          <tbody>
            {['common', 'medium', 'rare'].map((r) => (
              <tr key={r}>
                <td style={td}>{r}</td>
                <td style={td}>{rarityAgg.get(r) || 0}</td>
                <td style={td}>{pct(rarityTotal ? (rarityAgg.get(r) || 0) / rarityTotal : null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <details style={{ marginTop: 8, fontSize: 13 }}>
          <summary>By region and item</summary>
          <table style={{ borderCollapse: 'collapse', marginTop: 8 }}>
            <thead>
              <tr>
                <th style={th}>Version</th>
                <th style={th}>Rarity</th>
                <th style={th}>Region</th>
                <th style={th}>Item</th>
                <th style={th}>Times played</th>
              </tr>
            </thead>
            <tbody>
              {rarityRows.map((r: any, i: number) => (
                <tr key={i}>
                  <td style={td}>{r.ruleset_version}</td>
                  <td style={td}>{r.rarity}</td>
                  <td style={td}>{r.region}</td>
                  <td style={td}>{r.item_name}</td>
                  <td style={td}>{r.times_played}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15 }}>Most skipped coordination cards</h2>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Version</th>
              <th style={th}>Type</th>
              <th style={th}>Region</th>
              <th style={th}>Items on card</th>
              <th style={th}>Times drawn</th>
              <th style={th}>Turns skipped under</th>
              <th style={th}>Item plays under</th>
            </tr>
          </thead>
          <tbody>
            {coordRows.map((r: any, i: number) => (
              <tr key={i}>
                <td style={td}>{r.ruleset_version}</td>
                <td style={td}>{r.coord_type}</td>
                <td style={td}>{r.coord_region || '—'}</td>
                <td style={td}>{r.coord_item_count ?? '—'}</td>
                <td style={td}>{r.times_drawn}</td>
                <td style={td}>{r.turns_skipped_under}</td>
                <td style={td}>{r.item_plays_under}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15 }}>Action cards: usage and win-rate advantage</h2>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Action</th>
              <th style={th}>Uses (filtered games)</th>
              <th style={th}>Version</th>
              <th style={th}>Player count</th>
              <th style={th}>Win rate when used</th>
              <th style={th}>Baseline (1/players)</th>
              <th style={th}>Signal</th>
            </tr>
          </thead>
          <tbody>
            {advantageRows.map((r: any, i: number) => {
              const baseline = 1 / Number(r.player_count);
              const rate = Number(r.win_rate_when_used);
              const strong = Number.isFinite(rate) && rate > baseline * 1.25;
              const weak = Number.isFinite(rate) && rate < baseline * 0.75;
              return (
                <tr key={i}>
                  <td style={td}>{r.action_type}</td>
                  <td style={td}>{actionUsage[r.action_type] ?? '—'}</td>
                  <td style={td}>{r.ruleset_version}</td>
                  <td style={td}>{r.player_count}</td>
                  <td style={td}>{pct(rate)}</td>
                  <td style={td}>{pct(baseline)}</td>
                  <td style={{ ...td, color: strong ? '#a00' : weak ? '#06c' : '#666' }}>
                    {strong ? '⚠ possibly too strong' : weak ? 'possibly too weak' : 'ok'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p style={{ fontSize: 11, color: '#666' }}>
          Flags compare each action&apos;s win-rate-when-used to the naive 1/player_count baseline (±25%). Small sample sizes flag
          easily — check the uses column.
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15 }}>Bot games: estimated human-pace duration</h2>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Room</th>
              <th style={th}>Version</th>
              <th style={th}>Players</th>
              <th style={th}>Turns</th>
              <th style={th}>Actual</th>
              <th style={th}>Est. at human pace</th>
            </tr>
          </thead>
          <tbody>
            {durationRows.map((r: any, i: number) => (
              <tr key={i}>
                <td style={td}>{r.room_code || 'local'}</td>
                <td style={td}>{r.ruleset_version}</td>
                <td style={td}>{r.player_count}</td>
                <td style={td}>{r.total_turns}</td>
                <td style={td}>{mins(r.actual_duration_seconds)}</td>
                <td style={td}>{mins(r.estimated_human_duration_seconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 11, color: '#666' }}>
          Estimate = bot game turns × average seconds-per-turn of completed all-human games with the same player count and version.
          Empty until at least one completed all-human game exists for that combination.
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15 }}>Compare versions</h2>
        <form method="get" style={{ display: 'flex', gap: 8, alignItems: 'end', fontSize: 13, marginBottom: 8 }}>
          {/* keep current filters when comparing */}
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />
          <input type="hidden" name="bots" value={bots} />
          <input type="hidden" name="players" value={players} />
          <input type="hidden" name="done" value={done} />
          <input type="hidden" name="version" value={version} />
          <label>
            Version A
            <br />
            <select name="va" defaultValue={vA}>
              <option value="">—</option>
              {versions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Version B
            <br />
            <select name="vb" defaultValue={vB}>
              <option value="">—</option>
              {versions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" style={{ padding: '6px 14px' }}>Compare</button>
        </form>
        {compareA && compareB ? (
          <table style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Metric</th>
                <th style={th}>{compareA.ruleset_version}</th>
                <th style={th}>{compareB.ruleset_version}</th>
                <th style={th}>Δ B vs A</th>
              </tr>
            </thead>
            <tbody>
              {compareMetrics.map((m) => (
                <tr key={m.key}>
                  <td style={td}>{m.label}</td>
                  <td style={td}>{m.render(compareA[m.key])}</td>
                  <td style={td}>{m.render(compareB[m.key])}</td>
                  <td style={td}>{delta(compareA[m.key], compareB[m.key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ fontSize: 13, color: '#666' }}>Pick two versions with completed games to compare.</p>
        )}
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15 }}>Recent games</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>Started (UTC)</th>
              <th style={th}>Room</th>
              <th style={th}>Version</th>
              <th style={th}>Players</th>
              <th style={th}>Bots</th>
              <th style={th}>Turns</th>
              <th style={th}>Duration</th>
              <th style={th}>Winner</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {games.slice(0, 20).map((g) => (
              <tr key={g.id}>
                <td style={td}>{new Date(g.started_at).toISOString().replace('T', ' ').slice(0, 16)}</td>
                <td style={td}>{g.room_code || 'local'}</td>
                <td style={td}>{g.ruleset_version}</td>
                <td style={td}>{g.player_count}</td>
                <td style={td}>{g.bot_count}</td>
                <td style={td}>{g.total_turns ?? '—'}</td>
                <td style={td}>{mins(g.duration_seconds)}</td>
                <td style={td}>
                  {g.winner_name || '—'} {g.winner_is_bot ? '🤖' : ''}
                </td>
                <td style={td}>{g.completed ? 'completed' : 'incomplete'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 11, color: '#888' }}>
        Overview stats respect all filters. Rarity, coord, action-advantage, duration-estimate and comparison panels are grouped
        by ruleset version (the version filter applies; date/player filters do not).
      </p>
    </div>
  );
}

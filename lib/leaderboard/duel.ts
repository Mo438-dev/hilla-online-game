import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type Duel = { games: number; myWins: number; theirWins: number; myPts: number; theirPts: number; last: ('w' | 'l')[] };

// Head-to-head between two accounts: only the counted games they both played in, this season.
// last = up to 5 most recent, from the first player's side ("w" when they won).
export async function headToHead(meId: string, themId: string): Promise<Duel> {
  const empty: Duel = { games: 0, myWins: 0, theirWins: 0, myPts: 0, theirPts: 0, last: [] };
  if (!meId || !themId || meId === themId) return empty;
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const { data: season } = await supabase.from('seasons').select('starts_at, ends_at').lte('starts_at', nowIso).gt('ends_at', nowIso).maybeSingle();
  if (!season) return empty;
  const { data: rows, error } = await supabase
    .from('game_results')
    .select('game_id, user_id, won, points, finished_at')
    .in('user_id', [meId, themId])
    .eq('counted', true)
    .gte('finished_at', season.starts_at)
    .lt('finished_at', season.ends_at);
  if (error) throw error;

  type Pair = { mine?: any; theirs?: any; at: string };
  const byGame = new Map<string, Pair>();
  for (const r of rows ?? []) {
    const g: Pair = byGame.get(r.game_id) ?? { at: r.finished_at };
    if (r.user_id === meId) g.mine = r;
    else g.theirs = r;
    byGame.set(r.game_id, g);
  }
  const shared = [...byGame.values()].filter((g) => g.mine && g.theirs).sort((a, b) => (a.at < b.at ? 1 : -1));
  return {
    games: shared.length,
    myWins: shared.filter((g) => g.mine.won).length,
    theirWins: shared.filter((g) => g.theirs.won).length,
    myPts: shared.reduce((n, g) => n + g.mine.points, 0),
    theirPts: shared.reduce((n, g) => n + g.theirs.points, 0),
    last: shared.slice(0, 5).map((g) => (g.mine.won ? 'w' : 'l'))
  };
}

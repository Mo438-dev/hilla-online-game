// الخلاصة: generated from the current version's cells. Only cells with 10+ games, sorted by how far
// past the threshold they are, max 6. `prev` is the same metric in the previous version, same player count.
type Cells = Record<string, any>;

const rareStuck = (c: any) => (c?.rarPlayed?.rare != null ? 1 - c.rarPlayed.rare : null);

export function findings(cells: Cells, prevCells?: Cells | null) {
  const out: { key: string; n: number; title: string; value: number; ref: number; score: number; games: number; prev: number | null }[] = [];
  for (const [n, c] of Object.entries(cells)) {
    if (!c || c.games < 10) continue;
    const before = prevCells?.[n];
    const usable = before && before.games >= 10 ? before : null; // a small cell is never used, comparison included
    const add = (key: string, title: string, value: number | null | undefined, ref: number, prev: number | null | undefined) => {
      if (value != null && ref > 0 && value > ref) out.push({ key, n: +n, title, value, ref, score: value / ref, games: c.games, prev: prev ?? null });
    };
    add('zero', 'أدوار تمر بدون لعب', c.zero, 0.5, usable?.zero);
    add('reg.speed', 'بطاقة المنطقة تفرّغ اليد بسرعة زيادة', c.reg?.speed, 1.3, usable?.reg?.speed);
    add('rare', 'النادر يعلق باليد', rareStuck(c), 0.4, rareStuck(usable));
    for (const [a, x] of Object.entries<any>(c.actions ?? {})) {
      if (x.users >= 10) {
        add(`win.${a}`, 'كرت يفوز أكثر من المتوقع بوضوح', x.win, (x.base ?? 0) * 1.35, usable?.actions?.[a]?.win);
        add(`flip.${a}`, 'كرت يقلب النتيجة كثير', x.flip, 0.15, usable?.actions?.[a]?.flip);
      }
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 6);
}

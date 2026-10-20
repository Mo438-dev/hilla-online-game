// Ruleset v2.1 coordination-deck validator.
// Usage: node validate-coord-deck.mjs <path-to-game-source> [runs=5000]
// Extracts REGIONS / RARITY_* / v2.1 constants / buildCoordDeck from the source file (the data +
// engine block between the "DATA" banner and `function actionMeta(`), evaluates it with tiny stubs,
// and fails (exit 1) on ANY deviation from the spec in any run.
import fs from "fs";

const file = process.argv[2];
const RUNS = Number(process.argv[3] || 5000);
if (!file) { console.error("usage: node validate-coord-deck.mjs <file> [runs]"); process.exit(2); }
const src = fs.readFileSync(file, "utf8");
const a = src.indexOf("/* ---------------------------------- DATA");
const b = src.indexOf("function actionMeta(");
if (a < 0 || b < 0) { console.error("could not find DATA banner / actionMeta in", file); process.exit(2); }
const block = src.slice(a, b);

const iconStub = new Proxy({}, { get: () => null });
const factory = new Function(
  "icons",
  `const { Shirt, Gem, Shield, Shuffle, Users, Sparkles, RotateCcw, Hand, Repeat2, Gift, Search, Wifi, Home,
          Copy, Check, LogOut, RefreshCw, Type, Menu, Crown, Sword, Eye, CircleDashed, Sun, HelpCircle, X, Smile } = icons;
   ${block}
   return { REGIONS, RARITY_APPEARANCE_TARGET, COORD_RANDOM_CARDS, COORD_REGION_CARDS_PER_REGION,
            RANDOM_CARD_SIZES, REGION_CARD_SIZES, RULESET_VERSION, buildCoordDeck };`
);
const M = factory(iconStub);

const fail = (msg) => { console.error("FAIL:", msg); process.exit(1); };
const items = M.REGIONS.flatMap((r) => r.items.map((it) => ({ ...it, region: r.id })));
const regionOf = Object.fromEntries(items.map((it) => [it.name, it.region]));
const rarityOf = Object.fromEntries(items.map((it) => [it.name, it.rarity]));
const expectedTotal = items.reduce((s, it) => s + M.RARITY_APPEARANCE_TARGET[it.rarity], 0);
const count = (arr) => arr.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {});
const sameDist = (x, y) => JSON.stringify(Object.entries(count(x)).sort()) === JSON.stringify(Object.entries(count(y)).sort());
const regionSizes = Array.from({ length: M.COORD_REGION_CARDS_PER_REGION * M.REGIONS.length }, (_, i) =>
  M.REGION_CARD_SIZES[i % M.COORD_REGION_CARDS_PER_REGION % M.REGION_CARD_SIZES.length]);

for (let run = 0; run < RUNS; run++) {
  const deck = M.buildCoordDeck();
  const rnd = deck.filter((c) => c.type === "random");
  const reg = deck.filter((c) => c.type === "region");
  if (rnd.length !== M.COORD_RANDOM_CARDS) fail(`run ${run}: ${rnd.length} random cards`);
  if (reg.length !== M.COORD_REGION_CARDS_PER_REGION * M.REGIONS.length) fail(`run ${run}: ${reg.length} region cards`);
  for (const r of M.REGIONS) {
    const n = reg.filter((c) => c.region === r.id).length;
    if (n !== M.COORD_REGION_CARDS_PER_REGION) fail(`run ${run}: region ${r.id} has ${n} cards`);
  }
  if (!sameDist(rnd.map((c) => c.items.length), M.RANDOM_CARD_SIZES)) fail(`run ${run}: random size distribution`);
  if (!sameDist(reg.map((c) => c.items.length), regionSizes)) fail(`run ${run}: region size distribution`);
  const app = {};
  for (const c of deck) {
    if (new Set(c.items).size !== c.items.length) fail(`run ${run}: duplicate item on a card`);
    for (const it of c.items) {
      if (!(it in regionOf)) fail(`run ${run}: unknown item ${it}`);
      if (c.type === "region" && regionOf[it] !== c.region) fail(`run ${run}: ${it} on wrong region card ${c.region}`);
      app[it] = (app[it] || 0) + 1;
    }
  }
  for (const it of items) {
    const want = M.RARITY_APPEARANCE_TARGET[it.rarity];
    if ((app[it.name] || 0) !== want) fail(`run ${run}: ${it.name} (${it.rarity}) appeared ${app[it.name] || 0}×, want ${want}`);
  }
  const total = Object.values(app).reduce((s, v) => s + v, 0);
  if (total !== expectedTotal) fail(`run ${run}: total appearances ${total}, want ${expectedTotal}`);
}
console.log(`PASS — ruleset ${M.RULESET_VERSION}: ${RUNS} decks, every item exact (common ${M.RARITY_APPEARANCE_TARGET.common} / medium ${M.RARITY_APPEARANCE_TARGET.medium} / rare ${M.RARITY_APPEARANCE_TARGET.rare}), total ${expectedTotal}.`);

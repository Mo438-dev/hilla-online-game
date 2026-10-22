// Ruleset v2.2 validator — checks the WHOLE box against Mohammed's spec (hard-coded below, not
// read from the source), so a drifted constant fails instead of silently passing.
// Usage: node validate-ruleset-v22.mjs <path-to-game-source> [runs=5000]
import fs from "fs";

const SPEC = {
  version: "v2.2",
  items: 32, regions: 4, itemsPerRegion: 8, copies: 3, itemCards: 96,
  actions: { "عطني وأعطيك": 2, "اقدع": 4, "افزع لي": 2, "لا ما تقدر": 2, "ثبّت الحَلّة": 2, "فتّش الصندوق": 2 },
  actionCards: 14, playCards: 110, coordCards: 50, boxTotal: 160,
  random: 30, regionPer: 5,
  randomSizes: { 4: 11, 5: 12, 6: 5, 7: 2 },
  regionSizes: { 4: 3, 5: 2 },          // per region
  rarityCount: { common: 8, medium: 20, rare: 4 },
  target: { common: 10, medium: 7, rare: 4 },
  appearances: 236,
  maxHand: { 2: 20, 3: 20, 4: 20, 5: 19, 6: 18 },   // Mohammed's caps; pile reshuffles when it runs out
};

const file = process.argv[2];
const RUNS = Number(process.argv[3] || 5000);
if (!file) { console.error("usage: node validate-ruleset-v22.mjs <file> [runs]"); process.exit(2); }
const src = fs.readFileSync(file, "utf8");
const a = src.indexOf("/* ---------------------------------- DATA");
const b = src.indexOf("function actionMeta(");
if (a < 0 || b < 0) { console.error("could not find DATA banner / actionMeta in", file); process.exit(2); }
const iconStub = new Proxy({}, { get: () => null });
const M = new Function("icons", `
  const { Shirt, Gem, Shield, Shuffle, Users, Sparkles, RotateCcw, Hand, Repeat2, Gift, Search, Wifi, Home,
          Copy, Check, LogOut, RefreshCw, Type, Menu, Crown, Sword, Eye, CircleDashed, Sun, HelpCircle, X, Smile } = icons;
  ${src.slice(a, b)}
  return { REGIONS, ACTION_TYPES, RULESET_VERSION, buildItemDeck, buildActionDeck, buildCoordDeck, maxHandFor };`)(iconStub);

const fail = (m) => { console.error("FAIL:", m); process.exit(1); };
const tally = (arr) => arr.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {});
const eq = (x, y) => JSON.stringify(Object.entries(x).map(([k, v]) => [String(k), v]).sort()) === JSON.stringify(Object.entries(y).map(([k, v]) => [String(k), v]).sort());

// static
if (M.RULESET_VERSION !== SPEC.version) fail(`RULESET_VERSION ${M.RULESET_VERSION}`);
if (M.REGIONS.length !== SPEC.regions) fail("region count");
for (const r of M.REGIONS) if (r.items.length !== SPEC.itemsPerRegion) fail(`${r.id} has ${r.items.length} items`);
const items = M.REGIONS.flatMap((r) => r.items.map((it) => ({ ...it, region: r.id })));
if (new Set(items.map((i) => i.name)).size !== SPEC.items) fail("distinct items");
if (!eq(tally(items.map((i) => i.rarity)), SPEC.rarityCount)) fail(`rarity split ${JSON.stringify(tally(items.map((i) => i.rarity)))}`);
const total = items.reduce((s, it) => s + SPEC.target[it.rarity], 0);
if (total !== SPEC.appearances) fail(`appearance total ${total}`);

// play deck
const itemDeck = M.buildItemDeck(), actionDeck = M.buildActionDeck();
if (itemDeck.length !== SPEC.itemCards) fail(`item cards ${itemDeck.length}`);
for (const [n, c] of Object.entries(tally(itemDeck.map((c) => c.name)))) if (c !== SPEC.copies) fail(`${n} ×${c}`);
if (!eq(tally(actionDeck.map((c) => c.name)), SPEC.actions)) fail(`actions ${JSON.stringify(tally(actionDeck.map((c) => c.name)))}`);
if (actionDeck.length !== SPEC.actionCards) fail(`action cards ${actionDeck.length}`);
if (itemDeck.length + actionDeck.length !== SPEC.playCards) fail("play cards");

// hand-size cap
for (const [n, want] of Object.entries(SPEC.maxHand)) {
  const got = M.maxHandFor(Number(n));
  if (got !== want) fail(`maxHandFor(${n}) = ${got}, want ${want}`);
  if (got * Number(n) > SPEC.playCards) fail(`${n} players × ${got} exceeds the deck`);
}

// coordination deck
const regionOf = Object.fromEntries(items.map((i) => [i.name, i.region]));
for (let run = 0; run < RUNS; run++) {
  const deck = M.buildCoordDeck();
  if (deck.length !== SPEC.coordCards) fail(`run ${run}: ${deck.length} coord cards`);
  if (SPEC.playCards + deck.length !== SPEC.boxTotal) fail("box total");
  const rnd = deck.filter((c) => c.type === "random"), reg = deck.filter((c) => c.type === "region");
  if (rnd.length !== SPEC.random) fail(`run ${run}: random ${rnd.length}`);
  if (!eq(tally(rnd.map((c) => c.items.length)), SPEC.randomSizes)) fail(`run ${run}: random sizes`);
  for (const r of M.REGIONS) {
    const rc = reg.filter((c) => c.region === r.id);
    if (rc.length !== SPEC.regionPer) fail(`run ${run}: ${r.id} ${rc.length} cards`);
    if (!eq(tally(rc.map((c) => c.items.length)), SPEC.regionSizes)) fail(`run ${run}: ${r.id} sizes`);
  }
  const app = {};
  for (const c of deck) {
    if (new Set(c.items).size !== c.items.length) fail(`run ${run}: duplicate on a card`);
    for (const it of c.items) {
      if (c.type === "region" && regionOf[it] !== c.region) fail(`run ${run}: ${it} on ${c.region} card`);
      app[it] = (app[it] || 0) + 1;
    }
  }
  for (const it of items) if ((app[it.name] || 0) !== SPEC.target[it.rarity]) fail(`run ${run}: ${it.name} ${app[it.name]}≠${SPEC.target[it.rarity]}`);
}
console.log(`PASS — ruleset ${SPEC.version}: ${SPEC.items} items × ${SPEC.copies} = ${SPEC.itemCards} + ${SPEC.actionCards} actions = ${SPEC.playCards}; ` +
  `coord ${SPEC.coordCards} (${SPEC.random} random + ${SPEC.regionPer * SPEC.regions} region); box ${SPEC.boxTotal}; ` +
  `${SPEC.appearances} appearances exact; hand cap 20/20/20/19/18; ${RUNS} runs.`);

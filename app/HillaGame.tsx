// @ts-nocheck
'use client';
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Shirt, Gem, Shield, Shuffle, Users, Sparkles, RotateCcw, Hand, Repeat2, Gift, Search, Wifi, Home, Copy, Check, LogOut } from "lucide-react";
import { newAnalyticsGameId, sendAnalyticsEvents, sendGameStarted, sendGameFinished } from "@/lib/analytics-client";

/* ---------------------------------- PALETTE ---------------------------------- */
const CREAM = "#F3E9D2";
const CREAM2 = "#EADFC0";
const MAROON = "#6B1F2A";
const MAROON_DK = "#4A141C";
const GOLD = "#C9A227";
const INK = "#2B211C";
const TEAL = "#1F6F6B";

/* ---------------------------------- DATA ---------------------------------- */
/* rarity (شائع/متوسط/نادر) is just an info label printed on each item card —
   NOT a separate no-region category. Every item still belongs to one region. */

const RARITY_META = {
  common: { label: "شائع", color: "#8A8578" },
  medium: { label: "متوسط", color: "#B8860B" },
  rare: { label: "نادر", color: "#8B1E3F" },
};
const RARITY_COPIES = { common: 7, medium: 5, rare: 3 };

const REGIONS = [
  {
    id: "najdi",
    name: "نجدي",
    color: "#5B2C6F",
    items: [
      { name: "عقال", rarity: "common" },
      { name: "المخطم", rarity: "rare" },
      { name: "بشت", rarity: "medium" },
      { name: "ثوب", rarity: "medium" },
      { name: "دراعة", rarity: "medium" },
      { name: "مخنق", rarity: "medium" },
    ],
  },
  {
    id: "sharqi",
    name: "شرقي",
    color: "#2F4B33",
    items: [
      { name: "مرودن", rarity: "common" },
      { name: "قلادة", rarity: "common" },
      { name: "برقع أسود", rarity: "common" },
      { name: "دقلة", rarity: "common" },
      { name: "طفشة", rarity: "medium" },
      { name: "نشل", rarity: "medium" },
      { name: "نفنوف", rarity: "medium" },
      { name: "هامة", rarity: "medium" },
      { name: "المقصب", rarity: "medium" },
    ],
  },
  {
    id: "janoubi",
    name: "جنوبي",
    color: "#1F6F6B",
    items: [
      { name: "خواتم", rarity: "common" },
      { name: "المريشة", rarity: "rare" },
      { name: "منديل برتقالي", rarity: "medium" },
      { name: "المجنب العسيري", rarity: "medium" },
      { name: "بيدي", rarity: "medium" },
      { name: "رشرش", rarity: "medium" },
      { name: "متفت", rarity: "medium" },
    ],
  },
  {
    id: "gharbi",
    name: "غربي",
    color: "#2C3E63",
    items: [
      { name: "غوايش", rarity: "common" },
      { name: "حلق", rarity: "common" },
      { name: "البرم والمسفع", rarity: "rare" },
      { name: "برقع حجازي", rarity: "rare" },
      { name: "شاية", rarity: "medium" },
      { name: "مبقر", rarity: "medium" },
      { name: "الزبون الغربي", rarity: "medium" },
    ],
  },
];

const JEWELRY = ["غوايش", "حلق", "خواتم", "قلادة", "مرودن"];
const REGION_ORDER = REGIONS.map((r) => r.id);
const RARITY_ORDER = { common: 0, medium: 1, rare: 2 };

// quick lookup: item name -> {region, regionName, color, rarity}
const ITEM_INFO = {};
REGIONS.forEach((r) => {
  r.items.forEach((it) => {
    ITEM_INFO[it.name] = { region: r.id, regionName: r.name, color: r.color, rarity: it.rarity };
  });
});

function sortItemsByRegion(items) {
  return [...items].sort((a, b) => {
    const ra = REGION_ORDER.indexOf(a.region);
    const rb = REGION_ORDER.indexOf(b.region);
    if (ra !== rb) return ra - rb;
    const rra = RARITY_ORDER[a.rarity] ?? 0;
    const rrb = RARITY_ORDER[b.rarity] ?? 0;
    if (rra !== rrb) return rra - rrb;
    return a.name.localeCompare(b.name, "ar");
  });
}

// Same ordering, but for a plain array of item-name strings (e.g. a coordination card's chip
// list) rather than full card objects — looks up region/rarity via ITEM_INFO. Display-only:
// never mutates card.items or any shared game state.
function sortItemNamesByRegion(names) {
  return [...names].sort((a, b) => {
    const ia = ITEM_INFO[a];
    const ib = ITEM_INFO[b];
    const ra = REGION_ORDER.indexOf(ia?.region);
    const rb = REGION_ORDER.indexOf(ib?.region);
    if (ra !== rb) return ra - rb;
    const rra = RARITY_ORDER[ia?.rarity] ?? 0;
    const rrb = RARITY_ORDER[ib?.rarity] ?? 0;
    if (rra !== rrb) return rra - rrb;
    return a.localeCompare(b, "ar");
  });
}

const ACTION_TYPES = [
  { id: "giveTake", name: "عطني وأعطيك", count: 2, icon: Gift, desc: "أعط لاعبًا كرتين واسحب منه كرتين بدون رؤيتها." },
  { id: "drawTwo", name: "اقدع", count: 4, icon: Shuffle, desc: "لاعب مختار يسحب كرتين من كومة السحب." },
  { id: "stealTwo", name: "افزع لي", count: 2, icon: Hand, desc: "لاعب مختار يأخذ كرتين من يدك بدون رؤيتها." },
  { id: "block", name: "لا ما تقدر", count: 2, icon: Shield, desc: "يلغي أي أكشن يُستخدم ضدك أو ضد لاعب آخر." },
  { id: "freeze", name: "ثبّت الحَلّة", count: 2, icon: Repeat2, desc: "يبقى كرت التنسيق الحالي لجولة إضافية." },
  { id: "dig", name: "فتّش الصندوق", count: 2, icon: Search, desc: "اسحب 3 كروت واختر واحدًا، وأعد الباقي." },
];

const REC_COUNTS = { 2: 20, 3: 19, 4: 17, 5: 15, 6: 15 };

const BOT_NAME_POOL = [
  "أنا مجرد بوت", "بوت أبو ناصر", "أبو الذكاء الاصطناعي", "لا تضغطني", "نسخة اقتصادية",
  "موظف السيرفر", "مصنع في السيرفر", "جاري التفكير", "أبو البرمجة", "أنا مجرد أكواد",
  "تحديثي قديم", "ولد الخوارزمية", "روبوت متواضع", "بطاريتي ١٪", "أبو البكسلات",
  "بوت أبو صالح", "أبو السيرفر", "مصنوع من أكواد", "قيد البرمجة", "تمت برمجتي على السريع",
  "لا تعصب أنا بوت", "أنا نسخة تجريبية", "بوت أبو سعيد", "يشتغل إذا بغى", "تم استدعائي",
  "مجرد خوارزمية", "أبو الأكواد", "جاري اللفلفة", "لا ترفع البلاغ", "برمجوني ومشوا",
  "موظف آلي", "أبو ناصر", "ابن السيرفر", "أقوى بوت بالحارة", "أنا اختبار",
  "أبو الخوارزميات", "روبوت بسيط", "تمت صناعتي محليًا", "مصنوع في القراج", "أبو اللاقات",
  "أبو صفر وواحد", "معلق من أمس", "أبو التحديثات", "جاري التحديث", "لا تتوقع كثير",
  "أمي برمجتني", "بوت شغال بالبركة", "ذكاء اصطناعي من الحراج", "أبوي حدثني",
];

function pickRandomBotNames(n) {
  return shuffle(BOT_NAME_POOL).slice(0, n);
}

const BLOCK_WINDOW_SEC = 10;
const BLOCK_WINDOW_MS = BLOCK_WINDOW_SEC * 1000;

let _uid = 0;
const uid = () => `c${Date.now().toString(36)}${(_uid++).toString(36)}`;

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildItemDeck() {
  const deck = [];
  REGIONS.forEach((r) => {
    r.items.forEach((it) => {
      const copies = RARITY_COPIES[it.rarity];
      for (let k = 0; k < copies; k++) {
        deck.push({ id: uid(), kind: "item", name: it.name, region: r.id, regionName: r.name, color: r.color, rarity: it.rarity });
      }
    });
  });
  return deck;
}

function buildActionDeck() {
  const deck = [];
  ACTION_TYPES.forEach((a) => {
    for (let k = 0; k < a.count; k++) {
      deck.push({ id: uid(), kind: "action", actionType: a.id, name: a.name });
    }
  });
  return deck;
}

// Splits a shuffled item list into 3–4 sized chunks that together cover every item at least
// once (per call). Used with rarity-weighted "passes" below so common items end up on far more
// تنسيق cards than rare ones, while every single card still has 3-4 distinct items.
function chunkCoverAll(items, minSize = 3, maxSize = 4) {
  const shuffled = shuffle(items);
  const chunks = [];
  let i = 0;
  while (i < shuffled.length) {
    const size = Math.min(shuffled.length - i, Math.random() < 0.5 ? minSize : maxSize);
    chunks.push(shuffled.slice(i, i + size));
    i += size;
  }
  return chunks;
}

// Appearance weighting: for every 2 times a rare item shows up on a تنسيق card, a medium item
// shows up 3 times and a common item shows up 5 times — commons are easy to unload, rares are
// genuinely hard to place.
const RARITY_PASSES = { common: 5, medium: 3, rare: 2 };
const MAX_PASSES = 5;

function namesForPass(items, pass) {
  return items.filter((it) => (RARITY_PASSES[it.rarity] ?? 3) >= pass).map((it) => it.name);
}

function buildCoordDeck() {
  const deck = [];
  REGIONS.forEach((r) => {
    for (let pass = 1; pass <= MAX_PASSES; pass++) {
      const names = namesForPass(r.items, pass);
      if (names.length === 0) continue;
      chunkCoverAll(names).forEach((items) => {
        deck.push({ id: uid(), type: "region", region: r.id, regionName: r.name, color: r.color, items });
      });
    }
  });

  // عشوائي cards match by name only (any region) — apply the same rarity weighting across the
  // full item list so the ratio holds for the whole coordination deck, not just region cards.
  const allItems = REGIONS.flatMap((r) => r.items);
  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    const names = namesForPass(allItems, pass);
    if (names.length === 0) continue;
    chunkCoverAll(names).forEach((items) => {
      deck.push({ id: uid(), type: "random", region: null, items });
    });
  }
  return shuffle(deck);
}

function actionMeta(id) {
  return ACTION_TYPES.find((a) => a.id === id);
}

/* ------------------------------- GAME ENGINE (pure) ------------------------------- */

function createInitialGame(playersMeta, perPlayer) {
  const items = shuffle(buildItemDeck());
  const actions = shuffle(buildActionDeck());
  const full = shuffle([...items, ...actions]);
  const cap = Math.min(perPlayer, Math.floor(full.length / playersMeta.length));
  const players = playersMeta.map((pm) => ({ id: pm.id, name: pm.name, hand: [], isBot: !!pm.isBot }));
  for (let i = 0; i < cap; i++) {
    players.forEach((p) => p.hand.push(full.pop()));
  }
  const cDeck = shuffle(buildCoordDeck());
  const first = cDeck.pop();
  return {
    // Analytics-only identifier (game_sessions.id). Persisted inside the game
    // document so every client reports events under the same game_id. Has no
    // effect on gameplay.
    analyticsId: newAnalyticsGameId(),
    players,
    drawPile: full,
    discardPile: [],
    coordDeck: cDeck,
    coordDiscard: [],
    currentCoord: first,
    lockCoord: false,
    currentPlayerIndex: 0,
    actionUsedThisTurn: false,
    turnSerial: 0,
    log: [`بدأت اللعبة بـ ${players.length} لاعبين، ${cap} كرت لكل لاعب.`],
    winner: null,
    pendingAction: null,
    digOptions: null,
    blockEvent: null,
  };
}

function pushLog(game, msg) {
  return { ...game, log: [msg, ...game.log].slice(0, 30) };
}

function drawFromPile(game, n) {
  let pile = [...game.drawPile];
  let disc = [...game.discardPile];
  const out = [];
  for (let i = 0; i < n; i++) {
    if (pile.length === 0) {
      if (disc.length === 0) break;
      pile = shuffle(disc);
      disc = [];
    }
    out.push(pile.pop());
  }
  return { game: { ...game, drawPile: pile, discardPile: disc }, drawn: out };
}

function removeFromHand(game, playerId, cardIds) {
  let removed = [];
  const players = game.players.map((p) => {
    if (p.id !== playerId) return p;
    const keep = [];
    p.hand.forEach((c) => {
      if (cardIds.includes(c.id) && removed.length < cardIds.length) removed.push(c);
      else keep.push(c);
    });
    return { ...p, hand: keep };
  });
  return { game: { ...game, players }, removed };
}

function addToHand(game, playerId, cards) {
  const players = game.players.map((p) => (p.id === playerId ? { ...p, hand: [...p.hand, ...cards] } : p));
  return { ...game, players };
}

function checkWin(game, playerId) {
  const p = game.players.find((x) => x.id === playerId);
  if (p && p.hand.length === 0) return { ...game, winner: p.id };
  return game;
}

function endRound(game) {
  let g = { ...game };
  if (g.lockCoord) {
    g = pushLog(g, "ثبّت الحَلّة: يبقى نفس كرت التنسيق لجولة إضافية.");
    g.lockCoord = false;
    return g;
  }
  let deck = [...g.coordDeck];
  let disc = [...g.coordDiscard, g.currentCoord];
  if (deck.length === 0) {
    deck = shuffle(disc);
    disc = [];
  }
  const next = deck.pop();
  g.coordDeck = deck;
  g.coordDiscard = disc;
  g.currentCoord = next;
  g = pushLog(g, `كرت تنسيق جديد: ${next.type === "region" ? next.regionName : "عشوائي"}.`);
  return g;
}

// Turn only advances here — every other reducer just mutates state and hands control back to the
// same player, so a player can freely combine item plays with one action card before ending.
// turnSerial increments exactly once per turn; the online bot executor uses it to guarantee at
// most one bot move per turn even if the same room state is polled repeatedly.
function endTurn(game) {
  let g = { ...game, actionUsedThisTurn: false, turnSerial: (game.turnSerial ?? 0) + 1 };
  if (g.currentPlayerIndex === g.players.length - 1) {
    g = endRound(g);
    g.currentPlayerIndex = 0;
  } else {
    g.currentPlayerIndex = g.currentPlayerIndex + 1;
  }
  return g;
}

// Explicit "end my turn" — the player calls this once they're done (after any combination of
// item plays / one action card), or immediately to just pass.
function rEndTurn(game, playerId) {
  const player = game.players.find((p) => p.id === playerId);
  let g = pushLog(game, `${player.name} أنهى دوره.`);
  g = endTurn(g);
  return g;
}

function rPlayItems(game, playerId, cardIds) {
  const player = game.players.find((p) => p.id === playerId);
  const cards = player.hand.filter((c) => cardIds.includes(c.id) && c.kind === "item");
  if (cards.length === 0) return { game, error: null };
  const coord = game.currentCoord;
  if (coord.type === "random") {
    if (cards.length !== 1) return { game, error: "كرت التنسيق العشوائي يسمح بعنصر واحد فقط في كل مرة." };
    if (!coord.items.includes(cards[0].name)) return { game, error: "هذا العنصر غير مطابق لكرت التنسيق." };
  } else {
    const names = new Set();
    for (const c of cards) {
      if (c.region !== coord.region || !coord.items.includes(c.name))
        return { game, error: "كل الكروت المختارة يجب أن تطابق منطقة وعناصر كرت التنسيق." };
      if (names.has(c.name)) return { game, error: "لا يمكن تكرار نفس العنصر في نفس الجولة." };
      names.add(c.name);
    }
  }
  const ids = cards.map((c) => c.id);
  let { game: g1, removed } = removeFromHand(game, playerId, ids);
  g1 = { ...g1, discardPile: [...g1.discardPile, ...removed] };
  g1 = pushLog(g1, `${player.name} وضع: ${cards.map((c) => c.name).join("، ")}.`);
  g1 = checkWin(g1, playerId);
  // Turn does NOT end here — the caller is responsible for calling rEndTurn right after a
  // successful item play (placing items always ends the turn).
  return { game: g1, error: null };
}

function rPassTurn(game, playerId) {
  return rEndTurn(game, playerId);
}

function rPlayFreeze(game, playerId, cardId) {
  const player = game.players.find((p) => p.id === playerId);
  let { game: g1, removed } = removeFromHand(game, playerId, [cardId]);
  g1 = { ...g1, discardPile: [...g1.discardPile, ...removed], lockCoord: true, actionUsedThisTurn: true };
  g1 = pushLog(g1, `${player.name} لعب ثبّت الحَلّة.`);
  g1 = checkWin(g1, playerId);
  return g1;
}

function rPlayDig(game, playerId, cardId) {
  const player = game.players.find((p) => p.id === playerId);
  let { game: g1, removed } = removeFromHand(game, playerId, [cardId]);
  g1 = { ...g1, discardPile: [...g1.discardPile, ...removed], actionUsedThisTurn: true };
  const { game: g2, drawn } = drawFromPile(g1, 3);
  let g3 = { ...g2, digOptions: { playerId, cards: drawn } };
  g3 = pushLog(g3, `${player.name} فتّش الصندوق.`);
  return g3;
}

function rFinishDig(game, keepId) {
  const { playerId, cards } = game.digOptions;
  const kept = cards.find((c) => c.id === keepId);
  const rest = cards.filter((c) => c.id !== keepId);
  let g = addToHand(game, playerId, [kept]);
  g = { ...g, drawPile: [...rest, ...g.drawPile], digOptions: null };
  const player = g.players.find((p) => p.id === playerId);
  g = pushLog(g, `${player.name} أضاف "${kept.name}" من فتّش الصندوق.`);
  g = checkWin(g, playerId);
  return g;
}

function rDeclareAction(game, playerId, cardId, actionType, targetId) {
  const player = game.players.find((p) => p.id === playerId);
  let { game: g1, removed } = removeFromHand(game, playerId, [cardId]);
  g1 = { ...g1, discardPile: [...g1.discardPile, ...removed], actionUsedThisTurn: true };
  g1 = { ...g1, pendingAction: { id: uid(), actionType, actorId: playerId, targetId, actorName: player.name, startedAt: Date.now() } };
  return g1;
}

function rDeclareGiveTake(game, playerId, cardId, targetId, giveIds) {
  const player = game.players.find((p) => p.id === playerId);
  let { game: g1, removed } = removeFromHand(game, playerId, [cardId]);
  g1 = { ...g1, discardPile: [...g1.discardPile, ...removed], actionUsedThisTurn: true };
  g1 = { ...g1, pendingAction: { id: uid(), actionType: "giveTake", actorId: playerId, targetId, actorName: player.name, giveIds, startedAt: Date.now() } };
  return g1;
}

function rCancelWithBlock(game, blockerId) {
  const blocker = game.players.find((p) => p.id === blockerId);
  const blockCard = blocker.hand.find((c) => c.kind === "action" && c.actionType === "block");
  if (!blockCard) return game;
  const blockedActionType = game.pendingAction.actionType;
  const actorName = game.pendingAction.actorName;
  let { game: g1, removed } = removeFromHand(game, blockerId, [blockCard.id]);
  g1 = { ...g1, discardPile: [...g1.discardPile, ...removed] };
  g1 = pushLog(g1, `${blocker.name} استخدم لا ما تقدر! تم إلغاء ${actionMeta(blockedActionType).name}.`);
  g1 = {
    ...g1,
    pendingAction: null,
    // Display-only marker for BlockFlashToast; never cleared, never read by game logic.
    blockEvent: { id: uid(), blockerName: blocker.name, actorName, actionType: blockedActionType },
  };
  g1 = checkWin(g1, blockerId);
  return g1;
}

function rResolvePendingAction(game) {
  const pa = game.pendingAction;
  if (!pa) return game;
  let g = { ...game, pendingAction: null };
  const target = g.players.find((p) => p.id === pa.targetId);
  if (pa.actionType === "drawTwo") {
    const { game: g2, drawn } = drawFromPile(g, 2);
    g = addToHand(g2, pa.targetId, drawn);
    g = pushLog(g, `${pa.actorName} استخدم اقدع على ${target.name}: سحب ${drawn.length} كرت.`);
  } else if (pa.actionType === "stealTwo") {
    const actorHand = g.players.find((p) => p.id === pa.actorId).hand;
    const n = Math.min(2, actorHand.length);
    const ids = shuffle(actorHand).slice(0, n).map((c) => c.id);
    const { game: g2, removed } = removeFromHand(g, pa.actorId, ids);
    g = addToHand(g2, pa.targetId, removed);
    g = pushLog(g, `${target.name} فزع من ${pa.actorName} وأخذ ${removed.length} كرت.`);
  } else if (pa.actionType === "giveTake") {
    const { game: g2, removed: given } = removeFromHand(g, pa.actorId, pa.giveIds);
    let g3 = addToHand(g2, pa.targetId, given);
    const t = g3.players.find((p) => p.id === pa.targetId);
    const n = Math.min(2, t.hand.length);
    const takeIds = shuffle(t.hand).slice(0, n).map((c) => c.id);
    const { game: g4, removed: taken } = removeFromHand(g3, pa.targetId, takeIds);
    g = addToHand(g4, pa.actorId, taken);
    g = pushLog(g, `${pa.actorName} بادل كروت مع ${target.name} (عطني وأعطيك).`);
  }
  g = checkWin(g, pa.actorId);
  return g;
}

/* ------------------------------- BOT AI (pure) -------------------------------
   Greedy-optimal heuristic bot. Not a full game-tree search, but it never leaves value on the
   table: always plays the maximum number of matching items it legally can, and picks whichever
   single action card gives the best expected swing (fish for a match, lock in a bonus round,
   set back the leader, or dump dead weight). All functions here are pure (game in -> game out),
   same shape as the r* reducers above, so this is safe to reuse from any host app. */

function findMatchingItems(hand, coord) {
  if (coord.type === "random") {
    const m = hand.find((c) => c.kind === "item" && coord.items.includes(c.name));
    return m ? [m] : [];
  }
  const seen = new Set();
  return hand.filter((c) => {
    if (c.kind !== "item" || c.region !== coord.region || !coord.items.includes(c.name)) return false;
    if (seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });
}

function pickBestKeepFromDraw(drawnCards, coord) {
  const matches = drawnCards.filter(
    (c) => c.kind === "item" && (coord.type === "random" ? coord.items.includes(c.name) : c.region === coord.region && coord.items.includes(c.name))
  );
  if (matches.length) return matches[0].id;
  // Nothing playable right now — rare items rarely show up on تنسيق cards, so grabbing one just
  // means being stuck with it later. Prefer the easiest-to-unload (common) item instead.
  const rarityRank = { common: 0, medium: 1, rare: 2 };
  const items = drawnCards.filter((c) => c.kind === "item").sort((a, b) => (rarityRank[a.rarity] ?? 1) - (rarityRank[b.rarity] ?? 1));
  return (items[0] || drawnCards[0]).id;
}

function pickGiveAwayIds(hand, n) {
  // Lower score = more willing to give away. Rare items rarely show up on تنسيق cards, so they're
  // hard to get rid of through normal matching — dump those first. Common items will clear
  // themselves naturally (they show up on تنسيق cards constantly), so keep those.
  const rarityScore = { rare: 0, medium: 1, common: 3 };
  const scored = hand.map((c) => ({ c, score: c.kind === "action" ? 2 : rarityScore[c.rarity] ?? 1 }));
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, n).map((x) => x.c.id);
}

function botDecideTurn(game, botId) {
  const botStart = game.players.find((p) => p.id === botId);
  const coord = game.currentCoord;
  let g = game;

  const initialMatches = findMatchingItems(botStart.hand, coord);
  const actionCardsInitial = botStart.hand.filter((c) => c.kind === "action");
  const dig = actionCardsInitial.find((c) => c.actionType === "dig");
  const freeze = actionCardsInitial.find((c) => c.actionType === "freeze");

  // Freeze is only worth it if there are unplayed matches left to cash in on the bonus round.
  const remainingRegionMatches =
    coord.type === "region" ? botStart.hand.filter((c) => c.kind === "item" && c.region === coord.region && coord.items.includes(c.name)).length : 0;

  let usedInstantAction = false;

  // 1) An instant action (dig/freeze) can only be played BEFORE items, so decide that first.
  if (initialMatches.length === 0 && dig) {
    const { game: g1, removed } = removeFromHand(g, botId, [dig.id]);
    g = { ...g1, discardPile: [...g1.discardPile, ...removed] };
    const { game: g2, drawn } = drawFromPile(g, 3);
    const keepId = pickBestKeepFromDraw(drawn, coord);
    const kept = drawn.find((c) => c.id === keepId);
    const rest = drawn.filter((c) => c.id !== keepId);
    g = addToHand(g2, botId, [kept]);
    g = { ...g, drawPile: [...rest, ...g.drawPile] };
    g = pushLog(g, `${botStart.name} فتّش الصندوق وأضاف "${kept.name}".`);
    usedInstantAction = true;
  } else if (freeze && remainingRegionMatches > 0) {
    const { game: g1, removed } = removeFromHand(g, botId, [freeze.id]);
    g = { ...g1, discardPile: [...g1.discardPile, ...removed], lockCoord: true };
    g = pushLog(g, `${botStart.name} لعب ثبّت الحَلّة.`);
    usedInstantAction = true;
  }

  g = checkWin(g, botId);
  if (g.winner) return g;

  // 2) Now play any matching items (hand may have just been improved by فتّش الصندوق) — placing
  // items always ends the turn immediately, same as for a human player.
  const botAfterAction = g.players.find((p) => p.id === botId);
  const matchesNow = findMatchingItems(botAfterAction.hand, g.currentCoord);
  if (matchesNow.length > 0) {
    const ids = matchesNow.map((c) => c.id);
    const { game: g1, removed } = removeFromHand(g, botId, ids);
    g = { ...g1, discardPile: [...g1.discardPile, ...removed] };
    g = pushLog(g, `${botStart.name} وضع: ${matchesNow.map((c) => c.name).join("، ")}.`);
    g = checkWin(g, botId);
    return g.winner ? g : endTurn(g);
  }

  if (usedInstantAction) return endTurn(g);

  // 3) Nothing to place and no instant action taken — consider a targeted action as a last
  // resort (these leave the turn open until resolved, via the block-window automation).
  const bot = g.players.find((p) => p.id === botId);
  const actionCards = bot.hand.filter((c) => c.kind === "action");
  const give = actionCards.find((c) => c.actionType === "giveTake");
  const draw2 = actionCards.find((c) => c.actionType === "drawTwo");
  const steal2 = actionCards.find((c) => c.actionType === "stealTwo");
  const others = g.players.filter((p) => p.id !== botId);
  const leader = others.length ? others.reduce((a, b) => (b.hand.length < a.hand.length ? b : a), others[0]) : null;

  if (steal2 && leader) {
    const { game: g1, removed } = removeFromHand(g, botId, [steal2.id]);
    g = { ...g1, discardPile: [...g1.discardPile, ...removed], pendingAction: { id: uid(), actionType: "stealTwo", actorId: botId, targetId: leader.id, actorName: botStart.name, startedAt: Date.now() } };
    return g;
  }
  if (draw2 && leader) {
    const { game: g1, removed } = removeFromHand(g, botId, [draw2.id]);
    g = { ...g1, discardPile: [...g1.discardPile, ...removed], pendingAction: { id: uid(), actionType: "drawTwo", actorId: botId, targetId: leader.id, actorName: botStart.name, startedAt: Date.now() } };
    return g;
  }
  if (give && leader && bot.hand.length > 0) {
    const { game: g1, removed } = removeFromHand(g, botId, [give.id]);
    const afterHand = g1.players.find((p) => p.id === botId).hand;
    const giveIds = pickGiveAwayIds(afterHand, Math.min(2, afterHand.length));
    g = { ...g1, discardPile: [...g1.discardPile, ...removed], pendingAction: { id: uid(), actionType: "giveTake", actorId: botId, targetId: leader.id, actorName: botStart.name, giveIds, startedAt: Date.now() } };
    return g;
  }

  return rPassTurn(g, botId);
}

/* --------------------------------- UI BITS --------------------------------- */

function DiamondLattice({ color = GOLD, vertical = false, thickness = 14 }) {
  const style = vertical ? { width: thickness, minWidth: thickness } : { height: thickness, minHeight: thickness };
  return (
    <div
      style={{
        ...style,
        backgroundImage: `linear-gradient(135deg, ${color} 25%, transparent 25%), linear-gradient(225deg, ${color} 25%, transparent 25%), linear-gradient(45deg, ${color} 25%, transparent 25%), linear-gradient(315deg, ${color} 25%, transparent 25%)`,
        backgroundPosition: `${thickness / 2}px 0, ${thickness / 2}px 0, 0 0, 0 0`,
        backgroundSize: `${thickness}px ${thickness}px`,
        backgroundColor: MAROON_DK,
      }}
    />
  );
}

function CornerFlourish({ pos, color = GOLD }) {
  const posMap = { tl: "top-1.5 right-1.5", tr: "top-1.5 left-1.5", bl: "bottom-1.5 right-1.5", br: "bottom-1.5 left-1.5" };
  return <span className={`absolute ${posMap[pos]} w-2 h-2 rotate-45`} style={{ background: color, opacity: 0.8 }} />;
}

function OrnateDivider({ color = GOLD }) {
  return (
    <div className="flex items-center gap-1.5 justify-center my-1.5">
      <span className="h-px flex-1" style={{ background: color, opacity: 0.6 }} />
      <span className="w-1.5 h-1.5 rotate-45" style={{ background: color }} />
      <span className="h-px flex-1" style={{ background: color, opacity: 0.6 }} />
    </div>
  );
}

function CardBackHero() {
  return (
    <div
      className="w-40 h-56 rounded-2xl border-4 relative overflow-hidden mx-auto shadow-xl"
      style={{ borderColor: CREAM, backgroundImage: `repeating-conic-gradient(${MAROON} 0deg 9deg, ${CREAM} 9deg 18deg)` }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-24 h-28 rounded-xl border-2 flex items-center justify-center relative" style={{ background: CREAM, borderColor: MAROON }}>
          <CornerFlourish pos="tl" color={GOLD} />
          <CornerFlourish pos="tr" color={GOLD} />
          <CornerFlourish pos="bl" color={GOLD} />
          <CornerFlourish pos="br" color={GOLD} />
          <span className="text-3xl font-black" style={{ color: MAROON, fontFamily: "Aref Ruqaa" }}>
            حُلّة
          </span>
        </div>
      </div>
    </div>
  );
}

function ItemCard({ card, selected, onClick, small }) {
  const color = REGIONS.find((r) => r.id === card.region)?.color || GOLD;
  const rarity = RARITY_META[card.rarity] || RARITY_META.common;
  const Icon = JEWELRY.includes(card.name) ? Gem : Shirt;
  return (
    <button
      onClick={onClick}
      className={`relative flex-shrink-0 ${small ? "w-20 h-28" : "w-24 h-32"} rounded-lg border-2 flex flex-col text-center transition-transform overflow-hidden ${
        selected ? "-translate-y-3 ring-2 ring-offset-1" : "hover:-translate-y-1"
      }`}
      style={{ background: CREAM, borderColor: color, boxShadow: selected ? `0 0 0 2px ${GOLD}` : "none" }}
    >
      <CornerFlourish pos="tl" color={GOLD} />
      <CornerFlourish pos="tr" color={GOLD} />
      <div className="pt-2 px-1 flex items-center justify-center gap-1">
        <div className="text-[9px] font-bold" style={{ color, fontFamily: "Tajawal" }}>
          {card.regionName}
        </div>
        <span
          className="text-[7px] font-bold px-1 rounded-sm"
          style={{ background: `${rarity.color}22`, color: rarity.color, border: `1px solid ${rarity.color}55` }}
        >
          {rarity.label}
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${color}22`, border: `1.5px solid ${color}` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <div className="pb-2 px-1">
        <div className="text-[10px] font-black leading-tight" style={{ color: INK, fontFamily: "Tajawal" }}>
          {card.name}
        </div>
      </div>
      <div style={{ height: 6 }}>
        <DiamondLattice color={color} thickness={8} />
      </div>
    </button>
  );
}

function ActionCard({ card, selected, onClick, disabled }) {
  const meta = actionMeta(card.actionType);
  const Icon = meta.icon;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={meta.desc}
      className={`relative flex-shrink-0 w-24 h-32 rounded-lg border-2 flex flex-col items-center text-center p-1.5 transition-transform disabled:opacity-40 ${
        selected ? "-translate-y-3 ring-2 ring-offset-1" : "hover:-translate-y-1"
      }`}
      style={{ background: CREAM, borderColor: MAROON }}
    >
      <CornerFlourish pos="tl" color={GOLD} />
      <CornerFlourish pos="tr" color={GOLD} />
      <div className="w-8 h-8 rounded-full flex items-center justify-center mt-2 mb-1" style={{ background: MAROON }}>
        <Icon className="w-4 h-4" style={{ color: GOLD }} />
      </div>
      <div className="text-[11px] font-black leading-tight" style={{ color: MAROON, fontFamily: "Tajawal" }}>
        {meta.name}
      </div>
    </button>
  );
}

function CoordCard({ card }) {
  const isRandom = card.type === "random";
  const color = isRandom ? MAROON : card.color;
  const [openTip, setOpenTip] = useState(null);

  useEffect(() => {
    if (openTip === null) return;
    const t = setTimeout(() => setOpenTip(null), 2500);
    return () => clearTimeout(t);
  }, [openTip]);

  return (
    <div className="flex items-stretch rounded-xl overflow-hidden shadow-2xl border-2" style={{ borderColor: color, background: CREAM }}>
      <DiamondLattice color={color} vertical thickness={10} />
      <div className="w-56 p-4 relative">
        <CornerFlourish pos="tl" color={GOLD} />
        <CornerFlourish pos="tr" color={GOLD} />
        <div className="text-[10px] font-bold text-center" style={{ color }}>
          {isRandom ? "كرت تنسيق عشوائي" : "كرت تنسيق منطقة"}
        </div>
        <div className="text-2xl font-black text-center" style={{ color: INK, fontFamily: "Aref Ruqaa" }}>
          {isRandom ? "عشوائي" : card.regionName}
        </div>
        <OrnateDivider color={color} />
        <div className="flex flex-wrap gap-1 justify-center">
          {/* Display-only sort for عشوائي cards (F7): card.items itself is never reordered. */}
          {(isRandom ? sortItemNamesByRegion(card.items) : card.items).map((it, i) => {
            const info = ITEM_INFO[it];
            return (
              <span key={i} className="relative inline-block">
                {openTip === i && info && (
                  <span
                    className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md text-[9px] font-black whitespace-nowrap shadow-lg z-10 pointer-events-none"
                    style={{ background: info.color, color: CREAM }}
                  >
                    {info.regionName}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setOpenTip((cur) => (cur === i ? null : i))}
                  className="text-[10px] rounded px-1.5 py-0.5 font-bold"
                  style={{ background: `${color}18`, color, border: `1px solid ${color}55` }}
                >
                  {it}
                </button>
              </span>
            );
          })}
        </div>
      </div>
      <DiamondLattice color={color} vertical thickness={10} />
    </div>
  );
}

const GlobalFont = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&family=Tajawal:wght@400;500;700;900&display=swap');
    @keyframes hilla-toast-fade {
      0% { opacity: 0; transform: translate(-50%, -6px); }
      5% { opacity: 1; transform: translate(-50%, 0); }
      25% { opacity: 1; transform: translate(-50%, 0); }
      100% { opacity: 0; transform: translate(-50%, -6px); }
    }
    @keyframes hilla-block-flash {
      0% { opacity: 0; transform: translate(-50%, -10px) scale(0.92); }
      10% { opacity: 1; transform: translate(-50%, 0) scale(1.04); }
      18% { transform: translate(-50%, 0) scale(1); }
      88% { opacity: 1; transform: translate(-50%, 0) scale(1); }
      100% { opacity: 0; transform: translate(-50%, -8px) scale(0.96); }
    }
  `}</style>
);

const pageBg = {
  background: CREAM,
  backgroundImage: `linear-gradient(135deg, ${GOLD}0d 25%, transparent 25%), linear-gradient(225deg, ${GOLD}0d 25%, transparent 25%), linear-gradient(45deg, ${GOLD}0d 25%, transparent 25%), linear-gradient(315deg, ${GOLD}0d 25%, transparent 25%)`,
  backgroundPosition: "20px 0, 20px 0, 0 0, 0 0",
  backgroundSize: "40px 40px",
};

/* --------------------------------- GAME BOARD (shared) --------------------------------- */

function CountdownRing({ pendingActionId, startedAt, size = 56 }) {
  const safeStart = typeof startedAt === "number" ? startedAt : Date.now();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const iv = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(iv);
  }, [pendingActionId]);
  const elapsed = now - safeStart;
  const remaining = Math.max(0, BLOCK_WINDOW_SEC - Math.floor(elapsed / 1000));
  const circumference = 151;
  const dashoffset = Math.max(0, Math.min(circumference, (elapsed / BLOCK_WINDOW_MS) * circumference));
  const r = (size - 8) / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto mb-2">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={CREAM2} strokeWidth="4" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={remaining <= 3 ? MAROON : GOLD}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashoffset}
        style={{ transform: "rotate(-90deg)", transformOrigin: `${size / 2}px ${size / 2}px` }}
      />
      <text x={size / 2} y={size / 2 + 6} textAnchor="middle" fontSize="18" fontWeight="900" fill={MAROON} fontFamily="Tajawal">
        {remaining}
      </text>
    </svg>
  );
}

// Ambient "last move" notification (F1): renders game.log[0] as a fading pill.
// Pure CSS animation (4s: ~1s hold then fade), re-triggered by React key remount.
function MoveToast({ text }) {
  if (!text) return null;
  return (
    <div
      className="fixed top-3 left-1/2 z-[55] max-w-[90vw] px-3 py-1.5 rounded-full text-xs font-bold pointer-events-none shadow-md whitespace-nowrap overflow-hidden text-ellipsis"
      style={{ background: `${INK}cc`, color: CREAM, animation: "hilla-toast-fade 4s ease-out forwards" }}
    >
      {text}
    </div>
  );
}

// Prominent لا ما تقدر notification (F2). Display-only; reacts to game.blockEvent.
function BlockFlashToast({ data }) {
  if (!data) return null;
  return (
    <div
      className="fixed top-16 left-1/2 z-[65] px-5 py-3 rounded-2xl text-sm font-black pointer-events-none shadow-2xl border-2 flex items-center gap-2"
      style={{ background: MAROON, color: CREAM, borderColor: GOLD, animation: "hilla-block-flash 4s ease-out forwards" }}
    >
      <Shield className="w-5 h-5 flex-shrink-0" style={{ color: GOLD }} />
      <span>
        🛡️ {data.blockerName} صدّ {data.actorName} بـ لا ما تقدر!
      </span>
    </div>
  );
}

function GameBoard({ game, myId, isOnline, isHost, roomCode, dispatch, onExit }) {
  const [selected, setSelected] = useState([]);
  const [needTarget, setNeedTarget] = useState(null);
  const [giveStep, setGiveStep] = useState(null);
  const [revealed, setRevealed] = useState(isOnline ? true : false);
  const [errMsg, setErrMsg] = useState("");
  const [sortByRegion, setSortByRegion] = useState(false);

  const current = game.players[game.currentPlayerIndex];
  const viewer = isOnline ? game.players.find((p) => p.id === myId) || current : current;
  const isMyTurn = isOnline ? current.id === myId : true;

  // Exactly one client is allowed to run automated (bot) moves: the single local device in
  // local mode, or the host in online mode. Everyone else just watches through polling.
  const botExecutor = !isOnline || !!isHost;
  const lastBotTurnRef = useRef(null);
  const settledRef = useRef(null);

  // Stale-replay guard for BlockFlashToast: capture the blockEvent id present
  // at mount (e.g. after a refresh/reconnect, where shared state still holds
  // the last block of the game) and only show toasts for ids that arrive
  // later. Purely local — never clears or writes shared game state.
  const initialBlockIdRef = useRef(game.blockEvent?.id ?? null);
  const freshBlockEvent = game.blockEvent && game.blockEvent.id !== initialBlockIdRef.current ? game.blockEvent : null;

  /* ----- analytics (fire-and-forget, never affects gameplay) -----
     Action events are emitted by the one client that dispatches the move
     (the acting human, or the bot executor). Shared transitions
     (turn_started / coord_changed / game_finished) are emitted by the
     primary logger: the single local device, or the host online.
     Deterministic event_ids make any accidental double-send collapse into
     one row server-side. */
  const isPrimaryLogger = !isOnline || !!isHost;
  const prevGameRef = useRef(null);

  function mkEvent(g, type, actor, extra) {
    const coord = g.currentCoord;
    return {
      game_id: g.analyticsId,
      room_code: roomCode || null,
      event_type: type,
      turn_number: g.turnSerial ?? 0,
      round_number: g.players.length ? Math.floor((g.turnSerial ?? 0) / g.players.length) + 1 : null,
      player_id: actor ? actor.id : null,
      player_name: actor ? actor.name : null,
      is_bot: actor ? !!actor.isBot : null,
      coord_type: coord ? coord.type : null,
      coord_region: coord ? coord.region || null : null,
      coord_item_count: coord && Array.isArray(coord.items) ? coord.items.length : null,
      ...extra,
    };
  }

  function track(events) {
    if (!game.analyticsId) return;
    sendAnalyticsEvents(events.filter(Boolean));
  }

  // Derives what a bot actually did from the before/after game states: item
  // cards that left its hand were placed, action cards that left its hand
  // were played, nothing removed = it passed. Only the bot executor client
  // runs this, so bot events are recorded exactly once.
  function botTurnEvents(prev, next, bot) {
    const gid = prev.analyticsId;
    if (!gid) return [];
    const t = prev.turnSerial ?? 0;
    const prevBot = prev.players.find((p) => p.id === bot.id);
    const nextBot = next.players.find((p) => p.id === bot.id);
    if (!prevBot || !nextBot) return [];
    const nextIds = new Set(nextBot.hand.map((c) => c.id));
    const removed = prevBot.hand.filter((c) => !nextIds.has(c.id));
    const playedItems = removed.filter((c) => c.kind === "item");
    const playedActions = removed.filter((c) => c.kind === "action");
    const events = [
      mkEvent(prev, "bot_move", bot, {
        event_id: `${gid}-t${t}-bot-${bot.id}`,
        cards_played_count: playedItems.length,
      }),
    ];
    if (playedItems.length > 0) {
      events.push(
        mkEvent(prev, "items_played", bot, {
          event_id: `${gid}-t${t}-items-${bot.id}`,
          cards_played_count: playedItems.length,
          items: playedItems.map((c) => ({ name: c.name, region: c.region, rarity: c.rarity })),
        })
      );
    }
    playedActions.forEach((c) => {
      const pa = next.pendingAction;
      const target = pa && pa.actorId === bot.id ? next.players.find((p) => p.id === pa.targetId) : null;
      events.push(
        mkEvent(prev, "action_played", bot, {
          event_id: `${gid}-t${t}-action-${bot.id}-${c.actionType}`,
          action_type: c.actionType,
          payload: target ? { target_player_id: target.id, target_is_bot: !!target.isBot } : null,
        })
      );
    });
    if (playedItems.length === 0 && playedActions.length === 0) {
      events.push(
        mkEvent(prev, "turn_skipped", bot, {
          event_id: `${gid}-t${t}-skip-${bot.id}`,
          skip_reason: "bot_no_valid_move",
        })
      );
    }
    return events;
  }

  // Transition tracker: compares the previous game snapshot with the current
  // one and reports turn starts, coord changes and game end. Runs on every
  // client but only the primary logger emits.
  useEffect(() => {
    const prev = prevGameRef.current;
    prevGameRef.current = game;
    if (!game || !game.analyticsId || !isPrimaryLogger) return;
    if (!prev || prev.analyticsId !== game.analyticsId) return;
    const events = [];
    const prevTurn = prev.turnSerial ?? 0;
    const curTurn = game.turnSerial ?? 0;
    if (curTurn > prevTurn && !game.winner) {
      const cur = game.players[game.currentPlayerIndex];
      events.push(mkEvent(game, "turn_started", cur, { event_id: `${game.analyticsId}-t${curTurn}-start` }));
    }
    if (prev.currentCoord && game.currentCoord && prev.currentCoord.id !== game.currentCoord.id) {
      events.push(
        mkEvent(game, "coord_changed", null, {
          event_id: `${game.analyticsId}-t${curTurn}-coord`,
          payload: { locked_by_freeze: false },
        })
      );
    } else if (curTurn > prevTurn && game.currentPlayerIndex === 0 && prev.lockCoord && !game.lockCoord) {
      // Round wrapped but ثبّت الحَلّة retained the same coord card.
      events.push(
        mkEvent(game, "coord_changed", null, {
          event_id: `${game.analyticsId}-t${curTurn}-coord`,
          payload: { locked_by_freeze: true },
        })
      );
    }
    if (!prev.winner && game.winner) {
      sendGameFinished(game, roomCode || null);
    }
    if (events.length) track(events);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  useEffect(() => {
    if (!errMsg) return;
    const t = setTimeout(() => setErrMsg(""), 3000);
    return () => clearTimeout(t);
  }, [errMsg]);

  // Reset per-turn local UI state whenever the active player changes (covers bot-driven transitions too).
  useEffect(() => {
    if (isOnline) return;
    setRevealed(false);
    setSelected([]);
    setNeedTarget(null);
    setGiveStep(null);
  }, [game.currentPlayerIndex, isOnline]);

  // Auto-play a bot's turn a beat after it becomes active. turnSerial guards against dispatching
  // the same bot turn twice if the effect refires on an identical polled room state.
  useEffect(() => {
    if (!botExecutor || game.winner || game.pendingAction || game.digOptions) return;
    const cur = game.players[game.currentPlayerIndex];
    if (!cur || !cur.isBot) return;
    const key = `${game.turnSerial ?? 0}:${cur.id}`;
    if (lastBotTurnRef.current === key) return;
    const t = setTimeout(() => {
      if (lastBotTurnRef.current === key) return;
      lastBotTurnRef.current = key;
      const next = botDecideTurn(game, cur.id);
      track(botTurnEvents(game, next, cur));
      dispatch(next);
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, botExecutor]);

  function settlePendingAction(computeGame, analyticsEvents) {
    const pa = game.pendingAction;
    if (!pa || settledRef.current === pa.id) return;
    settledRef.current = pa.id;
    let g = computeGame();
    // If the actor was a bot, it has nothing left to decide — end its turn right away.
    if (!g.winner) {
      const actor = g.players.find((p) => p.id === pa.actorId);
      if (actor && actor.isBot) g = rEndTurn(g, pa.actorId);
    }
    if (analyticsEvents) track(analyticsEvents);
    dispatch(g);
  }

  // Block-window automation. Bot self-defense runs on the bot executor client; the timed
  // auto-resolve runs on exactly one client — the human actor's own device (whose clock stamped
  // startedAt, so it measures a true 10s window), or the host when the actor is a bot. The
  // remaining time is derived from the persisted startedAt, so a re-render from polling never
  // restarts the window.
  useEffect(() => {
    const pa = game.pendingAction;
    if (!pa) return;
    const actor = game.players.find((p) => p.id === pa.actorId);
    const harmfulToTarget = pa.actionType === "drawTwo" || pa.actionType === "stealTwo";
    const targetBot = game.players.find((p) => p.id === pa.targetId && p.isBot);
    const targetHasBlock = targetBot && targetBot.hand.some((c) => c.kind === "action" && c.actionType === "block");

    if (harmfulToTarget && targetHasBlock && botExecutor) {
      const t = setTimeout(
        () =>
          settlePendingAction(
            () => rCancelWithBlock(game, targetBot.id),
            [
              mkEvent(game, "block_used", targetBot, {
                event_id: `${game.analyticsId}-pa-${pa.id || "x"}-block-${targetBot.id}`,
                action_type: "block",
                payload: { blocked_action_type: pa.actionType, blocked_actor_player_id: pa.actorId },
              }),
            ]
          ),
        700
      );
      return () => clearTimeout(t);
    }

    const isResolver = !isOnline || (actor?.isBot ? !!isHost : pa.actorId === myId);
    if (!isResolver) return;
    const startedAt = typeof pa.startedAt === "number" ? pa.startedAt : Date.now();
    const remaining = Math.max(0, BLOCK_WINDOW_MS - (Date.now() - startedAt));
    const t = setTimeout(() => settlePendingAction(() => rResolvePendingAction(game)), remaining);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, isOnline, isHost, botExecutor]);

  function toggleSelect(cardId) {
    setSelected((s) => (s.includes(cardId) ? s.filter((x) => x !== cardId) : [...s, cardId]));
  }

  function playSelectedItems() {
    const res = rPlayItems(game, viewer.id, selected);
    if (res.error) {
      setErrMsg(res.error);
      return;
    }
    setSelected([]);
    const playedCards = viewer.hand.filter((c) => selected.includes(c.id) && c.kind === "item");
    if (playedCards.length > 0) {
      track([
        mkEvent(game, "items_played", viewer, {
          event_id: `${game.analyticsId}-t${game.turnSerial ?? 0}-items-${viewer.id}`,
          cards_played_count: playedCards.length,
          items: playedCards.map((c) => ({ name: c.name, region: c.region, rarity: c.rarity })),
        }),
      ]);
    }
    // Placing items always ends the turn right away — an action card can only be played
    // *before* items, never after.
    let g = res.game;
    if (!g.winner) g = rEndTurn(g, viewer.id);
    dispatch(g);
  }

  // Ends the current player's turn explicitly — for when they only played an action card (or
  // nothing at all) and have no items to place.
  function endMyTurn() {
    setSelected([]);
    setNeedTarget(null);
    const hadValidMove = findMatchingItems(viewer.hand, game.currentCoord).length > 0;
    track([
      mkEvent(game, "turn_skipped", viewer, {
        event_id: `${game.analyticsId}-t${game.turnSerial ?? 0}-skip-${viewer.id}`,
        skip_reason: hadValidMove ? "manual_skip" : "no_valid_card",
      }),
    ]);
    dispatch(rEndTurn(game, viewer.id));
  }

  function startAction(cardId) {
    if (game.actionUsedThisTurn) return;
    const card = viewer.hand.find((c) => c.id === cardId);
    if (!card) return;
    if (card.actionType === "freeze") {
      track([
        mkEvent(game, "action_played", viewer, {
          event_id: `${game.analyticsId}-t${game.turnSerial ?? 0}-action-${viewer.id}-freeze`,
          action_type: "freeze",
        }),
      ]);
      dispatch(rPlayFreeze(game, viewer.id, cardId));
      return;
    }
    if (card.actionType === "dig") {
      track([
        mkEvent(game, "action_played", viewer, {
          event_id: `${game.analyticsId}-t${game.turnSerial ?? 0}-action-${viewer.id}-dig`,
          action_type: "dig",
        }),
      ]);
      dispatch(rPlayDig(game, viewer.id, cardId));
      return;
    }
    setNeedTarget(card);
  }

  function chooseTarget(targetId) {
    const card = needTarget;
    if (card.actionType === "giveTake") {
      setGiveStep({ cardId: card.id, targetId });
      setNeedTarget(null);
      return;
    }
    const target = game.players.find((p) => p.id === targetId);
    track([
      mkEvent(game, "action_played", viewer, {
        event_id: `${game.analyticsId}-t${game.turnSerial ?? 0}-action-${viewer.id}-${card.actionType}`,
        action_type: card.actionType,
        payload: { target_player_id: targetId, target_is_bot: !!target?.isBot },
      }),
    ]);
    dispatch(rDeclareAction(game, viewer.id, card.id, card.actionType, targetId));
    setNeedTarget(null);
  }

  function confirmGiveTake(chosenIds) {
    const target = game.players.find((p) => p.id === giveStep.targetId);
    track([
      mkEvent(game, "action_played", viewer, {
        event_id: `${game.analyticsId}-t${game.turnSerial ?? 0}-action-${viewer.id}-giveTake`,
        action_type: "giveTake",
        payload: { target_player_id: giveStep.targetId, target_is_bot: !!target?.isBot },
      }),
    ]);
    dispatch(rDeclareGiveTake(game, viewer.id, giveStep.cardId, giveStep.targetId, chosenIds));
    setGiveStep(null);
  }

  function cancelWithBlock(blockerId) {
    const blocker = game.players.find((p) => p.id === blockerId);
    const hasBlock = blocker && blocker.hand.some((c) => c.kind === "action" && c.actionType === "block");
    if (!hasBlock) {
      setErrMsg(`${blocker?.name || ""} ما معه كرت لا ما تقدر.`);
      return;
    }
    const pa = game.pendingAction;
    settlePendingAction(
      () => rCancelWithBlock(game, blockerId),
      pa
        ? [
            mkEvent(game, "block_used", blocker, {
              event_id: `${game.analyticsId}-pa-${pa.id || "x"}-block-${blockerId}`,
              action_type: "block",
              payload: { blocked_action_type: pa.actionType, blocked_actor_player_id: pa.actorId },
            }),
          ]
        : null
    );
  }

  function finishDig(keepId) {
    dispatch(rFinishDig(game, keepId));
  }

  const eligibleBlockers = useMemo(() => {
    if (!game.pendingAction) return [];
    return game.players.filter(
      (p) => p.id !== game.pendingAction.actorId && p.hand.some((c) => c.kind === "action" && c.actionType === "block")
    );
  }, [game.pendingAction, game.players]);

  const winnerPlayer = game.winner ? game.players.find((p) => p.id === game.winner) : null;

  return (
    <div dir="rtl" className="min-h-screen w-full p-4" style={{ ...pageBg, fontFamily: "Tajawal" }}>
      <GlobalFont />
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="text-2xl font-black" style={{ color: MAROON, fontFamily: "Aref Ruqaa" }}>
            حُلّة {isOnline && <Wifi className="inline w-4 h-4 mb-1" style={{ color: TEAL }} />}
          </div>
          <button onClick={onExit} className="text-xs flex items-center gap-1" style={{ color: `${MAROON}99` }}>
            <RotateCcw className="w-3 h-3" /> لعبة جديدة
          </button>
        </div>
        <DiamondLattice color={GOLD} thickness={10} />

        <MoveToast key={`${game.log.length}-${game.log[0] || ""}`} text={game.log[0]} />
        <BlockFlashToast key={freshBlockEvent?.id || "none"} data={freshBlockEvent} />

        {winnerPlayer ? (
          <div className="mt-10 text-center">
            <div className="text-4xl font-black mb-3" style={{ color: MAROON, fontFamily: "Aref Ruqaa" }}>
              🎉 فاز {winnerPlayer.name}!
            </div>
            <button onClick={onExit} className="mt-4 px-6 py-3 rounded-xl font-bold" style={{ background: MAROON, color: CREAM }}>
              العب من جديد
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mt-4 mb-4">
              {game.players.map((p, i) => (
                <div
                  key={p.id}
                  className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border-2"
                  style={
                    i === game.currentPlayerIndex
                      ? { background: MAROON, color: CREAM, borderColor: MAROON }
                      : { color: `${INK}99`, borderColor: `${MAROON}33` }
                  }
                >
                  {p.isBot ? "🤖 " : ""}
                  {p.name} {isOnline && p.id === myId && <span style={{ color: GOLD }}>(أنت)</span>} <span className="opacity-70">({p.hand.length})</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center gap-4 mb-6">
              {game.lockCoord && (
                <div className="text-xs font-bold flex items-center gap-1" style={{ color: GOLD }}>
                  <Repeat2 className="w-3 h-3" /> ثبّت الحَلّة مفعّل — هذا الكرت سيبقى جولة إضافية
                </div>
              )}
              <CoordCard card={game.currentCoord} />
              {isOnline && !isMyTurn && (
                <div className="text-sm font-bold" style={{ color: `${INK}88` }}>
                  ⏳ دور {current.name} الآن...
                </div>
              )}
            </div>

            {game.pendingAction && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="rounded-2xl p-6 max-w-sm w-full text-center border-2" style={{ background: CREAM, borderColor: MAROON }}>
                  <CountdownRing pendingActionId={game.pendingAction.id} startedAt={game.pendingAction.startedAt} />
                  {(() => {
                    const actorPlayer = game.players.find((p) => p.id === game.pendingAction.actorId);
                    const targetPlayer = game.players.find((p) => p.id === game.pendingAction.targetId);
                    const actorIsMe = isOnline ? actorPlayer?.id === myId : !actorPlayer?.isBot;
                    const targetIsMe = isOnline ? targetPlayer?.id === myId : !targetPlayer?.isBot;
                    return (
                      <div className="mb-1" style={{ color: INK }}>
                        <div className="font-bold">
                          {actorIsMe ? "أنت تستخدم" : `${game.pendingAction.actorName} يستخدم`} {actionMeta(game.pendingAction.actionType).name}
                        </div>
                        {targetIsMe ? (
                          <div className="text-lg font-black mt-1" style={{ color: MAROON }}>
                            ⚠️ ضدك أنت!
                          </div>
                        ) : (
                          <div className="text-sm mt-1" style={{ color: `${INK}99` }}>
                            ضد {targetPlayer?.name}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div className="text-xs mb-4" style={{ color: `${INK}88` }}>
                    {isOnline ? (
                      eligibleBlockers.some((p) => p.id === myId) ? (
                        <>
                          عندك فرصة تستخدم <b className="font-black" style={{ color: MAROON }}>لا ما تقدر</b> قبل ما تنتهي العدّة.
                        </>
                      ) : (
                        "بينفّذ تلقائيًا بعد العدّة."
                      )
                    ) : (
                      <>
                        أي لاعب عنده <b className="font-black" style={{ color: MAROON }}>لا ما تقدر</b> يقدر يستخدمه الحين، وإلا بينفّذ تلقائيًا بعد العدّة.
                      </>
                    )}
                  </div>
                  <div className="space-y-2 mb-3">
                    {isOnline
                      ? eligibleBlockers
                          .filter((p) => p.id === myId)
                          .map((p) => (
                            <button key={p.id} onClick={() => cancelWithBlock(p.id)} className="w-full py-2 rounded-lg text-sm font-bold" style={{ background: MAROON, color: CREAM }}>
                              استخدم لا ما تقدر
                            </button>
                          ))
                      : eligibleBlockers
                          .filter((p) => !p.isBot)
                          .map((p) => (
                            <button key={p.id} onClick={() => cancelWithBlock(p.id)} className="w-full py-2 rounded-lg text-sm font-bold" style={{ background: MAROON, color: CREAM }}>
                              {p.name}: استخدم لا ما تقدر
                            </button>
                          ))}
                  </div>
                  {errMsg && (
                    <div className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: `${MAROON}15`, color: MAROON }}>
                      {errMsg}
                    </div>
                  )}
                </div>
              </div>
            )}

            {needTarget && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="rounded-2xl p-6 max-w-sm w-full text-center border-2" style={{ background: CREAM, borderColor: MAROON }}>
                  <div className="font-bold mb-4" style={{ color: INK }}>
                    اختر اللاعب المستهدف لـ {actionMeta(needTarget.actionType).name}
                  </div>
                  <div className="space-y-2">
                    {game.players.filter((p) => p.id !== viewer.id).map((p) => (
                      <button key={p.id} onClick={() => chooseTarget(p.id)} className="w-full py-2 rounded-lg border-2" style={{ color: INK, borderColor: `${MAROON}33` }}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setNeedTarget(null)} className="mt-3 text-xs" style={{ color: `${INK}66` }}>
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            {giveStep && <GivePicker viewer={viewer} onConfirm={confirmGiveTake} onCancel={() => setGiveStep(null)} />}

            {game.digOptions && (!isOnline || game.digOptions.playerId === myId) && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="rounded-2xl p-6 max-w-md w-full text-center border-2" style={{ background: CREAM, borderColor: MAROON }}>
                  <div className="font-bold mb-4" style={{ color: INK }}>
                    اختر كرت واحد تحتفظ به من فتّش الصندوق
                  </div>
                  <div className="flex justify-center gap-3">
                    {game.digOptions.cards.map((c) =>
                      c.kind === "item" ? <ItemCard key={c.id} card={c} onClick={() => finishDig(c.id)} /> : <ActionCard key={c.id} card={c} onClick={() => finishDig(c.id)} />
                    )}
                  </div>
                </div>
              </div>
            )}
            {game.digOptions && isOnline && game.digOptions.playerId !== myId && (
              <div className="text-center text-sm mb-4" style={{ color: `${INK}66` }}>
                {game.players.find((p) => p.id === game.digOptions.playerId)?.name} يفتّش الصندوق الآن...
              </div>
            )}

            {!isOnline && current.isBot ? (
              <div className="text-center py-14">
                <div className="text-lg font-bold mb-2" style={{ color: MAROON }}>
                  🤖 {current.name} يفكر...
                </div>
                <div className="flex justify-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-2 h-2 rounded-full animate-pulse" style={{ background: GOLD, animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            ) : !isOnline && !revealed && game.players.filter((p) => !p.isBot).length > 1 ? (
              <div className="text-center py-14">
                <div className="text-lg font-bold mb-2" style={{ color: INK }}>
                  مرر الجهاز إلى
                </div>
                <div className="text-3xl font-black mb-6" style={{ color: MAROON, fontFamily: "Aref Ruqaa" }}>
                  {current.name}
                </div>
                <button onClick={() => setRevealed(true)} className="px-6 py-3 rounded-xl font-bold" style={{ background: MAROON, color: CREAM }}>
                  اضغط لإظهار يدك
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold" style={{ color: `${INK}77` }}>
                    عناصر اللبس {isOnline && <span style={{ color: GOLD }}>({viewer?.name})</span>}
                  </div>
                  <button
                    onClick={() => setSortByRegion((s) => !s)}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg border-2 flex items-center gap-1"
                    style={sortByRegion ? { background: MAROON, color: CREAM, borderColor: MAROON } : { color: MAROON, borderColor: `${MAROON}55` }}
                  >
                    🗂️ رتّب حسب المنطقة
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-3 mb-3">
                  {(() => {
                    const itemCards = viewer.hand.filter((c) => c.kind === "item");
                    if (itemCards.length === 0) {
                      return (
                        <div className="text-sm py-4" style={{ color: `${INK}44` }}>
                          لا توجد عناصر لبس في يدك.
                        </div>
                      );
                    }
                    if (!sortByRegion) {
                      return itemCards.map((c) => <ItemCard key={c.id} card={c} selected={selected.includes(c.id)} onClick={() => (isMyTurn ? toggleSelect(c.id) : null)} />);
                    }
                    const sorted = sortItemsByRegion(itemCards);
                    const nodes = [];
                    let lastRegion = null;
                    sorted.forEach((c, i) => {
                      if (c.region !== lastRegion) {
                        if (lastRegion !== null) nodes.push(<DiamondLattice key={`div-${c.region}`} vertical color={GOLD} thickness={6} />);
                        lastRegion = c.region;
                      }
                      nodes.push(<ItemCard key={c.id} card={c} selected={selected.includes(c.id)} onClick={() => (isMyTurn ? toggleSelect(c.id) : null)} />);
                    });
                    return nodes;
                  })()}
                </div>

                {errMsg && (
                  <div className="text-xs font-bold mb-2 px-3 py-1.5 rounded-lg inline-block" style={{ background: `${MAROON}15`, color: MAROON }}>
                    {errMsg}
                  </div>
                )}

                <div className="flex gap-2 mb-6">
                  <button
                    onClick={playSelectedItems}
                    disabled={selected.length === 0 || !isMyTurn}
                    className="px-5 py-2 rounded-lg font-bold disabled:opacity-30"
                    style={{ background: TEAL, color: CREAM }}
                  >
                    ضع العنصر/العناصر المحددة
                  </button>
                  <button onClick={endMyTurn} disabled={!isMyTurn} className="px-5 py-2 rounded-lg font-bold disabled:opacity-30" style={{ background: MAROON, color: CREAM }}>
                    خلصت دوري
                  </button>
                </div>

                <div className="text-xs mb-2 font-bold" style={{ color: `${INK}77` }}>
                  كروت الأكشن — كرت واحد بس، وقبل ما تحط عناصرك {game.actionUsedThisTurn && isMyTurn && <span style={{ color: GOLD }}>(مستخدم هذي الجولة)</span>}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-3">
                  {viewer.hand
                    .filter((c) => c.kind === "action")
                    .map((c) => (
                      <ActionCard key={c.id} card={c} disabled={!isMyTurn || game.actionUsedThisTurn} onClick={() => startAction(c.id)} />
                    ))}
                  {viewer.hand.filter((c) => c.kind === "action").length === 0 && (
                    <div className="text-sm py-4" style={{ color: `${INK}44` }}>
                      لا توجد كروت أكشن في يدك.
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="mt-8 rounded-xl p-3 max-h-32 overflow-y-auto border-2" style={{ background: CREAM2, borderColor: `${MAROON}22` }}>
              {game.log.map((l, i) => (
                <div key={i} className="text-[11px] mb-1" style={{ color: `${INK}77` }}>
                  {l}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GivePicker({ viewer, onConfirm, onCancel }) {
  const [chosen, setChosen] = useState([]);
  const items = viewer.hand;
  const max = Math.min(2, items.length);
  function toggle(id) {
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < max ? [...c, id] : c));
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="rounded-2xl p-6 max-w-lg w-full text-center border-2" style={{ background: CREAM, borderColor: MAROON }}>
        <div className="font-bold mb-1" style={{ color: INK }}>
          عطني وأعطيك
        </div>
        <div className="text-xs mb-4" style={{ color: `${INK}88` }}>
          اختر {max === 2 ? "كرتين" : "كرت واحد"} من يدك لإعطائها للاعب الآخر.
        </div>
        <div className="flex gap-2 overflow-x-auto justify-center pb-3">
          {items.map((c) =>
            c.kind === "item" ? (
              <ItemCard key={c.id} small card={c} selected={chosen.includes(c.id)} onClick={() => toggle(c.id)} />
            ) : (
              <ActionCard key={c.id} card={c} selected={chosen.includes(c.id)} onClick={() => toggle(c.id)} />
            )
          )}
        </div>
        <div className="flex gap-2 justify-center mt-3">
          <button onClick={() => onConfirm(chosen)} disabled={chosen.length !== max} className="px-5 py-2 rounded-lg font-bold disabled:opacity-30" style={{ background: TEAL, color: CREAM }}>
            تأكيد
          </button>
          <button onClick={onCancel} className="px-5 py-2 rounded-lg border-2" style={{ color: `${INK}88`, borderColor: `${MAROON}33` }}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- LOCAL MODE --------------------------------- */

function LocalSetup({ onStart, onBack }) {
  const [numPlayers, setNumPlayers] = useState(3);
  const [defaultNames] = useState(() => ["المضيف", ...pickRandomBotNames(5)]);
  const [names, setNames] = useState(defaultNames);
  const [isBot, setIsBot] = useState([false, true, true, true, true, true]);
  const [perPlayer, setPerPlayer] = useState(REC_COUNTS[3]);

  function toggleBot(i) {
    const copy = [...isBot];
    copy[i] = !copy[i];
    setIsBot(copy);
    // give a sensible default name when flipping a slot, unless the user already typed something custom
    const wasDefault = names[i] === defaultNames[i] || names[i] === `لاعب ${i + 1}`;
    if (wasDefault) {
      const copyNames = [...names];
      copyNames[i] = copy[i] ? defaultNames[i] : i === 0 ? "المضيف" : `لاعب ${i + 1}`;
      setNames(copyNames);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen w-full flex items-center justify-center p-6" style={{ ...pageBg, fontFamily: "Tajawal" }}>
      <GlobalFont />
      <div className="w-full max-w-md">
        <div className="text-center mb-5">
          <CardBackHero />
          <p className="mt-3" style={{ color: MAROON_DK }}>
            وضع "تمرير الجهاز" — كل اللاعبين على نفس الجهاز، وتقدر تضيف بوتات تلعب أوتوماتيكي
          </p>
        </div>
        <div className="rounded-2xl p-5 space-y-5 border-2" style={{ background: CREAM2, borderColor: GOLD }}>
          <div>
            <label className="text-sm flex items-center gap-2 mb-2 font-bold" style={{ color: MAROON }}>
              <Users className="w-4 h-4" /> عدد اللاعبين
            </label>
            <div className="flex gap-2">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setNumPlayers(n);
                    setPerPlayer(REC_COUNTS[n]);
                  }}
                  className="flex-1 py-2 rounded-lg font-bold border-2"
                  style={numPlayers === n ? { background: MAROON, color: CREAM, borderColor: MAROON } : { color: MAROON, borderColor: `${MAROON}55`, background: "transparent" }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {Array.from({ length: numPlayers }).map((_, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={names[i]}
                  onChange={(e) => {
                    const copy = [...names];
                    copy[i] = e.target.value;
                    setNames(copy);
                  }}
                  placeholder={`اسم اللاعب ${i + 1}`}
                  className="flex-1 rounded-lg px-3 py-2 text-sm border-2 focus:outline-none"
                  style={{ background: CREAM, color: INK, borderColor: `${MAROON}33` }}
                />
                <button
                  onClick={() => toggleBot(i)}
                  className="px-3 rounded-lg text-xs font-bold border-2 whitespace-nowrap"
                  style={isBot[i] ? { background: MAROON, color: CREAM, borderColor: MAROON } : { color: MAROON, borderColor: `${MAROON}55`, background: "transparent" }}
                  title="بوت يلعب بذكاء أوتوماتيكي"
                >
                  {isBot[i] ? "🤖 بوت" : "🧍 إنسان"}
                </button>
              </div>
            ))}
            <p className="text-[11px]" style={{ color: `${INK}66` }}>
              🤖 البوتات تلعب بأقوى استراتيجية ممكنة: تحط أقصى عدد كروت مطابقة كل جولة، وتختار أذكى أكشن متاح.
            </p>
          </div>
          <div>
            <label className="text-sm mb-2 block font-bold" style={{ color: MAROON }}>
              عدد الكروت لكل لاعب: <span style={{ color: GOLD }}>{perPlayer}</span>
            </label>
            <input type="range" min={10} max={20} value={perPlayer} onChange={(e) => setPerPlayer(Number(e.target.value))} className="w-full" style={{ accentColor: MAROON }} />
          </div>
          <button
            onClick={() => {
              const meta = Array.from({ length: numPlayers }).map((_, i) => ({
                id: `p${i}`,
                name: names[i]?.trim() || (isBot[i] ? `بوت ${i + 1}` : `لاعب ${i + 1}`),
                isBot: !!isBot[i],
              }));
              onStart(createInitialGame(meta, perPlayer));
            }}
            className="w-full py-3 rounded-xl font-black text-lg hover:brightness-110 transition flex items-center justify-center gap-2"
            style={{ background: MAROON, color: CREAM }}
          >
            <Sparkles className="w-5 h-5" style={{ color: GOLD }} /> ابدأوا اللعب
          </button>
          <button onClick={onBack} className="w-full text-xs" style={{ color: `${INK}77` }}>
            رجوع
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- ONLINE MODE --------------------------------- */

function OnlineMenu({ myName, setMyName, onCreate, onJoin, onBack, error }) {
  const [joinCode, setJoinCode] = useState("");
  const [perPlayer, setPerPlayer] = useState(16);
  return (
    <div dir="rtl" className="min-h-screen w-full flex items-center justify-center p-6" style={{ ...pageBg, fontFamily: "Tajawal" }}>
      <GlobalFont />
      <div className="w-full max-w-md">
        <div className="text-center mb-5">
          <CardBackHero />
          <p className="mt-3 flex items-center justify-center gap-1.5" style={{ color: MAROON_DK }}>
            <Wifi className="w-4 h-4" /> العب أونلاين — كل واحد بجهازه
          </p>
        </div>
        <div className="rounded-2xl p-5 space-y-4 border-2" style={{ background: CREAM2, borderColor: GOLD }}>
          <input
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            placeholder="اسمك"
            className="w-full rounded-lg px-3 py-2 text-sm border-2 focus:outline-none"
            style={{ background: CREAM, color: INK, borderColor: `${MAROON}33` }}
          />

          <div className="border-t pt-4" style={{ borderColor: `${MAROON}22` }}>
            <div className="text-sm font-bold mb-2" style={{ color: MAROON }}>
              أنشئ غرفة جديدة
            </div>
            <label className="text-xs mb-1 block" style={{ color: `${INK}88` }}>
              كروت لكل لاعب: <span style={{ color: GOLD }}>{perPlayer}</span>
            </label>
            <input type="range" min={10} max={20} value={perPlayer} onChange={(e) => setPerPlayer(Number(e.target.value))} className="w-full mb-3" style={{ accentColor: MAROON }} />
            <button
              onClick={() => onCreate(perPlayer)}
              disabled={!myName.trim()}
              className="w-full py-3 rounded-xl font-black disabled:opacity-40"
              style={{ background: MAROON, color: CREAM }}
            >
              أنشئ غرفة
            </button>
          </div>

          <div className="border-t pt-4" style={{ borderColor: `${MAROON}22` }}>
            <div className="text-sm font-bold mb-2" style={{ color: MAROON }}>
              انضم لغرفة
            </div>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="كود الغرفة (مثال: A1B2)"
              maxLength={4}
              className="w-full rounded-lg px-3 py-2 text-sm border-2 mb-3 text-center tracking-widest font-black focus:outline-none"
              style={{ background: CREAM, color: MAROON, borderColor: `${MAROON}33` }}
            />
            <button
              onClick={() => onJoin(joinCode)}
              disabled={!myName.trim() || joinCode.length !== 4}
              className="w-full py-3 rounded-xl font-black disabled:opacity-40"
              style={{ background: TEAL, color: CREAM }}
            >
              انضم
            </button>
          </div>

          {error && (
            <div className="text-xs font-bold text-center px-3 py-2 rounded-lg" style={{ background: `${MAROON}15`, color: MAROON }}>
              {error}
            </div>
          )}

          <button onClick={onBack} className="w-full text-xs" style={{ color: `${INK}77` }}>
            رجوع
          </button>
        </div>
      </div>
    </div>
  );
}

function OnlineLobby({ room, myId, onStart, onAddBot, onRemoveBot, onBack }) {
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === myId;

  function copyCode() {
    try {
      navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {}
  }

  return (
    <div dir="rtl" className="min-h-screen w-full flex items-center justify-center p-6" style={{ ...pageBg, fontFamily: "Tajawal" }}>
      <GlobalFont />
      <div className="w-full max-w-md">
        <div className="text-center mb-5">
          <div className="text-2xl font-black mb-2" style={{ color: MAROON, fontFamily: "Aref Ruqaa" }}>
            حُلّة
          </div>
          <div className="text-xs mb-1" style={{ color: `${INK}88` }}>
            كود الغرفة — شاركه مع أصحابك
          </div>
          <button
            onClick={copyCode}
            className="mx-auto flex items-center gap-2 px-6 py-3 rounded-2xl border-4 text-3xl font-black tracking-[0.3em]"
            style={{ borderColor: MAROON, color: MAROON, background: CREAM2 }}
          >
            {room.code}
            {copied ? <Check className="w-5 h-5" style={{ color: TEAL }} /> : <Copy className="w-5 h-5 opacity-50" />}
          </button>
          <p className="text-[11px] mt-2" style={{ color: `${INK}66` }}>
            كل صديق يفتح نفس رابط هذي المحادثة، يضغط "العب أونلاين ← انضم لغرفة" ويدخل الكود.
          </p>
        </div>

        <div className="rounded-2xl p-5 space-y-3 border-2" style={{ background: CREAM2, borderColor: GOLD }}>
          <div className="text-sm font-bold" style={{ color: MAROON }}>
            اللاعبون ({room.lobby.length}/{room.maxPlayers})
          </div>
          {room.lobby.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: CREAM }}>
              <span className="text-sm font-bold" style={{ color: INK }}>
                {p.isBot ? "🤖 " : ""}
                {p.name} {p.id === room.hostId && <span style={{ color: GOLD }}>(المضيف)</span>} {p.id === myId && <span style={{ color: TEAL }}>— أنت</span>}
              </span>
              {isHost && p.isBot && (
                <button onClick={() => onRemoveBot(p.id)} className="text-xs font-bold px-2 py-1 rounded" style={{ color: MAROON, background: `${MAROON}15` }} title="أزل البوت">
                  ✕
                </button>
              )}
            </div>
          ))}

          {isHost && (
            <button
              onClick={onAddBot}
              disabled={room.lobby.length >= room.maxPlayers}
              className="w-full py-2 rounded-lg text-sm font-bold border-2 disabled:opacity-40"
              style={{ color: MAROON, borderColor: `${MAROON}55`, background: "transparent" }}
            >
              🤖 أضف بوت
            </button>
          )}

          {isHost ? (
            <button
              onClick={onStart}
              disabled={room.lobby.length < 2}
              className="w-full py-3 rounded-xl font-black disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: MAROON, color: CREAM }}
            >
              <Sparkles className="w-5 h-5" style={{ color: GOLD }} /> ابدأ اللعبة
            </button>
          ) : (
            <div className="text-center text-xs py-2" style={{ color: `${INK}66` }}>
              بانتظار المضيف يبدأ اللعبة...
            </div>
          )}
          {isHost && room.lobby.length < 2 && (
            <div className="text-[11px] text-center" style={{ color: `${INK}55` }}>
              لازم لاعبين اثنين على الأقل.
            </div>
          )}

          <button onClick={onBack} className="w-full text-xs flex items-center justify-center gap-1" style={{ color: `${INK}77` }}>
            <LogOut className="w-3 h-3" /> اخرج من الغرفة
          </button>
        </div>
      </div>
    </div>
  );
}

function OnlineFlow({ onBack }) {
  const [myId] = useState(() => uid());
  const [myName, setMyName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [onlinePhase, setOnlinePhase] = useState("menu"); // menu | lobby | play
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");

  async function saveRoomTo(code, doc) {
    setRoom(doc);
    try {
      const res = await fetch(`/api/rooms/${code}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: doc }),
      });
      if (!res.ok) throw new Error("save_failed");
    } catch (e) {
      setError("تعذر الحفظ، تأكد من الاتصال وحاول مجددًا.");
    }
  }

  async function pollRoom() {
    if (!roomCode) return;
    try {
      const res = await fetch(`/api/rooms/${roomCode}`, { cache: "no-store" });
      if (!res.ok) return;
      const doc = await res.json();
      setRoom(doc);
      if (doc.started) setOnlinePhase("play");
    } catch (e) {
      /* room not found yet or transient error, ignore */
    }
  }

  useEffect(() => {
    if (!roomCode) return;
    pollRoom();
    const iv = setInterval(pollRoom, 1500);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  async function createRoom(perPlayer) {
    setError("");
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = genCode();
      const doc = { code, hostId: myId, perPlayer, maxPlayers: 6, started: false, lobby: [{ id: myId, name: myName.trim() }], game: null };
      try {
        const res = await fetch("/api/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room: doc }),
        });
        if (res.status === 409) continue;
        if (!res.ok) throw new Error("create_failed");
        const created = await res.json();
        setRoomCode(code);
        setRoom(created);
        setOnlinePhase("lobby");
        return;
      } catch (e) {
        setError("تعذر إنشاء الغرفة، حاول مجددًا.");
        return;
      }
    }
    setError("تعذر إنشاء الغرفة، حاول مجددًا.");
  }

  async function joinRoom(codeRaw) {
    setError("");
    const code = codeRaw.trim().toUpperCase();
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player: { id: myId, name: myName.trim() } }),
      });
      if (res.status === 404) {
        setError("ما لقينا هذي الغرفة، تأكد من الكود.");
        return;
      }
      if (res.status === 409) {
        setError("اللعبة بدأت بالفعل بهذي الغرفة.");
        return;
      }
      if (res.status === 410) {
        setError("الغرفة مليانة.");
        return;
      }
      if (!res.ok) throw new Error("join_failed");
      const doc = await res.json();
      setRoomCode(code);
      setRoom(doc);
      setOnlinePhase("lobby");
    } catch (e) {
      setError("ما لقينا هذي الغرفة، تأكد من الكود.");
    }
  }

  async function addBot() {
    if (!room || room.hostId !== myId || room.started) return;
    if (room.lobby.length >= room.maxPlayers) return;
    const used = new Set(room.lobby.map((p) => p.name));
    const name = shuffle(BOT_NAME_POOL).find((n) => !used.has(n)) || `بوت ${room.lobby.length + 1}`;
    const bot = { id: `bot-${uid()}`, name, isBot: true };
    await saveRoomTo(roomCode, { ...room, lobby: [...room.lobby, bot] });
  }

  async function removeBot(botId) {
    if (!room || room.hostId !== myId || room.started) return;
    await saveRoomTo(roomCode, { ...room, lobby: room.lobby.filter((p) => p.id !== botId) });
  }

  async function startOnlineGame() {
    if (!room || room.hostId !== myId || room.lobby.length < 2) return;
    const g = createInitialGame(room.lobby, room.perPlayer);
    sendGameStarted(g, roomCode);
    await saveRoomTo(roomCode, { ...room, started: true, game: g });
  }

  async function dispatchGame(newGame) {
    if (!room) return;
    await saveRoomTo(roomCode, { ...room, game: newGame });
  }

  function exitToMenu() {
    setRoomCode("");
    setRoom(null);
    setOnlinePhase("menu");
  }

  if (onlinePhase === "menu") {
    return <OnlineMenu myName={myName} setMyName={setMyName} onCreate={createRoom} onJoin={joinRoom} onBack={onBack} error={error} />;
  }
  if (onlinePhase === "lobby" && room) {
    return <OnlineLobby room={room} myId={myId} onStart={startOnlineGame} onAddBot={addBot} onRemoveBot={removeBot} onBack={exitToMenu} />;
  }
  if (onlinePhase === "play" && room && room.game) {
    return (
      <GameBoard game={room.game} myId={myId} isOnline isHost={room.hostId === myId} roomCode={roomCode} dispatch={dispatchGame} onExit={exitToMenu} />
    );
  }
  return (
    <div dir="rtl" className="min-h-screen w-full flex items-center justify-center" style={{ ...pageBg, fontFamily: "Tajawal", color: MAROON }}>
      <GlobalFont />
      جاري التحميل...
    </div>
  );
}

/* --------------------------------- APP ROOT --------------------------------- */

export default function HillaGame() {
  const [mode, setMode] = useState("home"); // home | local | online
  const [localGame, setLocalGame] = useState(null);

  if (mode === "home") {
    return (
      <div dir="rtl" className="min-h-screen w-full flex items-center justify-center p-6" style={{ ...pageBg, fontFamily: "Tajawal" }}>
        <GlobalFont />
        <div className="w-full max-w-md text-center">
          <CardBackHero />
          <p className="mt-3 mb-6" style={{ color: MAROON_DK }}>
            لعبة مطابقة الأزياء التقليدية السعودية
          </p>
          <div className="space-y-3">
            <button
              onClick={() => setMode("local")}
              className="w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2"
              style={{ background: MAROON, color: CREAM }}
            >
              <Home className="w-5 h-5" style={{ color: GOLD }} /> العب على نفس الجهاز
            </button>
            <button
              onClick={() => setMode("online")}
              className="w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 border-2"
              style={{ background: CREAM2, color: MAROON, borderColor: MAROON }}
            >
              <Wifi className="w-5 h-5" /> العب أونلاين (كود غرفة)
            </button>
          </div>

          <div className="mt-8 text-center">
            <OrnateDivider color={GOLD} />
            <p className="text-xs font-bold mt-1" style={{ color: MAROON }}>
              صُممت بأيدي سعودية 🇸🇦
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: `${INK}77` }}>
              طالبة جامعة الأميرة نورة — لمقرر Core Studio (1)
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "local") {
    if (!localGame)
      return (
        <LocalSetup
          onStart={(g) => {
            sendGameStarted(g, null);
            setLocalGame(g);
          }}
          onBack={() => setMode("home")}
        />
      );
    return <GameBoard game={localGame} myId={null} isOnline={false} roomCode={null} dispatch={setLocalGame} onExit={() => setLocalGame(null)} />;
  }

  if (mode === "online") {
    return <OnlineFlow onBack={() => setMode("home")} />;
  }

  return null;
}

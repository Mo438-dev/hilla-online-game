// @ts-nocheck
'use client';
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Volume2, VolumeX, Shield, Shuffle, Users, Sparkles, RotateCcw, Hand, Repeat2, Gift, Search, Wifi, Home, Copy, Check, LogOut, RefreshCw, Type, Menu, HelpCircle, X, Smile } from "lucide-react";
import { HILLA_ART as ART } from "@/lib/art-manifest";
import { ensureGuest, authHeaders, saveNicknameRemote, linkGoogle, GOOGLE_ENABLED } from "@/lib/supabase-browser";
import { newAnalyticsGameId, sendAnalyticsEvents, sendGameStarted, sendGameFinished, sendDealSnapshot, getClientPid, sendFeedback } from "@/lib/analytics-client";

/* ---------------------------------- PALETTE ---------------------------------- */
// Sampled from the designer's identity file (هوية حلة).
const BRAND = "#85152D"; // card-back red
const CREAM = "#FCF3E2"; // card cream
const PAGE = "#F1E5CB"; // table paper
const BEIGE = "#D7CAA9"; // random coordination frame / logo plaque
const GOLD = "#DDAD55";
const GOLD_DK = "#B98A2E";
const INK = "#231F20";
// legacy aliases kept so untouched code paths still resolve
const CREAM2 = "#F3E8D0";
const MAROON = BRAND;
const MAROON_DK = "#5E0F20";
const TEAL = "#366135";
const OLD_TEAL = "#1F6F6B"; // the original turquoise, kept for «استمرار اللعب»

/* ---------------------------------- DATA ---------------------------------- */
/* rarity (شائع/متوسط/نادر) is just an info label printed on each item card —
   NOT a separate no-region category. Every item still belongs to one region. */

const RARITY_META = {
  common: { label: "شائع", color: "#196935", text: "#FCF3E2" },
  medium: { label: "متوسط", color: "#E4A324", text: "#3A2608" },
  rare: { label: "نادر", color: "#A81E23", text: "#FCF3E2" },
};
// Deck v2.2: every item has the same number of copies. 32 items × 3 = 96 item cards + 14 actions = 110.
// Rarity now only shapes how often an item appears on coordination cards (10 / 7 / 4).
const ITEM_COPIES = 3;

const REGIONS = [
  {
    id: "najdi",
    name: "نجدي",
    color: "#711112",
    items: [
      { name: "عقال", rarity: "common" },
      { name: "المخطم", rarity: "rare" },
      { name: "المخنق", rarity: "medium" },
      { name: "متفت", rarity: "medium" },
      { name: "دراعة", rarity: "medium" },
      { name: "رشرش", rarity: "medium" },
      { name: "بشت", rarity: "medium" },
      { name: "شماغ", rarity: "medium" },
    ],
  },
  {
    id: "sharqi",
    name: "شرقي",
    color: "#366135",
    items: [
      { name: "ثوب مرودن", rarity: "common" },
      { name: "قلادة", rarity: "common" },
      { name: "برقع أسود", rarity: "common" },
      { name: "دقلة", rarity: "common" },
      { name: "مقصب", rarity: "medium" },
      { name: "هامة", rarity: "medium" },
      { name: "نفنوف", rarity: "medium" },
      { name: "النشل", rarity: "medium" },
    ],
  },
  {
    id: "janoubi",
    name: "جنوبي",
    color: "#121A42",
    items: [
      { name: "خواتم", rarity: "common" },
      { name: "مريشة", rarity: "rare" },
      { name: "جنبية", rarity: "medium" },
      { name: "خرص", rarity: "medium" },
      { name: "منديل برتقالي", rarity: "medium" },
      { name: "المجنب", rarity: "medium" },
      { name: "طفشة", rarity: "medium" },
      { name: "بيدي", rarity: "medium" },
    ],
  },
  {
    id: "gharbi",
    name: "غربي",
    color: "#5C3A1C",
    items: [
      { name: "غوايش", rarity: "common" },
      { name: "حلق", rarity: "common" },
      { name: "بيرم ومسفع", rarity: "rare" },
      { name: "برقع حجازي", rarity: "rare" },
      { name: "شاية", rarity: "medium" },
      { name: "ثوب مبقر", rarity: "medium" },
      { name: "ثوب الزبون", rarity: "medium" },
      { name: "مرتعشة", rarity: "medium" },
    ],
  },
];

const ITEM_DESC = {
  "عقال": "حبل أسود دائري يُلبس فوق الشماغ أو الغترة لتثبيتهما على الرأس.",
  "المخطم": "ثوب نسائي نجدي واسع، يتميز بالتطريز والزخارف الممتدة على الصدر وأجزاء الثوب.",
  "المخنق": "قلادة تقليدية تُلبس ملاصقة للعنق، وقد تُصنع من الذهب أو الخرز.",
  "متفت": "ثوب نسائي نجدي واسع، يتميز بالتطريز اليدوي والزخارف النباتية الملونة.",
  "دراعة": "ثوب نسائي طويل وفضفاض، يُزيّن بالتطريز وتختلف خامته بحسب المناسبة.",
  "رشرش": "حُلي نسائي تراثي من الذهب، من صفوف متدلية تزيّن الرقبة والصدر، ويُلبس في المناسبات والاحتفالات.",
  "بشت": "عباءة رجالية فاخرة تُلبس فوق الثوب في المناسبات الرسمية والأعياد.",
  "شماغ": "غطاء رأس رجالي مربع، غالبًا ما يكون أحمر وأبيض، ويُثبت بالعقال.",
  "ثوب مرودن": "ثوب رجالي تراثي يتميز بأكمامه الطويلة والواسعة.",
  "قلادة": "عقد تقليدي يُلبس حول الرقبة ويمتد على الصدر، ويُصنع غالبًا من الذهب.",
  "برقع أسود": "غطاء وجه نسائي تقليدي أسود اللون يُظهر العينين.",
  "دقلة": "رداء رجالي طويل ومفتوح من الأمام، يُلبس فوق الثوب.",
  "مقصب": "عقال رجالي فاخر تزيّنه خيوط ذهبية أو زخارف مقصبة.",
  "هامة": "حلية ذهبية تُثبت أعلى الرأس، وقد تتدلى منها سلاسل أو قطع ذهبية على الجانبين.",
  "نفنوف": "فستان نسائي خليجي تقليدي، غالبًا ما يكون واسعًا ومزخرفًا.",
  "النشل": "ثوب نسائي واسع، يُصنع غالبًا من الحرير ويُطرز بخيوط الزري الذهبية.",
  "خواتم": "خواتم ذهبية أو فضية تقليدية تُلبس للزينة.",
  "مريشة": "شيلة نسائية سوداء تُزيّن أطرافها بخيوط أو شراريب ملونة، وتُلبس فوق غطاء الرأس.",
  "جنبية": "خنجر تقليدي ذو نصل منحنٍ، يُثبت في حزام حول الخصر.",
  "خرص": "أقراط أو حلقات أذن تراثية، تُصنع غالبًا من الفضة أو الذهب.",
  "منديل برتقالي": "غطاء رأس تقليدي يتميز بلونه البرتقالي الزاهي، ويُلبس عادة تحت الشيلة.",
  "المجنب": "ثوب نسائي طويل، يتميز بالتطريز الملون الممتد على جانبي الثوب والصدر.",
  "طفشة": "قبعة تراثية عريضة تُصنع من الخوص أو سعف النخيل للحماية من الشمس.",
  "بيدي": "رداء رجالي ثقيل يُصنع من الصوف، وتُزيّن أكمامه وجيوبه بالتطريز الملون، واشتهرت بصناعته منطقة الباحة.",
  "غوايش": "أساور ذهبية تقليدية تُلبس حول المعصم أو أعلى الذراع، وقد تُلبس عدة قطع معًا.",
  "حلق": "أقراط ذهبية تقليدية تُستخدم لتزيين الأذنين.",
  "بيرم ومسفع": "غطاءان تقليديان لرأس المرأة الحجازية؛ يُلف المسفع حول الرأس، ويُرتدى البيرم فوقه لإكمال الزينة.",
  "برقع حجازي": "غطاء وجه نسائي حجازي، قد يُزيّن بالتطريز أو بالقطع المعدنية والزخارف.",
  "شاية": "رداء رجالي حجازي خارجي يشبه المعطف، ويُلبس فوق الثوب.",
  "ثوب مبقر": "ثوب حجازي تراثي يتميز بتقسيمات زخرفية وأشرطة قماش ملونة.",
  "ثوب الزبون": "رداء نسائي حجازي طويل ومفتوح من الأمام، يُلبس فوق الثياب ويُزيّن بالتطريز.",
  "مرتعشة": "حلية ذهبية كبيرة متعددة الصفوف والسلاسل، تغطي جزءًا من الرقبة والصدر.",
};
const REGION_ORDER = REGIONS.map((r) => r.id);
const RARITY_ORDER = { common: 0, medium: 1, rare: 2 };
const REACTIONS = ["🌶️", "👏", "🥳", "😭", "😱"];

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
  { id: "giveTake", name: "عطني وأعطيك", count: 2, icon: Gift, desc: "اختر لاعب وكرتين من يدك تعطيه، وتاخذ منه كرتين عشوائي." },
  { id: "drawTwo", name: "اقدع", count: 4, icon: Shuffle, desc: "لاعب مختار يسحب كرتين من كومة السحب." },
  { id: "stealTwo", name: "افزع لي", count: 2, icon: Hand, desc: "لاعب مختار يأخذ كرتين من يدك بدون رؤيتها." },
  { id: "block", name: "لا ما تقدر", count: 2, icon: Shield, desc: "يلغي أي أكشن يُستخدم ضدك أو ضد لاعب آخر." },
  { id: "freeze", name: "ثبّت الحَلّة", count: 2, icon: Repeat2, desc: "يبقى كرت التنسيق الحالي لجولة إضافية." },
  { id: "dig", name: "فتّش الصندوق", count: 2, icon: Search, desc: "اسحب 3 كروت واختر واحدًا، وأعد الباقي." },
];

const REC_COUNTS = { 2: 20, 3: 17, 4: 15, 5: 12, 6: 10 };
// v2.2: max cards per player by player count. With 5–6 players the draw pile starts small (15 / 2);
// when it runs out, the played cards are shuffled into a new draw pile (drawFromPile).
const HAND_MIN = 10;
const HAND_MAX_BY_PLAYERS = { 2: 20, 3: 20, 4: 20, 5: 19, 6: 18 };
function maxHandFor(players) {
  return HAND_MAX_BY_PLAYERS[players] ?? 20;
}

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

const ONLINE_SESSION_KEY = "hilla_online_session_v1";

function readOnlineSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ONLINE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const roomCode = typeof parsed.roomCode === "string" ? parsed.roomCode : "";
    const myId = typeof parsed.myId === "string" ? parsed.myId : "";
    const myName = typeof parsed.myName === "string" ? parsed.myName : "";
    if (!roomCode || !myId) return null;
    return { roomCode, myId, myName };
  } catch {
    return null;
  }
}

function writeOnlineSession(session) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ONLINE_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore storage failures */
  }
}

function clearOnlineSession() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(ONLINE_SESSION_KEY);
  } catch {
    /* ignore storage failures */
  }
}

function pickRandomBotNames(n) {
  return shuffle(BOT_NAME_POOL).slice(0, n);
}

const BLOCK_WINDOW_SEC = 15; // long enough to actually read the action and decide
const BLOCK_WINDOW_MS = BLOCK_WINDOW_SEC * 1000;
// When everyone who could block has passed, the action still stays on screen at least this long
// (from the moment it appeared) so people can read what happened. Not applied when no human can
// intervene at all (bots only) — that case already uses the short 2.5s window.
const PASS_MIN_READ_MS = 4000;

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
      for (let k = 0; k < ITEM_COPIES; k++) {
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

/* ------------------------- COORDINATION DECK — RULESET v2.1 -------------------------
   Experimental balancing ruleset. Every knob below is intentionally a named constant so the
   deck composition can be re-tuned without touching the generation logic.

   Deck: 50 cards = 30 random + 20 region (3:2), region split evenly 5 per region.
   Card sizes: random 4–7 items, region 4–5 items (region kept lower on purpose so a single
   region card can't let a player dump too much at once).
   Appearance targets per individual item across the whole deck: common 10, medium 7, rare 4.
   With the current 8 common / 20 medium / 4 rare roster that's ~236 total item appearances. */
const RULESET_VERSION = "v2.3"; // v2.3: رشرش in the roster + the last-card لا ما تقدر rule // keep in sync with lib/analytics-config.ts (analytics ruleset_version)

const COORD_RANDOM_CARDS = 30;
const COORD_REGION_CARDS_PER_REGION = 5;

// Per-card item counts. v2.1 fixes these exactly: random = 11×4 + 12×5 + 5×6 + 2×7 = 148
// appearances, region = 4×(4+5+4+5+4) = 88, for a deck total of exactly 236 — which is precisely
// 8 common×10 + 20 medium×7 + 4 rare×4, so every item can hit its target exactly.
const RANDOM_CARD_SIZES = [
  4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
  5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
  6, 6, 6, 6, 6,
  7, 7,
];
// Region cards alternate 4/5 (test question #2) — 22 slots per region, 88 total.
const REGION_CARD_SIZES = [4, 5, 4, 5, 4];

// Target number of coordination cards each individual item should appear on.
const RARITY_APPEARANCE_TARGET = { common: 10, medium: 7, rare: 4 };

/* Deficit-driven fill: for every card slot, prefer whichever eligible item is currently furthest
   below its target (ties broken randomly). Region cards are generated first because they're
   constrained to a single region's items; random cards run afterwards and absorb whatever
   deficits remain, which is what keeps the final per-item counts close to target. */
function buildCoordDeck() {
  const appearances = {};
  REGIONS.forEach((r) => r.items.forEach((it) => (appearances[it.name] = 0)));

  const deficitOf = (it) => (RARITY_APPEARANCE_TARGET[it.rarity] ?? 0) - appearances[it.name];

  function pickItems(pool, size) {
    const chosen = shuffle(pool)
      .sort((a, b) => deficitOf(b) - deficitOf(a))
      .slice(0, Math.min(size, pool.length));
    chosen.forEach((it) => (appearances[it.name] += 1));
    return chosen.map((it) => it.name);
  }

  const deck = [];

  REGIONS.forEach((r) => {
    for (let i = 0; i < COORD_REGION_CARDS_PER_REGION; i++) {
      const size = REGION_CARD_SIZES[i % REGION_CARD_SIZES.length];
      deck.push({
        id: uid(),
        type: "region",
        region: r.id,
        regionName: r.name,
        color: r.color,
        items: pickItems(r.items, size),
      });
    }
  });

  const allItems = REGIONS.flatMap((r) => r.items);
  for (let i = 0; i < COORD_RANDOM_CARDS; i++) {
    const size = RANDOM_CARD_SIZES[i % RANDOM_CARD_SIZES.length];
    deck.push({ id: uid(), type: "random", region: null, items: pickItems(allItems, size) });
  }

  return shuffle(deck);
}

function actionMeta(id) {
  return ACTION_TYPES.find((a) => a.id === id);
}

/* --------- turn timer / inactive-mode constants (feature #26) --------- */
// A human has TURN_TIMEOUT_MS to act; miss it → auto-skip. After
// MISSED_TURNS_BEFORE_INACTIVE consecutive misses they're flagged "inactive"
// and skipped every INACTIVE_SKIP_MS until they act again. Never converted to a bot.
const TURN_TIMEOUT_SEC = 30;
const TURN_TIMEOUT_MS = TURN_TIMEOUT_SEC * 1000;
const MISSED_TURNS_BEFORE_INACTIVE = 2;
const INACTIVE_SKIP_MS = 3000;

/* ------------------------------- GAME ENGINE (pure) ------------------------------- */

function createInitialGame(playersMeta, perPlayer) {
  const items = shuffle(buildItemDeck());
  const actions = shuffle(buildActionDeck());
  const full = shuffle([...items, ...actions]);
  const cap = Math.min(perPlayer, maxHandFor(playersMeta.length), Math.floor(full.length / playersMeta.length));
  const players = playersMeta.map((pm) => ({ id: pm.id, name: pm.name, hand: [], isBot: !!pm.isBot, missedTurns: 0, inactive: false }));
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
    rulesetVersion: RULESET_VERSION, // analytics tags the game with the rules it was dealt under
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
    turnStartedAt: Date.now(),
    startedAtMs: Date.now(),
    endedAtMs: null,
    coordRounds: 1, // the first تنسيق card is already on the table
    log: [`بدأت اللعبة بـ ${players.length} لاعبين، ${cap} كرت لكل لاعب.`],
    winner: null,
    pendingAction: null,
    digOptions: null,
    blockEvent: null,
    reactionEvent: null,
    stats: { blocksByPlayerId: {}, rareItemsPlayed: 0, targetedByPlayerId: {}, itemsPlayed: 0 },
  };
}

function pushLog(game, msg) {
  return { ...game, log: [msg, ...game.log].slice(0, 30) };
}

function bumpItemStats(game, cards) {
  if (!game.stats) return game;
  const rare = cards.filter((c) => c.rarity === "rare").length;
  return {
    ...game,
    stats: {
      ...game.stats,
      itemsPlayed: (game.stats.itemsPlayed || 0) + cards.length,
      rareItemsPlayed: (game.stats.rareItemsPlayed || 0) + rare,
    },
  };
}

function drawFromPile(game, n) {
  let pile = [...game.drawPile];
  let disc = [...game.discardPile];
  const out = [];
  let reshuffled = false;
  for (let i = 0; i < n; i++) {
    if (pile.length === 0) {
      if (disc.length === 0) break;
      // draw pile ran out: shuffle the played cards into a new draw pile
      pile = shuffle(disc);
      disc = [];
      reshuffled = true;
    }
    out.push(pile.pop());
  }
  let g = { ...game, drawPile: pile, discardPile: disc };
  if (reshuffled) g = pushLog(g, "خلصت كومة السحب، انخلطت الكروت الملعوبة وصارت كومة سحب جديدة.");
  return { game: g, drawn: out };
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
  if (p && p.hand.length === 0) return { ...game, winner: p.id, endedAtMs: Date.now() };
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
  // Only counts a genuinely new coord card — the lockCoord (ثبّت الحَلّة) path returns above.
  g.coordRounds = (g.coordRounds || 0) + 1;
  g = pushLog(g, `كرت تنسيق جديد: ${next.type === "region" ? next.regionName : "عشوائي"}.`);
  return g;
}

// Turn only advances here — every other reducer just mutates state and hands control back to the
// same player, so a player can freely combine item plays with one action card before ending.
// turnSerial increments exactly once per turn; the online bot executor uses it to guarantee at
// most one bot move per turn even if the same room state is polled repeatedly.
function endTurn(game) {
  let g = { ...game, actionUsedThisTurn: false, turnSerial: (game.turnSerial ?? 0) + 1, turnStartedAt: Date.now() };
  if (g.currentPlayerIndex === g.players.length - 1) {
    g = endRound(g);
    g.currentPlayerIndex = 0;
  } else {
    g.currentPlayerIndex = g.currentPlayerIndex + 1;
  }
  return g;
}

// Any genuine player-initiated action clears their consecutive-miss count AND inactive flag
// — this is the "played, tapped, or pressed skip themselves" recovery path (feature #26/#27).
function resetMissed(game, playerId) {
  const players = game.players.map((p) => (p.id === playerId && (p.missedTurns || p.inactive) ? { ...p, missedTurns: 0, inactive: false } : p));
  return { ...game, players };
}

// Presence-only wake-up (feature #27): any sign the player is actually there (e.g. tapping a card
// to select it, without committing to a move) clears the inactive flag. Returns the game unchanged
// (by reference) when there's nothing to clear, so callers can skip dispatching entirely.
function rWakePlayer(game, playerId) {
  const p = game.players.find((x) => x.id === playerId);
  if (!p || (!p.inactive && !p.missedTurns)) return game;
  let g = resetMissed(game, playerId);
  // If it's their turn right now, restart the clock — otherwise the time already elapsed while
  // they were away would immediately expire the (full-length) window and skip them again (#27 bug 1).
  if (game.players[game.currentPlayerIndex]?.id === playerId) {
    g = { ...g, turnStartedAt: Date.now() };
  }
  if (p.inactive) g = pushLog(g, `${p.name} رجع نشط.`);
  return g;
}

function rSendReaction(game, playerId, emoji, single) {
  const p = game.players.find((x) => x.id === playerId);
  return { ...game, reactionEvent: { id: uid(), emoji, single: !!single, byId: playerId, byName: p ? p.name : "" } };
}

// A human didn't act within the current window (30s normally, 3s once inactive). Auto-skip their
// turn. After MISSED_TURNS_BEFORE_INACTIVE consecutive misses they become inactive — still fully
// human/in control of their own hand, just skipped fast until they act. Never converted to a bot.
function rTurnTimeout(game, playerId) {
  const player = game.players.find((p) => p.id === playerId);
  if (!player) return game;
  // Stale-timer guard (#27 bug 2): only skip if the applicable window has genuinely elapsed
  // against the current turn clock — a just-woken player must not be cut by an old queued timer.
  const startedAt = typeof game.turnStartedAt === "number" ? game.turnStartedAt : 0;
  const windowMs = player.inactive ? INACTIVE_SKIP_MS : TURN_TIMEOUT_MS;
  if (startedAt && Date.now() - startedAt < windowMs - 250) return game;
  const missed = (player.missedTurns || 0) + 1;
  const becomesInactive = !player.inactive && missed >= MISSED_TURNS_BEFORE_INACTIVE;
  let g = {
    ...game,
    players: game.players.map((p) => (p.id === playerId ? { ...p, missedTurns: missed, inactive: p.inactive || becomesInactive } : p)),
  };
  g = pushLog(
    g,
    becomesInactive
      ? `${player.name} صار غير نشط (ما تفاعل مرتين متتاليتين).`
      : player.inactive
      ? `${player.name} غير نشط، تجاوز دوره تلقائيًا.`
      : `${player.name} ما رد بالوقت، تم تخطي دوره.`
  );
  g = endTurn(g);
  // First-miss vs repeated inactive-mode skip — the caller uses this to pick the analytics
  // skip_reason (timeout vs timeout_inactive) so repeated 3s skips don't distort skip-rate.
  return g;
}

// Explicit "end my turn" — the player calls this once they're done (after any combination of
// item plays / one action card), or immediately to just pass.
function rEndTurn(game, playerId) {
  const player = game.players.find((p) => p.id === playerId);
  let g = pushLog(resetMissed(game, playerId), `${player.name} أنهى دوره.`);
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
  let { game: g1, removed } = removeFromHand(resetMissed(game, playerId), playerId, ids);
  g1 = { ...g1, discardPile: [...g1.discardPile, ...removed] };
  g1 = bumpItemStats(g1, cards);
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
  let { game: g1, removed } = removeFromHand(resetMissed(game, playerId), playerId, [cardId]);
  g1 = { ...g1, discardPile: [...g1.discardPile, ...removed], lockCoord: true, actionUsedThisTurn: true };
  g1 = pushLog(g1, `${player.name} لعب ثبّت الحَلّة.`);
  g1 = checkWin(g1, playerId);
  return g1;
}

function rPlayDig(game, playerId, cardId) {
  const player = game.players.find((p) => p.id === playerId);
  let { game: g1, removed } = removeFromHand(resetMissed(game, playerId), playerId, [cardId]);
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
  let { game: g1, removed } = removeFromHand(resetMissed(game, playerId), playerId, [cardId]);
  g1 = { ...g1, discardPile: [...g1.discardPile, ...removed], actionUsedThisTurn: true };
  g1 = { ...g1, pendingAction: { id: uid(), actionType, actorId: playerId, targetId, actorName: player.name, startedAt: Date.now() } };
  return g1;
}

function rDeclareGiveTake(game, playerId, cardId, targetId, giveIds) {
  const player = game.players.find((p) => p.id === playerId);
  // The عطني وأعطيك card itself can never be one of the gifts, and the gift is exactly
  // min(2, cards left after playing it) cards that are really in the actor's hand.
  const rest = player.hand.filter((c) => c.id !== cardId);
  giveIds = [...new Set(giveIds)].filter((id) => rest.some((c) => c.id === id)).slice(0, 2);
  if (giveIds.length !== Math.min(2, rest.length)) return game;
  let { game: g1, removed } = removeFromHand(resetMissed(game, playerId), playerId, [cardId]);
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
  const blockedTargetId = game.pendingAction.targetId;
  let { game: g1, removed } = removeFromHand(game, blockerId, [blockCard.id]);
  g1 = { ...g1, discardPile: [...g1.discardPile, ...removed] };
  g1 = pushLog(g1, `${blocker.name} استخدم لا ما تقدر! تم إلغاء ${actionMeta(blockedActionType).name}.`);
  g1 = {
    ...g1,
    pendingAction: null,
    // Display-only marker for BlockFlashToast; never cleared, never read by game logic.
    blockEvent: { id: uid(), blockerName: blocker.name, actorName, actionType: blockedActionType },
    stats: g1.stats
      ? {
          ...g1.stats,
          blocksByPlayerId: { ...g1.stats.blocksByPlayerId, [blockerId]: (g1.stats.blocksByPlayerId?.[blockerId] || 0) + 1 },
        }
      : g1.stats,
  };
  g1 = countTargeted(g1, blockedTargetId);
  g1 = checkWin(g1, blockerId);
  return g1;
}

// A player who holds لا ما تقدر chooses not to use it on the current pending action. Pure and
// additive: just records their id on the pending action (shared state, so every client knows).
function rDeclineBlock(game, playerId) {
  const pa = game.pendingAction;
  if (!pa) return game;
  const declined = pa.declinedIds || [];
  if (declined.includes(playerId)) return game;
  return { ...game, pendingAction: { ...pa, declinedIds: [...declined, playerId] } };
}

// True once every human who could still block (holds لا ما تقدر, isn't the actor) has passed —
// at that point there's nothing left to wait for and the action can resolve right away.
function allHumanBlockersDeclined(game) {
  const pa = game.pendingAction;
  if (!pa) return false;
  const declined = pa.declinedIds || [];
  const humans = game.players.filter(
    (p) => p.id !== pa.actorId && !p.isBot && p.hand.some((c) => c.kind === "action" && c.actionType === "block")
  );
  return humans.length > 0 && humans.every((p) => declined.includes(p.id));
}

// لا ما تقدر is normally reactive only. Exception: when it's the LAST card in your hand, on your
// own turn, and you haven't played an action this turn, you may put it down to finish — so nobody
// gets stuck holding it with no way out.
function canPlayLastBlock(game, playerId) {
  const cur = game.players[game.currentPlayerIndex];
  if (!cur || cur.id !== playerId || game.winner || game.pendingAction || game.digOptions) return false;
  if (game.actionUsedThisTurn) return false;
  return cur.hand.length === 1 && cur.hand[0].kind === "action" && cur.hand[0].actionType === "block";
}

function rPlayLastBlock(game, playerId) {
  if (!canPlayLastBlock(game, playerId)) return game;
  const player = game.players.find((p) => p.id === playerId);
  let { game: g1, removed } = removeFromHand(resetMissed(game, playerId), playerId, [player.hand[0].id]);
  g1 = { ...g1, discardPile: [...g1.discardPile, ...removed], actionUsedThisTurn: true };
  g1 = pushLog(g1, `${player.name} نزّل لا ما تقدر كآخر كرت.`);
  return checkWin(g1, playerId);
}

// "Most targeted" counts every targeted action aimed at a player, whether it landed or was
// cancelled with لا ما تقدر, keyed by player id (names can repeat).
function countTargeted(game, targetId) {
  if (!game.stats || !targetId) return game;
  const byId = game.stats.targetedByPlayerId || {};
  return { ...game, stats: { ...game.stats, targetedByPlayerId: { ...byId, [targetId]: (byId[targetId] || 0) + 1 } } };
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
    // #29 fix: pick the random 2 cards from the target's hand BEFORE the gift is added, so the
    // actor can never randomly draw back the very cards they just handed over.
    const targetBefore = g2.players.find((p) => p.id === pa.targetId);
    const n = Math.min(2, targetBefore.hand.length);
    const takeIds = shuffle(targetBefore.hand).slice(0, n).map((c) => c.id);
    const { game: g3, removed: taken } = removeFromHand(g2, pa.targetId, takeIds);
    let g4 = addToHand(g3, pa.actorId, taken);
    g = addToHand(g4, pa.targetId, given);
    g = pushLog(g, `${pa.actorName} بادل كروت مع ${target.name} (عطني وأعطيك).`);
  }
  g = countTargeted(g, pa.targetId);
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
  if (canPlayLastBlock(game, botId)) return rPlayLastBlock(game, botId);
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

/* ---------------------------------- I18N ----------------------------------
   Display-only translation layer. Game state, engine and online sync stay in Arabic exactly as
   before (item names, log lines, errors); everything is translated at render time, so each player
   can pick their own language and nothing shared changes. Default is always Arabic. */

const LANGS = [
  { code: "ar", label: "العربية", dir: "rtl" },
  { code: "en", label: "English", dir: "ltr" },
  { code: "es", label: "Español", dir: "ltr" },
];

const I18N = {
  ar: {},
  en: {
    // generic
    you: "You", cancel: "Cancel", back: "Back", refresh: "Refresh page", language: "Language",
    random: "Random", oneCardOnly: "One card only", severalNoRepeat: "Several cards · no repeats",
    drawPile: "Draw", lastCard: "Last card", round: "Round {n}", menu: "Menu", reactions: "Reactions",
    // home + setup
    tagline: "A matching game of traditional Saudi dress",
    playLocal: "Play on this device", playOnline: "Play online (room code)",
    sdErr_length: "2 to 16 characters.", sdErr_chars: "Letters, numbers, spaces, _ and - only.", sdErr_blocked: "Pick a different name.", sdErr_taken: "That name is taken.", sdErr_too_fast: "Wait a moment before changing it again.",
    sdTagline: "Every region has its outfit", sdOnline: "Online", sdOnlineSub: "With friends", sdLocal: "Same device", sdLocalSub: "Or vs bots", sdRank: "Leaderboard", sdRankSub: "Coming soon", sdRankSoon: "The leaderboard is coming soon", sdGuest: "Guest", sdSaveShort: "Sign in to save your points", sdPickName: "What should we call you?", sdChangeName: "Change your name", sdNamePh: "Your leaderboard name", sdNameRule: "2 to 16 characters · shown on the leaderboard", sdSave: "Save", sdEdit: "Edit", sdHello: "Hi {name}", sdGuestTitle: "You're playing as a guest", sdGuestBody: "Save your account so your name and points stay if you change phones", sdGoogle: "Continue with Google", sdEmail: "Continue with email", sdAuthSoon: "Sign-in arrives with the leaderboard", sdLang: "Language",
    madeBy: "Designed by Saudi hands 🇸🇦", credit: "A Princess Nourah University student, for Core Studio",
    errCreate: "Couldn't create the room, try again.", addBot: "🤖 Add a bot", removeBot: "Remove bot",
    svThanks: "Thanks for the feedback! 💛", svTitle: "Your opinion matters (optional)", svSkip: "Skip",
    svFun: "How fun was the game?", svClear: "Were the rules clear?", svAgain: "Would you play again?",
    svYes: "Definitely 😍", svNo: "Nope 😅", svComment: "Comment (optional)", svSend: "Send",
    localIntro: "Everyone plays on the same device, and you can add bots that play automatically",
    numPlayers: "Players", playerNamePh: "Player {n} name", botTitle: "A bot that plays smart, automatically",
    bot: "🤖 Bot", human: "🧍 Human",
    botNote: "🤖 Bots play the strongest strategy possible: they place as many matching cards as they can each round and pick the smartest action available.",
    cardsPerPlayer: "Cards per player", startPlaying: "Start playing", playerN: "Player {n}", botN: "Bot {n}",
    // online
    onlineIntro: "Play online, each on your own device", yourName: "Your name", createRoom: "Create a new room",
    create: "Create room", joinRoom: "Join a room", roomCodePh: "Room code (e.g. A1B2)", join: "Join",
    roomCodeShare: "Room code, share it with your friends",
    lobbyHint: 'Each friend opens this same chat link, taps "Play online → Join a room" and enters the code.',
    playersCount: "Players ({n}/{m})", host: "Host", startGame: "Start game", waitingHost: "Waiting for the host to start",
    needTwo: "You need at least two players.", leaveRoom: "Leave room", loading: "Loading…", preparing: "Getting ready…",
    errSave: "Couldn't save. Check your connection and try again.", errNoRoom: "We couldn't find that room. Check the code.",
    errStarted: "The game in this room has already started.", errFull: "The room is full.",
    // board
    thinking: "🤖 {name} is thinking", thinkingDots: "🤖 {name} is thinking…",
    inactiveNow: "😴 {name} is inactive right now", yourTurn: "Your turn, play before time runs out", turnOf: "{name}'s turn",
    lockOn: "Lock the Look is on: same card for another round",
    yourHand: "Your hand", handOf: "{name}'s hand", sortRegion: "Sort by region", clothing: "Clothing",
    actionsHint: "Action: just one, before you place your clothing", usedThisTurn: " · used this turn",
    noClothing: "You have no clothing cards.", pickMatching: "Pick cards that match",
    playN1: "Play the card", playN2: "Play both cards", playN: "Play {n} cards", endTurn: "I'm done",
    log: "Log", passTo: "Pass the device to", reveal: "Reveal your hand",
    youWon: "You won!", wonName: "{name} won!", playAgain: "Play again",
    // pending action
    youUse: "You're using", usesX: "{name} is using", againstYou: "Against you!", against: "Against {name}",
    canBlockYou: "You can use <b>No You Don't!</b> before the countdown ends.", autoResolve: "It goes through automatically after the countdown.",
    anyoneBlock: "Anyone holding <b>No You Don't!</b> can use it now, otherwise it goes through after the countdown.",
    useBlock: "Use No You Don't!", useBlockName: "{name}: use No You Don't!", passBlock: "No, I'll let it go",
    noBlockCard: "{name} doesn't have a No You Don't! card.", blockOnlyReactive: "No You Don't! is a reaction to someone's action, or you can put it down when it's your last card.", actNote_giveTake: "Only one card left in their hand? That's fine: they get your two, you take their one.", actNote_block: "If it's your last card, you can play it to finish, as long as you haven't played an action this turn.", inactiveMeTitle: "You're inactive", inactiveMeBody: "Your turns are skipped until you're back.", imBack: "I'm back", turnSound: "Turn sound",
    whoTarget: "On whom?", digTitle: "Search the Chest", digHint: "Pick one card to keep; the rest go back to the pile.",
    digging: "{name} is searching the chest…",
    giveTitle: "Give & Take", givePick2: "Pick two cards from your hand to give the other player.", givePick1: "Pick one card from your hand to give the other player.",
    confirm: "Confirm ({a}/{b})",
    spectator: "{actor} is using <b>{action}</b> against {target}", blocked: "{blocker} stopped {actor} with No You Don't!",
    // menu
    continue: "Keep playing", howToPlay: "How to play?", bigText: "Larger text", newGame: "New game", exit: "Exit",
    // rules
    rulesTitle: "How to play Hulla", rGoal: "Goal", rGoalT: "The first player to get rid of all their cards wins.",
    rRegion: "Region coordination card", rRegionT: "Play any number of clothing cards, as long as they're from the card's region and among the items shown on it (no repeating the same item).",
    rRandom: "Random coordination card", rRandomT: "Just one item at a time, from any region, as long as it's one of the items shown on the card.",
    rActions: "Action cards", rActionsT: "One action card per round, played before you place your clothing (not after). No You Don't! is the exception: use it any time as a reaction.",
    rRarity: "Rarity", rRarityT: "Every item has a rarity mark: common, uncommon or rare. Common items show up a lot on coordination cards and are easy to get rid of; rare ones show up rarely, so they're harder to unload.",
    letsPlay: "Let's play",
    // win stats
    recap: "Game recap", shareRecap: "Hulla game recap 🃏", winner: "Winner", duration: "Game length", runnerUp: "Closest rival",
    coordRounds: "Coordination rounds", cardsPlayed: "Cards played", raresPlayed: "Rare cards played", mostTargeted: "Most targeted by actions",
    left1: "1 card left", left2: "2 cards left", leftN: "{n} cards left", times1: "once", times2: "twice", timesN: "{n} times",
    copied: "Result copied", share: "Share result",
    appIcon: "App icon", appIconHint: "Pick an icon, then add Hulla to your home screen. To change the icon later, remove the app and add it again.", done: "Done",
    installTitle: "Add Hulla to your home screen", addToHome: "Add to home screen", later: "Not now",
    iosHow: "On iPhone, in Safari:", iosStep1: "Tap the Share button (the square with an arrow).", iosStep2: "Choose “Add to Home Screen”.", iosStep3: "Tap “Add”.",
    andHow: "In your browser:", andStep1: "Open the browser menu (⋮).", andStep2: "Choose “Install app” or “Add to Home screen”.",
  },
  es: {
    you: "Tú", cancel: "Cancelar", back: "Volver", refresh: "Actualizar página", language: "Idioma",
    random: "Aleatoria", oneCardOnly: "Solo una carta", severalNoRepeat: "Varias cartas · sin repetir",
    drawPile: "Mazo", lastCard: "Última carta", round: "Ronda {n}", menu: "Menú", reactions: "Reacciones",
    tagline: "Un juego de emparejar trajes tradicionales saudíes",
    playLocal: "Jugar en este dispositivo", playOnline: "Jugar en línea (código de sala)",
    sdErr_length: "De 2 a 16 caracteres.", sdErr_chars: "Solo letras, números, espacios, _ y -.", sdErr_blocked: "Elige otro nombre.", sdErr_taken: "Ese nombre ya está en uso.", sdErr_too_fast: "Espera un momento antes de cambiarlo otra vez.",
    sdTagline: "Cada región tiene su traje", sdOnline: "En línea", sdOnlineSub: "Con amigos", sdLocal: "Mismo dispositivo", sdLocalSub: "O contra bots", sdRank: "Clasificación", sdRankSub: "Muy pronto", sdRankSoon: "La clasificación llega pronto", sdGuest: "Invitado", sdSaveShort: "Inicia sesión para guardar tus puntos", sdPickName: "¿Cómo te llamamos?", sdChangeName: "Cambia tu nombre", sdNamePh: "Tu nombre en la clasificación", sdNameRule: "De 2 a 16 caracteres · se muestra en la clasificación", sdSave: "Guardar", sdEdit: "Editar", sdHello: "Hola {name}", sdGuestTitle: "Juegas como invitado", sdGuestBody: "Guarda tu cuenta para no perder tu nombre y tus puntos si cambias de móvil", sdGoogle: "Continuar con Google", sdEmail: "Continuar con correo", sdAuthSoon: "El inicio de sesión llega con la clasificación", sdLang: "Idioma",
    madeBy: "Diseñado por manos saudíes 🇸🇦", credit: "Estudiante de la Universidad Princesa Nourah, para Core Studio",
    errCreate: "No se pudo crear la sala, inténtalo de nuevo.", addBot: "🤖 Añadir un bot", removeBot: "Quitar bot",
    svThanks: "¡Gracias por tu opinión! 💛", svTitle: "Tu opinión importa (opcional)", svSkip: "Omitir",
    svFun: "¿Qué tan divertida fue la partida?", svClear: "¿Las reglas fueron claras?", svAgain: "¿Jugarías otra vez?",
    svYes: "¡Claro! 😍", svNo: "No 😅", svComment: "Comentario (opcional)", svSend: "Enviar",
    localIntro: "Todos juegan en el mismo dispositivo, y puedes añadir bots que juegan solos",
    numPlayers: "Jugadores", playerNamePh: "Nombre del jugador {n}", botTitle: "Un bot que juega con inteligencia, solo",
    bot: "🤖 Bot", human: "🧍 Humano",
    botNote: "🤖 Los bots juegan con la mejor estrategia posible: colocan todas las cartas que pueden en cada ronda y eligen la acción más inteligente.",
    cardsPerPlayer: "Cartas por jugador", startPlaying: "¡A jugar!", playerN: "Jugador {n}", botN: "Bot {n}",
    onlineIntro: "Juega en línea, cada uno en su dispositivo", yourName: "Tu nombre", createRoom: "Crear una sala nueva",
    create: "Crear sala", joinRoom: "Unirse a una sala", roomCodePh: "Código de sala (ej. A1B2)", join: "Unirse",
    roomCodeShare: "Código de sala, compártelo con tus amigos",
    lobbyHint: 'Cada amigo abre este mismo enlace del chat, pulsa "Jugar en línea → Unirse a una sala" e introduce el código.',
    playersCount: "Jugadores ({n}/{m})", host: "Anfitrión", startGame: "Empezar partida", waitingHost: "Esperando a que el anfitrión empiece",
    needTwo: "Se necesitan al menos dos jugadores.", leaveRoom: "Salir de la sala", loading: "Cargando…", preparing: "Preparando…",
    errSave: "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.", errNoRoom: "No encontramos esa sala. Revisa el código.",
    errStarted: "La partida de esta sala ya empezó.", errFull: "La sala está llena.",
    thinking: "🤖 {name} está pensando", thinkingDots: "🤖 {name} está pensando…",
    inactiveNow: "😴 {name} está inactivo ahora", yourTurn: "Tu turno, juega antes de que se acabe el tiempo", turnOf: "Turno de {name}",
    lockOn: "Fija el look activo: la misma carta otra ronda",
    yourHand: "Tu mano", handOf: "Mano de {name}", sortRegion: "Ordenar por región", clothing: "Ropa",
    actionsHint: "Acción: solo una, antes de colocar tu ropa", usedThisTurn: " · usada este turno",
    noClothing: "No tienes cartas de ropa.", pickMatching: "Elige cartas que coincidan",
    playN1: "Jugar la carta", playN2: "Jugar las dos cartas", playN: "Jugar {n} cartas", endTurn: "Terminé",
    log: "Registro", passTo: "Pasa el dispositivo a", reveal: "Mostrar tu mano",
    youWon: "¡Ganaste!", wonName: "¡Ganó {name}!", playAgain: "Jugar otra vez",
    youUse: "Estás usando", usesX: "{name} está usando", againstYou: "¡Contra ti!", against: "Contra {name}",
    canBlockYou: "Puedes usar <b>¡Ni hablar!</b> antes de que acabe la cuenta atrás.", autoResolve: "Se aplica sola al acabar la cuenta atrás.",
    anyoneBlock: "Quien tenga <b>¡Ni hablar!</b> puede usarla ahora; si no, se aplica al acabar la cuenta atrás.",
    useBlock: "Usar ¡Ni hablar!", useBlockName: "{name}: usar ¡Ni hablar!", passBlock: "No, lo dejo pasar",
    noBlockCard: "{name} no tiene una carta ¡Ni hablar!", blockOnlyReactive: "¡Ni hablar! es una reacción a la acción de otro, o puedes jugarla cuando sea tu última carta.", actNote_giveTake: "¿Le queda una sola carta? No pasa nada: recibe tus dos y tú te llevas la suya.", actNote_block: "Si es tu última carta, puedes jugarla para terminar, siempre que no hayas jugado una acción en este turno.", inactiveMeTitle: "Estás inactivo", inactiveMeBody: "Tus turnos se saltan hasta que vuelvas.", imBack: "Ya volví", turnSound: "Sonido de turno",
    whoTarget: "¿Contra quién?", digTitle: "Busca en el baúl", digHint: "Elige una carta para quedártela; el resto vuelve al mazo.",
    digging: "{name} está buscando en el baúl…",
    giveTitle: "Toma y daca", givePick2: "Elige dos cartas de tu mano para dárselas al otro jugador.", givePick1: "Elige una carta de tu mano para dársela al otro jugador.",
    confirm: "Confirmar ({a}/{b})",
    spectator: "{actor} usa <b>{action}</b> contra {target}", blocked: "¡{blocker} frenó a {actor} con ¡Ni hablar!",
    continue: "Seguir jugando", howToPlay: "¿Cómo se juega?", bigText: "Texto más grande", newGame: "Partida nueva", exit: "Salir",
    rulesTitle: "Cómo jugar a Hulla", rGoal: "Objetivo", rGoalT: "Gana el primer jugador que se quede sin cartas.",
    rRegion: "Carta de coordinación de región", rRegionT: "Coloca cuantas cartas de ropa quieras, siempre que sean de la región de la carta y estén entre los objetos que muestra (sin repetir el mismo objeto).",
    rRandom: "Carta de coordinación aleatoria", rRandomT: "Solo un objeto cada vez, de cualquier región, siempre que sea uno de los objetos de la carta.",
    rActions: "Cartas de acción", rActionsT: "Una carta de acción por ronda, jugada antes de colocar tu ropa (no después). ¡Ni hablar! es la excepción: úsala cuando quieras como reacción.",
    rRarity: "Rareza", rRarityT: "Cada objeto tiene una marca de rareza: común, poco común o raro. Los comunes salen mucho en las cartas de coordinación y son fáciles de soltar; los raros salen poco, así que cuesta más deshacerse de ellos.",
    letsPlay: "¡A jugar!",
    recap: "Resumen de la partida", shareRecap: "Resumen de Hulla 🃏", winner: "Ganador", duration: "Duración", runnerUp: "Rival más cercano",
    coordRounds: "Rondas de coordinación", cardsPlayed: "Cartas jugadas", raresPlayed: "Cartas raras jugadas", mostTargeted: "Más atacado con acciones",
    left1: "le queda 1 carta", left2: "le quedan 2 cartas", leftN: "le quedan {n} cartas", times1: "una vez", times2: "dos veces", timesN: "{n} veces",
    copied: "Resultado copiado", share: "Compartir resultado",
    appIcon: "Icono de la app", appIconHint: "Elige un icono y añade Hulla a tu pantalla de inicio. Para cambiar el icono después, quita la app y vuelve a añadirla.", done: "Listo",
    installTitle: "Añade Hulla a tu pantalla de inicio", addToHome: "Añadir a la pantalla de inicio", later: "Ahora no",
    iosHow: "En iPhone, desde Safari:", iosStep1: "Toca el botón Compartir (el cuadrado con una flecha).", iosStep2: "Elige «Añadir a pantalla de inicio».", iosStep3: "Toca «Añadir».",
    andHow: "En tu navegador:", andStep1: "Abre el menú del navegador (⋮).", andStep2: "Elige «Instalar app» o «Añadir a pantalla de inicio».",
  },
};

// Arabic source strings for the keys above (Arabic is the reference language).
Object.assign(I18N.ar, {
  you: "أنت", cancel: "إلغاء", back: "رجوع", refresh: "تحديث الصفحة", language: "اللغة",
  random: "عشوائي", oneCardOnly: "كرت واحد بس", severalNoRepeat: "أكثر من كرت · بدون تكرار",
  drawPile: "السحب", lastCard: "آخر كرت", round: "جولة {n}", menu: "القائمة", reactions: "التفاعلات",
  tagline: "لعبة مطابقة الأزياء التقليدية السعودية",
  playLocal: "العب على نفس الجهاز", playOnline: "العب أونلاين (كود غرفة)",
  sdErr_length: "من ٢ إلى ١٦ حرف.", sdErr_chars: "حروف وأرقام ومسافات و _ و - بس.", sdErr_blocked: "اختر اسم ثاني.", sdErr_taken: "هذا الاسم مأخوذ.", sdErr_too_fast: "انتظر شوي قبل ما تغيّره مرة ثانية.",
  sdTagline: "كل منطقة لها حُلّة", sdOnline: "أونلاين", sdOnlineSub: "مع أصحابك", sdLocal: "نفس الجهاز", sdLocalSub: "أو ضد البوتات", sdRank: "الترتيب", sdRankSub: "قريبًا", sdRankSoon: "الترتيب جاي قريب", sdGuest: "ضيف", sdSaveShort: "سجّل واحفظ نقاطك", sdPickName: "وش نسمّيك؟", sdChangeName: "غيّر اسمك", sdNamePh: "اسمك في الترتيب", sdNameRule: "من ٢ إلى ١٦ حرف · يطلع للناس في الترتيب", sdSave: "احفظ", sdEdit: "غيّر", sdHello: "أهلًا {name}", sdGuestTitle: "حسابك ضيف", sdGuestBody: "احفظه عشان ما يضيع اسمك ونقاطك لو غيّرت جوالك", sdGoogle: "كمّل بقوقل", sdEmail: "كمّل بالإيميل", sdAuthSoon: "تسجيل الدخول يجي مع الترتيب", sdLang: "اللغة",
  madeBy: "صُممت بأيدي سعودية 🇸🇦", credit: "طالبة جامعة الأميرة نورة، لمقرر Core Studio",
  errCreate: "تعذر إنشاء الغرفة، حاول مجددًا.", addBot: "🤖 أضف بوت", removeBot: "أزل البوت",
  svThanks: "شكرًا على رأيك! 💛", svTitle: "رأيك يهمنا (اختياري)", svSkip: "تخطي",
  svFun: "كم كانت اللعبة ممتعة؟", svClear: "هل القوانين واضحة؟", svAgain: "تلعبها مرة ثانية؟",
  svYes: "أكيد 😍", svNo: "لا 😅", svComment: "تعليق (اختياري)", svSend: "أرسل",
  localIntro: "كل اللاعبين على نفس الجهاز، وتقدر تضيف بوتات تلعب أوتوماتيك",
  numPlayers: "عدد اللاعبين", playerNamePh: "اسم اللاعب {n}", botTitle: "بوت يلعب بذكاء أوتوماتيكي",
  bot: "🤖 بوت", human: "🧍 إنسان",
  botNote: "🤖 البوتات تلعب بأقوى استراتيجية ممكنة: تحط أقصى عدد كروت مطابقة كل جولة، وتختار أذكى أكشن متاح.",
  cardsPerPlayer: "عدد الكروت لكل لاعب", startPlaying: "ابدأوا اللعب", playerN: "لاعب {n}", botN: "بوت {n}",
  onlineIntro: "العب أونلاين، كل واحد بجهازه", yourName: "اسمك", createRoom: "أنشئ غرفة جديدة",
  create: "أنشئ غرفة", joinRoom: "انضم لغرفة", roomCodePh: "كود الغرفة (مثال: A1B2)", join: "انضم",
  roomCodeShare: "كود الغرفة، شاركه مع أصحابك",
  lobbyHint: 'كل صديق يفتح نفس رابط هذي المحادثة، يضغط "العب أونلاين ← انضم لغرفة" ويدخل الكود.',
  playersCount: "اللاعبون ({n}/{m})", host: "المضيف", startGame: "ابدأ اللعبة", waitingHost: "بانتظار المضيف يبدأ اللعبة",
  needTwo: "لازم لاعبين اثنين على الأقل.", leaveRoom: "اخرج من الغرفة", loading: "جاري التحميل…", preparing: "جاري التجهيز…",
  errSave: "تعذر الحفظ، تأكد من الاتصال وحاول مجددًا.", errNoRoom: "ما لقينا هذي الغرفة، تأكد من الكود.",
  errStarted: "اللعبة بدأت بالفعل بهذي الغرفة.", errFull: "الغرفة مليانة.",
  thinking: "🤖 {name} يفكر", thinkingDots: "🤖 {name} يفكر…",
  inactiveNow: "😴 {name} غير نشط الحين", yourTurn: "دورك، العب قبل ما ينتهي الوقت", turnOf: "دور {name} الحين",
  lockOn: "ثبّت الحَلّة مفعّل: نفس الكرت جولة زيادة",
  yourHand: "يدك", handOf: "يد {name}", sortRegion: "رتّب حسب المنطقة", clothing: "عناصر اللبس",
  actionsHint: "أكشن: واحد بس، قبل ما تحط عناصرك", usedThisTurn: " · استخدمته هالدور",
  noClothing: "ما عندك عناصر لبس.", pickMatching: "اختر كروت تطابق التنسيق",
  playN1: "حط الكرت", playN2: "حط الكرتين", playN: "حط {n} كروت", playN11: "حط {n} كرت", endTurn: "خلصت دوري",
  log: "السجل", passTo: "مرّر الجهاز إلى", reveal: "اكشف يدك",
  youWon: "فزت!", wonName: "فاز {name}!", playAgain: "العب من جديد",
  youUse: "أنت تستخدم", usesX: "{name} يستخدم", againstYou: "ضدك أنت!", against: "ضد {name}",
  canBlockYou: "عندك فرصة تستخدم <b>لا ما تقدر</b> قبل ما تنتهي العدّة.", autoResolve: "بينفّذ تلقائيًا بعد العدّة.",
  anyoneBlock: "أي لاعب عنده <b>لا ما تقدر</b> يقدر يستخدمه الحين، وإلا بينفّذ تلقائيًا بعد العدّة.",
  useBlock: "استخدم لا ما تقدر", useBlockName: "{name}: استخدم لا ما تقدر", passBlock: "لا، ما راح أستخدمه",
  noBlockCard: "{name} ما معه كرت لا ما تقدر.", blockOnlyReactive: "لا ما تقدر تستخدمه كردّ فعل لما أحد يلعب أكشن، أو تنزله إذا صار آخر كرت معك.", actNote_giveTake: "ما بقى معه إلا كرت واحد؟ عادي، ياخذ كرتينك وتاخذ كرته.", actNote_block: "وإذا صارت آخر كرت معك، نزّلها وخلصت، بشرط ما لعبت أكشن بنفس الدور.", inactiveMeTitle: "أنت غير نشط", inactiveMeBody: "أدوارك تتخطى تلقائيًا لين ترجع.", imBack: "رجّعني نشط", turnSound: "صوت الدور",
  whoTarget: "على مين؟", digTitle: "فتّش الصندوق", digHint: "اختر كرت واحد تحتفظ فيه، والباقي يرجع للسحب.",
  digging: "{name} يفتّش الصندوق الحين…",
  giveTitle: "عطني وأعطيك", givePick2: "اختر كرتين من يدك تعطيها للاعب الثاني.", givePick1: "اختر كرت واحد من يدك تعطيها للاعب الثاني.",
  confirm: "تأكيد ({a}/{b})",
  spectator: "{actor} يستخدم <b>{action}</b> ضد {target}", blocked: "{blocker} صدّ {actor} بـ لا ما تقدر!",
  continue: "استمرار اللعب", howToPlay: "كيف ألعب؟", bigText: "تكبير النص", newGame: "لعبة جديدة", exit: "خروج",
  rulesTitle: "وش قوانين حُلّة؟", rGoal: "الهدف", rGoalT: "أول لاعب يتخلص من كل كروته يفوز.",
  rRegion: "كرت تنسيق منطقة", rRegionT: "تقدر تحط أي عدد من كروت العناصر بشرط تكون من نفس منطقة الكرت ومن العناصر المعروضة عليه (بدون تكرار نفس العنصر).",
  rRandom: "كرت تنسيق عشوائي", rRandomT: "عنصر واحد بس بكل مرة، من أي منطقة، طالما اسمه من ضمن العناصر المعروضة على الكرت.",
  rActions: "كروت الأكشن", rActionsT: "كرت أكشن واحد بس بكل جولة، ويُلعب قبل ما تحط عناصرك (مو بعدها). لا ما تقدر استثناء، تقدر تستخدمها أي وقت كردّ فعل.",
  rRarity: "الندرة", rRarityT: "كل عنصر عليه علامة ندرة: شائع أو متوسط أو نادر. الشائع يطلع كثير بكروت التنسيق وسهل تتخلص منه، والنادر يطلع نادر فيصعب تصريفه.",
  letsPlay: "يلا نلعب",
  recap: "حصيلة اللعبة", shareRecap: "حصيلة لعبة حُلّة 🃏", winner: "الفائز", duration: "مدة اللعبة", runnerUp: "أقرب منافس",
  coordRounds: "جولات التنسيق", cardsPlayed: "كروت انلعبت", raresPlayed: "الكروت النادرة المستخدمة", mostTargeted: "أكثر لاعب استُهدف بالأكشن",
  left1: "بقي له كرت واحد", left2: "بقي له كرتين", leftN: "بقي له {n} كروت", leftN11: "بقي له {n} كرت",
  times1: "مرة واحدة", times2: "مرتين", timesN: "{n} مرات",
  copied: "تم نسخ النتيجة", share: "شارك النتيجة",
  appIcon: "أيقونة التطبيق", appIconHint: "اختر الأيقونة، وبعدها أضف حُلّة لشاشتك الرئيسية. ولو تبي تغيّر الأيقونة بعدين، احذف التطبيق وأضفه من جديد.", done: "تم",
  installTitle: "أضف حُلّة لشاشتك الرئيسية", addToHome: "أضف للشاشة الرئيسية", later: "مو الحين",
  iosHow: "على الآيفون من سفاري:", iosStep1: "اضغط زر المشاركة (المربع اللي فيه سهم).", iosStep2: "اختر «إضافة إلى الشاشة الرئيسية».", iosStep3: "اضغط «إضافة».",
  andHow: "من المتصفح:", andStep1: "افتح قائمة المتصفح (⋮).", andStep2: "اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».",
});

// Every word that means "you" — used where a seat's name is the default "أنت"/"You"/"Tú".
const YOU_WORDS = new Set(["أنت", "You", "Tú"]);

const REGION_NAMES = {
  najdi: { ar: "نجدي", en: "Najdi", es: "Najdi" },
  sharqi: { ar: "شرقي", en: "Eastern", es: "Oriental" },
  janoubi: { ar: "جنوبي", en: "Southern", es: "Sureño" },
  gharbi: { ar: "غربي", en: "Western", es: "Occidental" },
};
const REGION_BY_AR = Object.fromEntries(Object.entries(REGION_NAMES).map(([id, v]) => [v.ar, id]));

const RARITY_NAMES = {
  common: { ar: "شائع", en: "Common", es: "Común" },
  medium: { ar: "متوسط", en: "Uncommon", es: "Poco común" },
  rare: { ar: "نادر", en: "Rare", es: "Raro" },
};

const ACTION_NAMES = {
  giveTake: {
    en: ["Give & Take", "Pick a player and two cards from your hand to give them; take two of theirs at random."],
    es: ["Toma y daca", "Elige un jugador y dos cartas de tu mano para dárselas; tomas dos suyas al azar."],
  },
  drawTwo: {
    en: ["Take Two!", "A chosen player draws two cards from the pile."],
    es: ["¡Roba dos!", "Un jugador elegido roba dos cartas del mazo."],
  },
  stealTwo: {
    en: ["Help Me Out", "A chosen player takes two cards from your hand, unseen."],
    es: ["¡Échame una mano!", "Un jugador elegido toma dos cartas de tu mano sin verlas."],
  },
  block: {
    en: ["No You Don't!", "Cancels any action played against you or another player."],
    es: ["¡Ni hablar!", "Anula cualquier acción usada contra ti o contra otro jugador."],
  },
  freeze: {
    en: ["Lock the Look", "The current coordination card stays for one more round."],
    es: ["Fija el look", "La carta de coordinación actual se queda una ronda más."],
  },
  dig: {
    en: ["Search the Chest", "Draw 3 cards, keep one and put the rest back."],
    es: ["Busca en el baúl", "Roba 3 cartas, quédate una y devuelve el resto."],
  },
};
const ACTION_BY_AR = Object.fromEntries(ACTION_TYPES.map((a) => [a.name, a.id]));

// Costume names: traditional names are transliterated (they're proper names); generic jewellery is
// translated. Descriptions are full translations of the designer-approved Arabic text.
const ITEM_I18N = {
  "عقال": { en: ["Agal", "A black cord ring worn on top of the shemagh or ghutra to hold it in place."], es: ["Agal", "Cordón negro en forma de aro que se pone sobre el shemagh o la ghutra para sujetarlos."] },
  "المخطم": { en: ["Mukhattam", "A wide Najdi women's dress, with embroidery and patterns spreading across the chest and body."], es: ["Mukhattam", "Vestido najdí de mujer, amplio, con bordados y motivos que se extienden por el pecho y el cuerpo."] },
  "المخنق": { en: ["Mikhnaq", "A traditional necklace worn close around the neck, made of gold or beads."], es: ["Mikhnaq", "Collar tradicional que se lleva pegado al cuello, de oro o de cuentas."] },
  "متفت": { en: ["Mitfit", "A wide Najdi women's dress with colourful hand-embroidered floral patterns."], es: ["Mitfit", "Vestido najdí de mujer, amplio, con bordados florales de colores hechos a mano."] },
  "دراعة": { en: ["Darra'a", "A long, loose women's dress, embroidered, its fabric varying with the occasion."], es: ["Darra'a", "Vestido de mujer largo y holgado, bordado; la tela cambia según la ocasión."] },
  "رشرش": { en: ["Rashrash", "A traditional women's gold ornament of hanging rows that adorns the neck and chest, worn at occasions and celebrations."], es: ["Rashrash", "Adorno femenino tradicional de oro, con hileras colgantes que adornan el cuello y el pecho; se lleva en ocasiones y celebraciones."] },
  "بشت": { en: ["Bisht", "A fine men's cloak worn over the thobe on formal occasions and Eid."], es: ["Bisht", "Capa masculina de gala que se lleva sobre el thobe en ocasiones formales y en el Eid."] },
  "شماغ": { en: ["Shemagh", "A square men's headscarf, usually red and white, held in place with the agal."], es: ["Shemagh", "Pañuelo cuadrado de hombre, normalmente rojo y blanco, que se sujeta con el agal."] },
  "ثوب مرودن": { en: ["Mirwadan Thobe", "A traditional men's thobe known for its long, wide sleeves."], es: ["Thobe mirwadan", "Thobe tradicional de hombre, conocido por sus mangas largas y anchas."] },
  "قلادة": { en: ["Necklace", "A traditional necklace worn around the neck and over the chest, usually gold."], es: ["Collar", "Collar tradicional que cae sobre el pecho, normalmente de oro."] },
  "برقع أسود": { en: ["Black Burqa", "A traditional black women's face veil that shows the eyes."], es: ["Burka negro", "Velo negro tradicional de mujer que deja ver los ojos."] },
  "دقلة": { en: ["Daqla", "A long men's robe, open at the front, worn over the thobe."], es: ["Daqla", "Túnica masculina larga, abierta por delante, que se lleva sobre el thobe."] },
  "مقصب": { en: ["Muqassab", "A luxurious men's agal decorated with gold thread."], es: ["Muqassab", "Agal masculino de lujo decorado con hilo de oro."] },
  "هامة": { en: ["Hama", "A gold ornament fixed on top of the head, with chains or gold pieces hanging at the sides."], es: ["Hama", "Adorno de oro que se fija en lo alto de la cabeza, con cadenas o piezas que cuelgan a los lados."] },
  "نفنوف": { en: ["Nafnoof", "A traditional Gulf women's dress, usually wide and decorated."], es: ["Nafnoof", "Vestido tradicional de mujer del Golfo, normalmente amplio y decorado."] },
  "النشل": { en: ["Nashal", "A wide women's gown, often silk, embroidered with gold zari thread."], es: ["Nashal", "Túnica amplia de mujer, a menudo de seda, bordada con hilo dorado zari."] },
  "خواتم": { en: ["Rings", "Traditional gold or silver rings worn as adornment."], es: ["Anillos", "Anillos tradicionales de oro o plata que se llevan como adorno."] },
  "مريشة": { en: ["Muraysha", "A black women's shawl edged with coloured threads or tassels, worn over the head covering."], es: ["Muraysha", "Chal negro de mujer con flecos o hilos de colores en los bordes, que se pone sobre el pañuelo."] },
  "جنبية": { en: ["Jambiya", "A traditional curved dagger worn in a belt around the waist."], es: ["Jambiya", "Daga tradicional curva que se lleva en un cinturón."] },
  "خرص": { en: ["Khurs", "Traditional earrings or ear hoops, usually silver or gold."], es: ["Khurs", "Pendientes o aros tradicionales, normalmente de plata u oro."] },
  "منديل برتقالي": { en: ["Orange Headscarf", "A traditional head covering in bright orange, usually worn under the shawl."], es: ["Pañuelo naranja", "Tocado tradicional de color naranja intenso, que se lleva bajo el chal."] },
  "المجنب": { en: ["Mujannab", "A long women's dress with colourful embroidery along both sides and the chest."], es: ["Mujannab", "Vestido largo de mujer con bordados de colores a los lados y en el pecho."] },
  "طفشة": { en: ["Tafsha", "A wide traditional hat woven from palm fronds, for shade from the sun."], es: ["Tafsha", "Sombrero tradicional ancho, tejido con hojas de palmera, para protegerse del sol."] },
  "بيدي": { en: ["Baydi", "A heavy wool men's robe with colourful embroidery on the sleeves and pockets, famously made in Al-Baha."], es: ["Baydi", "Túnica masculina de lana gruesa con bordados de colores en mangas y bolsillos, famosa en Al-Baha."] },
  "غوايش": { en: ["Bangles", "Traditional gold bracelets worn on the wrist or upper arm, often several together."], es: ["Brazaletes", "Pulseras de oro tradicionales para la muñeca o el brazo; a menudo se llevan varias."] },
  "حلق": { en: ["Earrings", "Traditional gold earrings."], es: ["Pendientes", "Pendientes de oro tradicionales."] },
  "بيرم ومسفع": { en: ["Bayram & Musfa", "Two traditional Hijazi women's head coverings: the musfa is wrapped around the head and the bayram worn on top."], es: ["Bayram y musfa", "Dos tocados tradicionales de la mujer hiyazí: el musfa se enrolla en la cabeza y el bayram va encima."] },
  "برقع حجازي": { en: ["Hijazi Burqa", "A Hijazi women's face veil, sometimes decorated with embroidery or metal pieces."], es: ["Burka hiyazí", "Velo hiyazí de mujer, a veces decorado con bordados o piezas de metal."] },
  "شاية": { en: ["Shaya", "A Hijazi men's outer coat worn over the thobe."], es: ["Shaya", "Abrigo masculino hiyazí que se lleva sobre el thobe."] },
  "ثوب مبقر": { en: ["Mubaqqar Thobe", "A traditional Hijazi thobe with decorative panels and coloured fabric bands."], es: ["Thobe mubaqqar", "Thobe tradicional hiyazí con paneles decorativos y bandas de tela de colores."] },
  "ثوب الزبون": { en: ["Zaboon Robe", "A long Hijazi women's robe, open at the front and embroidered, worn over clothes."], es: ["Bata zaboon", "Bata larga hiyazí de mujer, abierta por delante y bordada, que se lleva sobre la ropa."] },
  "مرتعشة": { en: ["Murta'isha", "A large multi-row gold ornament with chains, covering part of the neck and chest."], es: ["Murta'isha", "Gran adorno de oro de varias filas con cadenas, que cubre parte del cuello y el pecho."] },
};

// Saudi phrases travel in shared state in Arabic; each viewer sees them in their language.
const PHRASE_I18N = {
  "كفو!": { en: "Legend!", es: "¡Crack!" },
  "ظلم!": { en: "So unfair!", es: "¡Injusto!" },
  "يا زينه": { en: "Gorgeous!", es: "¡Qué bonito!" },
  "الله يعين": { en: "Good luck with that", es: "Que Dios te ayude" },
  "ههههه": { en: "Hahaha", es: "Jajaja" },
};

const BOT_NAME_POOLS = {
  en: [
    "Just a Bot", "Budget Edition", "Server Intern", "Still Thinking", "Made of Code", "Old Firmware", "Battery 1%",
    "Pixel Uncle", "Coded in a Hurry", "Don't Report Me", "Beta Version", "Works When It Feels Like It", "Summoned",
    "Mere Algorithm", "Robot Lite", "Made in a Garage", "Lag Lord", "Zero-and-One", "Stuck Since Yesterday",
    "Updating…", "Don't Expect Much", "Strongest Bot on the Block", "Bargain-Bin AI", "Mom Coded Me",
  ],
  es: [
    "Solo un bot", "Edición económica", "Becario del servidor", "Sigo pensando", "Hecho de código", "Firmware viejo",
    "Batería 1%", "Tío Píxel", "Programado a lo loco", "No me denuncies", "Versión beta", "Funciona cuando quiere",
    "Invocado", "Mero algoritmo", "Robot ligero", "Hecho en un garaje", "Señor del lag", "Ceroyuno", "Colgado desde ayer",
    "Actualizando…", "No esperes mucho", "El bot más fuerte del barrio", "IA de rebajas", "Me programó mi madre",
  ],
};

// Engine log lines (shared, Arabic) → viewer's language. Each rule is [regex, en(m), es(m)].
const LOG_RULES = [
  [/^(.+) نزّل لا ما تقدر كآخر كرت\.$/, (m, L) => `${m[1]} played ${L.action("block")} as their last card.`, (m, L) => `${m[1]} jugó ${L.action("block")} como su última carta.`],
  [/^خلصت كومة السحب، انخلطت الكروت الملعوبة وصارت كومة سحب جديدة\.$/, () => "The draw pile ran out: the played cards were shuffled into a new draw pile.", () => "Se acabó el mazo: las cartas jugadas se barajaron como mazo nuevo."],
  [/^بدأت اللعبة بـ (\d+) لاعبين، (\d+) كرت لكل لاعب\.$/, (m) => `Game started: ${m[1]} players, ${m[2]} cards each.`, (m) => `Empieza la partida: ${m[1]} jugadores, ${m[2]} cartas cada uno.`],
  [/^ثبّت الحَلّة: يبقى نفس كرت التنسيق لجولة إضافية\.$/, () => "Lock the Look: the same coordination card stays another round.", () => "Fija el look: la misma carta de coordinación se queda otra ronda."],
  [/^كرت تنسيق جديد: (.+)\.$/, (m, L) => `New coordination card: ${L.regionAr(m[1])}.`, (m, L) => `Nueva carta de coordinación: ${L.regionAr(m[1])}.`],
  [/^(.+) رجع نشط\.$/, (m) => `${m[1]} is back.`, (m) => `${m[1]} ha vuelto.`],
  [/^(.+) أنهى دوره\.$/, (m) => `${m[1]} ended their turn.`, (m) => `${m[1]} terminó su turno.`],
  // production's quiet last-move line for a turn with no play
  [/^(.+) تخطّى دوره\.$/, (m) => `${m[1]} skipped their turn.`, (m) => `${m[1]} pasó su turno.`],
  [/^(.+) صار غير نشط \(ما تفاعل مرتين متتاليتين\)\.$/, (m) => `${m[1]} is now inactive (missed two turns in a row).`, (m) => `${m[1]} está inactivo (no jugó dos turnos seguidos).`],
  [/^(.+) غير نشط، تجاوز دوره تلقائيًا\.$/, (m) => `${m[1]} is inactive, turn skipped automatically.`, (m) => `${m[1]} está inactivo, turno saltado automáticamente.`],
  [/^(.+) ما رد بالوقت، تم تخطي دوره\.$/, (m) => `${m[1]} ran out of time, turn skipped.`, (m) => `A ${m[1]} se le acabó el tiempo, turno saltado.`],
  [/^(.+) وضع: (.+)\.$/, (m, L) => `${m[1]} played: ${L.itemList(m[2])}.`, (m, L) => `${m[1]} jugó: ${L.itemList(m[2])}.`],
  [/^(.+) لعب ثبّت الحَلّة\.$/, (m, L) => `${m[1]} played ${L.action("freeze")}.`, (m, L) => `${m[1]} jugó ${L.action("freeze")}.`],
  [/^(.+) فتّش الصندوق وأضاف "(.+)"\.$/, (m, L) => `${m[1]} searched the chest and kept "${L.item(m[2])}".`, (m, L) => `${m[1]} buscó en el baúl y se quedó "${L.item(m[2])}".`],
  [/^(.+) أضاف "(.+)" من فتّش الصندوق\.$/, (m, L) => `${m[1]} kept "${L.item(m[2])}" from the chest.`, (m, L) => `${m[1]} se quedó "${L.item(m[2])}" del baúl.`],
  [/^(.+) فتّش الصندوق\.$/, (m) => `${m[1]} searched the chest.`, (m) => `${m[1]} buscó en el baúl.`],
  [/^(.+) استخدم لا ما تقدر! تم إلغاء (.+)\.$/, (m, L) => `${m[1]} used ${L.action("block")} and cancelled ${L.actionAr(m[2])}.`, (m, L) => `${m[1]} usó ${L.action("block")} y anuló ${L.actionAr(m[2])}.`],
  [/^(.+) استخدم اقدع على (.+): سحب (\d+) كرت\.$/, (m, L) => `${m[1]} used ${L.action("drawTwo")} on ${m[2]}: drew ${m[3]} cards.`, (m, L) => `${m[1]} usó ${L.action("drawTwo")} contra ${m[2]}: robó ${m[3]} cartas.`],
  [/^(.+) فزع من (.+) وأخذ (\d+) كرت\.$/, (m) => `${m[1]} helped ${m[2]} out and took ${m[3]} cards.`, (m) => `${m[1]} le echó una mano a ${m[2]} y tomó ${m[3]} cartas.`],
  [/^(.+) بادل كروت مع (.+) \(عطني وأعطيك\)\.$/, (m, L) => `${m[1]} swapped cards with ${m[2]} (${L.action("giveTake")}).`, (m, L) => `${m[1]} intercambió cartas con ${m[2]} (${L.action("giveTake")}).`],
];

// Engine error strings (Arabic) → viewer's language.
const ERROR_I18N = {
  "كرت التنسيق العشوائي يسمح بعنصر واحد فقط في كل مرة.": {
    en: "A random coordination card allows only one item at a time.", es: "Una carta de coordinación aleatoria solo permite un objeto cada vez.",
  },
  "هذا العنصر غير مطابق لكرت التنسيق.": { en: "This item doesn't match the coordination card.", es: "Este objeto no coincide con la carta de coordinación." },
  "كل الكروت المختارة يجب أن تطابق منطقة وعناصر كرت التنسيق.": {
    en: "All selected cards must match the coordination card's region and items.", es: "Todas las cartas elegidas deben coincidir con la región y los objetos de la carta.",
  },
  "لا يمكن تكرار نفس العنصر في نفس الجولة.": { en: "You can't repeat the same item in one play.", es: "No puedes repetir el mismo objeto en una jugada." },
};

// When the acting seat is the default "you" seat, rewrite the sentence in second person.
const YOU_FIX = {
  en: [
    [/(^|[\s(])(?:أنت|Tú)(?=[\s:.,)!]|$)/g, "$1You"],
    [/^You ended their turn\./, "You ended your turn."],
    [/^You is back\./, "You're back."],
    [/^You played (.+) as their last card\./, "You played $1 as your last card."],
    [/^You is now inactive/, "You're now inactive"],
    [/^You is inactive/, "You're inactive"],
  ],
  es: [
    [/(^|[\s(])(?:أنت|You)(?=[\s:.,)!]|$)/g, "$1Tú"],
    [/^Tú terminó su turno\./, "Terminaste tu turno."],
    [/^Tú ha vuelto\./, "Has vuelto."],
    [/^Tú jugó (.+) como su última carta\./, "Jugaste $1 como tu última carta."],
    [/^Tú está inactivo/, "Estás inactivo"],
    [/^A Tú se le acabó el tiempo/, "Se te acabó el tiempo"],
    [/^Tú jugó:/, "Jugaste:"],
    [/^Tú buscó en el baúl y se quedó/, "Buscaste en el baúl y te quedaste"],
    [/^Tú buscó en el baúl/, "Buscaste en el baúl"],
    [/^Tú se quedó/, "Te quedaste"],
    [/^Tú usó/, "Usaste"],
    [/^Tú le echó una mano a/, "Le echaste una mano a"],
    [/^Tú intercambió/, "Intercambiaste"],
    [/ contra Tú/g, " contra ti"],
    [/ a Tú /g, " a ti "],
    [/ con Tú /g, " contigo "],
    [/^Tú jugó /, "Jugaste "],
  ],
};
function fixYouGrammar(text, code) {
  const rules = YOU_FIX[code];
  if (!rules || !text) return text;
  return rules.reduce((acc, [re, to]) => acc.replace(re, to), text);
}

function makeI18n(code) {
  const lang = LANGS.find((l) => l.code === code) || LANGS[0];
  const dict = I18N[lang.code] || I18N.ar;
  const fill = (str, params) => (params ? str.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? "")) : str);
  const t = (key, params) => fill(dict[key] ?? I18N.ar[key] ?? key, params);
  const ar = lang.code === "ar";
  const L = {
    code: lang.code,
    dir: lang.dir,
    isAr: ar,
    item: (name) => (ar ? name : ITEM_I18N[name]?.[lang.code]?.[0] || name),
    itemDesc: (name) => (ar ? ITEM_DESC[name] : ITEM_I18N[name]?.[lang.code]?.[1] || ITEM_DESC[name]),
    itemList: (s) => (ar ? s : s.split("، ").map((n) => L.item(n)).join(", ")),
    region: (id) => REGION_NAMES[id]?.[lang.code] || REGION_NAMES[id]?.ar || "",
    regionAr: (arName) => (arName === "عشوائي" ? t("random") : REGION_BY_AR[arName] ? L.region(REGION_BY_AR[arName]) : arName),
    rarity: (r) => RARITY_NAMES[r]?.[lang.code] || RARITY_NAMES[r]?.ar || "",
    action: (id) => (ar ? actionMeta(id)?.name : ACTION_NAMES[id]?.[lang.code]?.[0]) || actionMeta(id)?.name || id,
    actionDesc: (id) => (ar ? actionMeta(id)?.desc : ACTION_NAMES[id]?.[lang.code]?.[1]) || actionMeta(id)?.desc || "",
    actionAr: (arName) => (ACTION_BY_AR[arName] ? L.action(ACTION_BY_AR[arName]) : arName),
    phrase: (p) => (ar ? p : PHRASE_I18N[p]?.[lang.code] || p),
    error: (e) => (ar || !e ? e : ERROR_I18N[e]?.[lang.code] || e),
    log: (line) => {
      if (ar || !line) return line;
      let out = line;
      for (const [re, en, es] of LOG_RULES) {
        const m = line.match(re);
        if (m) {
          out = (lang.code === "en" ? en : es)(m, L);
          break;
        }
      }
      return fixYouGrammar(out, lang.code);
    },
    // a viewer-facing name: the default "you" seat name shows in the current language
    name: (n) => (YOU_WORDS.has(n) ? t("you") : n),
    cardsLeft: (n) => (n === 1 ? t("left1") : n === 2 ? t("left2") : ar && n > 10 ? t("leftN11", { n }) : t("leftN", { n })),
    times: (n) => (n === 1 ? t("times1") : n === 2 ? t("times2") : t("timesN", { n })),
    playCards: (n) => (n === 1 ? t("playN1") : n === 2 ? t("playN2") : ar && n > 10 ? t("playN11", { n }) : t("playN", { n })),
    botNames: (n) => (ar ? pickRandomBotNames(n) : shuffle(BOT_NAME_POOLS[lang.code] || BOT_NAME_POOL).slice(0, n)),
  };
  // Renders a string that may contain <b>…</b> as React nodes (bold in the brand colour).
  const tb = (key, params, boldStyle) =>
    t(key, params)
      .split(/(<b>.*?<\/b>)/)
      .map((part, i) =>
        part.startsWith("<b>") ? (
          <b key={i} className="font-bold" style={boldStyle}>
            {part.slice(3, -4)}
          </b>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      );
  return { t, tb, L };
}

const I18nContext = React.createContext({ ...makeI18n("ar"), setLang: null });
const useI18n = () => React.useContext(I18nContext);

// Small segmented language switch (home screen + in-game menu).
function LanguagePicker({ value, onChange, compact = false }) {
  return (
    <div dir="rtl" className="inline-flex p-1 rounded-full gap-0.5" style={{ background: compact ? `${INK}0b` : CREAM, boxShadow: compact ? "none" : "0 2px 8px -2px rgba(60,30,10,.3)" }}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => onChange(l.code)}
          className="rounded-full font-semibold tsz-12 transition"
          style={{ padding: compact ? "4px 10px" : "6px 12px", ...(value === l.code ? { background: BRAND, color: CREAM } : { color: `${INK}aa` }) }}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------- UI BITS --------------------------------- */

const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
const regionOf = (id) => REGION_BY_ID[id];
const costumeArt = (name) => ART["cos:" + name] || null;

// Every in-card font size scales with the "تكبير النص" toggle through --tsz.
const fs = (px) => `calc(${Number(px).toFixed(2)}px * var(--tsz, 1))`;

// Hand-card size follows the viewport so a full hand stays comfortable on a phone.
function useCardSize() {
  const get = () => {
    const w = typeof window !== "undefined" ? window.innerWidth : 400;
    return w < 370 ? 80 : w < 430 ? 88 : w < 720 ? 96 : 106;
  };
  const [s, setS] = useState(get);
  useEffect(() => {
    const on = () => setS(get());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return s;
}

function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 400));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

// The designer's wordmark, used as a CSS mask so it can take any brand colour.
// The original zigzag diamond band from the first version (same gold on the same deep maroon).
function DiamondLattice({ color = "#C9A227", vertical = false, thickness = 14 }) {
  const style = vertical ? { width: thickness, minWidth: thickness } : { height: thickness, minHeight: thickness };
  return (
    <div
      aria-hidden="true"
      style={{
        ...style,
        backgroundImage: `linear-gradient(135deg, ${color} 25%, transparent 25%), linear-gradient(225deg, ${color} 25%, transparent 25%), linear-gradient(45deg, ${color} 25%, transparent 25%), linear-gradient(315deg, ${color} 25%, transparent 25%)`,
        backgroundPosition: `${thickness / 2}px 0, ${thickness / 2}px 0, 0 0, 0 0`,
        backgroundSize: `${thickness}px ${thickness}px`,
        backgroundColor: "#4A141C",
      }}
    />
  );
}

function Wordmark({ height = 40, color = BRAND, className = "", style }) {
  const mask = {
    WebkitMaskImage: `url(${ART.wordmark})`,
    maskImage: `url(${ART.wordmark})`,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
  };
  // Registered trademark: ® at the end of the word in Arabic reading order (the left side), sitting
  // just above the dots of the ة rather than at the image's edge. Coordinates come from the glyph
  // bounds in the 360×313 wordmark art. Same colour as the logo.
  const w = height * (360 / 313);
  const r = Math.max(9, Math.round(height * 0.26));
  return (
    <span className={`relative inline-block ${className}`} style={{ height, width: w, verticalAlign: "middle", ...style }}>
      <span role="img" aria-label="حُلّة®" className="absolute inset-0" style={{ backgroundColor: color, ...mask }} />
      <span
        aria-hidden="true"
        className="absolute font-semibold leading-none"
        style={{ top: height * (112 / 313) - r * 0.95, left: w * (12 / 360), fontSize: r, color, fontFamily: "IBM Plex Sans Arabic, system-ui, sans-serif" }}
      >
        ®
      </span>
    </span>
  );
}

function RegionBadge({ region, size = 18, radius }) {
  const r = regionOf(region);
  if (!r) return null;
  return (
    <img
      src={ART[`badge_${region}`]}
      alt={r.name}
      draggable={false}
      style={{ width: size, height: size, minWidth: size, borderRadius: radius ?? size * 0.24, display: "block" }}
    />
  );
}


// Each side ornament is built from two pieces cut from the designer's strip: a clean motif tile
// (one diamond / leaf / pair of triangles / square) and the small gold connector that sits between
// two motifs. Sizes are relative to the column width. The column shows a whole number of motifs,
// connectors only between them — and for غربي, a gold star at both ends as well.
const ORN_COL = {
  najdi: { tile: 1, conn: 0.2699, caps: false }, // full (uncropped) diamond tile, square
  sharqi: { tile: 0.9837, conn: 0, caps: false },
  janoubi: { tile: 1.206, conn: 0.168, caps: false },
  gharbi: { tile: 1.6667, conn: 0.2824, caps: true },
};

function OrnamentColumn({ region, width = 14, flip = false }) {
  const ref = useRef(null);
  const [h, setH] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // offsetHeight is the layout height — unaffected by the card's flip-in transform, which would
    // otherwise make the two sides measure differently mid-animation.
    const measure = () => setH(el.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const spec = ORN_COL[region] || ORN_COL.sharqi;
  const tileH = width * spec.tile;
  const connH = width * spec.conn;
  const capH = spec.caps ? connH : 0;
  const count = Math.max(0, Math.floor((h - capH + 0.5) / tileH));
  const total = count * tileH + capH;
  const off = capH / 2;
  const joints = [];
  if (spec.conn && count > 0) {
    for (let i = spec.caps ? 0 : 1; i <= (spec.caps ? count : count - 1); i++) joints.push(i);
  }
  return (
    <div ref={ref} aria-hidden="true" className="relative" style={{ width, minWidth: width, alignSelf: "stretch" }}>
      {/* absolutely positioned so the motif stack never feeds back into the card's height */}
      <div className="absolute left-0" style={{ top: "50%", marginTop: -total / 2, width, height: total, transform: flip ? "scaleX(-1)" : undefined }}>
        {/* one image per motif (not a repeating background) so fractional sizes never drift and
            the last motif is never shaved off */}
        {Array.from({ length: count }).map((_, i) => {
          // A motif can be a cut-out shape (spec.motif) slightly larger than its slot, so its tips
          // can meet the neighbours' without being sliced; it's centred on the slot.
          const mW = spec.motif ? width * spec.motif.w : width;
          const mH = spec.motif ? width * spec.motif.h : tileH;
          return (
            <img
              key={`m${i}`}
              src={ART[`ornvM_${region}`]}
              alt=""
              draggable={false}
              style={{ position: "absolute", left: (width - mW) / 2, top: off + i * tileH + (tileH - mH) / 2, width: mW, height: mH, maxWidth: "none" }}
            />
          );
        })}
        {joints.map((i) => (
          <img
            key={i}
            src={ART[`ornvC_${region}`]}
            alt=""
            draggable={false}
            style={{ position: "absolute", left: 0, top: off + i * tileH - connH / 2, width, height: connH, maxWidth: "none" }}
          />
        ))}
      </div>
    </div>
  );
}


function GoldRule({ children, color = GOLD, className = "" }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className="h-px flex-1" style={{ background: color }} />
      <span className="w-1 h-1 rotate-45 flex-shrink-0" style={{ background: color }} />
      {children}
      {children && <span className="w-1 h-1 rotate-45 flex-shrink-0" style={{ background: color }} />}
      <span className="h-px flex-1" style={{ background: color }} />
    </div>
  );
}

// Shared card body: rounded corners everywhere, soft resting shadow, lifts + gold ring when picked.
function CardShell({ size, height, selected, onClick, disabled, children, bg, title, className = "", style }) {
  const h = height ?? size;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      title={onClick ? title : undefined}
      className={`hilla-card relative flex-shrink-0 overflow-hidden p-0 text-center ${onClick && !disabled ? "cursor-pointer" : ""} ${
        selected ? "is-selected" : ""
      } ${className}`}
      style={{
        width: size,
        height: h,
        borderRadius: size * 0.11,
        background: bg,
        opacity: disabled ? 0.45 : 1,
        filter: disabled ? "saturate(.55)" : undefined,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

// Square hand card, after the designer's frame: regional colour, scalloped cream panel with the
// region badge in two corners, rarity pill on top, the illustration, then the name.
const HAND_FRAME_PATH =
  "M9.8 4.6 H71 a3 3 0 0 1 3 3 V11.5 A14 14 0 0 0 88 25.5 H92.1 a3 3 0 0 1 3 3 V90 a5 5 0 0 1 -5 5 H29 a3 3 0 0 1 -3 -3 V88.5 A14 14 0 0 0 12 74.5 H7.8 a3 3 0 0 1 -3 -3 V9.6 a5 5 0 0 1 5 -5 Z";

function ItemCard({ card, selected, onClick, size = 92, disabled, showDesc, className = "", style }) {
  const { t, tb, L } = useI18n();
  const region = regionOf(card.region);
  const color = region?.color || BRAND;
  const rarity = RARITY_META[card.rarity] || RARITY_META.common;
  const art = costumeArt(card.name);
  const big = showDesc ?? size >= 160;
  const pillText = size >= 104;
  return (
    <CardShell size={size} selected={selected} onClick={onClick} disabled={disabled} bg={color} title={L.item(card.name)} className={className} style={style}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <path d={HAND_FRAME_PATH} fill={CREAM} />
      </svg>
      <img src={ART[`badge_${card.region}`]} alt="" draggable={false} className="absolute" style={{ left: "79.5%", top: "7.5%", width: "13%" }} />
      <img src={ART[`badge_${card.region}`]} alt="" draggable={false} className="absolute" style={{ left: "7.4%", top: "79.2%", width: "13%" }} />
      <span
        className="absolute left-1/2 -translate-x-1/2 rounded-full flex items-center justify-center font-semibold leading-none whitespace-nowrap"
        style={{
          top: "8.6%",
          width: pillText ? "32%" : "26%",
          height: pillText ? "7.4%" : "5%",
          background: rarity.color,
          color: rarity.text,
          fontSize: fs(size * 0.056),
        }}
      >
        {pillText ? L.rarity(card.rarity) : ""}
      </span>
      <div className="absolute flex items-center justify-center" style={{ left: "16%", right: "16%", top: big ? "18%" : "17%", height: big ? "40%" : "47%" }}>
        {art ? (
          <img src={art} alt={L.item(card.name)} draggable={false} className="max-w-full max-h-full object-contain" style={{ filter: "drop-shadow(0 2px 2px rgba(60,30,10,.18))" }} />
        ) : (
          <div className="opacity-80 flex flex-col items-center gap-1">
            <RegionBadge region={card.region} size={size * 0.3} radius={size * 0.06} />
          </div>
        )}
      </div>
      <div
        className="absolute font-bold leading-tight"
        style={{ left: "14%", right: "10%", top: big ? "60%" : "66.5%", color: INK, fontSize: fs(size * (big ? 0.082 : 0.118)) }}
      >
        {L.item(card.name)}
      </div>
      {big && ITEM_DESC[card.name] && (
        <div
          className="absolute serif-text leading-snug"
          style={{ left: "21%", right: "8%", top: "70%", color: `${INK}cc`, fontSize: fs(size * 0.056), textAlign: "center" }}
        >
          {L.itemDesc(card.name)}
        </div>
      )}
    </CardShell>
  );
}

// Where the title (and description on big cards) sits on each action illustration, so text never
// lands on the drawing — positions follow the designer's layouts.
// Base colour of each action illustration — fills the card behind the art so the corners stay clean.
const ACTION_BG = { block: "#961E21", stealTwo: "#FACE94", drawTwo: "#A2A7BC", dig: "#FCF3E2", giveTake: "#FCF3E2", freeze: "#FCF3E2" };

const ACTION_LAYOUT = {
  block: { color: CREAM, box: { top: "8%", left: "7%", right: "7%" }, align: "left" },
  stealTwo: { color: "#6E2B12", box: { top: "66%", left: "7%", width: "48%" }, align: "left" },
  drawTwo: { color: CREAM, box: { top: "70%", left: "7%", right: "7%" }, align: "center" },
  dig: { color: INK, box: { top: "8%", left: "7%", right: "7%" }, align: "right" },
  giveTake: { color: INK, box: { top: "70%", left: "7%", right: "7%" }, align: "right" },
  freeze: { color: INK, box: { top: "72%", left: "7%", right: "7%" }, align: "center" },
};

function ActionCard({ card, actionType, size = 92, selected, onClick, disabled, showDesc, className = "", style }) {
  const { t, tb, L } = useI18n();
  const type = actionType || card?.actionType;
  const meta = actionMeta(type);
  const baseLay = ACTION_LAYOUT[type] || ACTION_LAYOUT.freeze;
  // Latin titles are longer and wrap, so give the narrow help-me-out box a bit more room.
  const lay = !L.isAr && type === "stealTwo" ? { ...baseLay, box: { ...baseLay.box, top: "60%", width: "62%" } } : baseLay;
  // Only the title sits on the art; the description is shown as text beside the card where needed,
  // so it never runs over the illustration.
  const big = showDesc ?? false;
  return (
    <CardShell size={size} selected={selected} onClick={onClick} disabled={disabled} bg={ACTION_BG[type] || CREAM} title={L.actionDesc(type)} className={className} style={style}>
      {/* the art carries its own rounded corners; oversize it a touch so the card's corners clip it cleanly */}
      <img src={ART[`act_${type}`]} alt="" draggable={false} className="absolute" style={{ left: "-4%", top: "-4%", width: "108%", height: "108%", maxWidth: "none" }} />
      <div className="absolute" style={{ ...lay.box, textAlign: lay.align, color: lay.color }}>
        <div className={`font-bold hlead-105 ${L.isAr ? "whitespace-nowrap" : ""}`} style={{ fontSize: fs(size * (big ? 0.1 : L.isAr ? 0.118 : 0.108)) }}>
          {L.action(type)}
        </div>
        {big && (
          <div className="mt-1 leading-snug font-medium" style={{ fontSize: fs(size * 0.058), opacity: 0.92 }}>
            {L.actionDesc(type)}
          </div>
        )}
      </div>
    </CardShell>
  );
}

// Small square crop of an action's art (lists, toasts, buttons) with clean rounded corners.
function ActionThumb({ type, size = 40, radius }) {
  return (
    <span className="relative inline-block overflow-hidden flex-shrink-0" style={{ width: size, height: size, borderRadius: radius ?? size * 0.24, background: ACTION_BG[type] || CREAM }}>
      {/* text-free thumbnail: the drawing re-centred on its own background */}
      <img src={ART[`actT_${type}`]} alt="" draggable={false} className="absolute inset-0 w-full h-full" />
    </span>
  );
}

function AnyCard(props) {
  return props.card?.kind === "action" ? <ActionCard {...props} /> : <ItemCard {...props} />;
}

function CardBack({ size = 60, tall = false, style, className = "" }) {
  return (
    <img
      src={tall ? ART.back_tall : ART.back_sq}
      alt=""
      draggable={false}
      className={className}
      style={{ width: size, height: tall ? size * (1186 / 828) : size, borderRadius: size * 0.09, display: "block", ...style }}
    />
  );
}

// Coordination card, drawn live from the real illustrations. Landscape, like the original board
// layout: the region's ornament runs down both short sides, the title sits on top and the item
// illustrations line up underneath (no names — tap a piece to see what it is). Random cards use
// the beige frame with a few gold sparkles.
function CoordCard({ card, width = 340, animate = true }) {
  const { t, tb, L } = useI18n();
  const isRandom = card.type === "random";
  const region = isRandom ? null : card.region;
  const frame = isRandom ? BEIGE : regionOf(region)?.color || BRAND;
  const titleColor = isRandom ? BRAND : frame;
  const items = isRandom ? sortItemNamesByRegion(card.items) : card.items;
  const n = items.length;
  const cols = n <= 5 ? n : Math.ceil(n / 2);
  const k = width / 340;
  const [openTip, setOpenTip] = useState(null);

  useEffect(() => {
    if (openTip === null) return;
    const tm = setTimeout(() => setOpenTip(null), 2500);
    return () => clearTimeout(tm);
  }, [openTip]);

  const strip = Math.round(15 * k);
  const artH = (n <= 5 ? 66 : 54) * k;

  return (
    <div
      className={`relative select-none ${animate ? "hilla-coord-in" : ""}`}
      style={{
        width,
        background: frame,
        padding: 7 * k,
        borderRadius: 18 * k,
        boxShadow: "0 2px 0 rgba(0,0,0,.08), 0 18px 34px -14px rgba(60,30,10,.45)",
      }}
    >
      <div dir="ltr" className="relative flex" style={{ background: CREAM, borderRadius: 13 * k, padding: `${9 * k}px ${8 * k}px`, gap: 8 * k }}>
        {!isRandom && <OrnamentColumn region={region} width={strip} />}
        <div dir={L.dir} className="flex-1 min-w-0 flex flex-col">
          <GoldRule>
            <span className="display-font font-bold leading-none px-1" style={{ color: titleColor, fontSize: fs(23 * k) }}>
              {isRandom ? t("random") : L.region(card.region)}
            </span>
          </GoldRule>
          <div className="text-center font-medium" style={{ color: `${INK}88`, fontSize: fs(9.5 * k), marginTop: 2 * k }}>
            {isRandom ? t("oneCardOnly") : t("severalNoRepeat")}
          </div>
          <div className="flex flex-wrap justify-center items-end" style={{ marginTop: 8 * k, rowGap: 8 * k }}>
            {items.map((it, i) => {
              const info = ITEM_INFO[it];
              const art = costumeArt(it);
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={it}
                  onClick={() => setOpenTip((cur) => (cur === i ? null : i))}
                  className="relative flex items-center justify-center p-0 bg-transparent transition active:scale-95"
                  style={{ width: `${100 / cols}%`, height: artH }}
                >
                  {openTip === i && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full font-bold whitespace-nowrap shadow-lg z-10 pointer-events-none hilla-tip"
                      style={{ top: -10 * k, background: INK, color: CREAM, fontSize: fs(11 * k) }}
                    >
                      {L.item(it)}
                    </span>
                  )}
                  {art ? (
                    <img src={art} alt={it} draggable={false} className="max-h-full object-contain" style={{ maxWidth: "88%", filter: "drop-shadow(0 2px 2px rgba(60,30,10,.16))" }} />
                  ) : (
                    <RegionBadge region={info?.region} size={artH * 0.55} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        {!isRandom && <OrnamentColumn region={region} width={strip} flip />}
        {isRandom &&
          [
            [5, 18],
            [93, 22],
            [4, 78],
            [94, 80],
          ].map(([x, y], i) => (
            <span key={i} className="absolute pointer-events-none" style={{ left: `${x}%`, top: `${y}%`, color: GOLD, fontSize: 10 * k, opacity: 0.85 }}>
              ✦
            </span>
          ))}
      </div>
    </div>
  );
}

// Compact copy of the coordination card that slides in at the top once the real card has scrolled
// out of view — so you can still see what to match while picking from your hand. Tap it to jump
// back up to the full card.
function StickyCoordBar({ card, onJump, timer }) {
  const { t, tb, L } = useI18n();
  const isRandom = card.type === "random";
  const color = isRandom ? BEIGE : regionOf(card.region)?.color || BRAND;
  const items = isRandom ? sortItemNamesByRegion(card.items) : card.items;
  return (
    <div className="fixed left-0 right-0 px-3 hilla-sticky" style={{ top: "max(8px, calc(env(safe-area-inset-top) + 4px))", zIndex: 40 }}>
      <button
        type="button"
        onClick={onJump}
        dir={L.dir}
        className="mx-auto max-w-2xl w-full flex items-center gap-2.5 hr-20 px-2 py-1.5 hstart"
        style={{ background: CREAM, boxShadow: `0 0 0 1.5px ${GOLD}, 0 12px 26px -12px rgba(60,30,10,.55)` }}
      >
        <span
          className="flex-shrink-0 flex items-center justify-center hr-20 display-font font-bold leading-none px-3"
          style={{ background: color, color: isRandom ? BRAND : CREAM, height: 44, fontSize: fs(19) }}
        >
          {isRandom ? t("random") : L.region(card.region)}
        </span>
        <span className="flex-1 min-w-0 flex items-center justify-around gap-1">
          {items.map((it, i) =>
            costumeArt(it) ? (
              <img key={i} src={costumeArt(it)} alt={it} draggable={false} className="object-contain" style={{ height: 34, maxWidth: 40, minWidth: 0 }} />
            ) : null
          )}
        </span>
        {timer}
      </button>
    </div>
  );
}

function DrawPile({ size = 56 }) {
  const { t, tb, L } = useI18n();
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size + 6, height: size + 6 }}>
        {[2, 1, 0].map((i) => (
          <CardBack
            key={i}
            size={size}
            style={{
              position: "absolute",
              left: i * 2,
              top: 6 - i * 3,
              transform: `rotate(${(i - 1) * 4}deg)`,
              boxShadow: "0 2px 6px rgba(60,30,10,.22)",
            }}
          />
        ))}
      </div>
      <span className="font-semibold" style={{ color: `${INK}77`, fontSize: fs(10) }}>
        {t("drawPile")}
      </span>
    </div>
  );
}

// Each played card lands with its own slight tilt, so the pile feels hand-stacked.
const tiltOf = (id) => {
  let h = 0;
  for (let i = 0; i < String(id).length; i++) h = (h * 31 + String(id).charCodeAt(i)) | 0;
  return (Math.abs(h) % 13) - 6; // −6°…+6°
};

// The last three played cards stay stacked. A new card lands on top, and only after it has landed
// does the oldest one (at the bottom, already covered) disappear — nothing ever pops out of view.
const DISCARD_STACK = 3;
function DiscardPile({ card, size = 56 }) {
  const { t, tb, L } = useI18n();
  const [layers, setLayers] = useState(() => (card ? [card] : []));
  useEffect(() => {
    if (!card) {
      setLayers([]);
      return;
    }
    setLayers((l) => (l.length && l[l.length - 1].id === card.id ? l : [...l.slice(-DISCARD_STACK), card]));
    const tm = setTimeout(() => setLayers((l) => l.slice(-DISCARD_STACK)), 520);
    return () => clearTimeout(tm);
  }, [card?.id]);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size + 6, height: size + 6 }}>
        <div
          className="absolute rounded-xl"
          style={{ left: 3, top: 6, width: size, height: size, borderRadius: size * 0.11, border: `1.5px dashed ${INK}33` }}
        />
        {layers.map((c, i) => {
          const top = i === layers.length - 1;
          const rot = `${tiltOf(c.id)}deg`;
          return (
            <div
              key={c.id}
              className={`absolute ${top ? "hilla-drop" : ""}`}
              style={{ left: 3, top: 3, transform: `rotate(${rot})`, "--rot": rot, zIndex: i }}
            >
              <AnyCard card={c} size={size} />
            </div>
          );
        })}
      </div>
      <span className="font-semibold" style={{ color: `${INK}77`, fontSize: fs(10) }}>
        {t("lastCard")}
      </span>
    </div>
  );
}

// Seat: a small fan of card backs with the hand count tucked under it, then the name. Everything
// is centred, and the active seat gets a soft cream tile with a gold ring (no lift, so nothing
// gets clipped by the scrolling row).
function SeatPod({ player, active, isMe, nearWin, thinking }) {
  const { t, tb, L } = useI18n();
  const n = player.hand.length;
  const backs = Math.min(5, n);
  // Wider, flatter fan as the count grows so five cards still read as a full hand.
  const spread = backs >= 4 ? 8.5 : 11;
  const tilt = backs >= 4 ? 9 : 12;
  return (
    <div
      className="flex flex-col items-center text-center flex-shrink-0 hr-20 transition-all duration-300"
      style={{
        minWidth: 92,
        padding: "10px 14px 9px",
        background: active ? CREAM : "transparent",
        boxShadow: active ? `0 0 0 2px ${GOLD}, 0 6px 14px -8px rgba(60,30,10,.35)` : "none",
      }}
    >
      <div className="relative" style={{ width: 76, height: 40 }}>
        {Array.from({ length: backs }).map((_, i) => {
          const o = i - (backs - 1) / 2;
          return (
            <CardBack
              key={i}
              size={28}
              style={{
                position: "absolute",
                left: 24 + o * spread,
                top: 2,
                transform: `rotate(${o * tilt}deg)`,
                transformOrigin: "50% 130%",
                boxShadow: "0 1px 2px rgba(60,30,10,.22)",
              }}
            />
          );
        })}
        {n === 0 && <span className="absolute rounded-md" style={{ left: 24, top: 2, width: 28, height: 28, border: `1.5px dashed ${INK}33` }} />}
        <span
          className={`absolute left-1/2 -translate-x-1/2 hminw-22 hh-20 px-1.5 rounded-full flex items-center justify-center font-bold ${nearWin ? "hilla-nearwin" : ""}`}
          style={{ bottom: -2, background: nearWin ? GOLD : INK, color: nearWin ? INK : CREAM, fontSize: fs(10.5), border: `2px solid ${active ? CREAM : PAGE}` }}
        >
          {n}
        </span>
      </div>
      <div className="mt-1.5 font-semibold leading-snug whitespace-nowrap" style={{ color: active ? INK : `${INK}99`, fontSize: fs(11.5) }}>
        {player.isBot ? "🤖 " : player.inactive ? "😴 " : nearWin ? "🔥 " : ""}
        {L.name(player.name)}
        {isMe && !YOU_WORDS.has(player.name) && (
          <span className="font-medium" style={{ color: GOLD_DK }}>
            {" "}({t("you")})
          </span>
        )}
        {thinking && (
          <span className="inline-flex gap-0.5 hms-1 align-middle">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-1 h-1 rounded-full hilla-dot" style={{ background: GOLD_DK, animationDelay: `${i * 150}ms` }} />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

// Lobby avatar: a round chip with the player's first letter (🤖 for bots), tinted in rotating
// brand colours so each seat is easy to tell apart. Replaces the region badges, which read as
// decoration rather than "this is a person".
const AVATAR_TINTS = [BRAND, "#366135", "#121A42", "#5C3A1C", GOLD_DK, INK];
function PlayerAvatar({ name, isBot, index = 0, size = 34 }) {
  const ch = (name || "").trim().replace(/^[^\p{L}\p{N}]+/u, "").charAt(0) || "؟";
  const bg = AVATAR_TINTS[index % AVATAR_TINTS.length];
  return (
    <span
      aria-hidden="true"
      className="flex-shrink-0 rounded-full flex items-center justify-center font-bold leading-none"
      style={{ width: size, height: size, background: isBot ? `${INK}12` : bg, color: CREAM, fontSize: isBot ? size * 0.5 : size * 0.46, boxShadow: isBot ? "none" : `0 0 0 2px ${CREAM}, 0 0 0 3px ${bg}40` }}
    >
      {isBot ? "🤖" : ch.toUpperCase()}
    </span>
  );
}

// Centered modal sheet used by every in-game dialog.
function Sheet({ children, onBackdrop, maxW = 380, z = 50 }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 hilla-fade"
      style={{ zIndex: z, background: "rgba(35,31,32,.5)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
      onClick={onBackdrop}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full hr-28 p-5 text-center relative hilla-pop"
        style={{ maxWidth: maxW, borderRadius: 28, background: CREAM, boxShadow: `0 0 0 2px ${GOLD}, 0 24px 60px -10px rgba(0,0,0,.4)`, maxHeight: "calc(100% - 2rem)", overflowY: "auto" }}
      >
        {children}
      </div>
    </div>
  );
}

const btn = "rounded-2xl font-bold transition hpress-97 hbtn";
const btnPrimary = { background: BRAND, color: CREAM, boxShadow: "0 6px 14px -6px rgba(133,21,45,.6)" };
const btnGhost = { background: "transparent", color: INK, border: `1.5px solid ${INK}26` };


// Fonts: Thmanyah can't be embedded in a web page (license), so the closest Google Fonts stand in —
// IBM Plex Sans Arabic for the interface, Markazi Text for titles and long reading text.
const GlobalFont = () => (
  <style>{`
    .hilla-root, .hilla-root button, .hilla-root input, .hilla-root textarea { font-family: var(--font-plex), "IBM Plex Sans Arabic", system-ui, sans-serif; }
    .hr-20 { border-radius: 20px; } .hr-22 { border-radius: 22px; } .hr-26 { border-radius: 26px; } .hr-28 { border-radius: 28px; }
    .hh-20 { height: 20px; } .hminw-22 { min-width: 22px; } .hlead-105 { line-height: 1.05; } .hmaxh-52 { max-height: 52vh; }
    .hmaxw-90 { max-width: 90vw; } .hmaxw-92 { max-width: 92vw; } .hminh-40 { min-height: 40px; } .htrack-3 { letter-spacing: .3em; }
    .hpress-97:active:not(:disabled) { transform: scale(.97); } .hpress-98:active { transform: scale(.98); }
    .hbtn:disabled { opacity: .38; cursor: default; }
    .hz-55 { z-index: 55; } .hz-58 { z-index: 58; } .hz-60 { z-index: 60; } .hz-65 { z-index: 65; } .hz-70 { z-index: 70; }
    .hz-9998 { z-index: 9998; } .hz-9999 { z-index: 9999; } .hz-10000 { z-index: 10000; }
    .hstart { text-align: start; } .hend { text-align: end; }
    .hms-1 { margin-inline-start: .25rem; }
    .hpad-se { padding-inline-start: .5rem; padding-inline-end: 1rem; }
    .hpad-e3 { padding-inline-end: .75rem; }
    .display-font { font-family: var(--font-markazi), "Markazi Text", serif; letter-spacing: 0; }
    .serif-text { font-family: var(--font-markazi), "Markazi Text", serif; }
    .hilla-root button { -webkit-tap-highlight-color: transparent; }
    .hilla-card {
      box-shadow: 0 0 0 1px rgba(35,31,32,.07), 0 6px 14px -6px rgba(60,30,10,.35);
      transition: transform .22s cubic-bezier(.2,.8,.2,1), box-shadow .22s ease, opacity .2s ease, filter .2s ease;
    }
    button.hilla-card:not(:disabled):hover { transform: translateY(-3px); }
    .hilla-card.is-selected, button.hilla-card.is-selected:hover {
      transform: translateY(-12px);
      box-shadow: 0 0 0 3px ${GOLD}, 0 16px 24px -10px rgba(60,30,10,.55);
    }
    .hilla-clamp2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
    .hilla-lastmove { animation: hilla-lastmove 5s ease-out forwards; }
    @keyframes hilla-lastmove { 0% { opacity: 0; transform: translateY(4px); } 8% { opacity: 1; transform: none; } 70% { opacity: 1; } 100% { opacity: .55; } }
    .hilla-hand { scroll-snap-type: x proximity; scrollbar-width: none; }
    .hilla-hand::-webkit-scrollbar { display: none; }
    .hilla-hand > * { scroll-snap-align: start; }
    .hilla-deal { animation: hilla-deal .38s cubic-bezier(.2,.8,.2,1) backwards; }
    .hilla-coord-in { animation: hilla-coord-in .55s cubic-bezier(.2,.8,.2,1) backwards; transform-origin: 50% 60%; }
    .hilla-drop { animation: hilla-drop .46s cubic-bezier(.2,.9,.3,1.12) backwards; }
    .sd-card { transition: transform .3s cubic-bezier(.2,.8,.2,1), box-shadow .3s; }
    .sd-toast { animation: sd-toast 1.9s ease forwards; }
    @keyframes sd-toast { 0% { opacity: 0; transform: translate(-50%, 10px); } 15%, 80% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, 0); } }
    .hilla-pop { animation: hilla-pop .28s cubic-bezier(.2,.9,.3,1.15) backwards; }
    .hilla-fade { animation: hilla-fade .2s ease-out backwards; }
    .hilla-tip { animation: hilla-fade .15s ease-out backwards; }
    .hilla-float { animation: hilla-float 6s ease-in-out infinite; }
    .hilla-nearwin { animation: hilla-nearwin 1.2s ease-in-out infinite; }
    .hilla-dot { animation: hilla-dot 1s ease-in-out infinite; }
    .hilla-myturn { animation: hilla-myturn 2.4s ease-in-out infinite; }
    @keyframes hilla-deal { from { opacity: 0; transform: translateY(16px) scale(.9); } to { opacity: 1; transform: none; } }
    @keyframes hilla-coord-in {
      0% { opacity: 0; transform: perspective(900px) rotateY(-70deg) scale(.92); }
      60% { opacity: 1; }
      100% { opacity: 1; transform: perspective(900px) rotateY(0) scale(1); }
    }
    @keyframes hilla-drop {
      from { opacity: 0; transform: translateY(-30px) rotate(calc(var(--rot, 0deg) - 10deg)) scale(1.18); }
      70% { opacity: 1; }
      to { opacity: 1; transform: rotate(var(--rot, 0deg)); }
    }
    @keyframes hilla-pop { from { opacity: 0; transform: translateY(10px) scale(.94); } to { opacity: 1; transform: none; } }
    @keyframes hilla-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes hilla-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
    @keyframes hilla-dot { 0%, 100% { opacity: .25; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-2px); } }
    @keyframes hilla-myturn {
      0%, 100% { box-shadow: 0 0 0 2px ${GOLD}aa, 0 10px 30px -14px rgba(60,30,10,.4); }
      50% { box-shadow: 0 0 0 3px ${GOLD}, 0 10px 34px -10px rgba(221,173,85,.55); }
    }
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
    @keyframes hilla-nearwin {
      0%, 100% { box-shadow: 0 0 0 0 rgba(221,173,85,0); }
      50% { box-shadow: 0 0 10px 3px rgba(221,173,85,0.8); }
    }
    @keyframes hilla-strip {
      from { width: 100%; }
      to { width: 0%; }
    }
    @keyframes hilla-edu {
      0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
      7% { opacity: 1; transform: translateX(-50%) translateY(0); }
      80% { opacity: 1; transform: translateX(-50%) translateY(0); }
      100% { opacity: 0; transform: translateX(-50%) translateY(8px); }
    }
    @keyframes hilla-confetti {
      0% { transform: translateY(-4vh) rotate(0deg); opacity: 1; }
      100% { transform: translateY(108vh) rotate(var(--cr, 720deg)); opacity: 0.85; }
    }
    @keyframes hilla-fan-in {
      from { opacity: 0; transform: translate3d(-10px, 10px, 0) scale(.6); }
      to   { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
    }
    .hilla-rays { animation: hilla-rays 40s linear infinite; will-change: transform; }
    @keyframes hilla-rays { to { transform: rotate(360deg); } }
    .hilla-sticky { animation: hilla-sticky .32s cubic-bezier(.2,.9,.3,1.1) backwards; }
    @keyframes hilla-sticky { from { opacity: 0; transform: translateY(-120%); } to { opacity: 1; transform: none; } }
    .hilla-seatbubble { animation: hilla-seatbubble 5s ease-out forwards; transform-origin: 50% 100%; }
    @keyframes hilla-seatbubble {
      0% { opacity: 0; transform: translateY(6px) scale(.6); }
      5% { opacity: 1; transform: translateY(0) scale(1.08); }
      9% { transform: translateY(0) scale(1); }
      90% { opacity: 1; transform: translateY(0) scale(1); }
      100% { opacity: 0; transform: translateY(-4px) scale(.96); }
    }
    .hilla-bubble { animation: hilla-bubble 2.5s cubic-bezier(.2,.9,.3,1.2) forwards; transform-origin: 50% 100%; }
    @keyframes hilla-bubble {
      0% { opacity: 0; transform: translateY(14px) scale(.55) rotate(var(--tilt, 0deg)); }
      12% { opacity: 1; transform: translateY(0) scale(1.08) rotate(var(--tilt, 0deg)); }
      20% { transform: translateY(0) scale(1) rotate(var(--tilt, 0deg)); }
      78% { opacity: 1; transform: translateY(-6px) scale(1) rotate(var(--tilt, 0deg)); }
      100% { opacity: 0; transform: translateY(-22px) scale(.96) rotate(var(--tilt, 0deg)); }
    }
    @keyframes hilla-reactor-tag {
      0% { opacity: 0; transform: translate3d(-50%, 8px, 0); }
      12% { opacity: 1; transform: translate3d(-50%, 0, 0); }
      75% { opacity: 1; transform: translate3d(-50%, 0, 0); }
      100% { opacity: 0; transform: translate3d(-50%, -6px, 0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .hilla-deal, .hilla-coord-in, .hilla-drop, .hilla-pop, .hilla-fade, .hilla-float, .hilla-myturn, .hilla-rays { animation: none !important; }
      .hilla-card { transition: none; }
    }
    .tsz-7 { font-size: calc(7px * var(--tsz, 1)); }
    .tsz-9 { font-size: calc(9px * var(--tsz, 1)); }
    .tsz-10 { font-size: calc(10px * var(--tsz, 1)); }
    .tsz-11 { font-size: calc(11px * var(--tsz, 1)); }
    .tsz-12 { font-size: calc(12px * var(--tsz, 1)); }
    .tsz-13 { font-size: calc(13px * var(--tsz, 1)); }
    .tsz-14 { font-size: calc(14px * var(--tsz, 1)); }
    .tsz-15 { font-size: calc(15px * var(--tsz, 1)); }
    .tsz-17 { font-size: calc(17px * var(--tsz, 1)); }
    .tsz-20 { font-size: calc(20px * var(--tsz, 1)); }
  `}</style>
);

// The original zigzag diamond lattice, exactly as before (same cream and the same faint gold).
const ZIG_BG = "#F3E9D2";
const ZIG_GOLD = "#C9A2270d";
const pageBg = {
  background: ZIG_BG,
  backgroundImage: `linear-gradient(135deg, ${ZIG_GOLD} 25%, transparent 25%), linear-gradient(225deg, ${ZIG_GOLD} 25%, transparent 25%), linear-gradient(45deg, ${ZIG_GOLD} 25%, transparent 25%), linear-gradient(315deg, ${ZIG_GOLD} 25%, transparent 25%)`,
  backgroundPosition: "20px 0, 20px 0, 0 0, 0 0",
  backgroundSize: "40px 40px",
};


/* --------------------------------- GAME BOARD (shared) --------------------------------- */

// If no human can possibly intervene (no human target to warn, no human holding لا ما تقدر),
// waiting the full 10s is dead air — shorten the reaction window to 2.5s. Bot self-defense is
// handled separately (700ms) and unaffected.
function pendingWindowMs(game) {
  const pa = game.pendingAction;
  if (!pa) return BLOCK_WINDOW_MS;
  const target = game.players.find((p) => p.id === pa.targetId);
  const humanTarget = target && !target.isBot;
  const humanBlocker = game.players.some(
    (p) => p.id !== pa.actorId && !p.isBot && p.hand.some((c) => c.kind === "action" && c.actionType === "block")
  );
  return humanTarget || humanBlocker ? BLOCK_WINDOW_MS : 2500;
}

// F2 — win celebration: CSS-only confetti in the four region colours plus gold and the brand red.
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 108 }).map((_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.9,
        dur: 2.2 + Math.random() * 1.8,
        color: [BRAND, GOLD, ...REGIONS.map((r) => r.color)][i % 6],
        size: 6 + Math.random() * 7,
        rot: 360 + Math.random() * 540,
        shape: i % 3,
      })),
    []
  );
  return (
    <div className="fixed inset-0 pointer-events-none hz-70 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: "-5vh",
            left: `${p.left}%`,
            width: p.size,
            height: p.shape === 1 ? p.size : p.size * 0.45,
            background: p.color,
            borderRadius: p.shape === 2 ? "50%" : 2,
            "--cr": `${p.rot}deg`,
            animation: `hilla-confetti ${p.dur}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}

// F2 — end-of-game fun stats, computed from game.stats/turnSerial. Display-only.
function WinStats({ game, myId, isOnline }) {
  const { t, tb, L } = useI18n();
  const [copied, setCopied] = useState(false);
  const targeted = game.stats?.targetedByPlayerId || {};
  // Most targeted (landed + blocked, by id). Ties list everyone on the top count.
  const topTargeted = (() => {
    const vals = Object.values(targeted);
    if (!vals.length) return null;
    const max = Math.max(...vals);
    const ps = game.players.filter((p) => targeted[p.id] === max);
    return ps.length ? { players: ps, count: max } : null;
  })();
  const winner = game.players.find((p) => p.id === game.winner);
  const runnerUp = game.players.filter((p) => p.id !== game.winner).sort((a, b) => a.hand.length - b.hand.length)[0];

  // Name each seat from the reader's point of view, so "أنت" reads naturally.
  // On a shared device with more than one human, «أنت» would be everyone, so use names there.
  const sharedHumans = !isOnline && game.players.filter((p) => !p.isBot).length > 1;
  const who = (p) => (p ? (isOnline ? (p.id === myId ? t("you") : L.name(p.name)) : p.isBot || sharedHumans ? L.name(p.name) : t("you")) : "");
  const cardsLeft = L.cardsLeft;
  const times = L.times;
  const sep = L.isAr ? "، " : ", ";

  const durationMs = game.endedAtMs && game.startedAtMs ? game.endedAtMs - game.startedAtMs : null;
  const durationText = (() => {
    if (!durationMs || durationMs < 0) return null;
    const total = Math.round(durationMs / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  })();

  const rows = [
    { l: t("winner"), v: `${who(winner)} 🎉`, hero: true },
    durationText ? { l: t("duration"), v: durationText, hero: true } : null,
    runnerUp ? { l: t("runnerUp"), v: `${who(runnerUp)}${sep}${cardsLeft(runnerUp.hand.length)}` } : null,
    { l: t("coordRounds"), v: `${game.coordRounds ?? 0}` },
    { l: t("cardsPlayed"), v: `${game.stats?.itemsPlayed || 0}` },
    { l: t("raresPlayed"), v: `${game.stats?.rareItemsPlayed || 0}` },
    topTargeted ? { l: t("mostTargeted"), v: `${topTargeted.players.map(who).join(L.isAr ? " و" : " & ")}${sep}${times(topTargeted.count)}` } : null,
  ].filter(Boolean);

  function share() {
    const lines = [t("shareRecap"), ...rows.map((r) => `${r.l}: ${r.v}`)].join("\n");
    try {
      if (navigator.share) {
        navigator.share({ text: lines });
      } else {
        navigator.clipboard.writeText(lines);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {}
  }

  return (
    <div className="mt-6 mx-auto max-w-xs hr-26 overflow-hidden hstart hilla-pop" style={{ background: CREAM, boxShadow: `0 0 0 2px ${GOLD}, 0 18px 40px -16px rgba(60,30,10,.45)` }}>
      <div className="px-4 pb-4 pt-4">
        <div className="display-font font-bold mb-1 text-center tsz-20" style={{ color: BRAND }}>
          {t("recap")}
        </div>
        {rows.map((r, i) => (
          <div
            key={i}
            className={`flex justify-between items-baseline gap-2 ${r.hero ? "py-1.5" : "py-1"}`}
            style={{ color: INK, borderBottom: i < rows.length - 1 ? `1px solid ${INK}14` : "none" }}
          >
            <span className={r.hero ? "tsz-13 font-semibold" : "tsz-12"} style={{ color: r.hero ? BRAND : `${INK}99` }}>
              {r.l}
            </span>
            <span className={`font-bold hend ${r.hero ? "tsz-15" : "tsz-13"}`} style={{ color: r.hero ? BRAND : INK }}>
              {r.v}
            </span>
          </div>
        ))}
        <button onClick={share} className={`w-full mt-3 py-2.5 tsz-13 flex items-center justify-center gap-1.5 ${btn}`} style={btnPrimary}>
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? t("copied") : t("share")}
        </button>
      </div>
    </div>
  );
}

// F9 — spectator reaction strip: shown instead of the full-screen modal to anyone who can't
// intervene (not the target, holds no لا ما تقدر). Gold line drains in real time — the negative
// animation-delay syncs it to startedAt, so polling re-renders never restart it.
function ReactionStrip({ pa, players, windowMs }) {
  const { t, tb, L } = useI18n();
  if (!pa) return null;
  const target = players.find((p) => p.id === pa.targetId);
  const startedAt = typeof pa.startedAt === "number" ? pa.startedAt : Date.now();
  const elapsed = Math.max(0, Math.min(windowMs, Date.now() - startedAt));
  return (
    <div className="fixed left-0 right-0 hz-60 pointer-events-none px-3" dir={L.dir} style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}>
      <div className="mx-auto max-w-md rounded-2xl overflow-hidden shadow-lg flex items-center gap-2 hpad-e3 hilla-pop" style={{ background: `${INK}ee` }}>
        <ActionThumb type={pa.actionType} size={40} radius={0} />
        <div className="flex-1 py-1.5 tsz-12 font-semibold" style={{ color: CREAM }}>
          {tb("spectator", { actor: pa.actorName, action: L.action(pa.actionType), target: target?.name }, { color: GOLD })}
        </div>
      </div>
      <div className="mx-auto max-w-md px-3">
        <div style={{ height: 3, background: `${CREAM}22` }}>
          <div style={{ height: 3, background: GOLD, animation: `hilla-strip ${windowMs / 1000}s linear forwards`, animationDelay: `-${elapsed}ms` }} />
        </div>
      </div>
    </div>
  );
}

// F10 — cultural hint card: appears near the bottom after the player places an item, teaching
// what the piece actually is. Limited to the first few plays per game so it never nags.
function EduToast({ data }) {
  const { t, tb, L } = useI18n();
  if (!data) return null;
  const info = ITEM_INFO[data.name];
  return (
    <div
      dir={L.dir}
      className="fixed left-1/2 hz-58 w-80 hmaxw-92 rounded-2xl shadow-xl pointer-events-none p-2.5 flex items-center gap-3"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)", background: CREAM, boxShadow: `0 0 0 1.5px ${GOLD}, 0 16px 30px -12px rgba(60,30,10,.5)`, animation: "hilla-edu 5s ease-out forwards" }}
    >
      {info && <ItemCard card={{ id: "edu", name: data.name, region: info.region, rarity: info.rarity }} size={64} />}
      <div className="flex-1 min-w-0 hstart">
        <div className="tsz-13 font-bold" style={{ color: info?.color || BRAND }}>
          {L.item(data.name)}
          {info && <span className="font-medium tsz-11 hms-1" style={{ color: `${INK}77` }}>· {L.region(info.region)}</span>}
        </div>
        <div className="serif-text tsz-15 leading-snug" style={{ color: INK }}>
          {L.itemDesc(data.name) || data.text}
        </div>
      </div>
    </div>
  );
}

// F7 — iPhone haptics. iOS Safari has no navigator.vibrate; the one semi-official path is the
// haptic that fires when an <input type="checkbox" switch> toggles (iOS 17.4+). We keep a hidden
// switch and click it. Android falls back to navigator.vibrate. Everything is wrapped in
// try/catch and degrades to a silent no-op — zero risk to gameplay.
function useIosHaptic() {
  const ref = useRef(null);
  // pattern: ms number or a vibrate() pattern array. iOS can't do patterns, so each "on" pulse
  // becomes one switch tick, 160ms apart.
  const fire = useCallback((pattern = 35) => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(pattern);
        return;
      }
      const pulses = Array.isArray(pattern) ? Math.ceil(pattern.length / 2) : 1;
      for (let i = 0; i < pulses; i++) setTimeout(() => ref.current?.click(), i * 160);
    } catch {}
  }, []);
  const node = (
    <label aria-hidden="true" style={{ position: "fixed", top: -100, left: -100, opacity: 0, pointerEvents: "none" }}>
      <input type="checkbox" ref={ref} readOnly {...{ switch: "" }} />
    </label>
  );
  return [fire, node];
}

/* Turn alert: a short two-note chime plus a stronger buzz when your turn starts. The chime is
   synthesized with Web Audio (no audio file to load). On iOS the audio session is set to "ambient"
   so it respects the silent switch. On/off lives in the ☰ menu and is saved per device. */
const TURN_SOUND_STORE = "hulla-turn-sound";
let turnAudioCtx = null;
function turnAudio() {
  try {
    if (!turnAudioCtx) {
      const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return null;
      try {
        if (navigator.audioSession) navigator.audioSession.type = "ambient";
      } catch {}
      turnAudioCtx = new AC();
    }
    return turnAudioCtx;
  } catch {
    return null;
  }
}
// Browsers only allow audio after a user gesture, so the context is resumed on the first tap.
function unlockTurnAudio() {
  const ctx = turnAudio();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
}
function playTurnChime() {
  const ctx = turnAudio();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const t0 = ctx.currentTime + 0.02;
    [
      [784, 0],
      [1175, 0.13],
    ].forEach(([freq, dt]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + dt);
      gain.gain.exponentialRampToValueAtTime(0.22, t0 + dt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0 + dt);
      osc.stop(t0 + dt + 0.35);
    });
  } catch {}
}
function loadTurnSound() {
  try {
    return window.localStorage.getItem(TURN_SOUND_STORE) !== "off";
  } catch {
    return true;
  }
}

function CountdownRing({ pendingActionId, startedAt, size = 56, windowSec = BLOCK_WINDOW_SEC, windowMs: windowMsProp, className = "mx-auto mb-2" }) {
  const safeStart = typeof startedAt === "number" ? startedAt : Date.now();
  const windowMs = typeof windowMsProp === "number" ? windowMsProp : windowSec * 1000;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const iv = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(iv);
  }, [pendingActionId]);
  const elapsed = now - safeStart;
  const remaining = Math.ceil(Math.max(0, windowMs - elapsed) / 1000);
  const r = (size - 6) / 2;
  const circumference = 2 * Math.PI * r;
  const dashoffset = Math.max(0, Math.min(circumference, (elapsed / windowMs) * circumference));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} style={{ display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill={CREAM} stroke={`${INK}14`} strokeWidth="3.5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={remaining <= 3 ? BRAND : GOLD}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashoffset}
        style={{ transform: "rotate(-90deg)", transformOrigin: `${size / 2}px ${size / 2}px`, transition: "stroke .3s" }}
      />
      <text
        x={size / 2}
        y={size / 2}
        dy="0.36em"
        textAnchor="middle"
        fontSize={size * 0.36}
        fontWeight="700"
        fill={remaining <= 3 ? BRAND : INK}
        fontFamily="IBM Plex Sans Arabic, sans-serif"
      >
        {remaining}
      </text>
    </svg>
  );
}



// Saudi one-liners — sent through the same reactionEvent as the emoji, shown as a speech bubble.
const PHRASES = ["كفو!", "ظلم!", "يا زينه", "الله يعين", "ههههه"];

// Reaction FX layer — imperative Web Animations API particles (no per-frame React re-renders).
// Fixed to the viewport so it's unaffected by page scroll, and pointer-events-none so it never
// blocks play. `trigger` is the shared-state reactionEvent; each new id spawns one burst, and
// bursts stack rather than interrupting each other. Purely visual — never read by game logic.
function ReactionFX({ trigger, myId, isOnline }) {
  const { t, tb, L } = useI18n();
  const layerRef = useRef(null);
  const [tag, setTag] = useState(null);
  const [bubbles, setBubbles] = useState([]);
  const seenRef = useRef(new Set(trigger?.id ? [trigger.id] : []));

  useEffect(() => {
    if (!trigger || seenRef.current.has(trigger.id)) return;
    seenRef.current.add(trigger.id);

    // A phrase pops up as a speech bubble (with who said it) instead of raining particles.
    if (PHRASES.includes(trigger.emoji)) {
      const mine = isOnline ? trigger.byId === myId : true;
      const b = {
        id: trigger.id,
        text: trigger.emoji,
        by: mine ? t("you") : trigger.byName,
        small: !!trigger.single,
        dx: Math.round(-70 + Math.random() * 140),
        top: 28 + Math.random() * 14,
        tilt: (-4 + Math.random() * 8).toFixed(1),
      };
      setBubbles((list) => [...list.slice(-3), b]);
      const tm = setTimeout(() => setBubbles((list) => list.filter((x) => x.id !== b.id)), 2500);
      return () => clearTimeout(tm);
    }

    const layer = layerRef.current;
    if (!layer) return;
    const emoji = trigger.emoji;
    const amount = trigger.single ? 1 : 12 + Math.floor(Math.random() * 5);

    for (let i = 0; i < amount; i++) {
      const particle = document.createElement("span");
      particle.textContent = emoji;

      const x = 5 + Math.random() * 90;
      const size = 30 + Math.random() * 24;
      const drift = -35 + Math.random() * 70;
      const rotation = -25 + Math.random() * 50;
      const duration = 1100 + Math.random() * 600;
      const delay = i * 45 + Math.random() * 80;

      Object.assign(particle.style, {
        position: "absolute",
        left: `${x}%`,
        top: "-80px",
        fontSize: `${size}px`,
        // display:block + roomy line-height matter here: an inline span with line-height 1 gets
        // rasterized to a box tighter than the emoji glyph once `filter` applies, which visibly
        // slices the top off the emoji in WebKit.
        display: "block",
        lineHeight: "1.35",
        pointerEvents: "none",
        willChange: "transform, opacity",
        filter: "drop-shadow(0 3px 5px rgba(0,0,0,.15))",
      });

      layer.appendChild(particle);

      particle.animate(
        [
          { transform: "translate3d(0, -20px, 0) scale(.5)", opacity: 0 },
          {
            transform: `translate3d(${drift * 0.25}px, 50px, 0) scale(1.2) rotate(${rotation * 0.25}deg)`,
            opacity: 1,
            offset: 0.15,
          },
          {
            transform: `translate3d(${drift}px, 75vh, 0) scale(1) rotate(${rotation}deg)`,
            opacity: 1,
            offset: 0.82,
          },
          {
            transform: `translate3d(${drift * 1.15}px, 90vh, 0) scale(.8) rotate(${rotation * 1.2}deg)`,
            opacity: 0,
          },
        ],
        { duration, delay, easing: "cubic-bezier(.2,.75,.25,1)", fill: "forwards" }
      );

      setTimeout(() => particle.remove(), duration + delay + 100);
    }

    // Who sent it — shown briefly so it's clear, then fades on its own.
    const mine = isOnline ? trigger.byId === myId : true;
    setTag({ id: trigger.id, text: `${emoji} ${mine ? t("you") : trigger.byName}` });
    const tm = setTimeout(() => setTag(null), 2600);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger?.id]);

  return (
    <>
      <div ref={layerRef} className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 9990 }} />
      {bubbles.map((b) => (
        <div
          key={b.id}
          className="fixed pointer-events-none"
          style={{ left: "50%", top: `${b.top}%`, zIndex: 9992, marginLeft: b.dx, transform: "translateX(-50%)" }}
        >
          <div className="hilla-bubble" style={{ "--tilt": `${b.tilt}deg` }}>
            <div
              className="relative text-center"
              style={{
                background: CREAM,
                borderRadius: 22,
                padding: b.small ? "6px 16px 8px" : "8px 22px 10px",
                boxShadow: `0 0 0 2px ${GOLD}, 0 14px 30px -10px rgba(60,30,10,.5)`,
              }}
            >
              <div className="tsz-11 font-semibold whitespace-nowrap" style={{ color: `${INK}88` }}>
                {b.by}
              </div>
              <div className="display-font font-bold leading-none whitespace-nowrap" style={{ color: BRAND, fontSize: b.small ? 26 : 36 }}>
                {L.phrase(b.text)}
              </div>
              <span
                className="absolute left-1/2"
                style={{ bottom: -6, width: 12, height: 12, marginLeft: -6, background: CREAM, transform: "rotate(45deg)", boxShadow: `2px 2px 0 0 ${GOLD}` }}
              />
            </div>
          </div>
        </div>
      ))}
      {tag && (
        <div
          key={tag.id}
          className="fixed left-1/2 px-2.5 py-1 rounded-full font-bold whitespace-nowrap tsz-11 pointer-events-none"
          style={{
            top: "80%",
            zIndex: 9992,
            background: `${INK}dd`,
            color: CREAM,
            animation: "hilla-reactor-tag 2.6s ease-out forwards",
          }}
        >
          {tag.text}
        </div>
      )}
    </>
  );
}

// A reaction also sits above the sender's own seat for 5 seconds, so it's clear who said what.
// Rendered fixed to the viewport (measured from the seat) so the scrolling seat row never clips it.
const SEAT_REACT_MS = 5000;

function SeatBubble({ anchor, text }) {
  const { t, tb, L } = useI18n();
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (!anchor) return;
    const update = () => {
      const r = anchor.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const iv = setInterval(update, 250); // follows the seat row if it scrolls sideways
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      clearInterval(iv);
    };
  }, [anchor]);
  if (!pos) return null;
  const isPhrase = PHRASES.includes(text);
  return (
    <div className="fixed pointer-events-none" style={{ left: pos.x, top: pos.y, zIndex: 9993, transform: "translate(-50%, -100%)" }}>
      <div className="hilla-seatbubble" style={{ marginBottom: 2 }}>
        <div
          className="relative flex items-center justify-center whitespace-nowrap"
          style={{
            background: CREAM,
            borderRadius: 16,
            padding: isPhrase ? "4px 12px 5px" : "2px 9px 3px",
            minWidth: 34,
            boxShadow: `0 0 0 1.5px ${GOLD}, 0 8px 18px -8px rgba(60,30,10,.5)`,
          }}
        >
          <span className={isPhrase ? "font-bold tsz-13" : "text-xl leading-snug"} style={{ color: BRAND }}>
            {L.phrase(text)}
          </span>
          <span
            className="absolute left-1/2"
            style={{ bottom: -5, width: 10, height: 10, marginLeft: -5, background: CREAM, transform: "rotate(45deg)", boxShadow: `1.5px 1.5px 0 0 ${GOLD}` }}
          />
        </div>
      </div>
    </div>
  );
}

// Floating reaction button, pinned bottom-left of the viewport. Single tap opens a small picker:
// Saudi phrases stacked as pills, with the emoji in one row underneath, right above the button.
function ReactionButton({ onReact }) {
  const { t, tb, L } = useI18n();
  const [open, setOpen] = useState(false);
  const pick = (v) => {
    onReact(v);
    setOpen(false);
  };
  return (
    <>
      {open && <div className="fixed inset-0" style={{ zIndex: 9990 }} onClick={() => setOpen(false)} />}
      <div dir="ltr" className="fixed left-4 bottom-4 flex flex-col-reverse items-start gap-2.5" style={{ zIndex: 9991 }}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-full flex items-center justify-center transition-transform active:scale-90 p-0"
          style={{
            width: 52,
            height: 52,
            minWidth: 52,
            minHeight: 52,
            flex: "0 0 auto",
            background: MAROON,
            color: CREAM,
            boxShadow: "0 2px 6px rgba(0,0,0,.16)",
            opacity: open ? 1 : 0.82,
          }}
          title={t("reactions")}
        >
          {open ? <X className="w-5 h-5" /> : <Smile className="w-5 h-5" />}
        </button>
        {open && (
          <div
            dir={L.dir}
            className="hr-22 p-2.5"
            style={{
              width: 236,
              background: CREAM,
              boxShadow: `0 0 0 1.5px ${GOLD}, 0 14px 30px -12px rgba(0,0,0,.35)`,
              transformOrigin: "0% 100%",
              animation: "hilla-pop .2s cubic-bezier(.2,.9,.3,1.15) backwards",
            }}
          >
            <div className="flex flex-wrap gap-1.5 justify-center">
              {PHRASES.map((ph) => (
                <button
                  key={ph}
                  onClick={() => pick(ph)}
                  className="rounded-full font-bold tsz-13 active:scale-95 transition-transform whitespace-nowrap"
                  style={{ padding: "5px 12px", background: `${BRAND}0f`, color: BRAND }}
                >
                  {L.phrase(ph)}
                </button>
              ))}
            </div>
            <div className="h-px my-2" style={{ background: `${INK}14` }} />
            <div dir="ltr" className="flex justify-between px-1">
              {REACTIONS.map((e) => (
                <button key={e} onClick={() => pick(e)} className="text-2xl leading-none p-1 active:scale-90 transition-transform">
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}


function BlockFlashToast({ data }) {
  const { t, tb, L } = useI18n();
  if (!data) return null;
  return (
    <div
      className="fixed left-1/2 hz-65 hpad-se py-2 rounded-2xl tsz-13 font-bold pointer-events-none shadow-2xl flex items-center gap-2.5 whitespace-nowrap"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 4rem)", background: "#961E21", color: CREAM, boxShadow: `0 0 0 2px ${GOLD}, 0 18px 34px -12px rgba(0,0,0,.5)`, animation: "hilla-block-flash 4s ease-out forwards" }}
    >
      <ActionThumb type="block" size={40} radius={10} />
      <span>
        {t("blocked", { blocker: data.blockerName, actor: data.actorName })}
      </span>
    </div>
  );
}

const cardsWord = (n) => (n === 1 ? "الكرت" : n === 2 ? "الكرتين" : n <= 10 ? `${n} كروت` : `${n} كرت`);


// Production: which log line becomes the quiet "last move" line under the table (turn-aware,
// prefers the actual play over the generic "ended turn" entry).
const MOVE_TOAST_PRIORITY = { noPlay: 1, play: 2 };


function getInsertedLogEntries(prevLog, nextLog) {
  if (!Array.isArray(prevLog) || prevLog.length === 0) return [];
  if (!Array.isArray(nextLog) || nextLog.length === 0) return [];
  const maxOverlap = Math.min(prevLog.length, nextLog.length);
  for (let overlap = maxOverlap; overlap >= 0; overlap--) {
    let matches = true;
    for (let i = 0; i < overlap; i++) {
      if (nextLog[nextLog.length - overlap + i] !== prevLog[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return nextLog.slice(0, nextLog.length - overlap);
  }
  return nextLog;
}

function parseTurnEndActor(msg) {
  const match = msg.match(/^(.+?) أنهى دوره\.$/);
  return match ? match[1] : null;
}

function parsePlayToast(msg) {
  if (!msg) return null;

  const itemMatch = msg.match(/^(.+?) وضع: /);
  if (itemMatch) return { actorName: itemMatch[1], text: msg, priority: MOVE_TOAST_PRIORITY.play };

  const actionStartPatterns = [
    /^(.+?) استخدم اقدع على /,
    /^(.+?) بادل كروت مع /,
    /^(.+?) لعب ثبّت الحَلّة\.$/,
    /^(.+?) فتّش الصندوق\.$/,
    /^(.+?) أضاف ".+?" من فتّش الصندوق\.$/,
  ];
  for (const pattern of actionStartPatterns) {
    const match = msg.match(pattern);
    if (match) return { actorName: match[1], text: msg, priority: MOVE_TOAST_PRIORITY.play };
  }

  const stealMatch = msg.match(/^.+? فزع من (.+?) وأخذ /);
  if (stealMatch) return { actorName: stealMatch[1], text: msg, priority: MOVE_TOAST_PRIORITY.play };

  const blockMatch = msg.match(/^(.+?) استخدم لا ما تقدر! /);
  if (blockMatch) return { actorName: blockMatch[1], text: msg, priority: MOVE_TOAST_PRIORITY.play };

  return null;
}

function turnToastKey(turnSerial, actorName) {
  return `${turnSerial}:${actorName}`;
}

function pickPriorityMoveToast(entries, currentGame, prevGame, shownTurnToastKeys) {
  const currentTurn = currentGame.turnSerial ?? 0;
  const previousTurn = Math.max(0, currentTurn - 1);
  const endedActors = new Map();

  for (const entry of entries) {
    const actorName = parseTurnEndActor(entry);
    if (actorName && !endedActors.has(actorName)) endedActors.set(actorName, entry);
  }

  for (const entry of entries) {
    const candidate = parsePlayToast(entry);
    if (!candidate) continue;
    const turnKey = turnToastKey(endedActors.has(candidate.actorName) ? previousTurn : currentTurn, candidate.actorName);
    if (shownTurnToastKeys.has(turnKey)) continue;
    return { ...candidate, turnKey };
  }

  for (const [actorName] of endedActors) {
    const turnKey = turnToastKey(previousTurn, actorName);
    if (shownTurnToastKeys.has(turnKey)) continue;
    const prevActor = prevGame?.players?.[prevGame.currentPlayerIndex];
    const hadActionPlay = prevActor?.name === actorName && (prevGame?.turnSerial ?? null) === previousTurn && !!prevGame?.actionUsedThisTurn;
    if (hadActionPlay) continue;
    return {
      actorName,
      priority: MOVE_TOAST_PRIORITY.noPlay,
      text: `${actorName} تخطّى دوره.`,
      turnKey,
    };
  }

  return null;
}

// Optional post-game survey (V2 analytics). Shown only on the winner screen,
// fully skippable, fire-and-forget — can never interrupt or break gameplay.
function PostGameSurvey({ game, myId, isOnline }) {
  const { t } = useI18n();
  const [fun, setFun] = useState(0);
  const [clarity, setClarity] = useState(0);
  const [again, setAgain] = useState(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [hidden, setHidden] = useState(false);
  if (!game.analyticsId || hidden) return null;
  const seat = isOnline ? game.players.find((p) => p.id === myId && !p.isBot) : game.players.find((p) => !p.isBot);
  if (!seat) return null;
  if (sent)
    return (
      <div className="mt-6 mx-auto max-w-sm rounded-2xl border-2 p-4 text-center font-bold" style={{ background: CREAM2, borderColor: GOLD, color: MAROON }}>
        {t("svThanks")}
      </div>
    );
  const Stars = ({ value, onPick }) => (
    <div className="flex gap-1 justify-center" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onPick(n === value ? 0 : n)} className="text-xl" style={{ opacity: n <= value ? 1 : 0.25 }}>
          ⭐
        </button>
      ))}
    </div>
  );
  return (
    <div className="mt-6 mx-auto max-w-sm rounded-2xl border-2 p-4 text-center" style={{ background: CREAM2, borderColor: GOLD }}>
      <div className="flex justify-between items-center mb-2">
        <div className="font-black" style={{ color: MAROON }}>
          {t("svTitle")}
        </div>
        <button onClick={() => setHidden(true)} className="text-xs" style={{ color: `${INK}66` }}>
          {t("svSkip")}
        </button>
      </div>
      <div className="text-xs mb-1" style={{ color: `${INK}88` }}>
        {t("svFun")}
      </div>
      <Stars value={fun} onPick={setFun} />
      <div className="text-xs mb-1 mt-2" style={{ color: `${INK}88` }}>
        {t("svClear")}
      </div>
      <Stars value={clarity} onPick={setClarity} />
      <div className="text-xs mb-1 mt-2" style={{ color: `${INK}88` }}>
        {t("svAgain")}
      </div>
      <div className="flex gap-2 justify-center mb-2">
        <button
          onClick={() => setAgain(again === true ? null : true)}
          className="px-3 py-1 rounded-lg border-2 text-sm font-bold"
          style={again === true ? { background: TEAL, color: CREAM, borderColor: TEAL } : { color: TEAL, borderColor: `${TEAL}66` }}
        >
          {t("svYes")}
        </button>
        <button
          onClick={() => setAgain(again === false ? null : false)}
          className="px-3 py-1 rounded-lg border-2 text-sm font-bold"
          style={again === false ? { background: MAROON, color: CREAM, borderColor: MAROON } : { color: MAROON, borderColor: `${MAROON}66` }}
        >
          {t("svNo")}
        </button>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, 280))}
        placeholder={t("svComment")}
        rows={2}
        className="w-full rounded-lg px-2 py-1 text-xs border-2 focus:outline-none mb-2"
        style={{ background: CREAM, color: INK, borderColor: `${MAROON}33` }}
      />
      <button
        onClick={() => {
          sendFeedback({
            gameId: game.analyticsId,
            playerId: seat.id,
            clientPid: getClientPid(),
            fun: fun || null,
            clarity: clarity || null,
            playAgain: again,
            comment,
          });
          setSent(true);
        }}
        disabled={!fun && !clarity && again === null && !comment.trim()}
        className="px-5 py-2 rounded-lg font-bold disabled:opacity-30"
        style={{ background: MAROON, color: CREAM }}
      >
        {t("svSend")}
      </button>
    </div>
  );
}

function GameBoard({ game, myId, isOnline, isHost, roomCode, roomUpdatedAt, onClaimTimeout, onDeclineBlock, dispatch, onExit, onGoHome }) {
  const { t, tb, L } = useI18n();
  const [selected, setSelected] = useState([]);
  const [needTarget, setNeedTarget] = useState(null);
  const [giveStep, setGiveStep] = useState(null);
  const [revealed, setRevealed] = useState(isOnline ? true : false);
  const [errMsg, setErrMsg] = useState("");
  const [sortByRegion, setSortByRegion] = useState(false);
  const [moveToast, setMoveToast] = useState(null);
  const [eduToast, setEduToast] = useState(null);
  const eduCountRef = useRef(0);
  const [haptic, hapticNode] = useIosHaptic();
  const lastHapticTurnRef = useRef(-1);
  const [bigText, setBigText] = useState(false);
  const [turnSound, setTurnSound] = useState(loadTurnSound);
  useEffect(() => {
    try {
      window.localStorage.setItem(TURN_SOUND_STORE, turnSound ? "on" : "off");
    } catch {}
  }, [turnSound]);
  useEffect(() => {
    const unlock = () => unlockTurnAudio();
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const seatRefs = useRef({});
  // Seat row follows the turn: when it overflows (many players), it glides to whoever's turn it is.
  // If the player is touching / dragging / flicking it, we leave it alone; once they let go and the
  // row settles, it glides back to the active seat if that seat isn't fully on screen.
  const seatRowRef = useRef(null);
  const seatTouchRef = useRef(false);
  const seatIdleTimerRef = useRef(null);
  const seatProgrammaticUntilRef = useRef(0);
  const seatUserScrollAtRef = useRef(0);
  const activeSeatId = game.players[game.currentPlayerIndex]?.id;

  const centerActiveSeat = useCallback(
    (onlyIfHidden) => {
      const row = seatRowRef.current;
      const el = seatRefs.current[activeSeatId];
      if (!row || !el || row.scrollWidth <= row.clientWidth + 1) return;
      const r = row.getBoundingClientRect();
      const e = el.getBoundingClientRect();
      const fullyVisible = e.left >= r.left + 4 && e.right <= r.right - 4;
      if (onlyIfHidden && fullyVisible) return;
      const delta = e.left + e.width / 2 - (r.left + r.width / 2);
      if (Math.abs(delta) < 2) return;
      seatProgrammaticUntilRef.current = Date.now() + 700;
      try {
        row.scrollBy({ left: delta, behavior: "smooth" });
      } catch {
        row.scrollLeft += delta;
      }
    },
    [activeSeatId]
  );

  // New turn → glide to the active seat (unless the player is holding the row right now).


  const scheduleSeatReturn = useCallback(() => {
    clearTimeout(seatIdleTimerRef.current);
    seatIdleTimerRef.current = setTimeout(() => {
      if (seatTouchRef.current) return;
      if (Date.now() - (seatUserScrollAtRef.current || 0) < 700) return scheduleSeatReturn(); // still gliding
      centerActiveSeat(true);
    }, 900);
  }, [centerActiveSeat]);
  useEffect(() => {
    if (seatTouchRef.current || Date.now() - (seatUserScrollAtRef.current || 0) < 900) {
      scheduleSeatReturn();
      return;
    }
    const t0 = setTimeout(() => centerActiveSeat(false), 60);
    return () => clearTimeout(t0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSeatId, centerActiveSeat]);
  useEffect(() => () => clearTimeout(seatIdleTimerRef.current), []);

  // Touch: the finger is "down" from touchstart until touchend/touchcancel. We deliberately ignore
  // pointercancel here — mobile browsers fire it the moment native panning takes over, while the
  // finger is still on the glass, which used to make the row fight the user.
  const seatRowHandlers = {
    onPointerDown: (e) => {
      if (e.pointerType !== "mouse") return;
      seatTouchRef.current = true;
      clearTimeout(seatIdleTimerRef.current);
    },
    onPointerUp: (e) => {
      if (e.pointerType !== "mouse") return;
      seatTouchRef.current = false;
      scheduleSeatReturn();
    },
    onTouchStart: () => {
      seatTouchRef.current = true;
      clearTimeout(seatIdleTimerRef.current);
    },
    onTouchEnd: (e) => {
      if (e.touches && e.touches.length > 0) return; // another finger still down
      seatTouchRef.current = false;
      scheduleSeatReturn();
    },
    onTouchCancel: () => {
      seatTouchRef.current = false;
      scheduleSeatReturn();
    },
    // flicks / wheel / momentum: each user scroll event pushes the return back
    onScroll: () => {
      if (Date.now() < seatProgrammaticUntilRef.current) return;
      seatUserScrollAtRef.current = Date.now();
      clearTimeout(seatIdleTimerRef.current);
      if (!seatTouchRef.current) scheduleSeatReturn();
    },
  };
  const coordRef = useRef(null);
  const [coordHidden, setCoordHidden] = useState(false);
  useEffect(() => {
    const el = coordRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => setCoordHidden(!e.isIntersecting && e.boundingClientRect.top < 0),
      { threshold: 0, rootMargin: "-40px 0px 0px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [!!game.winner]);
  const [seatReacts, setSeatReacts] = useState({}); // playerId -> { id, text }
  const seenReactRef = useRef(game.reactionEvent?.id || null);
  useEffect(() => {
    const ev = game.reactionEvent;
    if (!ev || ev.id === seenReactRef.current) return;
    seenReactRef.current = ev.id;
    setSeatReacts((m) => ({ ...m, [ev.byId]: { id: ev.id, text: ev.emoji } }));
    const tm = setTimeout(
      () => setSeatReacts((m) => (m[ev.byId]?.id === ev.id ? Object.fromEntries(Object.entries(m).filter(([k]) => k !== ev.byId)) : m)),
      SEAT_REACT_MS
    );
    return () => clearTimeout(tm);
  }, [game.reactionEvent?.id]);
  const cardSize = useCardSize();
  const vw = useViewportWidth();
  const wide = vw >= 640;

  const current = game.players[game.currentPlayerIndex];
  // Local game with a single human against bots: that human's hand stays on screen the whole
  // time (just inactive during bot turns) instead of disappearing behind a "thinking" panel.
  const humans = game.players.filter((p) => !p.isBot);
  const soloHuman = !isOnline && humans.length === 1 ? humans[0] : null;
  const viewer = isOnline ? game.players.find((p) => p.id === myId) || current : soloHuman || current;
  const isMyTurn = isOnline ? current.id === myId : soloHuman ? current.id === soloHuman.id : true;

  // Exactly one client is allowed to run automated (bot) moves: the single local device in
  // local mode, or the host in online mode. Everyone else just watches through polling.
  const botExecutor = !isOnline || !!isHost;
  const lastBotTurnRef = useRef(null);
  const settledRef = useRef(null);
  const prevToastGameRef = useRef(game);
  const prevToastLogRef = useRef(Array.isArray(game.log) ? game.log : []);
  const shownTurnToastKeysRef = useRef(new Set());
  const toastSeqRef = useRef(0);
  const burstsLeftRef = useRef(2);
  const reducedUntilRef = useRef(0);
  const lastSingleAtRef = useRef(0);

  // Stale-replay guard for BlockFlashToast: capture the blockEvent id present
  // at mount (e.g. after a refresh/reconnect, where shared state still holds
  // the last block of the game) and only show toasts for ids that arrive
  // later. Purely local — never clears or writes shared game state.
  const initialBlockIdRef = useRef(game.blockEvent?.id ?? null);
  const freshBlockEvent = game.blockEvent && game.blockEvent.id !== initialBlockIdRef.current ? game.blockEvent : null;

  useEffect(() => {
    prevToastGameRef.current = game;
    prevToastLogRef.current = Array.isArray(game.log) ? game.log : [];
    shownTurnToastKeysRef.current = new Set();
    setMoveToast(null);
  }, [game.analyticsId]);

  useEffect(() => {
    const prevGame = prevToastGameRef.current;
    const prevLog = prevToastLogRef.current;
    const nextLog = Array.isArray(game.log) ? game.log : [];
    prevToastGameRef.current = game;
    prevToastLogRef.current = nextLog;
    if (!prevGame || prevGame.analyticsId !== game.analyticsId) return;
    if (!prevLog.length || !nextLog.length) return;
    const inserted = getInsertedLogEntries(prevLog, nextLog);
    if (!inserted.length) return;
    const nextToast = pickPriorityMoveToast(inserted, game, prevGame, shownTurnToastKeysRef.current);
    if (!nextToast) return;
    shownTurnToastKeysRef.current.add(nextToast.turnKey);
    toastSeqRef.current += 1;
    setMoveToast({ id: toastSeqRef.current, text: nextToast.text });
  }, [game]);

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
      coord_card_id: coord ? coord.id || null : null,
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
    const turnN = prev.turnSerial ?? 0;
    const prevBot = prev.players.find((p) => p.id === bot.id);
    const nextBot = next.players.find((p) => p.id === bot.id);
    if (!prevBot || !nextBot) return [];
    const nextIds = new Set(nextBot.hand.map((c) => c.id));
    const removed = prevBot.hand.filter((c) => !nextIds.has(c.id));
    const playedItems = removed.filter((c) => c.kind === "item");
    const playedActions = removed.filter((c) => c.kind === "action");
    const events = [
      mkEvent(prev, "bot_move", bot, {
        event_id: `${gid}-t${turnN}-bot-${bot.id}`,
        cards_played_count: playedItems.length,
      }),
    ];
    if (playedItems.length > 0) {
      events.push(
        mkEvent(prev, "items_played", bot, {
          event_id: `${gid}-t${turnN}-items-${bot.id}`,
          cards_played_count: playedItems.length,
          items: playedItems.map((c) => ({ name: c.name, region: c.region, rarity: c.rarity, cid: c.id })),
        })
      );
    }
    playedActions.forEach((c) => {
      const pa = next.pendingAction;
      const target = pa && pa.actorId === bot.id ? next.players.find((p) => p.id === pa.targetId) : null;
      events.push(
        mkEvent(prev, "action_played", bot, {
          event_id: `${gid}-t${turnN}-action-${bot.id}-${c.actionType}`,
          action_type: c.actionType,
          payload: target ? { target_player_id: target.id, target_is_bot: !!target.isBot } : null,
        })
      );
    });
    if (playedItems.length === 0 && playedActions.length === 0) {
      events.push(
        mkEvent(prev, "turn_skipped", bot, {
          event_id: `${gid}-t${turnN}-skip-${bot.id}`,
          skip_reason: "bot_no_valid_move",
        })
      );
    }
    return events;
  }

  // Pseudonymous experience tracking: each client reports its own seat once
  // per game with a random localStorage-only id (no emails/IPs/fingerprints).
  // Local shared-screen games report the first human seat for the device.
  useEffect(() => {
    if (!game || !game.analyticsId) return;
    const pid = getClientPid();
    if (!pid) return;
    const seat = isOnline ? game.players.find((p) => p.id === myId && !p.isBot) : game.players.find((p) => !p.isBot);
    if (!seat) return;
    sendAnalyticsEvents([
      {
        event_id: `${game.analyticsId}-pid-${seat.id}`,
        game_id: game.analyticsId,
        room_code: roomCode || null,
        player_id: seat.id,
        player_name: seat.name,
        is_bot: false,
        event_type: "player_identity",
        payload: { client_pid: pid },
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.analyticsId]);

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
      const playable = findMatchingItems(cur.hand, game.currentCoord);
      events.push(
        mkEvent(game, "turn_started", cur, {
          event_id: `${game.analyticsId}-t${curTurn}-start`,
          payload: {
            hand_size: cur.hand.length,
            had_valid_move: playable.length > 0,
            ...(playable.length ? { playable_items: [...new Set(playable.map((c) => c.name))].slice(0, 12) } : {}),
          },
        })
      );
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
      // Losers' leftover cards + final standings — powers unload-rate,
      // stuck-with-losers and game-closeness metrics.
      const leftovers = game.players
        .filter((p) => p.id !== game.winner)
        .flatMap((p) => p.hand.filter((c) => c.kind === "item"))
        .map((c) => ({ name: c.name, region: c.region, rarity: c.rarity, cid: c.id }));
      events.push(
        mkEvent(game, "end_snapshot", null, {
          event_id: `${game.analyticsId}-end`,
          items: leftovers,
          payload: {
            standings: game.players.map((p) => ({
              player_id: p.id,
              is_bot: !!p.isBot,
              is_winner: p.id === game.winner,
              hand_size: p.hand.length,
            })),
          },
        })
      );
      sendGameFinished(game, roomCode || null);
    }
    if (events.length) track(events);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  useEffect(() => {
    if (!errMsg) return;
    const tm = setTimeout(() => setErrMsg(""), 3000);
    return () => clearTimeout(tm);
  }, [errMsg]);

  useEffect(() => {
    try {
      document.documentElement.style.fontSize = bigText ? "118%" : "";
    } catch {}
    return () => {
      try {
        document.documentElement.style.fontSize = "";
      } catch {}
    };
  }, [bigText]);

  useEffect(() => {
    const turnN = game.turnSerial ?? 0;
    const humanTurn = isOnline ? isMyTurn : current && !current.isBot;
    if (humanTurn && lastHapticTurnRef.current !== turnN && !game.winner) {
      lastHapticTurnRef.current = turnN;
      haptic([90, 70, 140]);
      if (turnSound) playTurnChime();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.turnSerial, isMyTurn]);

  useEffect(() => {
    const pa = game.pendingAction;
    if (!pa) return;
    const target = game.players.find((p) => p.id === pa.targetId);
    const meTargeted = isOnline ? target?.id === myId : target && !target.isBot;
    if (!meTargeted) return;
    haptic();
    const startedAt = typeof pa.startedAt === "number" ? pa.startedAt : Date.now();
    const warnIn = Math.max(0, pendingWindowMs(game) - 3000 - (Date.now() - startedAt));
    const tm = setTimeout(haptic, warnIn);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.pendingAction?.id]);

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
    const tm = setTimeout(() => {
      if (lastBotTurnRef.current === key) return;
      lastBotTurnRef.current = key;
      const next = botDecideTurn(game, cur.id);
      track(botTurnEvents(game, next, cur));
      dispatch(next);
    }, 900);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, botExecutor]);

  // LOCAL turn timer / inactive auto-skip (#26). If the active human doesn't act within the window
  // (30s normally, 3s once inactive), auto-skip their turn. Remaining time is derived from the
  // persisted turnStartedAt so re-renders never restart it. The active player's `inactive` flag is
  // a dependency so waking mid-turn cancels the short 3s timer and reschedules (#27 bug 2). Local
  // mode has a single authoritative client, so it just dispatches the skip directly.
  useEffect(() => {
    if (isOnline) return;
    if (game.winner || game.pendingAction || game.digOptions) return;
    const cur = game.players[game.currentPlayerIndex];
    if (!cur || cur.isBot) return;
    const startedAt = typeof game.turnStartedAt === "number" ? game.turnStartedAt : Date.now();
    const windowMs = cur.inactive ? INACTIVE_SKIP_MS : TURN_TIMEOUT_MS;
    const remaining = Math.max(0, windowMs - (Date.now() - startedAt));
    const wasInactive = cur.inactive;
    const tm = setTimeout(() => {
      const next = rTurnTimeout(game, cur.id);
      if (next === game) return; // stale-timer guard rejected it — nothing happened
      track([
        mkEvent(game, "turn_skipped", cur, {
          event_id: `${game.analyticsId}-t${game.turnSerial ?? 0}-timeout-${cur.id}`,
          // First miss vs inactive-mode repeat-skip: distinct reasons so one away player firing
          // a skip every 3s doesn't inflate the normal skip-rate metric.
          skip_reason: wasInactive ? "timeout_inactive" : "timeout",
        }),
      ]);
      dispatch(next);
    }, remaining);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, game.turnSerial, game.turnStartedAt, game.pendingAction, game.digOptions, game.players[game.currentPlayerIndex]?.inactive]);

  // ONLINE turn timer (#26), host-independent. Every connected client runs this and races to
  // "claim" the skip through a guarded server write (onClaimTimeout → /timeout CAS). The server
  // guards on the room version (updated_at) plus expected turnSerial/currentPlayerIndex/
  // turnStartedAt, so exactly one claim wins and any stale one — including one racing a legitimate
  // move that changed same-turn state without bumping turnSerial — is rejected. claimedTimeoutRef
  // stops this client from re-spamming the same turn fingerprint before its poll catches up.
  const claimedTimeoutRef = useRef(null);
  useEffect(() => {
    if (!isOnline) return;
    if (game.winner || game.pendingAction || game.digOptions) return;
    if (typeof roomUpdatedAt !== "string" || typeof game.turnStartedAt !== "number") return;
    const cur = game.players[game.currentPlayerIndex];
    if (!cur || cur.isBot) return;
    const windowMs = cur.inactive ? INACTIVE_SKIP_MS : TURN_TIMEOUT_MS;
    const remaining = Math.max(0, windowMs - (Date.now() - game.turnStartedAt));
    const wasInactive = cur.inactive;
    const fingerprint = `${game.turnSerial}:${game.currentPlayerIndex}:${game.turnStartedAt}:${roomUpdatedAt}`;
    const tm = setTimeout(async () => {
      if (claimedTimeoutRef.current === fingerprint) return;
      claimedTimeoutRef.current = fingerprint;
      const next = rTurnTimeout(game, cur.id);
      if (next === game) return; // not actually elapsed against the turn clock
      const expected = {
        updatedAt: roomUpdatedAt,
        turnSerial: game.turnSerial ?? 0,
        currentPlayerIndex: game.currentPlayerIndex,
        turnStartedAt: game.turnStartedAt,
      };
      const won = await onClaimTimeout?.(next, expected);
      // Only the client whose guarded write won logs the skip — no double-count across clients,
      // and normal vs inactive-mode skips stay distinct in analytics.
      if (won) {
        track([
          mkEvent(game, "turn_skipped", cur, {
            event_id: `${game.analyticsId}-t${game.turnSerial ?? 0}-timeout-${cur.id}`,
            skip_reason: wasInactive ? "timeout_inactive" : "timeout",
          }),
        ]);
      }
    }, remaining);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, roomUpdatedAt, game.turnSerial, game.turnStartedAt, game.pendingAction, game.digOptions, game.players[game.currentPlayerIndex]?.inactive]);

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
      const tm = setTimeout(
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
      return () => clearTimeout(tm);
    }

    const isResolver = !isOnline || (actor?.isBot ? !!isHost : pa.actorId === myId);
    if (!isResolver) return;
    const startedAt = typeof pa.startedAt === "number" ? pa.startedAt : Date.now();
    const elapsed = Date.now() - startedAt;
    // #58: once every human who could block has passed, resolve early (after a short read).
    const remaining = allHumanBlockersDeclined(game)
      ? Math.max(250, PASS_MIN_READ_MS - elapsed)
      : Math.max(0, pendingWindowMs(game) - elapsed);
    const tm = setTimeout(() => settlePendingAction(() => rResolvePendingAction(game)), remaining);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, isOnline, isHost, botExecutor]);

  // The player on this device who's been marked inactive (online: me; solo vs bots: the human;
  // pass-and-play: the human whose turn it is). Drives the "رجّعني نشط" banner.
  const inactiveMe = isOnline
    ? viewer && viewer.inactive
      ? viewer
      : null
    : soloHuman
    ? soloHuman.inactive
      ? soloHuman
      : null
    : current && !current.isBot && current.inactive
    ? current
    : null;
  function wakeMe() {
    if (!inactiveMe) return;
    const woken = rWakePlayer(game, inactiveMe.id);
    if (woken !== game) dispatch(woken);
  }

  function toggleSelect(cardId) {
    // Wake-on-touch (#27): merely tapping a card is proof of presence — clears inactive/missed
    // and restarts this turn's clock. rWakePlayer returns the game by reference when there's
    // nothing to clear, so we only dispatch on a real change.
    const woken = rWakePlayer(game, viewer.id);
    if (woken !== game) dispatch(woken);
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
    if (playedCards.length > 0 && eduCountRef.current < 4) {
      const info = ITEM_DESC[playedCards[0].name];
      if (info) {
        eduCountRef.current += 1;
        setEduToast({ id: `${playedCards[0].id}-${eduCountRef.current}`, name: playedCards[0].name, text: info });
      }
    }
    if (playedCards.length > 0) {
      track([
        mkEvent(game, "items_played", viewer, {
          event_id: `${game.analyticsId}-t${game.turnSerial ?? 0}-items-${viewer.id}`,
          cards_played_count: playedCards.length,
          items: playedCards.map((c) => ({ name: c.name, region: c.region, rarity: c.rarity, cid: c.id })),
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

  function sendReaction(emoji) {
    const me = isOnline ? viewer : game.players.find((p) => !p.isBot) || viewer;
    if (!me) return;
    const now = Date.now();

    if (reducedUntilRef.current && now >= reducedUntilRef.current) {
      reducedUntilRef.current = 0;
      burstsLeftRef.current = 2;
    }

    let single;
    if (!reducedUntilRef.current && burstsLeftRef.current > 0) {
      burstsLeftRef.current -= 1;
      single = false;
      if (burstsLeftRef.current === 0) reducedUntilRef.current = now + 10000;
    } else {
      if (now - lastSingleAtRef.current < 1000) return;
      lastSingleAtRef.current = now;
      single = true;
    }

    dispatch(rSendReaction(rWakePlayer(game, me.id), me.id, emoji, single));
  }

  function startAction(cardId) {
    if (game.actionUsedThisTurn) return;
    const card = viewer.hand.find((c) => c.id === cardId);
    if (!card) return;
    // لا ما تقدر is purely reactive — it's used from the incoming-action window, never as a turn action.
    if (card.actionType === "block") {
      if (canPlayLastBlock(game, viewer.id)) {
        track([
          mkEvent(game, "action_played", viewer, {
            event_id: `${game.analyticsId}-t${game.turnSerial ?? 0}-action-${viewer.id}-lastBlock`,
            action_type: "block",
            payload: { last_card: true },
          }),
        ]);
        dispatch(rPlayLastBlock(game, viewer.id));
        return;
      }
      setErrMsg(t("blockOnlyReactive"));
      return;
    }
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
      setNeedTarget(null);
      // nothing left to give (عطني وأعطيك was your last card): skip the picker
      if (!viewer.hand.some((c) => c.id !== card.id)) {
        const target = game.players.find((p) => p.id === targetId);
        track([
          mkEvent(game, "action_played", viewer, {
            event_id: `${game.analyticsId}-t${game.turnSerial ?? 0}-action-${viewer.id}-giveTake`,
            action_type: "giveTake",
            payload: { target_player_id: targetId, target_is_bot: !!target?.isBot },
          }),
        ]);
        dispatch(rDeclareGiveTake(game, viewer.id, card.id, targetId, []));
        return;
      }
      setGiveStep({ cardId: card.id, targetId });
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
      setErrMsg(t("noBlockCard", { name: blocker?.name || "" }));
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

  // Who sees the full pending-action sheet: the target, or anyone who can still block — unless
  // they've already chosen "لا، ما راح أستخدمه", in which case they drop to the spectator strip.
  const showPendingSheet = (() => {
    const pa = game.pendingAction;
    if (!pa) return false;
    const paTarget = game.players.find((p) => p.id === pa.targetId);
    const iAmTarget = isOnline ? paTarget?.id === myId : paTarget && !paTarget.isBot;
    const iCanBlock = isOnline ? eligibleBlockers.some((p) => p.id === myId) : eligibleBlockers.some((p) => !p.isBot);
    const iPassed = isOnline ? (pa.declinedIds || []).includes(myId) : allHumanBlockersDeclined(game);
    return (iAmTarget || iCanBlock) && !iPassed;
  })();

  function declineBlock() {
    if (isOnline) {
      if (game.pendingAction) onDeclineBlock?.(game.pendingAction.id);
      return;
    }
    // one shared device: passing means nobody here wants to use it
    const g = eligibleBlockers.filter((p) => !p.isBot).reduce((acc, p) => rDeclineBlock(acc, p.id), game);
    dispatch(g);
  }

  const winnerPlayer = game.winner ? game.players.find((p) => p.id === game.winner) : null;
  const topDiscard = game.discardPile.length ? game.discardPile[game.discardPile.length - 1] : null;
  const multiHumanLocal = !isOnline && humans.length > 1;
  const showPassScreen = multiHumanLocal && !current.isBot && !revealed;
  const showThinkingPanel = multiHumanLocal && current.isBot;
  const handActive = isMyTurn && !current.isBot;

  const itemCards = viewer.hand.filter((c) => c.kind === "item");
  const actionCards = viewer.hand.filter((c) => c.kind === "action");

  function renderItems() {
    if (itemCards.length === 0) {
      return (
        <div className="tsz-13 py-6 w-full text-center" style={{ color: `${INK}55` }}>
          {t("noClothing")}
        </div>
      );
    }
    const onPick = (id) => (handActive ? toggleSelect(id) : null);
    const node = (c, i) => (
      <div key={c.id} className="hilla-deal pt-4" style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}>
        <ItemCard card={c} size={cardSize} selected={selected.includes(c.id)} onClick={() => onPick(c.id)} />
      </div>
    );
    if (!sortByRegion) return itemCards.map(node);
    const sorted = sortItemsByRegion(itemCards);
    const nodes = [];
    let lastRegion = null;
    sorted.forEach((c, i) => {
      if (c.region !== lastRegion) {
        if (lastRegion !== null) nodes.push(<span key={`div-${c.region}`} className="self-stretch w-px my-4 flex-shrink-0" style={{ background: `${INK}22` }} />);
        lastRegion = c.region;
      }
      nodes.push(node(c, i));
    });
    return nodes;
  }

  // Turn banner text + timer, one line under the table.
  function renderTurnBanner() {
    if (game.pendingAction || game.digOptions) return null;
    if (current.isBot) {
      return (
        <div className="flex items-center gap-2 tsz-13 font-semibold" style={{ color: `${INK}88` }}>
          {t("thinking", { name: current.name })}
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full hilla-dot" style={{ background: GOLD_DK, animationDelay: `${i * 150}ms` }} />
            ))}
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2.5">
        {/* Online, only the active player sees the ring; everyone still runs the timeout CAS. */}
        {(!isOnline || isMyTurn) && (
          <CountdownRing
            pendingActionId={`turn-${game.turnSerial ?? 0}`}
            startedAt={game.turnStartedAt}
            size={38}
            windowMs={current.inactive ? INACTIVE_SKIP_MS : TURN_TIMEOUT_MS}
            className=""
          />
        )}
        <div className="tsz-14 font-bold hstart" style={{ color: isMyTurn ? BRAND : `${INK}88` }}>
          {current.inactive ? t("inactiveNow", { name: L.name(current.name) }) : isMyTurn ? t("yourTurn") : t("turnOf", { name: L.name(current.name) })}
        </div>
      </div>
    );
  }

  return (
    <div
      dir={L.dir}
      className="hilla-root min-h-screen w-full px-3 pb-24"
      style={{
        ...pageBg,
        paddingTop: "max(12px, calc(env(safe-area-inset-top) + 6px))",
        color: INK,
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
        "--tsz": bigText ? 1.18 : 1,
      }}
    >
      <GlobalFont />
      <div className="max-w-2xl mx-auto">
        {/* header */}
        <div className="flex items-center justify-between px-1 mb-2">
          <div className="flex items-center gap-2">
            <Wordmark height={30} />
            {isOnline && <Wifi className="w-4 h-4" style={{ color: `${INK}66` }} />}
          </div>
          <div className="flex items-center gap-2">
            {!winnerPlayer && (
              <span className="tsz-11 font-semibold px-2.5 py-1 rounded-full" style={{ background: `${INK}0d`, color: `${INK}88` }}>
                {t("round", { n: game.coordRounds ?? 1 })}
              </span>
            )}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-10 h-10 rounded-full flex items-center justify-center transition active:scale-95"
              style={menuOpen ? { background: INK, color: CREAM } : { background: CREAM, color: INK, boxShadow: "0 2px 8px -2px rgba(60,30,10,.3)" }}
              title={t("menu")}
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>

        <DiamondLattice thickness={10} />

        <EduToast key={eduToast?.id || "edu-none"} data={eduToast} />
        {hapticNode}
        <BlockFlashToast key={freshBlockEvent?.id || "none"} data={freshBlockEvent} />
        <ReactionFX trigger={game.reactionEvent} myId={myId} isOnline={isOnline} />
        {!winnerPlayer &&
          Object.entries(seatReacts).map(([pid, r]) => <SeatBubble key={r.id} anchor={seatRefs.current[pid]} text={r.text} />)}
        <ReactionButton onReact={sendReaction} />

        {winnerPlayer ? (
          <div className="mt-8 text-center">
            <Confetti />
            <div className="relative mx-auto mb-4 hilla-float" style={{ width: 120 }}>
              <CardBack size={120} tall style={{ boxShadow: "0 20px 40px -14px rgba(60,30,10,.6)" }} />
            </div>
            <div className="display-font font-bold leading-none" style={{ color: BRAND, fontSize: fs(46) }}>
              {(isOnline ? winnerPlayer.id === myId : soloHuman ? winnerPlayer.id === soloHuman.id : false) ? t("youWon") : t("wonName", { name: L.name(winnerPlayer.name) })}
            </div>
            <WinStats game={game} myId={myId} isOnline={isOnline} />
            <button onClick={onExit} className={`mt-5 px-8 py-3 tsz-15 ${btn}`} style={btnPrimary}>
              {t("playAgain")}
            </button>
            <PostGameSurvey game={game} myId={myId} isOnline={isOnline} />
          </div>
        ) : (
          <>
            {/* seats */}
            <div ref={seatRowRef} {...seatRowHandlers} className="hilla-hand flex overflow-x-auto -mx-3 px-4 pt-2 pb-5 -mb-2">
              <div className="flex gap-1.5 mx-auto">
              {game.players.map((p, i) => (
                <div key={p.id} ref={(el) => (seatRefs.current[p.id] = el)}>
                  <SeatPod
                    player={p}
                    active={i === game.currentPlayerIndex}
                    isMe={isOnline ? p.id === myId : soloHuman ? p.id === soloHuman.id : false}
                    nearWin={p.hand.length <= 3}
                    thinking={p.isBot && i === game.currentPlayerIndex && !game.pendingAction}
                  />
                </div>
              ))}
              </div>
            </div>

            {/* table */}
            <div ref={coordRef}>
              {wide ? (
                <div className="flex items-center justify-center gap-6 mt-3">
                  <DrawPile size={58} />
                  <CoordCard key={game.currentCoord.id} card={game.currentCoord} width={420} />
                  <DiscardPile card={topDiscard} size={58} />
                </div>
              ) : (
                <div className="flex justify-center mt-3">
                  <CoordCard key={game.currentCoord.id} card={game.currentCoord} width={Math.min(380, vw - 24)} />
                </div>
              )}
            </div>
            {coordHidden && !game.pendingAction && !game.digOptions && (
              <StickyCoordBar
                card={game.currentCoord}
                onJump={() => {
                  try {
                    coordRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  } catch {}
                }}
                timer={
                  !current.isBot && (!isOnline || isMyTurn) ? (
                    <CountdownRing
                      pendingActionId={`sticky-${game.turnSerial ?? 0}`}
                      startedAt={game.turnStartedAt}
                      size={36}
                      windowMs={current.inactive ? INACTIVE_SKIP_MS : TURN_TIMEOUT_MS}
                      className="flex-shrink-0"
                    />
                  ) : null
                }
              />
            )}
            {game.lockCoord && (
              <div className="mt-3 mx-auto w-fit flex items-center gap-2 hpad-e3 rounded-full tsz-12 font-semibold hilla-pop" style={{ background: CREAM, color: INK, boxShadow: `0 0 0 1px ${GOLD}` }}>
                <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: GOLD }}>
                  <Repeat2 className="w-3.5 h-3.5" style={{ color: INK }} />
                </span>
                {t("lockOn")}
              </div>
            )}
            {wide ? (
              <div className="flex justify-center mt-3 hminh-40">{renderTurnBanner()}</div>
            ) : (
              <div className="flex items-center justify-between gap-2 mt-3">
                <DrawPile size={42} />
                <div className="flex-1 flex justify-center hminh-40 min-w-0">{renderTurnBanner()}</div>
                <DiscardPile card={topDiscard} size={42} />
              </div>
            )}
            <div className="h-5 mt-1 flex justify-center overflow-hidden px-4">
              {!game.winner && moveToast?.text && (
                <span key={moveToast.id} className="hilla-lastmove tsz-12 truncate" style={{ color: `${INK}88` }}>
                  {L.log(moveToast.text)}
                </span>
              )}
            </div>

            {game.pendingAction && !showPendingSheet && (
              <ReactionStrip key={game.pendingAction.id} pa={game.pendingAction} players={game.players} windowMs={pendingWindowMs(game)} />
            )}
            {game.pendingAction && showPendingSheet && (
                <Sheet>
                  {(() => {
                    const pa = game.pendingAction;
                    const actorPlayer = game.players.find((p) => p.id === pa.actorId);
                    const targetPlayer = game.players.find((p) => p.id === pa.targetId);
                    const actorIsMe = isOnline ? actorPlayer?.id === myId : !actorPlayer?.isBot;
                    const targetIsMe = isOnline ? targetPlayer?.id === myId : !targetPlayer?.isBot;
                    return (
                      <>
                        <div className="flex items-start justify-center gap-3 mb-3">
                          <ActionCard actionType={pa.actionType} size={150} showDesc={false} className="hilla-drop" />
                          <div className="absolute top-4 left-4">
                            <CountdownRing pendingActionId={pa.id} startedAt={pa.startedAt} windowMs={pendingWindowMs(game)} size={48} className="" />
                          </div>
                        </div>
                        <div className="mb-1" style={{ color: INK }}>
                          <div className="font-semibold tsz-14">
                            {actorIsMe ? t("youUse") : t("usesX", { name: pa.actorName })} <b style={{ color: BRAND }}>{L.action(pa.actionType)}</b>
                          </div>
                          {targetIsMe ? (
                            <div className="display-font font-bold mt-0.5 tsz-20" style={{ color: BRAND }}>
                              {t("againstYou")}
                            </div>
                          ) : (
                            <div className="tsz-13 mt-1" style={{ color: `${INK}99` }}>
                              {t("against", { name: L.name(targetPlayer?.name) })}
                            </div>
                          )}
                        </div>
                        <div className="tsz-12 mb-4 mt-1" style={{ color: `${INK}88` }}>
                          {isOnline ? (
                            eligibleBlockers.some((p) => p.id === myId) ? (
                              <>
                                {tb("canBlockYou", null, { color: BRAND })}
                              </>
                            ) : (
                              t("autoResolve")
                            )
                          ) : (
                            <>
                              {tb("anyoneBlock", null, { color: BRAND })}
                            </>
                          )}
                        </div>
                        <div className="space-y-2 mb-1">
                          {(isOnline ? eligibleBlockers.filter((p) => p.id === myId) : eligibleBlockers.filter((p) => !p.isBot)).map((p) => (
                            <button
                              key={p.id}
                              onClick={() => cancelWithBlock(p.id)}
                              className={`w-full py-2 hpad-se tsz-14 flex items-center gap-3 ${btn}`}
                              style={{ background: "#961E21", color: CREAM, boxShadow: "0 8px 18px -8px rgba(150,30,33,.7)" }}
                            >
                              <ActionThumb type="block" size={36} radius={9} />
                              <span className="flex-1 text-center">{isOnline || soloHuman ? t("useBlock") : t("useBlockName", { name: p.name })}</span>
                            </button>
                          ))}
                          {(isOnline ? eligibleBlockers.some((p) => p.id === myId) : eligibleBlockers.some((p) => !p.isBot)) && (
                            <button onClick={declineBlock} className={`w-full py-2.5 tsz-14 ${btn}`} style={btnGhost}>
                              {t("passBlock")}
                            </button>
                          )}
                        </div>
                        {errMsg && (
                          <div className="tsz-12 font-semibold px-3 py-1.5 rounded-xl mt-2" style={{ background: `${BRAND}14`, color: BRAND }}>
                            {L.error(errMsg)}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </Sheet>
              )}

            {needTarget && (
              <Sheet onBackdrop={() => setNeedTarget(null)}>
                <div className="flex justify-center mb-3">
                  <ActionCard card={needTarget} size={170} />
                </div>
                <div className="tsz-13 mb-3 -mt-1" style={{ color: `${INK}99` }}>
                  {L.actionDesc(needTarget.actionType)}
                </div>
                <div className="font-bold tsz-15 mb-3" style={{ color: INK }}>
                  {t("whoTarget")}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {game.players
                    .filter((p) => p.id !== viewer.id)
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() => chooseTarget(p.id)}
                        className={`py-2.5 px-2 tsz-13 flex items-center justify-center gap-1.5 ${btn}`}
                        style={{ background: PAGE, color: INK, boxShadow: `inset 0 0 0 1.5px ${INK}1a` }}
                      >
                        <span className="truncate">{p.isBot ? "🤖 " : ""}{L.name(p.name)}</span>
                        <span className="tsz-11 font-semibold px-1.5 rounded-full" style={{ background: p.hand.length <= 3 ? GOLD : `${INK}12` }}>
                          {p.hand.length}
                        </span>
                      </button>
                    ))}
                </div>
                <button onClick={() => setNeedTarget(null)} className="mt-4 tsz-12 font-semibold" style={{ color: `${INK}77` }}>
                  {t("cancel")}
                </button>
              </Sheet>
            )}

            {giveStep && <GivePicker viewer={viewer} excludeId={giveStep.cardId} onConfirm={confirmGiveTake} onCancel={() => setGiveStep(null)} />}

            {game.digOptions && (!isOnline || game.digOptions.playerId === myId) && (
              <Sheet maxW={440}>
                <div className="display-font font-bold tsz-20 mb-1" style={{ color: BRAND }}>
                  {t("digTitle")}
                </div>
                <div className="tsz-13 mb-4" style={{ color: `${INK}88` }}>
                  {t("digHint")}
                </div>
                <div className="flex justify-center gap-2.5 pt-3">
                  {game.digOptions.cards.map((c, i) => (
                    <div key={c.id} className="hilla-deal" style={{ animationDelay: `${i * 90}ms` }}>
                      <AnyCard card={c} size={cardSize <= 88 ? 96 : 116} onClick={() => finishDig(c.id)} />
                    </div>
                  ))}
                </div>
              </Sheet>
            )}
            {game.digOptions && isOnline && game.digOptions.playerId !== myId && (
              <div className="text-center tsz-13 mb-2" style={{ color: `${INK}77` }}>
                {t("digging", { name: game.players.find((p) => p.id === game.digOptions.playerId)?.name })}
              </div>
            )}

            {/* hand */}
            {showThinkingPanel ? (
              <div className="mt-5 hr-28 py-12 text-center" style={{ background: `${CREAM}aa` }}>
                <div className="tsz-15 font-bold mb-2" style={{ color: INK }}>
                  {t("thinkingDots", { name: current.name })}
                </div>
                <div className="flex justify-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-2 h-2 rounded-full hilla-dot" style={{ background: GOLD, animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            ) : showPassScreen ? (
              <div className="mt-5 hr-28 py-8 text-center hilla-pop" style={{ background: CREAM, boxShadow: "0 18px 40px -20px rgba(60,30,10,.5)" }}>
                <div className="mx-auto mb-3 w-fit hilla-float">
                  <CardBack size={84} tall style={{ boxShadow: "0 14px 28px -12px rgba(60,30,10,.6)" }} />
                </div>
                <div className="tsz-13 font-semibold mb-1" style={{ color: `${INK}88` }}>
                  {t("passTo")}
                </div>
                <div className="display-font font-bold mb-5" style={{ color: BRAND, fontSize: fs(38) }}>
                  {current.name}
                </div>
                <button onClick={() => setRevealed(true)} className={`px-7 py-3 tsz-15 ${btn}`} style={btnPrimary}>
                  {t("reveal")}
                </button>
              </div>
            ) : (
              <section
                className={`mt-4 hr-28 px-3 pt-3 pb-3 ${handActive ? "hilla-myturn" : ""}`}
                style={{ background: CREAM, boxShadow: "0 10px 30px -14px rgba(60,30,10,.4)" }}
              >
                <div className="flex items-center justify-between px-1">
                  <div className="tsz-13 font-bold flex items-center gap-1.5" style={{ color: INK }}>
                    {isOnline || soloHuman ? t("yourHand") : t("handOf", { name: viewer.name })}
                    <span className="tsz-11 font-semibold px-1.5 rounded-full" style={{ background: `${INK}0f`, color: `${INK}88` }}>
                      {viewer.hand.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setSortByRegion((s) => !s)}
                    className="tsz-11 font-semibold px-3 py-1.5 rounded-full transition"
                    style={sortByRegion ? { background: INK, color: CREAM } : { background: `${INK}0b`, color: `${INK}aa` }}
                  >
                    {t("sortRegion")}
                  </button>
                </div>

                <div className="tsz-11 font-semibold mt-2 px-1" style={{ color: `${INK}77` }}>
                  {t("clothing")}
                </div>
                <div className="hilla-hand flex gap-2 overflow-x-auto -mx-3 px-3 pb-4 -mb-1">{renderItems()}</div>

                {actionCards.length > 0 && (
                  <>
                    <div className="tsz-11 font-semibold mt-1 px-1" style={{ color: `${INK}77` }}>
                      {t("actionsHint")}
                      {game.actionUsedThisTurn && isMyTurn && <span style={{ color: GOLD_DK }}>{t("usedThisTurn")}</span>}
                    </div>
                    <div className="hilla-hand flex gap-2 overflow-x-auto -mx-3 px-3 pb-4 -mb-2">
                      {actionCards.map((c, i) => (
                        <div key={c.id} className="hilla-deal pt-2" style={{ animationDelay: `${i * 28}ms` }}>
                          <ActionCard card={c} size={Math.round(cardSize * 0.86)} disabled={!handActive || game.actionUsedThisTurn} onClick={() => startAction(c.id)} />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {errMsg && !game.pendingAction && (
                  <div className="tsz-12 font-semibold mb-2 px-3 py-1.5 rounded-xl hilla-pop" style={{ background: `${BRAND}14`, color: BRAND }}>
                    {L.error(errMsg)}
                  </div>
                )}

                <div className="flex gap-2 mt-1">
                  <button
                    onClick={playSelectedItems}
                    disabled={selected.length === 0 || !handActive}
                    className={`flex-1 py-3 tsz-14 ${btn}`}
                    style={btnPrimary}
                  >
                    {selected.length === 0 ? t("pickMatching") : L.playCards(selected.length)}
                  </button>
                  <button onClick={endMyTurn} disabled={!handActive} className={`px-5 py-3 tsz-14 ${btn}`} style={btnGhost}>
                    {t("endTurn")}
                  </button>
                </div>
              </section>
            )}

            <button
              onClick={() => setLogOpen((v) => !v)}
              className="mt-4 mx-auto flex items-center gap-1.5 tsz-11 font-semibold px-3 py-1.5 rounded-full"
              style={{ color: `${INK}88`, background: `${INK}0a` }}
            >
              {t("log")} {logOpen ? "▴" : "▾"}
            </button>
            {logOpen && (
              <div className="mt-2 rounded-2xl p-3 max-h-40 overflow-y-auto hilla-pop" style={{ background: `${CREAM}cc` }}>
                {game.log.map((l, i) => (
                  <div key={i} className="tsz-11 mb-1" style={{ color: `${INK}88` }}>
                    {L.log(l)}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {menuOpen && (
        <>
          <div className="fixed inset-0 hz-9998 backdrop-blur-sm bg-black/10" onClick={() => setMenuOpen(false)} />
          <div
            className="fixed hz-9999 w-52 rounded-2xl shadow-xl overflow-hidden hilla-pop"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 3.75rem)", ...(L.dir === "rtl" ? { left: "1rem" } : { right: "1rem" }), background: CREAM, boxShadow: "0 18px 40px -12px rgba(0,0,0,.35)" }}
          >
            <button
              onClick={() => setMenuOpen(false)}
              className="w-full hstart px-4 py-3 tsz-13 font-bold flex items-center gap-2"
              style={{ color: CREAM, background: OLD_TEAL }}
            >
              <Check className="w-4 h-4" /> {t("continue")}
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                setShowRules(true);
              }}
              className="w-full hstart px-4 py-3 tsz-13 font-semibold flex items-center gap-2 border-t"
              style={{ color: INK, borderColor: `${INK}12` }}
            >
              <HelpCircle className="w-4 h-4" style={{ color: BRAND }} /> {t("howToPlay")}
            </button>
            <button
              onClick={() => {
                setBigText((v) => !v);
              }}
              className="w-full hstart px-4 py-3 tsz-13 font-semibold flex items-center gap-2 border-t"
              style={{ color: INK, background: bigText ? `${GOLD}33` : "transparent", borderColor: `${INK}12` }}
            >
              <Type className="w-4 h-4" style={{ color: BRAND }} /> {t("bigText")} {bigText ? "✓" : ""}
            </button>
            <button
              onClick={() => {
                setTurnSound((v) => {
                  if (!v) playTurnChime();
                  return !v;
                });
              }}
              className="w-full hstart px-4 py-3 tsz-13 font-semibold flex items-center gap-2 border-t"
              style={{ color: INK, background: turnSound ? `${GOLD}33` : "transparent", borderColor: `${INK}12` }}
            >
              {turnSound ? <Volume2 className="w-4 h-4" style={{ color: BRAND }} /> : <VolumeX className="w-4 h-4" style={{ color: BRAND }} />} {t("turnSound")} {turnSound ? "✓" : ""}
            </button>
            <button
              onClick={() => {
                try {
                  window.location.reload();
                } catch {}
              }}
              className="w-full hstart px-4 py-3 tsz-13 font-semibold flex items-center gap-2 border-t"
              style={{ color: INK, borderColor: `${INK}12` }}
            >
              <RefreshCw className="w-4 h-4" style={{ color: BRAND }} /> {t("refresh")}
            </button>
            <button
              onClick={onExit}
              className="w-full hstart px-4 py-3 tsz-13 font-semibold flex items-center gap-2 border-t"
              style={{ color: INK, borderColor: `${INK}12` }}
            >
              <RotateCcw className="w-4 h-4" style={{ color: BRAND }} /> {t("newGame")}
            </button>
            {onGoHome && (
              <button
                onClick={onGoHome}
                className="w-full hstart px-4 py-3 tsz-13 font-semibold flex items-center gap-2 border-t"
                style={{ color: BRAND, borderColor: `${INK}12` }}
              >
                <LogOut className="w-4 h-4" /> {t("exit")}
              </button>
            )}
          </div>
        </>
      )}

      {/* Rendered last so it sits above the board and the ☰ menu; scales with A+. */}
      {showRules && <HowToPlay onClose={() => setShowRules(false)} bigText={bigText} />}
      {inactiveMe && !winnerPlayer && <InactiveBanner onWake={wakeMe} />}
    </div>
  );
}

// #28 — self-contained "?" affordance for pre-game screens: renders the button and owns the
// modal open state (bigText=false — the A+ toggle only exists in-game).
function RulesFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <HelpButton onClick={() => setOpen(true)} />
      {open && <HowToPlay onClose={() => setOpen(false)} bigText={false} />}
    </>
  );
}

// #28 — help affordance + rules modal.
function HelpButton({ onClick, className = "" }) {
  const { t, tb, L } = useI18n();
  return (
    <button
      onClick={onClick}
      title={t("howToPlay")}
      className={`w-10 h-10 rounded-full flex items-center justify-center transition active:scale-95 ${className}`}
      style={{ color: INK, background: CREAM, boxShadow: "0 2px 8px -2px rgba(60,30,10,.3)" }}
    >
      <HelpCircle className="w-5 h-5" />
    </button>
  );
}

// "وش قوانين حُلّة؟" — sectioned rules modal. The action-card list is generated from ACTION_TYPES
// so descriptions can never drift from the actual card definitions. Rendered at z-[10000] (above
// the in-game menu). bigText scales the text via the shared --tsz mechanism (#21).
function HowToPlay({ onClose, bigText }) {
  const { t, tb, L } = useI18n();
  const Section = ({ title, children }) => (
    <div className="mb-3">
      <div className="tsz-13 font-bold mb-1" style={{ color: BRAND }}>
        {title}
      </div>
      <div className="tsz-12 leading-relaxed" style={{ color: INK }}>
        {children}
      </div>
    </div>
  );
  return (
    <div
      dir={L.dir}
      className="hilla-root fixed inset-0 hz-10000 flex items-center justify-center hilla-fade"
      style={{
        background: "rgba(35,31,32,0.55)",
        "--tsz": bigText ? 1.18 : 1,
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)",
        paddingRight: "max(1.25rem, calc(env(safe-area-inset-right, 0px) + 1rem))",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
        paddingLeft: "max(1.25rem, calc(env(safe-area-inset-left, 0px) + 1rem))",
      }}
    >
      <GlobalFont />
      <div
        className="w-full max-w-md hr-26 flex flex-col overflow-hidden hilla-pop"
        style={{ background: CREAM, maxHeight: "100%", boxShadow: `0 0 0 2px ${GOLD}, 0 24px 60px -10px rgba(0,0,0,.4)` }}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0" style={{ background: CREAM }}>
          <div className="display-font tsz-20 font-bold" style={{ color: BRAND }}>
            {t("rulesTitle")}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ color: INK, background: `${INK}0d` }} title="×">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 pt-2 overflow-y-auto" style={{ background: CREAM }}>
          <Section title={t("rGoal")}>{t("rGoalT")}</Section>

          <Section title={t("rRegion")}>{t("rRegionT")}</Section>

          <Section title={t("rRandom")}>{t("rRandomT")}</Section>

          <Section title={t("rActions")}>{t("rActionsT")}</Section>

          <div className="space-y-1.5 mb-3">
            {ACTION_TYPES.map((a) => (
              <div key={a.id} className="rounded-2xl p-1.5 hpad-e3 flex items-center gap-2.5" style={{ background: `${INK}08` }}>
                <ActionThumb type={a.id} size={44} radius={12} />
                <div className="min-w-0">
                  <div className="font-bold tsz-12" style={{ color: INK }}>
                    {L.action(a.id)}
                  </div>
                  <div className="tsz-11 mt-0.5" style={{ color: `${INK}aa` }}>
                    {L.actionDesc(a.id)}
                  </div>
                  {(a.id === "giveTake" || a.id === "block") && (
                    <div className="tsz-11 mt-0.5 font-semibold" style={{ color: BRAND }}>{t(`actNote_${a.id}`)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Section title={t("rRarity")}>
            <span className="flex gap-1.5 my-1">
              {["common", "medium", "rare"].map((r) => (
                <span key={r} className="px-2.5 py-0.5 rounded-full tsz-11 font-semibold" style={{ background: RARITY_META[r].color, color: RARITY_META[r].text }}>
                  {L.rarity(r)}
                </span>
              ))}
            </span>
            {t("rRarityT")}
          </Section>


          <button onClick={onClose} className={`w-full py-3 tsz-14 ${btn}`} style={btnPrimary}>
            {t("letsPlay")}
          </button>
          {/* Maker's stamp: «حُلّة | SAUDI MADE» — the wordmark and the Saudi Made mark read as one seal. */}
          <div className="flex items-center justify-center gap-3 mt-4 mb-1" aria-label="حُلّة، صُنع في السعودية">
            <Wordmark height={30} />
            <span aria-hidden="true" style={{ width: 1, height: 30, background: GOLD }} />
            <img src={ART.saudi_made} alt="Saudi Made" draggable={false} style={{ height: 26, width: "auto", display: "block" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Shown to a player who's been marked inactive (😴). One tap brings them back.
function InactiveBanner({ onWake }) {
  const { t, L } = useI18n();
  return (
    <div
      dir={L.dir}
      className="fixed left-0 right-0 flex justify-center px-4 hilla-pop"
      style={{ zIndex: 60, bottom: "max(84px, calc(env(safe-area-inset-bottom) + 78px))", pointerEvents: "none" }}
    >
      <div
        className="w-full flex items-center gap-3 rounded-2xl py-2"
        style={{ paddingInlineStart: 12, paddingInlineEnd: 8, maxWidth: 380, background: INK, color: CREAM, boxShadow: `0 0 0 2px ${GOLD}, 0 16px 34px -12px rgba(0,0,0,.55)`, pointerEvents: "auto" }}
        role="status"
      >
        <span aria-hidden="true" style={{ fontSize: 22 }}>😴</span>
        <div className="flex-1 min-w-0 hstart">
          <div className="tsz-13 font-bold leading-tight">{t("inactiveMeTitle")}</div>
          <div className="tsz-11 leading-tight mt-0.5" style={{ color: `${CREAM}bb` }}>
            {t("inactiveMeBody")}
          </div>
        </div>
        <button onClick={onWake} className={`px-4 py-2.5 tsz-13 whitespace-nowrap ${btn}`} style={btnPrimary}>
          {t("imBack")}
        </button>
      </div>
    </div>
  );
}

function GivePicker({ viewer, excludeId, onConfirm, onCancel }) {
  const { t, tb, L } = useI18n();
  const [chosen, setChosen] = useState([]);
  // the عطني وأعطيك card being played isn't part of the hand you give from
  const items = viewer.hand.filter((c) => c.id !== excludeId);
  const max = Math.min(2, items.length);
  function toggle(id) {
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < max ? [...c, id] : c));
  }
  return (
    <Sheet maxW={520}>
      <div className="flex items-center justify-center gap-3 mb-3">
        <ActionThumb type="giveTake" size={56} radius={16} />
        <div className="hstart">
          <div className="display-font font-bold tsz-20 leading-none" style={{ color: BRAND }}>
            {t("giveTitle")}
          </div>
          <div className="tsz-12 mt-1" style={{ color: `${INK}88` }}>
            {max === 2 ? t("givePick2") : t("givePick1")}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 justify-center pt-3 pb-2 hmaxh-52 overflow-y-auto">
        {items.map((c) => (
          <AnyCard key={c.id} card={c} size={76} selected={chosen.includes(c.id)} onClick={() => toggle(c.id)} />
        ))}
      </div>
      <div className="flex gap-2 justify-center mt-3">
        <button onClick={() => onConfirm(chosen)} disabled={chosen.length !== max} className={`flex-1 py-3 tsz-14 ${btn}`} style={btnPrimary}>
          {t("confirm", { a: chosen.length, b: max })}
        </button>
        <button onClick={onCancel} className={`px-6 py-3 tsz-14 ${btn}`} style={btnGhost}>
          {t("cancel")}
        </button>
      </div>
    </Sheet>
  );
}

// Fanned hero for the pre-game screens: an action card and a hand card peeking from behind the
// card back. Purely decorative.
function HeroFan({ scale = 1 }) {
  const s = scale;
  return (
    <div className="relative mx-auto" style={{ width: 250 * s, height: 190 * s }} aria-hidden="true">
      <div className="absolute hilla-float" style={{ left: 18 * s, top: 34 * s, transform: "rotate(-15deg)", animationDelay: "-2s" }}>
        <ActionCard actionType="stealTwo" size={104 * s} showDesc={false} />
      </div>
      <div className="absolute hilla-float" style={{ right: 18 * s, top: 34 * s, transform: "rotate(15deg)", animationDelay: "-4s" }}>
        <ItemCard card={{ id: "hero", name: "النشل", region: "sharqi", rarity: "medium" }} size={104 * s} />
      </div>
      <div className="absolute left-1/2 hilla-float" style={{ top: 0, marginLeft: -62 * s }}>
        <CardBack size={124 * s} tall style={{ boxShadow: "0 22px 40px -14px rgba(60,30,10,.6)" }} />
      </div>
    </div>
  );
}

// Top bar for the pre-game screens: pinned to the top of the page (not floating with the centred
// content), with breathing room and the iPhone notch / Dynamic Island taken into account.
// Always laid out right-to-left whatever the language, so the language switch and "?" never jump
// sides while someone is trying languages out.
function TopBar({ start, end }) {
  return (
    <div
      dir="rtl"
      className="absolute left-0 right-0 top-0 flex items-center justify-between gap-3"
      style={{
        zIndex: 2,
        paddingTop: "max(16px, calc(env(safe-area-inset-top) + 8px))",
        paddingLeft: "max(16px, calc(env(safe-area-inset-left) + 8px))",
        paddingRight: "max(16px, calc(env(safe-area-inset-right) + 8px))",
      }}
    >
      <div className="min-w-0">{start}</div>
      <div className="flex-shrink-0">{end}</div>
    </div>
  );
}

function ScreenShell({ children, maxW = "max-w-md" }) {
  const { t, tb, L } = useI18n();
  return (
    <div
      dir={L.dir}
      className="hilla-root relative min-h-screen w-full flex items-center justify-center px-5"
      style={{ ...pageBg, color: INK, paddingTop: "calc(max(16px, env(safe-area-inset-top)) + 64px)", paddingBottom: "calc(max(16px, env(safe-area-inset-bottom)) + 20px)" }}
    >
      <GlobalFont />
      <TopBar end={<RulesFab />} />
      <div className={`w-full ${maxW} relative`} style={{ zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}

const panelStyle = { background: CREAM, boxShadow: "0 18px 44px -20px rgba(60,30,10,.5)" };
const inputStyle = { background: PAGE, color: INK, boxShadow: `inset 0 0 0 1.5px ${INK}14` };

/* --------------------------------- LOCAL MODE --------------------------------- */

function LocalSetup({ onStart, onBack }) {
  const { t, tb, L } = useI18n();
  const [numPlayers, setNumPlayers] = useState(3);
  const [defaultNames] = useState(() => [L.isAr ? "المضيف" : t("you"), ...L.botNames(5)]);
  const [names, setNames] = useState(defaultNames);
  const [isBot, setIsBot] = useState([false, true, true, true, true, true]);
  const [perPlayer, setPerPlayer] = useState(REC_COUNTS[3]);

  function toggleBot(i) {
    const copy = [...isBot];
    copy[i] = !copy[i];
    setIsBot(copy);
    // give a sensible default name when flipping a slot, unless the user already typed something custom
    const wasDefault = names[i] === defaultNames[i] || names[i] === t("playerN", { n: i + 1 });
    if (wasDefault) {
      const copyNames = [...names];
      copyNames[i] = copy[i] ? defaultNames[i] : i === 0 ? (L.isAr ? "المضيف" : t("you")) : t("playerN", { n: i + 1 });
      setNames(copyNames);
    }
  }

  return (
    <ScreenShell>
      <div className="text-center mb-4">
        <HeroFan scale={0.72} />
        <p className="tsz-13 mt-1" style={{ color: `${INK}99` }}>
          {t("localIntro")}
        </p>
      </div>
      <div className="hr-28 p-5 space-y-5" style={panelStyle}>
        <div>
          <label className="tsz-13 flex items-center gap-2 mb-2 font-bold" style={{ color: INK }}>
            <Users className="w-4 h-4" style={{ color: BRAND }} /> {t("numPlayers")}
          </label>
          <div className="flex gap-1.5 p-1 rounded-2xl" style={{ background: PAGE }}>
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => {
                  setNumPlayers(n);
                  setPerPlayer(Math.min(REC_COUNTS[n], maxHandFor(n)));
                }}
                className="flex-1 py-2 rounded-xl font-bold tsz-14 transition"
                style={numPlayers === n ? { background: BRAND, color: CREAM, boxShadow: "0 4px 10px -4px rgba(133,21,45,.6)" } : { color: `${INK}99` }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: numPlayers }).map((_, i) => (
            <div key={i} className="flex gap-2 hilla-fade">
              <input
                value={names[i]}
                onChange={(e) => {
                  const copy = [...names];
                  copy[i] = e.target.value;
                  setNames(copy);
                }}
                placeholder={t("playerNamePh", { n: i + 1 })}
                className="flex-1 min-w-0 rounded-xl px-3 py-2.5 tsz-13 focus:outline-none"
                style={inputStyle}
              />
              <button
                onClick={() => toggleBot(i)}
                className="px-3 rounded-xl tsz-12 font-semibold whitespace-nowrap transition"
                style={isBot[i] ? { background: INK, color: CREAM } : { color: INK, boxShadow: `inset 0 0 0 1.5px ${INK}26` }}
                title={t("botTitle")}
              >
                {isBot[i] ? t("bot") : t("human")}
              </button>
            </div>
          ))}
          <p className="tsz-11" style={{ color: `${INK}77` }}>
            {t("botNote")}
          </p>
        </div>
        <div>
          <label className="tsz-13 mb-2 flex items-center justify-between font-bold" style={{ color: INK }}>
            {t("cardsPerPlayer")}
            <span className="px-2.5 py-0.5 rounded-full tsz-13" style={{ background: GOLD, color: INK }}>
              {perPlayer}
            </span>
          </label>
          <input type="range" min={HAND_MIN} max={maxHandFor(numPlayers)} value={Math.min(perPlayer, maxHandFor(numPlayers))} onChange={(e) => setPerPlayer(Number(e.target.value))} className="w-full" style={{ accentColor: BRAND }} />
        </div>
        <button
          onClick={() => {
            const meta = Array.from({ length: numPlayers }).map((_, i) => ({
              id: `p${i}`,
              name: names[i]?.trim() || (isBot[i] ? t("botN", { n: i + 1 }) : t("playerN", { n: i + 1 })),
              isBot: !!isBot[i],
            }));
            onStart(createInitialGame(meta, perPlayer));
          }}
          className={`w-full py-3.5 tsz-17 flex items-center justify-center gap-2 ${btn}`}
          style={btnPrimary}
        >
          <Sparkles className="w-5 h-5" style={{ color: GOLD }} /> {t("startPlaying")}
        </button>
        <button onClick={onBack} className="w-full tsz-12 font-semibold" style={{ color: `${INK}77` }}>
          {t("back")}
        </button>
      </div>
    </ScreenShell>
  );
}

/* --------------------------------- ONLINE MODE --------------------------------- */

function OnlineMenu({ myName, setMyName, onCreate, onJoin, onBack, error }) {
  const { t, tb, L } = useI18n();
  const [joinCode, setJoinCode] = useState("");
  const [perPlayer, setPerPlayer] = useState(16);
  return (
    <ScreenShell>
      <div className="text-center mb-4">
        <HeroFan scale={0.72} />
        <p className="tsz-13 mt-1 flex items-center justify-center gap-1.5" style={{ color: `${INK}99` }}>
          <Wifi className="w-4 h-4" /> {t("onlineIntro")}
        </p>
      </div>
      <div className="hr-28 p-5 space-y-4" style={panelStyle}>
        <input
          value={myName}
          onChange={(e) => setMyName(e.target.value)}
          placeholder={t("yourName")}
          className="w-full rounded-xl px-3 py-2.5 tsz-14 focus:outline-none"
          style={inputStyle}
        />

        <div className="pt-3 border-t" style={{ borderColor: `${INK}12` }}>
          <div className="tsz-14 font-bold mb-2" style={{ color: INK }}>
            {t("createRoom")}
          </div>
          <label className="tsz-12 mb-1 flex items-center justify-between" style={{ color: `${INK}88` }}>
            {t("cardsPerPlayer")}
            <span className="px-2 rounded-full font-bold" style={{ background: GOLD, color: INK }}>
              {perPlayer}
            </span>
          </label>
          <input type="range" min={10} max={20} value={perPlayer} onChange={(e) => setPerPlayer(Number(e.target.value))} className="w-full mb-3" style={{ accentColor: BRAND }} />
          <button onClick={() => onCreate(perPlayer)} disabled={!myName.trim()} className={`w-full py-3 tsz-15 ${btn}`} style={btnPrimary}>
            {t("create")}
          </button>
        </div>

        <div className="pt-3 border-t" style={{ borderColor: `${INK}12` }}>
          <div className="tsz-14 font-bold mb-2" style={{ color: INK }}>
            {t("joinRoom")}
          </div>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder={t("roomCodePh")}
            maxLength={4}
            className="w-full rounded-xl px-3 py-2.5 tsz-15 mb-3 text-center tracking-widest font-bold focus:outline-none"
            style={{ ...inputStyle, color: BRAND }}
          />
          <button onClick={() => onJoin(joinCode)} disabled={!myName.trim() || joinCode.length !== 4} className={`w-full py-3 tsz-15 ${btn}`} style={{ background: INK, color: CREAM }}>
            {t("join")}
          </button>
        </div>

        {error && (
          <div className="tsz-12 font-semibold text-center px-3 py-2 rounded-xl" style={{ background: `${BRAND}14`, color: BRAND }}>
            {error}
          </div>
        )}

        <button onClick={onBack} className="w-full tsz-12 font-semibold" style={{ color: `${INK}77` }}>
          {t("back")}
        </button>
      </div>
    </ScreenShell>
  );
}

function OnlineLobby({ room, myId, onStart, onAddBot, onRemoveBot, onBack }) {
  const { t, tb, L } = useI18n();
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
    <ScreenShell>
      <div className="text-center mb-5">
        <Wordmark height={52} className="mb-3" />
        <div className="tsz-12 mb-1.5" style={{ color: `${INK}88` }}>
          {t("roomCodeShare")}
        </div>
        <button
          onClick={copyCode}
          className="mx-auto flex items-center gap-3 pl-4 pr-6 py-3 hr-22 text-3xl font-bold htrack-3 transition hpress-98"
          style={{ color: BRAND, background: CREAM, boxShadow: `0 0 0 2px ${GOLD}, 0 14px 30px -16px rgba(60,30,10,.5)` }}
        >
          {room.code}
          {copied ? <Check className="w-5 h-5" style={{ color: REGION_BY_ID.sharqi.color }} /> : <Copy className="w-5 h-5 opacity-50" />}
        </button>
        <p className="tsz-11 mt-2" style={{ color: `${INK}77` }}>
          {t("lobbyHint")}
        </p>
      </div>

      <div className="hr-28 p-5 space-y-2.5" style={panelStyle}>
        <div className="tsz-14 font-bold" style={{ color: INK }}>
          {t("playersCount", { n: room.lobby.length, m: room.maxPlayers })}
        </div>
        {room.lobby.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2.5 px-2 py-2 rounded-2xl hilla-fade" style={{ background: PAGE }}>
            <PlayerAvatar name={p.name} isBot={p.isBot} index={i} />
            <span className="tsz-13 font-semibold flex-1" style={{ color: INK }}>
              {p.name}
            </span>
            {p.id === room.hostId && (
              <span className="tsz-11 font-semibold px-2 py-0.5 rounded-full" style={{ background: GOLD, color: INK }}>
                {t("host")}
              </span>
            )}
            {p.id === myId && (
              <span className="tsz-11 font-semibold px-2 py-0.5 rounded-full" style={{ background: INK, color: CREAM }}>
                {t("you")}
              </span>
            )}
            {isHost && p.isBot && (
              <button onClick={() => onRemoveBot(p.id)} className="tsz-12 font-bold w-7 h-7 rounded-full flex items-center justify-center" style={{ color: BRAND, background: `${BRAND}14` }} title={t("removeBot")}>
                ✕
              </button>
            )}
          </div>
        ))}

        {isHost && (
          <button
            onClick={onAddBot}
            disabled={room.lobby.length >= room.maxPlayers}
            className={`w-full py-2.5 tsz-13 mt-1 ${btn}`}
            style={btnGhost}
          >
            {t("addBot")}
          </button>
        )}
        {isHost ? (
          <button onClick={onStart} disabled={room.lobby.length < 2} className={`w-full py-3.5 tsz-15 flex items-center justify-center gap-2 mt-2 ${btn}`} style={btnPrimary}>
            <Sparkles className="w-5 h-5" style={{ color: GOLD }} /> {t("startGame")}
          </button>
        ) : (
          <div className="text-center tsz-12 py-2 flex items-center justify-center gap-2" style={{ color: `${INK}77` }}>
            {t("waitingHost")}
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-1 h-1 rounded-full hilla-dot" style={{ background: GOLD_DK, animationDelay: `${i * 150}ms` }} />
              ))}
            </span>
          </div>
        )}
        {isHost && room.lobby.length < 2 && (
          <div className="tsz-11 text-center" style={{ color: `${INK}66` }}>
            {t("needTwo")}
          </div>
        )}

        <button
          onClick={() => {
            try {
              window.location.reload();
            } catch {}
          }}
          className="w-full tsz-12 font-semibold flex items-center justify-center gap-1 pt-1"
          style={{ color: `${INK}77` }}
        >
          <RefreshCw className="w-3 h-3" /> {t("refresh")}
        </button>
        <button onClick={onBack} className="w-full tsz-12 font-semibold flex items-center justify-center gap-1" style={{ color: `${INK}77` }}>
          <LogOut className="w-3 h-3" /> {t("leaveRoom")}
        </button>
      </div>
    </ScreenShell>
  );
}

function OnlineFlow({ onBack }) {
  const { t, tb, L } = useI18n();
  const [savedSession] = useState(() => readOnlineSession());
  const [myId] = useState(() => savedSession?.myId || uid());
  const [myName, setMyName] = useState(() => savedSession?.myName || loadNick());
  const [roomCode, setRoomCode] = useState(() => savedSession?.roomCode || "");
  const [onlinePhase, setOnlinePhase] = useState(() => (savedSession?.roomCode ? "restoring" : "menu")); // menu | restoring | lobby | play
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const pollInFlightRef = useRef(false);
  const pollSeqRef = useRef(0);
  const appliedPollSeqRef = useRef(0);
  const roomMutationRef = useRef(0);
  const latestRoomUpdatedAtRef = useRef(0);
  const activeRoomCodeRef = useRef(roomCode);
  const pendingOptimisticRoomRef = useRef(null);

  function getRoomSyncSnapshot(doc) {
    const game = doc?.game;
    return {
      started: !!doc?.started,
      turnSerial: game?.turnSerial ?? null,
      currentPlayerIndex: game?.currentPlayerIndex ?? null,
      winner: game?.winner ?? null,
    };
  }

  function isBehindOptimisticRoom(doc, optimisticSnapshot) {
    if (!optimisticSnapshot) return false;
    if (optimisticSnapshot.started && !doc?.started) return true;
    if (!optimisticSnapshot.started || !doc?.started) return false;

    const incoming = getRoomSyncSnapshot(doc);
    const incomingTurn = incoming.turnSerial ?? -1;
    const optimisticTurn = optimisticSnapshot.turnSerial ?? -1;

    if (incomingTurn < optimisticTurn) return true;
    if (incomingTurn > optimisticTurn) return false;
    if (incoming.currentPlayerIndex !== optimisticSnapshot.currentPlayerIndex) return true;
    if (optimisticSnapshot.winner && incoming.winner !== optimisticSnapshot.winner) return true;

    return false;
  }

  function resetRoomSyncState() {
    pollInFlightRef.current = false;
    pollSeqRef.current = 0;
    appliedPollSeqRef.current = 0;
    roomMutationRef.current = 0;
    latestRoomUpdatedAtRef.current = 0;
    pendingOptimisticRoomRef.current = null;
  }

  function stampRoom(doc) {
    const nextTs = typeof doc?.updatedAt === "string" ? Date.parse(doc.updatedAt) : Number.NaN;
    if (Number.isFinite(nextTs)) latestRoomUpdatedAtRef.current = Math.max(latestRoomUpdatedAtRef.current, nextTs);
  }

  function adoptRoom(doc) {
    stampRoom(doc);
    setRoom(doc);
  }

  useEffect(() => {
    activeRoomCodeRef.current = roomCode;
    if (!roomCode) resetRoomSyncState();
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) return;
    writeOnlineSession({ roomCode, myId, myName: myName.trim() });
  }, [roomCode, myId, myName]);

  async function saveRoomTo(code, doc) {
    const mutationVersion = ++roomMutationRef.current;
    pendingOptimisticRoomRef.current = { code, mutationVersion, snapshot: getRoomSyncSnapshot(doc) };
    setRoom(doc);
    try {
      const res = await fetch(`/api/rooms/${code}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: doc }),
      });
      if (!res.ok) throw new Error("save_failed");
      const updated = await res.json();
      if (activeRoomCodeRef.current !== code || mutationVersion !== roomMutationRef.current) return;
      pendingOptimisticRoomRef.current = null;
      adoptRoom(updated);
    } catch (e) {
      pendingOptimisticRoomRef.current = null;
      setError(t("errSave"));
    }
  }

  // Online turn-timeout claim. Not optimistic (unlike saveRoomTo): the guarded write may lose, so
  // we never pre-apply. On a win we adopt the returned room (its newer updatedAt makes the poll
  // guard drop any in-flight stale poll — no flicker). On a loss (409) we do nothing; polling
  // brings whatever actually happened. Returns true only if this client's claim won.
  // #58 online pass on «لا ما تقدر»: guarded server write (adds only this player to declinedIds and
  // refuses if the action already resolved). On success adopt the returned room; otherwise polling
  // brings the current state.
  async function declineBlockOnline(code, pendingActionId) {
    try {
      const res = await fetch(`/api/rooms/${code}/decline-block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: myId, pendingActionId }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      if (activeRoomCodeRef.current !== code) return;
      adoptRoom(updated);
    } catch (e) {}
  }

  async function claimTimeout(code, nextGame, expected) {
    try {
      const res = await fetch(`/api/rooms/${code}/timeout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: { ...room, game: nextGame }, expected }),
      });
      if (res.status === 409) return false; // stale / lost the race — clean rejection
      if (!res.ok) return false;
      const updated = await res.json();
      if (activeRoomCodeRef.current !== code) return false;
      adoptRoom(updated);
      return true;
    } catch (e) {
      return false;
    }
  }

  async function pollRoom() {
    if (!roomCode || pollInFlightRef.current) return;
    const code = roomCode;
    const requestId = ++pollSeqRef.current;
    const mutationVersionAtStart = roomMutationRef.current;
    pollInFlightRef.current = true;
    try {
      const res = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
      if (activeRoomCodeRef.current !== code) return;
      if (res.status === 404) {
        clearOnlineSession();
        setRoom(null);
        setRoomCode("");
        setOnlinePhase("menu");
        return;
      }
      if (!res.ok) return;
      const doc = await res.json();
      if (activeRoomCodeRef.current !== code) return;
      if (requestId < appliedPollSeqRef.current) return;
      if (mutationVersionAtStart !== roomMutationRef.current) return;
      const optimisticRoom = pendingOptimisticRoomRef.current;
      if (
        optimisticRoom &&
        optimisticRoom.code === code &&
        optimisticRoom.mutationVersion === mutationVersionAtStart &&
        isBehindOptimisticRoom(doc, optimisticRoom.snapshot)
      ) {
        return;
      }
      const incomingUpdatedAt = typeof doc?.updatedAt === "string" ? Date.parse(doc.updatedAt) : Number.NaN;
      if (Number.isFinite(incomingUpdatedAt) && incomingUpdatedAt < latestRoomUpdatedAtRef.current) return;
      const seat = doc.started ? doc.game?.players?.find((p) => p.id === myId) : doc.lobby?.find((p) => p.id === myId);
      if (!seat) {
        clearOnlineSession();
        setRoom(null);
        setRoomCode("");
        setOnlinePhase("menu");
        return;
      }
      appliedPollSeqRef.current = requestId;
      adoptRoom(doc);
      if (!myName && seat.name) setMyName(seat.name);
      setOnlinePhase(doc.started ? "play" : "lobby");
    } catch (e) {
      /* room not found yet or transient error, ignore */
    } finally {
      pollInFlightRef.current = false;
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
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ room: doc }),
        });
        if (res.status === 409) continue;
        if (!res.ok) throw new Error("create_failed");
        const created = await res.json();
        writeOnlineSession({ roomCode: code, myId, myName: myName.trim() });
        setRoomCode(code);
        adoptRoom(created);
        setOnlinePhase("lobby");
        return;
      } catch (e) {
        setError(t("errCreate"));
        return;
      }
    }
    setError(t("errCreate"));
  }

  async function joinRoom(codeRaw) {
    setError("");
    const code = codeRaw.trim().toUpperCase();
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ player: { id: myId, name: myName.trim() } }),
      });
      if (res.status === 404) {
        setError(t("errNoRoom"));
        return;
      }
      if (res.status === 409) {
        setError(t("errStarted"));
        return;
      }
      if (res.status === 410) {
        setError(t("errFull"));
        return;
      }
      if (!res.ok) throw new Error("join_failed");
      const doc = await res.json();
      writeOnlineSession({ roomCode: code, myId, myName: myName.trim() });
      setRoomCode(code);
      adoptRoom(doc);
      setOnlinePhase("lobby");
    } catch (e) {
      setError(t("errNoRoom"));
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
    sendDealSnapshot(g, roomCode);
    await saveRoomTo(roomCode, { ...room, started: true, game: g });
  }

  async function dispatchGame(newGame) {
    if (!room) return;
    await saveRoomTo(roomCode, { ...room, game: newGame });
  }

  function exitToMenu() {
    clearOnlineSession();
    resetRoomSyncState();
    setRoomCode("");
    setRoom(null);
    setOnlinePhase("menu");
    setError("");
  }

  function exitToHome() {
    clearOnlineSession();
    resetRoomSyncState();
    setRoomCode("");
    setRoom(null);
    setOnlinePhase("menu");
    setError("");
    onBack();
  }

  if (onlinePhase === "menu") {
    return <OnlineMenu myName={myName} setMyName={setMyName} onCreate={createRoom} onJoin={joinRoom} onBack={onBack} error={error} />;
  }
  if (onlinePhase === "lobby" && room) {
    return <OnlineLobby room={room} myId={myId} onStart={startOnlineGame} onAddBot={addBot} onRemoveBot={removeBot} onBack={exitToMenu} />;
  }
  if (onlinePhase === "play" && room && room.game) {
    return (
      <GameBoard
        game={room.game}
        myId={myId}
        isOnline
        isHost={room.hostId === myId}
        roomCode={roomCode}
        roomUpdatedAt={room.updatedAt}
        onClaimTimeout={(nextGame, expected) => claimTimeout(roomCode, nextGame, expected)}
        onDeclineBlock={(paId) => declineBlockOnline(roomCode, paId)}
        dispatch={dispatchGame}
        onExit={exitToMenu}
        onGoHome={exitToHome}
      />
    );
  }
  return (
    <div dir={L.dir} className="hilla-root min-h-screen w-full flex flex-col items-center justify-center gap-3" style={{ ...pageBg, color: INK }}>
      <GlobalFont />
      <Wordmark height={44} />
      <span className="tsz-13" style={{ color: `${INK}88` }}>{t("loading")}</span>
    </div>
  );
}


/* --------------------------------- ASSET PRELOAD ---------------------------------
   Everything the game will ever draw is fetched and decoded up front, behind a short splash, so no
   card ever appears blank and then "pops" its drawing in. The decoded Image objects are kept in
   PRELOADED for the life of the page so the browser keeps them warm in memory. Fonts are awaited
   too (so text never swaps style after the game opens). Hard cap: PRELOAD_MAX_MS — on a very slow
   connection the game opens anyway rather than hanging. */
const PRELOAD_MAX_MS = 6000;
const PRELOAD_MIN_MS = 1200;
const PRELOADED = [];
let preloadPromise = null;

function preloadAllAssets(onProgress) {
  if (preloadPromise) return preloadPromise;
  const urls = Array.from(new Set(Object.values(ART)));
  const fontSpecs = [
    '400 16px "IBM Plex Sans Arabic"',
    '500 16px "IBM Plex Sans Arabic"',
    '600 16px "IBM Plex Sans Arabic"',
    '700 16px "IBM Plex Sans Arabic"',
    '400 16px "Markazi Text"',
    '700 16px "Markazi Text"',
  ];
  const total = urls.length + 1;
  let done = 0;
  const tick = () => {
    done += 1;
    try {
      onProgress && onProgress(Math.min(1, done / total));
    } catch {}
  };
  const imageJobs = urls.map(
    (src) =>
      new Promise((resolve) => {
        try {
          const img = new Image();
          img.decoding = "async";
          let settled = false;
          // Done on whichever comes first: load/error, or decode. Some engines (embedded webviews)
          // never settle decode() for an off-DOM image, which would otherwise hold the splash to
          // its 6s cap; decode is still requested so the image is warm where it does work.
          const finish = () => {
            if (settled) return;
            settled = true;
            tick();
            resolve();
          };
          img.onload = finish;
          img.onerror = finish;
          img.src = src;
          PRELOADED.push(img);
          if (img.decode) img.decode().then(finish, () => {});
        } catch {
          tick();
          resolve();
        }
      })
  );
  const fontJob = (async () => {
    try {
      if (typeof document !== "undefined" && document.fonts) {
        await Promise.all(fontSpecs.map((f) => document.fonts.load(f, "حُلّة").catch(() => null)));
        await document.fonts.ready;
      }
    } catch {}
    tick();
  })();
  const all = Promise.all([...imageJobs, fontJob]);
  const cap = new Promise((resolve) => setTimeout(resolve, PRELOAD_MAX_MS));
  preloadPromise = Promise.race([all, cap]);
  return preloadPromise;
}

// Splash: the card-back sunburst fills the screen and turns slowly behind a cream plaque holding the
// wordmark and progress — the same "back of the card" look you see before every hand.
function LoadingSplash({ progress }) {
  const { t, tb, L } = useI18n();
  return (
    <div dir={L.dir} className="hilla-root fixed inset-0 overflow-hidden flex items-center justify-center" style={{ background: CREAM, color: INK }}>
      <GlobalFont />
      <div
        aria-hidden="true"
        className="absolute hilla-rays"
        style={{
          width: "200vmax",
          height: "200vmax",
          left: "50%",
          top: "50%",
          marginLeft: "-100vmax",
          marginTop: "-100vmax",
          backgroundImage: `repeating-conic-gradient(from 0deg, ${BRAND} 0deg 7.5deg, ${CREAM} 7.5deg 15deg)`,
        }}
      />
      <div
        className="relative flex flex-col items-center gap-4 px-9 pt-7 pb-6 hilla-pop"
        style={{ background: BEIGE, borderRadius: 26, boxShadow: `0 0 0 3px ${CREAM}, 0 0 0 5px ${BRAND}, 0 24px 50px -14px rgba(0,0,0,.45)` }}
      >
        <Wordmark height={64} color={INK} />
        <div className="w-36 h-1.5 rounded-full overflow-hidden" style={{ background: `${INK}1f` }}>
          <div className="h-full rounded-full" style={{ width: `${Math.round(progress * 100)}%`, background: BRAND, transition: "width .2s ease-out" }} />
        </div>
        <span className="tsz-12 font-semibold" style={{ color: `${INK}99` }}>
          {t("preparing")}
        </span>
      </div>
    </div>
  );
}

/* --------------------------------- HOME: SADU MAJLIS ---------------------------------
   The home screen is a Sadu rug (Al Sadu weaving: red, soft charcoal, white, beige) with the
   wordmark sewn on as a woven label, and the main choices as three playing cards tossed on it.
   Top bar: account chip (guest name / sign-in, start side) and a compact language menu. */
const SADU_TILE = (() => {
  const R = "#9B1B2A",
    K = "#3B3132", // soft charcoal, thin bands only
    W = "#F6EEDC",
    B = "#E2CFA6";
  let s = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='300' viewBox='0 0 96 300'>`;
  s += `<rect width='96' height='300' fill='${R}'/>`;
  s += `<rect y='0' width='96' height='26' fill='${K}'/>`;
  for (let x = 0; x < 96; x += 12) s += `<polygon points='${x},26 ${x + 12},26 ${x + 6},36' fill='${K}'/>`;
  s += `<rect y='38' width='96' height='4' fill='${W}'/>`;
  for (const cx of [0, 48, 96]) {
    s += `<polygon points='${cx},50 ${cx + 26},82 ${cx},114 ${cx - 26},82' fill='none' stroke='${W}' stroke-width='5'/>`;
    s += `<polygon points='${cx},70 ${cx + 10},82 ${cx},94 ${cx - 10},82' fill='${K}'/>`;
  }
  s += `<rect y='122' width='96' height='4' fill='${W}'/>`;
  s += `<rect y='130' width='96' height='22' fill='${B}'/>`;
  for (let x = 0; x < 96; x += 16) s += `<polygon points='${x},152 ${x + 8},134 ${x + 16},152' fill='${R}'/>`;
  s += `<rect y='152' width='96' height='4' fill='${K}'/>`;
  s += `<rect y='164' width='96' height='40' fill='${W}'/>`;
  for (let x = 0; x < 96; x += 24) s += `<polygon points='${x},184 ${x + 12},168 ${x + 24},184 ${x + 12},200' fill='${R}'/><rect x='${x + 9}' y='181' width='6' height='6' fill='${K}'/>`;
  s += `<rect y='212' width='96' height='4' fill='${K}'/>`;
  for (let x = 0; x < 96; x += 8) s += `<rect x='${x}' y='224' width='4' height='14' fill='${W}'/>`;
  s += `<rect y='246' width='96' height='54' fill='${B}'/>`;
  for (let x = 0; x < 96; x += 32) s += `<polygon points='${x + 16},254 ${x + 30},273 ${x + 16},292 ${x + 2},273' fill='${R}'/><polygon points='${x + 16},266 ${x + 21},273 ${x + 16},280 ${x + 11},273' fill='${W}'/>`;
  s += `</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(s)}")`;
})();

// Leaderboard nickname. Artifact: kept on this device. Production: profiles.nickname via
// POST /api/profile/nickname (see hulla-leaderboard-spec.md §6), with this as a cache.
const NICK_STORE = "hulla-nickname";
function loadNick() {
  try {
    return window.localStorage.getItem(NICK_STORE) || "";
  } catch {
    return "";
  }
}
const cleanNick = (v) => v.trim().replace(/\s+/g, " ");
const nickValid = (v) => {
  const n = [...cleanNick(v)].length;
  return n >= 2 && n <= 16;
};

function SaduToast({ msg }) {
  if (!msg) return null;
  return (
    <div key={msg.id} className="fixed left-1/2 sd-toast tsz-13 font-bold rounded-full px-4 py-2" style={{ bottom: "calc(max(16px, env(safe-area-inset-bottom)) + 96px)", zIndex: 80, background: INK, color: CREAM, boxShadow: "0 10px 24px -10px rgba(0,0,0,.5)", whiteSpace: "nowrap" }}>
      {msg.text}
    </div>
  );
}

function LangMenu() {
  const { L, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const cur = LANGS.find((l) => l.code === L.code) || LANGS[0];
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label={t("sdLang")} aria-expanded={open} className="flex items-center gap-1.5 rounded-full px-3 py-2 tsz-12 font-bold" style={{ background: `${CREAM}f2`, color: INK, boxShadow: "0 4px 12px -4px rgba(0,0,0,.45)" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
        </svg>
        {cur.label} <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0" style={{ zIndex: 41 }} onClick={() => setOpen(false)} />
          <div className="absolute mt-2 rounded-2xl overflow-hidden hilla-pop" style={{ left: 0, zIndex: 42, minWidth: 140, background: CREAM, boxShadow: `0 0 0 1.5px ${GOLD}, 0 14px 30px -10px rgba(0,0,0,.5)` }}>
            {LANGS.map((l) => (
              <button
                key={l.code}
                dir={l.dir}
                onClick={() => {
                  setLang && setLang(l.code);
                  setOpen(false);
                }}
                className="w-full px-4 py-2.5 tsz-13 font-semibold flex items-center justify-between gap-3"
                style={{ color: INK, background: l.code === cur.code ? `${GOLD}33` : "transparent" }}
              >
                <span>{l.label}</span>
                <span style={{ color: BRAND }}>{l.code === cur.code ? "✓" : ""}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AccountChip({ nick, onClick }) {
  const { t } = useI18n();
  const initial = nick ? [...nick][0] : [...t("sdGuest")][0];
  return (
    <button onClick={onClick} className="flex items-center gap-2 rounded-full py-1" style={{ paddingInlineStart: 4, paddingInlineEnd: 12, background: `${CREAM}f2`, boxShadow: "0 4px 12px -4px rgba(0,0,0,.45)", maxWidth: "60vw" }}>
      <span className="w-8 h-8 rounded-full flex items-center justify-center tsz-14 font-bold flex-shrink-0" style={{ background: BRAND, color: CREAM, boxShadow: `0 0 0 2px ${CREAM}, 0 0 0 3.5px ${GOLD}` }}>
        {initial}
      </span>
      <span className="flex flex-col items-start leading-tight min-w-0">
        <span className="tsz-12 font-bold truncate" style={{ color: INK, maxWidth: "40vw" }}>
          {nick || t("sdGuest")}
        </span>
        <span className="tsz-10 font-semibold truncate" style={{ color: BRAND, maxWidth: "40vw" }}>
          {t("sdSaveShort")}
        </span>
      </span>
    </button>
  );
}

// Account sheet. Name: pick one as a guest, edit any time. Saving the account (Google / email
// code) is production-only (Supabase linkIdentity / updateUser + verifyOtp).
function ProfileSheet({ nick, onSaveNick, onClose, onSignIn }) {
  const { t, L } = useI18n();
  const [editing, setEditing] = useState(!nick);
  const [draft, setDraft] = useState(nick || "");
  const [saveErr, setSaveErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = nickValid(draft);
  const initial = nick ? [...nick][0] : [...t("sdGuest")][0];
  return (
    <Sheet onBackdrop={onClose} maxW={380} z={90}>
      <div dir={L.dir} className="text-center">
        <span className="mx-auto w-16 h-16 rounded-full flex items-center justify-center font-bold" style={{ fontSize: 26, background: BRAND, color: CREAM, boxShadow: `0 0 0 3px ${CREAM}, 0 0 0 5px ${GOLD}` }}>
          {initial}
        </span>
        {editing ? (
          <form
            className="mt-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!ok || busy) return;
              setBusy(true);
              const err = await onSaveNick(cleanNick(draft));
              setBusy(false);
              if (err) {
                setSaveErr(t(`sdErr_${err}`));
                return;
              }
              setSaveErr("");
              setEditing(false);
            }}
          >
            <div className="tsz-13 font-bold mb-1.5" style={{ color: INK }}>
              {nick ? t("sdChangeName") : t("sdPickName")}
            </div>
            <div className="flex gap-2">
              <input
                id="hulla-nick"
                value={draft}
                autoFocus
                maxLength={24}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t("sdNamePh")}
                className="flex-1 min-w-0 rounded-xl px-3 py-2.5 tsz-14 hstart focus:outline-none"
                style={{ background: "#fff", color: INK, boxShadow: `inset 0 0 0 1.5px ${ok ? GOLD : INK + "22"}` }}
              />
              <button type="submit" disabled={!ok} className={`px-4 tsz-13 ${btn}`} style={ok ? btnPrimary : { background: `${INK}12`, color: `${INK}55` }}>
                {t("sdSave")}
              </button>
            </div>
            <div className="tsz-10 mt-1 hstart" style={{ color: `${INK}77` }}>
              {t("sdNameRule")}
            </div>
            {saveErr && (
              <div className="tsz-11 mt-1 font-semibold hstart" style={{ color: BRAND }}>
                {saveErr}
              </div>
            )}
          </form>
        ) : (
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="display-font font-bold tsz-20" style={{ color: BRAND }}>
              {nick}
            </span>
            <button
              onClick={() => {
                setDraft(nick);
                setEditing(true);
              }}
              className="tsz-11 font-bold rounded-full px-2.5 py-1"
              style={{ background: `${GOLD}33`, color: GOLD_DK }}
            >
              ✎ {t("sdEdit")}
            </button>
          </div>
        )}
        <div className="mt-4 rounded-2xl p-3" style={{ background: `${INK}08` }}>
          <div className="tsz-13 font-bold" style={{ color: INK }}>
            {t("sdGuestTitle")}
          </div>
          <p className="tsz-11 mt-0.5" style={{ color: `${INK}99` }}>
            {t("sdGuestBody")}
          </p>
          <div className="space-y-2 mt-3">
            <button onClick={() => onSignIn("google")} className={`w-full py-3 tsz-14 flex items-center justify-center gap-2 ${btn}`} style={{ background: "#fff", color: INK, boxShadow: `inset 0 0 0 1.5px ${INK}22` }}>
              <span className="font-bold" style={{ color: "#4285F4" }}>
                G
              </span>{" "}
              {t("sdGoogle")}
            </button>
            <button onClick={() => onSignIn("email")} className={`w-full py-3 tsz-14 ${btn}`} style={btnPrimary}>
              {t("sdEmail")}
            </button>
          </div>
        </div>
        <button onClick={onClose} className="mt-3 tsz-12 font-semibold" style={{ color: `${INK}77` }}>
          {t("later")}
        </button>
      </div>
    </Sheet>
  );
}

// One of the three menu cards lying on the rug.
function RugCard({ title, sub, icon, bg, fg, style, big, lifted, onClick }) {
  return (
    <button
      onClick={onClick}
      className="absolute sd-card flex flex-col items-center justify-center text-center"
      style={{
        width: big ? 136 : 112,
        height: big ? 186 : 154,
        background: bg,
        color: fg,
        borderRadius: 14,
        border: `3px solid ${CREAM}`,
        boxShadow: lifted ? "0 30px 40px -14px rgba(0,0,0,.65)" : "0 12px 22px -10px rgba(0,0,0,.6)",
        ...style,
      }}
    >
      {icon}
      <span className="display-font font-bold mt-3 leading-none px-1" style={{ fontSize: big ? 26 : [...title].length > 8 ? 16 : 19 }}>
        {title}
      </span>
      <span className="tsz-10 font-semibold mt-1" style={{ opacity: 0.75 }}>
        {sub}
      </span>
    </button>
  );
}

function SaduHome({ onOnline, onLocal, onRules, installed, onInstall, nick, setNick }) {
  const { t, L } = useI18n();
  const [toast, setToast] = useState(null);
  const [lift, setLift] = useState(null);
  const [profile, setProfile] = useState(false);
  const say = (text) => setToast({ id: Date.now(), text });
  // a tap lifts the card for a beat, then opens
  const play = (key, go) => {
    setLift(key);
    setTimeout(() => {
      setLift(null);
      go();
    }, 260);
  };
  const tilt = (key, deg) => (lift === key ? "rotate(0deg) translateY(-26px) scale(1.06)" : `rotate(${deg}deg)`);
  return (
    <div
      dir={L.dir}
      className="hilla-root relative w-full flex flex-col overflow-hidden"
      style={{ minHeight: "100dvh", ...pageBg, color: INK }}
    >
      <GlobalFont />

      {/* top bar: account on the start side (right in Arabic), language on the end side */}
      <div dir="rtl" className="relative flex items-center justify-between gap-3" style={{ zIndex: 40, paddingTop: "max(16px, calc(env(safe-area-inset-top) + 8px))", paddingLeft: "max(16px, env(safe-area-inset-left))", paddingRight: "max(16px, env(safe-area-inset-right))" }}>
        <AccountChip nick={nick} onClick={() => setProfile(true)} />
        <LangMenu />
      </div>

      {/* woven label */}
      <div className="relative flex justify-center mt-5">
        <div className="text-center px-7 pt-4 pb-3" style={{ transform: "rotate(-1.5deg)", background: CREAM, borderRadius: 6, boxShadow: `0 0 0 3px ${CREAM}, 0 0 0 4.5px ${GOLD_DK}, 0 18px 30px -12px rgba(0,0,0,.6)`, outline: `1.5px dashed ${GOLD_DK}`, outlineOffset: -8 }}>
          <Wordmark height={66} />
          <div className="tsz-12 font-bold mt-1" style={{ color: MAROON_DK }}>
            {t("sdTagline")}
          </div>
        </div>
      </div>

      {/* the three cards */}
      <div className="relative flex-1 flex items-center justify-center" style={{ minHeight: 330 }}>
        <div className="relative" style={{ width: 340, height: 320 }}>
          <RugCard big title={t("sdOnline")} sub={t("sdOnlineSub")} bg={BRAND} fg={CREAM} lifted={lift === "online"} icon={<Wifi className="w-10 h-10" style={{ color: GOLD }} />} style={{ left: "50%", top: 0, marginLeft: -68, transform: tilt("online", -4), zIndex: 6 }} onClick={() => play("online", onOnline)} />
          <RugCard title={t("sdLocal")} sub={t("sdLocalSub")} bg={CREAM} fg={BRAND} lifted={lift === "local"} icon={<Home className="w-9 h-9" style={{ color: BRAND }} />} style={{ right: 8, top: 150, transform: tilt("local", 12), zIndex: 5 }} onClick={() => play("local", onLocal)} />
          <RugCard title={t("sdRank")} sub={t("sdRankSub")} bg="#2C3E63" fg={CREAM} lifted={lift === "rank"} icon={<span style={{ fontSize: 34 }}>🏆</span>} style={{ left: 8, top: 150, transform: tilt("rank", -12), zIndex: 5 }} onClick={() => play("rank", () => say(t("sdRankSoon")))} />
        </div>
      </div>

      {/* how to play + add to home */}
      <div className="relative flex flex-wrap items-center justify-center gap-2 px-4">
        <button onClick={onRules} className="tsz-13 font-bold rounded-full px-4 py-2" style={{ background: `${CREAM}ee`, color: BRAND }}>
          {t("howToPlay")}
        </button>
        {!installed && (
          <button onClick={onInstall} className="tsz-12 font-semibold rounded-full px-4 py-2" style={{ background: `${CREAM}cc`, color: `${INK}aa` }}>
            {t("addToHome")}
          </button>
        )}
      </div>
      <div className="relative flex justify-center px-4 mt-3" style={{ paddingBottom: "max(14px, calc(env(safe-area-inset-bottom) + 8px))" }}>
        <span className="text-center tsz-10 font-semibold rounded-full px-3 py-1" style={{ background: `${CREAM}e6`, color: `${INK}99` }}>
          {t("madeBy")} · {t("credit")}
        </span>
      </div>

      {profile && (
        <ProfileSheet
          nick={nick}
          onClose={() => setProfile(false)}
          onSaveNick={async (n) => {
            // With accounts on, the server validates (unique, filtered); localStorage stays a cache.
            const res = await saveNicknameRemote(n);
            if (!res.ok && res.error !== "offline") return res.error;
            setNick(res.ok ? res.nickname : n);
            say(t("sdHello", { name: res.ok ? res.nickname : n }));
            return null;
          }}
          onSignIn={async (provider) => {
            if (provider === "google" && GOOGLE_ENABLED) {
              const { error } = await linkGoogle();
              if (error) say(error);
              return;
            }
            say(t("sdAuthSoon"));
          }}
        />
      )}
      <SaduToast msg={toast} />
    </div>
  );
}

/* --------------------------------- APP ICON CHOICE ---------------------------------
   The player picks the home-screen icon. In the browser we swap the page's favicon and
   apple-touch-icon links; iOS and Android read those when the game is added to the home screen,
   so the choice has to be made before adding (to change it later: remove and re-add). Thumbnails
   only here; production serves the full icon set from /icons/<key>/. */
const APP_ICONS = [
  { key: "b", src: "/icons/b/icon-192.png" },
  { key: "f", src: "/icons/f/icon-192.png" },
  { key: "a2", src: "/icons/a2/icon-192.png" },
  { key: "d2", src: "/icons/d2/icon-192.png" },
  { key: "e2", src: "/icons/e2/icon-192.png" },
  { key: "najdi", src: "/icons/najdi/icon-192.png" },
  { key: "sharqi", src: "/icons/sharqi/icon-192.png" },
  { key: "janoubi", src: "/icons/janoubi/icon-192.png" },
  { key: "gharbi", src: "/icons/gharbi/icon-192.png" },
];
const DEFAULT_APP_ICON = "b";
// v2: the old key was written on every load, so everyone had "e2" saved. This one is written only on pick.
const APP_ICON_STORE = "hulla-app-icon-v2";

function applyAppIcon(key) {
  const icon = APP_ICONS.find((i) => i.key === key) || APP_ICONS[0];
  try {
    const set = (rel, sizes) => {
      let el = document.head.querySelector(`link[rel="${rel}"]${sizes ? `[sizes="${sizes}"]` : ""}`);
      if (!el) {
        el = document.createElement("link");
        el.rel = rel;
        if (sizes) el.setAttribute("sizes", sizes);
        document.head.appendChild(el);
      }
      return el;
    };
    set("icon").href = `/icons/${icon.key}/favicon-32.png`;
    set("apple-touch-icon").href = `/icons/${icon.key}/apple-touch-icon-180.png`;
    // Chrome/Android read the manifest at install time: point it at this icon's manifest copy.
    set("manifest").href = `/manifest-${icon.key}.webmanifest`;
  } catch {}
}

function loadAppIcon() {
  try {
    const k = window.localStorage.getItem(APP_ICON_STORE);
    if (k && APP_ICONS.some((i) => i.key === k)) return k;
  } catch {}
  return DEFAULT_APP_ICON;
}

// Install helpers. Chrome/Edge/Android fire `beforeinstallprompt` when the site is installable; we
// keep that event and replay it from our own button. iOS has no programmatic install, so there we
// show the two-tap Share → "Add to Home Screen" steps instead.
const isStandalone = () => {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  } catch {
    return false;
  }
};
const isIOS = () => {
  try {
    const ua = navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  } catch {
    return false;
  }
};

function AppIconPicker({ value, onChange, onClose, installEvent, onInstalled }) {
  const { t } = useI18n();
  const [showSteps, setShowSteps] = useState(false);
  const ios = isIOS();
  async function install() {
    if (installEvent) {
      try {
        installEvent.prompt();
        const r = await installEvent.userChoice;
        if (r && r.outcome === "accepted") {
          onInstalled && onInstalled();
          onClose();
        }
        return;
      } catch {}
    }
    setShowSteps(true);
  }
  const steps = ios ? [t("iosStep1"), t("iosStep2"), t("iosStep3")] : [t("andStep1"), t("andStep2")];
  return (
    <Sheet onBackdrop={onClose} maxW={400}>
      <div className="display-font font-bold tsz-20 mb-1" style={{ color: BRAND }}>
        {t("installTitle")}
      </div>
      <div className="tsz-12 mb-4" style={{ color: `${INK}88` }}>
        {t("appIconHint")}
      </div>
      <div dir="rtl" className="grid grid-cols-3 gap-3 justify-items-center">
        {APP_ICONS.map((ic) => {
          const on = ic.key === value;
          return (
            <button
              key={ic.key}
              type="button"
              onClick={() => onChange(ic.key)}
              className="p-0 transition active:scale-95"
              style={{ borderRadius: 22, boxShadow: on ? `0 0 0 3px ${CREAM}, 0 0 0 6px ${GOLD}` : "0 6px 14px -8px rgba(60,30,10,.45)" }}
              aria-pressed={on}
            >
              <img src={ic.src} alt="" draggable={false} style={{ width: 84, height: 84, borderRadius: 20, display: "block" }} />
            </button>
          );
        })}
      </div>

      {showSteps ? (
        <div className="mt-5 rounded-2xl p-3 hstart hilla-pop" style={{ background: `${INK}08` }}>
          <div className="tsz-13 font-bold mb-2" style={{ color: INK }}>
            {ios ? t("iosHow") : t("andHow")}
          </div>
          <ol className="space-y-1.5">
            {steps.map((st, i) => (
              <li key={i} className="flex items-start gap-2 tsz-13" style={{ color: INK }}>
                <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center tsz-11 font-bold" style={{ background: BRAND, color: CREAM }}>
                  {i + 1}
                </span>
                <span>{st}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <button onClick={install} className={`w-full mt-5 py-3 tsz-14 flex items-center justify-center gap-2 ${btn}`} style={btnPrimary}>
        {t("addToHome")}
      </button>
      <button onClick={onClose} className="w-full mt-3 tsz-12 font-semibold" style={{ color: `${INK}77` }}>
        {t("later")}
      </button>
    </Sheet>
  );
}

/* --------------------------------- APP ROOT --------------------------------- */

function HillaApp() {
  const { t, L } = useI18n();
  const [mode, setMode] = useState("boot"); // boot | home | local | online
  const [localGame, setLocalGame] = useState(null);
  const [appIcon, setAppIcon] = useState(loadAppIcon);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [nick, setNickState] = useState(loadNick);
  const setNick = (n) => {
    setNickState(n);
    try {
      window.localStorage.setItem(NICK_STORE, n);
    } catch {}
  };
  const [installEvent, setInstallEvent] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);
  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  useEffect(() => {
    applyAppIcon(appIcon);
  }, [appIcon]);
  const pickAppIcon = (key) => {
    setAppIcon(key);
    try {
      window.localStorage.setItem(APP_ICON_STORE, key);
    } catch {}
  };

  useEffect(() => {
    setMode(readOnlineSession() ? "online" : "home");
    ensureGuest(); // silent guest account for the leaderboard; a no-op until auth is configured
  }, []);

  if (mode === "boot") {
    return (
      <div dir="rtl" className="hilla-root min-h-screen w-full flex items-center justify-center" style={{ ...pageBg, color: MAROON }}>
        <GlobalFont />
        {t("loading")}
      </div>
    );
  }

  if (mode === "home") {
    return (
      <>
        <SaduHome
          onOnline={() => setMode("online")}
          onLocal={() => setMode("local")}
          onRules={() => setShowRules(true)}
          installed={installed}
          onInstall={() => setShowIconPicker(true)}
          nick={nick}
          setNick={setNick}
        />
        {showRules && <HowToPlay onClose={() => setShowRules(false)} bigText={false} />}
        {showIconPicker && (
          <AppIconPicker
            value={appIcon}
            onChange={pickAppIcon}
            onClose={() => setShowIconPicker(false)}
            installEvent={installEvent}
            onInstalled={() => setInstalled(true)}
          />
        )}
      </>
    );
  }

  if (mode === "local") {
    if (!localGame)
      return (
        <LocalSetup
          onStart={(g) => {
            sendGameStarted(g, null);
            sendDealSnapshot(g, null);
            setLocalGame(g);
          }}
          onBack={() => setMode("home")}
        />
      );
    return <GameBoard game={localGame} myId={null} isOnline={false} roomCode={null} dispatch={setLocalGame} onExit={() => setLocalGame(null)} onGoHome={() => { setLocalGame(null); setMode("home"); }} />;
  }

  if (mode === "online") {
    return <OnlineFlow onBack={() => setMode("home")} />;
  }

  return null;
}

// Language lives above everything (default Arabic on every load, never remembered).
export default function HillaGame() {
  const [lang, setLang] = useState("ar");
  const value = useMemo(() => ({ ...makeI18n(lang), setLang }), [lang]);

  // #51 preload splash — an overlay on top of the app, not a gate: the online flow (session
  // rejoin, polling, reconnect) starts underneath immediately instead of waiting up to 6s.
  const [assetsReady, setAssetsReady] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  useEffect(() => {
    let alive = true;
    // keep the splash up at least 1.2s so the sunburst reads as intentional, not a flash
    const minShow = new Promise((r) => setTimeout(r, PRELOAD_MIN_MS));
    Promise.all([preloadAllAssets((p) => alive && setLoadProgress(p)), minShow]).then(() => {
      if (!alive) return;
      setLoadProgress(1);
      // a beat at 100% so the bar visibly completes instead of vanishing mid-way
      setTimeout(() => alive && setAssetsReady(true), 150);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!assetsReady) return;
    const tm = setTimeout(() => setSplashGone(true), 320);
    return () => clearTimeout(tm);
  }, [assetsReady]);

  return (
    <I18nContext.Provider value={value}>
      <HillaApp />
      {!splashGone && (
        <div
          aria-hidden={assetsReady}
          style={{ position: "fixed", inset: 0, zIndex: 20000, opacity: assetsReady ? 0 : 1, transition: "opacity .3s ease-out", pointerEvents: assetsReady ? "none" : "auto" }}
        >
          <LoadingSplash progress={loadProgress} />
        </div>
      )}
    </I18nContext.Provider>
  );
}

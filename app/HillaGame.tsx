// @ts-nocheck
'use client';
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Shirt, Gem, Shield, Shuffle, Users, Sparkles, RotateCcw, Hand, Archive, Ban, Repeat2, Gift, Search, Wifi, Home, Copy, Check, LogOut } from "lucide-react";

/* ---------------------------------- PALETTE ---------------------------------- */
const CREAM = "#F3E9D2";
const CREAM2 = "#EADFC0";
const MAROON = "#6B1F2A";
const MAROON_DK = "#4A141C";
const GOLD = "#C9A227";
const INK = "#2B211C";
const COMMON_COLOR = "#7A6A2E";
const TEAL = "#1F6F6B";

/* ---------------------------------- DATA ---------------------------------- */

const REGIONS = [
  { id: "najdi", name: "نجدي", color: "#5B2C6F", items: ["عقال", "مخطم", "ثوب نجدي", "بشت"] },
  { id: "sharqi", name: "شرقي", color: "#2F4B33", items: ["مرودن", "غوايش", "ثوب شرقي", "مخنق"] },
  { id: "hijazi", name: "حجازي", color: "#2B211C", items: ["برقع حجازي", "مقصب", "طرحة", "قفطان"] },
  { id: "janoubi", name: "جنوبي", color: "#1F6F6B", items: ["زهرة", "خرز", "ملفع", "مسبت"] },
];

const COMMON_ITEMS = ["قلادة", "خاتم", "محفظة عطر"];

const ACTION_TYPES = [
  { id: "giveTake", name: "عطني وأعطيك", count: 2, icon: Gift, desc: "أعط لاعبًا كرتين واسحب منه كرتين بدون رؤيتها." },
  { id: "drawTwo", name: "اقدع", count: 4, icon: Shuffle, desc: "لاعب مختار يسحب كرتين من كومة السحب." },
  { id: "stealTwo", name: "افزع لي", count: 2, icon: Hand, desc: "لاعب مختار يأخذ كرتين من يدك بدون رؤيتها." },
  { id: "block", name: "لا ما تقدر", count: 2, icon: Shield, desc: "يلغي أي أكشن يُستخدم ضدك أو ضد لاعب آخر." },
  { id: "freeze", name: "ثبّت الحَلّة", count: 2, icon: Repeat2, desc: "يبقى كرت التنسيق الحالي لجولة إضافية." },
  { id: "dig", name: "فتّش الصندوق", count: 2, icon: Search, desc: "اسحب 3 كروت واختر واحدًا، وأعد الباقي." },
];

const REC_COUNTS = { 2: 20, 3: 19, 4: 17, 5: 15, 6: 15 };
const JEWELRY = ["قلادة", "خاتم", "غوايش", "خرز", "مرودن", "مسبت", "مخنق", "محفظة عطر"];
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
    r.items.forEach((name) => {
      for (let k = 0; k < 6; k++) {
        deck.push({ id: uid(), kind: "item", name, region: r.id, regionName: r.name, color: r.color });
      }
    });
  });
  COMMON_ITEMS.forEach((name) => {
    for (let k = 0; k < 8; k++) {
      deck.push({ id: uid(), kind: "item", name, region: null, regionName: "شائع", color: COMMON_COLOR });
    }
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

function buildCoordDeck() {
  const deck = [];
  REGIONS.forEach((r) => {
    for (let v = 0; v < 3; v++) {
      const n = Math.random() < 0.4 ? 4 : 3;
      const items = shuffle(r.items).slice(0, n);
      deck.push({ id: uid(), type: "region", region: r.id, regionName: r.name, color: r.color, items });
    }
  });
  for (let v = 0; v < 8; v++) {
    const pool = shuffle([
      ...REGIONS.flatMap((r) => r.items.map((name) => ({ name, region: r.id }))),
      ...COMMON_ITEMS.map((name) => ({ name, region: null })),
    ]);
    const items = pool.slice(0, 2 + (v % 2)).map((p) => p.name);
    deck.push({ id: uid(), type: "random", region: null, items });
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
  const players = playersMeta.map((pm) => ({ id: pm.id, name: pm.name, hand: [] }));
  for (let i = 0; i < cap; i++) {
    players.forEach((p) => p.hand.push(full.pop()));
  }
  const cDeck = shuffle(buildCoordDeck());
  const first = cDeck.pop();
  return {
    players,
    drawPile: full,
    discardPile: [],
    coordDeck: cDeck,
    coordDiscard: [],
    currentCoord: first,
    lockCoord: false,
    currentPlayerIndex: 0,
    log: [`بدأت اللعبة بـ ${players.length} لاعبين، ${cap} كرت لكل لاعب.`],
    winner: null,
    pendingAction: null,
    digOptions: null,
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

function endTurn(game) {
  let g = { ...game };
  if (g.currentPlayerIndex === g.players.length - 1) {
    g = endRound(g);
    g.currentPlayerIndex = 0;
  } else {
    g.currentPlayerIndex = g.currentPlayerIndex + 1;
  }
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
  if (!g1.winner) g1 = endTurn(g1);
  return { game: g1, error: null };
}

function rPassTurn(game, playerId) {
  const player = game.players.find((p) => p.id === playerId);
  let g = pushLog(game, `${player.name} تجاوز الجولة.`);
  g = endTurn(g);
  return g;
}

function rPlayFreeze(game, playerId, cardId) {
  const player = game.players.find((p) => p.id === playerId);
  let { game: g1, removed } = removeFromHand(game, playerId, [cardId]);
  g1 = { ...g1, discardPile: [...g1.discardPile, ...removed], lockCoord: true };
  g1 = pushLog(g1, `${player.name} لعب ثبّت الحَلّة.`);
  g1 = checkWin(g1, playerId);
  if (!g1.winner) g1 = endTurn(g1);
  return g1;
}

function rPlayDig(game, playerId, cardId) {
  const player = game.players.find((p) => p.id === playerId);
  let { game: g1, removed } = removeFromHand(game, playerId, [cardId]);
  g1 = { ...g1, discardPile: [...g1.discardPile, ...removed] };
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
  if (!g.winner) g = endTurn(g);
  return g;
}

function rDeclareAction(game, playerId, cardId, actionType, targetId) {
  const player = game.players.find((p) => p.id === playerId);
  let { game: g1, removed } = removeFromHand(game, playerId, [cardId]);
  g1 = { ...g1, discardPile: [...g1.discardPile, ...removed] };
  g1 = { ...g1, pendingAction: { actionType, actorId: playerId, targetId, actorName: player.name } };
  return g1;
}

function rDeclareGiveTake(game, playerId, cardId, targetId, giveIds) {
  const player = game.players.find((p) => p.id === playerId);
  let { game: g1, removed } = removeFromHand(game, playerId, [cardId]);
  g1 = { ...g1, discardPile: [...g1.discardPile, ...removed] };
  g1 = { ...g1, pendingAction: { actionType: "giveTake", actorId: playerId, targetId, actorName: player.name, giveIds } };
  return g1;
}

function rCancelWithBlock(game, blockerId) {
  const blocker = game.players.find((p) => p.id === blockerId);
  const blockCard = blocker.hand.find((c) => c.kind === "action" && c.actionType === "block");
  if (!blockCard) return game;
  let { game: g1, removed } = removeFromHand(game, blockerId, [blockCard.id]);
  g1 = { ...g1, discardPile: [...g1.discardPile, ...removed] };
  g1 = pushLog(g1, `${blocker.name} استخدم لا ما تقدر! تم إلغاء ${actionMeta(game.pendingAction.actionType).name}.`);
  g1 = { ...g1, pendingAction: null };
  g1 = checkWin(g1, blockerId);
  if (!g1.winner) g1 = endTurn(g1);
  return g1;
}

function rResolvePendingAction(game) {
  const pa = game.pendingAction;
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
  if (!g.winner) g = endTurn(g);
  return g;
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
            حِلّة
          </span>
        </div>
      </div>
    </div>
  );
}

function ItemCard({ card, selected, onClick, small }) {
  const color = card.region ? REGIONS.find((r) => r.id === card.region).color : COMMON_COLOR;
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
      <div className="pt-2 px-1">
        <div className="text-[9px] font-bold" style={{ color, fontFamily: "Tajawal" }}>
          {card.regionName}
        </div>
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
          {card.items.map((it, i) => (
            <span key={i} className="text-[10px] rounded px-1.5 py-0.5 font-bold" style={{ background: `${color}18`, color, border: `1px solid ${color}55` }}>
              {it}
            </span>
          ))}
        </div>
      </div>
      <DiamondLattice color={color} vertical thickness={10} />
    </div>
  );
}

const GlobalFont = () => (
  <style>{`@import url('https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&family=Tajawal:wght@400;500;700;900&display=swap');`}</style>
);

const pageBg = {
  background: CREAM,
  backgroundImage: `linear-gradient(135deg, ${GOLD}0d 25%, transparent 25%), linear-gradient(225deg, ${GOLD}0d 25%, transparent 25%), linear-gradient(45deg, ${GOLD}0d 25%, transparent 25%), linear-gradient(315deg, ${GOLD}0d 25%, transparent 25%)`,
  backgroundPosition: "20px 0, 20px 0, 0 0, 0 0",
  backgroundSize: "40px 40px",
};

/* --------------------------------- GAME BOARD (shared) --------------------------------- */

function GameBoard({ game, myId, isOnline, dispatch, onExit }) {
  const [selected, setSelected] = useState([]);
  const [needTarget, setNeedTarget] = useState(null);
  const [giveStep, setGiveStep] = useState(null);
  const [revealed, setRevealed] = useState(isOnline ? true : false);
  const [errMsg, setErrMsg] = useState("");

  const current = game.players[game.currentPlayerIndex];
  const viewer = isOnline ? game.players.find((p) => p.id === myId) || current : current;
  const isMyTurn = isOnline ? current.id === myId : true;

  useEffect(() => {
    if (!errMsg) return;
    const t = setTimeout(() => setErrMsg(""), 3000);
    return () => clearTimeout(t);
  }, [errMsg]);

  function toggleSelect(cardId) {
    setSelected((s) => (s.includes(cardId) ? s.filter((x) => x !== cardId) : [...s, cardId]));
  }

  function afterMyMove() {
    setSelected([]);
    setNeedTarget(null);
    if (!isOnline) setRevealed(false);
  }

  function playSelectedItems() {
    const res = rPlayItems(game, viewer.id, selected);
    if (res.error) {
      setErrMsg(res.error);
      return;
    }
    afterMyMove();
    dispatch(res.game);
  }

  function passTurn() {
    dispatch(rPassTurn(game, viewer.id));
    afterMyMove();
  }

  function startAction(cardId) {
    const card = viewer.hand.find((c) => c.id === cardId);
    if (!card) return;
    if (card.actionType === "freeze") {
      dispatch(rPlayFreeze(game, viewer.id, cardId));
      afterMyMove();
      return;
    }
    if (card.actionType === "dig") {
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
    dispatch(rDeclareAction(game, viewer.id, card.id, card.actionType, targetId));
    setNeedTarget(null);
    if (!isOnline) setRevealed(false);
  }

  function confirmGiveTake(chosenIds) {
    dispatch(rDeclareGiveTake(game, viewer.id, giveStep.cardId, giveStep.targetId, chosenIds));
    setGiveStep(null);
    if (!isOnline) setRevealed(false);
  }

  function cancelWithBlock(blockerId) {
    dispatch(rCancelWithBlock(game, blockerId));
    if (!isOnline) setRevealed(false);
  }

  function resolvePendingAction() {
    dispatch(rResolvePendingAction(game));
    if (!isOnline) setRevealed(false);
  }

  function finishDig(keepId) {
    dispatch(rFinishDig(game, keepId));
    if (!isOnline) setRevealed(false);
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
            حِلّة {isOnline && <Wifi className="inline w-4 h-4 mb-1" style={{ color: TEAL }} />}
          </div>
          <button onClick={onExit} className="text-xs flex items-center gap-1" style={{ color: `${MAROON}99` }}>
            <RotateCcw className="w-3 h-3" /> لعبة جديدة
          </button>
        </div>
        <DiamondLattice color={GOLD} thickness={10} />

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
                  {p.name} {isOnline && p.id === myId && <span style={{ color: GOLD }}>(أنت)</span>} <span className="opacity-70">({p.hand.length})</span>
                </div>
              ))}
              <div className="px-3 py-1.5 rounded-full text-xs border-2 flex items-center gap-1" style={{ color: `${INK}77`, borderColor: `${MAROON}33` }}>
                <Archive className="w-3 h-3" /> سحب: {game.drawPile.length}
              </div>
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
                  <Ban className="w-8 h-8 mx-auto mb-2" style={{ color: MAROON }} />
                  <div className="font-bold mb-1" style={{ color: INK }}>
                    {game.pendingAction.actorName} يستخدم {actionMeta(game.pendingAction.actionType).name}
                  </div>
                  <div className="text-xs mb-4" style={{ color: `${INK}88` }}>
                    ضد {game.players.find((p) => p.id === game.pendingAction.targetId)?.name}. هل أحد يريد استخدام لا ما تقدر؟
                  </div>
                  <div className="space-y-2 mb-3">
                    {(isOnline ? eligibleBlockers.filter((p) => p.id === myId) : eligibleBlockers).length === 0 && (
                      <div className="text-xs" style={{ color: `${INK}55` }}>
                        {isOnline ? "ما تقدر تعترض على هذا الأكشن." : "لا يملك أحد كرت لا ما تقدر."}
                      </div>
                    )}
                    {(isOnline ? eligibleBlockers.filter((p) => p.id === myId) : eligibleBlockers).map((p) => (
                      <button key={p.id} onClick={() => cancelWithBlock(p.id)} className="w-full py-2 rounded-lg text-sm font-bold" style={{ background: MAROON, color: CREAM }}>
                        {p.name}: استخدم لا ما تقدر
                      </button>
                    ))}
                  </div>
                  {(!isOnline || game.pendingAction.actorId === myId) && (
                    <button onClick={resolvePendingAction} className="w-full py-2 rounded-lg font-black" style={{ background: GOLD, color: MAROON_DK }}>
                      لا أحد يعترض — تنفيذ
                    </button>
                  )}
                  {isOnline && game.pendingAction.actorId !== myId && (
                    <div className="text-xs" style={{ color: `${INK}55` }}>
                      بانتظار {game.pendingAction.actorName}...
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

            {!isOnline && !revealed ? (
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
                <div className="text-xs mb-2 font-bold" style={{ color: `${INK}77` }}>
                  عناصر اللبس {isOnline && <span style={{ color: GOLD }}>({viewer?.name})</span>}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-3 mb-3">
                  {viewer.hand
                    .filter((c) => c.kind === "item")
                    .map((c) => (
                      <ItemCard key={c.id} card={c} selected={selected.includes(c.id)} onClick={() => (isMyTurn ? toggleSelect(c.id) : null)} />
                    ))}
                  {viewer.hand.filter((c) => c.kind === "item").length === 0 && (
                    <div className="text-sm py-4" style={{ color: `${INK}44` }}>
                      لا توجد عناصر لبس في يدك.
                    </div>
                  )}
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
                  <button onClick={passTurn} disabled={!isMyTurn} className="px-5 py-2 rounded-lg border-2 font-bold disabled:opacity-30" style={{ color: `${INK}88`, borderColor: `${MAROON}33` }}>
                    تجاوز الجولة
                  </button>
                </div>

                <div className="text-xs mb-2 font-bold" style={{ color: `${INK}77` }}>
                  كروت الأكشن (كرت واحد كحد أقصى في كل جولة)
                </div>
                <div className="flex gap-2 overflow-x-auto pb-3">
                  {viewer.hand
                    .filter((c) => c.kind === "action")
                    .map((c) => (
                      <ActionCard key={c.id} card={c} disabled={!isMyTurn} onClick={() => startAction(c.id)} />
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
          اختر {max} كرت{max > 1 ? "ين" : ""} من يدك لإعطائها للاعب الآخر.
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
  const [names, setNames] = useState(["لاعب 1", "لاعب 2", "لاعب 3", "لاعب 4", "لاعب 5", "لاعب 6"]);
  const [perPlayer, setPerPlayer] = useState(REC_COUNTS[3]);

  return (
    <div dir="rtl" className="min-h-screen w-full flex items-center justify-center p-6" style={{ ...pageBg, fontFamily: "Tajawal" }}>
      <GlobalFont />
      <div className="w-full max-w-md">
        <div className="text-center mb-5">
          <CardBackHero />
          <p className="mt-3" style={{ color: MAROON_DK }}>
            وضع "تمرير الجهاز" — كل اللاعبين على نفس الجهاز
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
              <input
                key={i}
                value={names[i]}
                onChange={(e) => {
                  const copy = [...names];
                  copy[i] = e.target.value;
                  setNames(copy);
                }}
                placeholder={`اسم اللاعب ${i + 1}`}
                className="w-full rounded-lg px-3 py-2 text-sm border-2 focus:outline-none"
                style={{ background: CREAM, color: INK, borderColor: `${MAROON}33` }}
              />
            ))}
          </div>
          <div>
            <label className="text-sm mb-2 block font-bold" style={{ color: MAROON }}>
              عدد الكروت لكل لاعب: <span style={{ color: GOLD }}>{perPlayer}</span>
            </label>
            <input type="range" min={10} max={20} value={perPlayer} onChange={(e) => setPerPlayer(Number(e.target.value))} className="w-full" style={{ accentColor: MAROON }} />
          </div>
          <button
            onClick={() => {
              const meta = Array.from({ length: numPlayers }).map((_, i) => ({ id: `p${i}`, name: names[i]?.trim() || `لاعب ${i + 1}` }));
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

function OnlineLobby({ room, myId, onStart, onBack }) {
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
            حِلّة
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
                {p.name} {p.id === room.hostId && <span style={{ color: GOLD }}>(المضيف)</span>} {p.id === myId && <span style={{ color: TEAL }}>— أنت</span>}
              </span>
            </div>
          ))}

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

  async function startOnlineGame() {
    if (!room || room.hostId !== myId || room.lobby.length < 2) return;
    const g = createInitialGame(room.lobby, room.perPlayer);
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
    return <OnlineLobby room={room} myId={myId} onStart={startOnlineGame} onBack={exitToMenu} />;
  }
  if (onlinePhase === "play" && room && room.game) {
    return <GameBoard game={room.game} myId={myId} isOnline dispatch={dispatchGame} onExit={exitToMenu} />;
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
        </div>
      </div>
    );
  }

  if (mode === "local") {
    if (!localGame) return <LocalSetup onStart={setLocalGame} onBack={() => setMode("home")} />;
    return <GameBoard game={localGame} myId={null} isOnline={false} dispatch={setLocalGame} onExit={() => setLocalGame(null)} />;
  }

  if (mode === "online") {
    return <OnlineFlow onBack={() => setMode("home")} />;
  }

  return null;
}

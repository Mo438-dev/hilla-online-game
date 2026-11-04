// @ts-nocheck
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './analytics.css';

// The new analytics page, ported from the approved preview. It only draws: every number is aggregated on
// the server by /api/analytics2, and players are keyed by ref (public_id), never a user id.

const DAY = 86400000;
const ROSTER_REGIONS = [['najdi', 'نجدي'], ['sharqi', 'شرقي'], ['janoubi', 'جنوبي'], ['gharbi', 'غربي']];
const RARITY_AR = { common: 'شائع', medium: 'متوسط', rare: 'نادر' };
const ACTIONS = [
  { id: 'drawTwo', name: 'اقدع' },
  { id: 'stealTwo', name: 'افزع لي' },
  { id: 'giveTake', name: 'عطني وأعطيك' },
  { id: 'freeze', name: 'ثبّت الحَلّة' },
  { id: 'dig', name: 'فتّش الصندوق' },
  { id: 'block', name: 'لا ما تقدر' },
];
const ACTION_NAME = Object.fromEntries(ACTIONS.map((a) => [a.id, a.name]));
const PLATFORM_AR = { ios_app: 'آيفون · التطبيق', ios_safari: 'آيفون · سفاري', ios: 'آيفون', android: 'أندرويد', desktop: 'كمبيوتر' };
const REASON_AR = {
  bots_only: 'بوتات', not_finished: 'ما اكتملت', group_limit: 'حد المجموعة', integrity: 'فحص السلامة', same_device: 'جهاز واحد',
  before_accounts: 'قبل الحسابات', too_short: 'قصيرة', too_few_turns: 'أدوار قليلة', too_few_humans: 'بوتات',
};

const dayKey = (t, tz) => new Date(t + tz * 3600000).toISOString().slice(0, 10);
const fmt = (n, d = 0) => Number(n).toLocaleString('ar-SA', { maximumFractionDigits: d, minimumFractionDigits: d });
const pct = (x, d = 0) => (Number.isFinite(x) ? fmt(x * 100, d) + '٪' : '—');
const dateAr = (t, withTime) => new Date(t + 3 * 3600000).toLocaleString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}), timeZone: 'UTC' });
const dayAr = (k) => new Date(k).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short', timeZone: 'UTC' });
function ago(t) {
  const d = Math.floor((Date.now() - t) / DAY);
  if (d <= 0) return 'اليوم';
  if (d === 1) return 'أمس';
  if (d === 2) return 'قبل يومين';
  return d <= 10 ? `قبل ${fmt(d)} أيام` : `قبل ${fmt(d)} يوم`;
}
const pl = (one, two, few) => (n) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${fmt(n)} ${few}` : `${fmt(n)} ${one}`);
const nPlayers = pl('لاعب', 'لاعبين', 'لاعبين');
const nCards = pl('كرت', 'كرتين', 'كروت');
const nDays = pl('يوم', 'يومين', 'أيام');
const nReplies = pl('رد', 'ردّين', 'ردود');
const nBrowsers = pl('متصفح', 'متصفحين', 'متصفحات');
const games = pl('مباراة', 'مباراتين', 'مباريات');
const accountName = (a) => a?.name || 'ضيف بدون اسم';
const platformAr = (p) => PLATFORM_AR[p] || '—';

// One admin route. Keeps the last answer on screen while the next one loads.
function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetch(`/api/analytics2/${path}`, { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) { location.reload(); return; }
        const j = await r.json();
        if (live) setState(r.ok ? { data: j, error: null, loading: false } : { data: null, error: j.error || 'error', loading: false });
      })
      .catch((e) => live && setState((s) => ({ ...s, error: String(e?.message || e), loading: false })));
    return () => { live = false; };
  }, [path, tick]);
  return { ...state, reload: useCallback(() => setTick((n) => n + 1), []) };
}

function Status({ api, children }) {
  if (api.data) return children(api.data);
  if (api.error) return <div className="empty">ما قدرنا نجيب الأرقام: {api.error}</div>;
  return <div className="empty">جاري التحميل…</div>;
}

function Tip({ tip }) {
  if (!tip) return null;
  return <div className="tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>;
}
function useTip() {
  const [tip, setTip] = useState(null);
  const on = (text) => (e) => {
    const box = e.currentTarget.closest('.chart').getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ text, x: r.left + r.width / 2 - box.left, y: r.top - box.top - 8 });
  };
  return [tip, on, () => setTip(null)];
}
function Info({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="info">
      <button aria-label="وش يعني هذا الرقم" onClick={() => setOpen((v) => !v)} aria-expanded={open}>؟</button>
      {open && <span className="info-pop" role="note">{children}</span>}
    </span>
  );
}
function Kpi({ label, value, sub, info, tone }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}{info && <Info>{info}</Info>}</div>
      <div className={`kpi-value ${tone || ''}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
function Section({ title, note, children, right, id }) {
  return (
    <section className="sec" id={id}>
      <header className="sec-head">
        <div>
          <h2>{title}</h2>
          {note && <p className="sec-note">{note}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}
function Empty() { return <div className="empty">ما فيه بيانات بهالفلتر</div>; }
function Avatar({ a, size = 34 }) {
  return <span className="av" style={{ width: size, height: size, fontSize: size * 0.44 }}>{(a?.name || '؟').trim()[0]}</span>;
}
function Pill({ tone, children }) { return <span className={`pill ${tone || ''}`}>{children}</span>; }

function DailyBars({ list, tz }) {
  const [tip, on, off] = useTip();
  const map = {};
  list.forEach((s) => { const k = dayKey(s.t, tz); map[k] = (map[k] || 0) + 1; });
  const keys = Object.keys(map).sort();
  if (!keys.length) return <Empty />;
  const start = new Date(keys[0]).getTime();
  const end = new Date(keys[keys.length - 1]).getTime();
  const days = [];
  for (let t = start; t <= end; t += DAY) days.push(new Date(t).toISOString().slice(0, 10));
  const max = Math.max(...Object.values(map));
  const W = 640, H = 150, pad = 22;
  const bw = (W - 8) / days.length;
  const ticks = [days[0], days[Math.floor(days.length / 2)], days[days.length - 1]];
  return (
    <div className="chart" onMouseLeave={off}>
      <svg viewBox={`0 0 ${W} ${H + pad}`} role="img" aria-label="المباريات في كل يوم">
        {[0.5, 1].map((f) => <line key={f} x1="0" x2={W} y1={H - H * f * 0.92} y2={H - H * f * 0.92} className="grid" />)}
        <line x1="0" x2={W} y1={H} y2={H} className="axis" />
        {days.map((k, i) => {
          const v = map[k] || 0;
          const h = (v / max) * H * 0.92;
          return (
            <g key={k} onMouseEnter={on(`${dayAr(k)}، ${v ? games(v) : 'ما فيه'}`)}>
              <rect x={W - (i + 1) * bw} y="0" width={bw} height={H} fill="transparent" />
              {v > 0 && <rect x={W - (i + 1) * bw + bw * 0.18} y={H - h} width={Math.max(1.5, bw * 0.64)} height={h} rx={Math.min(3, bw * 0.3)} className="bar" />}
            </g>
          );
        })}
        <text x={W - 2} y={H + 16} className="tick" textAnchor="start">{dayAr(ticks[0])}</text>
        <text x={W / 2} y={H + 16} className="tick" textAnchor="middle">{dayAr(ticks[1])}</text>
        <text x={2} y={H + 16} className="tick" textAnchor="end">{dayAr(ticks[2])}</text>
        <text x={4} y={H - H * 0.92 - 4} className="tick" textAnchor="end">{fmt(max)}</text>
      </svg>
      <Tip tip={tip} />
    </div>
  );
}

function Heatmap({ list, tz }) {
  const [tip, on, off] = useTip();
  const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const grid = Array.from({ length: 7 }, () => Array(8).fill(0));
  list.forEach((s) => {
    const d = new Date(s.t + tz * 3600000);
    grid[d.getUTCDay()][Math.floor(d.getUTCHours() / 3)]++;
  });
  const max = Math.max(1, ...grid.flat());
  const slot = (i) => `${fmt(i * 3)}–${fmt(i * 3 + 3)}`;
  return (
    <div className="chart heat" onMouseLeave={off}>
      <div className="heat-grid">
        <span />
        {Array.from({ length: 8 }, (_, i) => <span key={i} className="heat-h">{fmt(i * 3)}</span>)}
        {grid.map((row, di) => (
          <React.Fragment key={di}>
            <span className="heat-d">{DAYS[di]}</span>
            {row.map((v, hi) => (
              <span key={hi} className="heat-c" tabIndex={0} onFocus={on(`${DAYS[di]} ${slot(hi)}، ${v ? games(v) : 'ما فيه'}`)} onMouseEnter={on(`${DAYS[di]} ${slot(hi)}، ${v ? games(v) : 'ما فيه'}`)}
                style={{ '--a': v ? 0.12 + 0.88 * (v / max) : 0 }} />
            ))}
          </React.Fragment>
        ))}
      </div>
      <Tip tip={tip} />
    </div>
  );
}

function HBars({ rows, format = (v) => fmt(v), max, tone }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.v));
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar" key={r.label}>
          <span className="hbar-l">{r.label}</span>
          <span className="hbar-track"><span className={`hbar-fill ${r.tone || tone || ''}`} style={{ width: `${Math.max(1.5, (r.v / m) * 100)}%` }} /></span>
          <span className="hbar-v">{format(r.v)}{r.sub && <small>{r.sub}</small>}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------ الخلاصة ------------------------------------ */
function findingValue(f) {
  if (f.key === 'reg.speed') return (v) => `×${fmt(v, 2)}`;
  return (v) => pct(v);
}
function Findings({ f, versions, go }) {
  const version = f.version !== 'all' ? f.version : versions[0];
  const humans = f.pop === 'humans';
  const api = useApi(version ? `findings?version=${version}${humans ? '&humans=1' : ''}` : null);
  return (
    <>
      <div className="hero">
        <p className="hero-eyebrow">الخلاصة</p>
        <h2 className="hero-h">وش يحتاج نظرة في {version}</h2>
        <p className="hero-p">تطلع من الأرقام نفسها: كل خانة فيها ١٠ مباريات أو أكثر، مرتبة بكم عدّت الحد. {humans ? 'لاعبين حقيقيين بس.' : 'مع البوتات.'}</p>
      </div>
      <Status api={api}>{(d) => (
        d.findings.length ? (
          <div className="finds">
            {d.findings.map((x) => {
              const [kind, action] = x.key.split('.');
              const show = findingValue(x);
              const expected = kind === 'win' ? x.ref / 1.35 : null;
              return (
                <article key={`${x.key}|${x.n}`} className={`find ${kind === 'win' || kind === 'flip' ? 'bal' : ''}`}>
                  <div className="find-top">
                    <span className="find-kind">{x.n === 2 ? 'لاعبين اثنين' : `${fmt(x.n)} لاعبين`}، {games(x.games)}</span>
                    <button className="link" onClick={() => go('rules')}>مؤشرات القواعد ←</button>
                  </div>
                  <div className="find-big">
                    <span className="fbv">{show(x.value)}<span className="vs">{expected != null ? `المتوقع ${pct(expected)}` : `الحد ${show(x.ref)}`}</span></span>
                    <small>{x.prev != null ? `${d.prevVersion}: ${show(x.prev)}` : d.prevVersion ? `${d.prevVersion}: ما فيها ١٠ مباريات بهالعدد` : 'ما فيه نسخة قبلها للمقارنة'}</small>
                  </div>
                  <h3 className="find-title">{x.title}{ACTION_NAME[action] && kind !== 'reg' ? `: ${ACTION_NAME[action]}` : ''}</h3>
                </article>
              );
            })}
          </div>
        ) : <section className="sec"><div className="empty">ما فيه خانة عدّت حدّها بهالنسخة، أو الخانات أقل من ١٠ مباريات.</div></section>
      )}</Status>
    </>
  );
}

/* --------------------------------- مؤشرات القواعد --------------------------------- */
const PCOUNTS = [2, 3, 4, 5, 6];
const SPLIT_GROUP = 'أدوار بدون لعب';
const RULE_ROWS = [
  { g: 'طول اللعبة' },
  { k: 'durMin', l: 'المدة (دقيقة)', f: (v) => fmt(v, 1), better: 'none' },
  { k: 'rounds', l: 'بطاقات تنسيق لين تنتهي', f: (v) => fmt(v, 1), better: 'none' },
  { k: 'turns', l: 'أدوار لين تنتهي', f: (v) => fmt(v, 0), better: 'none' },
  { g: SPLIT_GROUP },
  { k: 'zero', l: 'دور ما انلعب فيه ولا كرت', f: (v) => pct(v), better: 'low', strong: true },
  { k: 'noMatch', l: '↳ ما عنده قطعة تطابق', f: (v) => pct(v), better: 'low', note: 'من الأدوار الفاضية' },
  { k: 'chose', l: '↳ عنده بس اختار ما يلعب', f: (v) => pct(v), better: 'none', note: 'من الأدوار الفاضية' },
  { k: 'act', l: '↳ لعب أكشن بس', f: (v) => pct(v), better: 'none', note: 'من الأدوار الفاضية' },
  { g: 'تقارب النتيجة (لحظة الفوز)' },
  { k: 'closest', l: 'كروت أقرب منافس', f: (v) => fmt(v, 1), better: 'low', strong: true },
  { k: 'others', l: 'كروت بقية اللاعبين (متوسط)', f: (v) => fmt(v, 1), better: 'low' },
  { k: 'close3', l: 'مباريات قريبة (٣ كروت أو أقل)', f: (v) => pct(v), better: 'high' },
  { g: 'الندرة' },
  ...['common', 'medium', 'rare'].map((r) => ({ k: `rarPlayed.${r}`, l: `انلعب من ${RARITY_AR[r]}`, f: (v) => pct(v), better: 'high' })),
  ...['common', 'medium', 'rare'].map((r) => ({ k: `rarStuck.${r}`, l: `${RARITY_AR[r]} علق مع كل خاسر`, f: (v) => fmt(v, 1), better: 'low', avail: 'new' })),
  ...['common', 'medium', 'rare'].map((r) => ({ k: `rarTurns.${r}`, l: `أدوار قبل ما يطلع ${RARITY_AR[r]}`, f: (v) => fmt(v, 0), better: 'low', avail: 'new' })),
  { g: 'المناطق (تفريغ)' },
  ...ROSTER_REGIONS.map(([rid, name]) => ({ k: `region.${rid}`, l: name, f: (v) => pct(v), better: 'none' })),
  { g: 'تنسيق المنطقة مقابل العشوائي' },
  { k: 'reg.avg', l: 'كروت تنزل: منطقة', f: (v) => fmt(v, 2), better: 'none' },
  { k: 'rnd.avg', l: 'كروت تنزل: عشوائي', f: (v) => fmt(v, 2), better: 'none' },
  { k: 'reg.speed', l: 'المنطقة تفرّغ أسرع بـ', f: (v) => `×${fmt(v, 2)}`, better: 'none', note: 'كروت الدورة: منطقة ÷ عشوائي. فوق ×١٫٣ = سريعة زيادة', warnAbove: 1.3 },
  { k: 'reg.noMatch', l: 'ما عنده مطابق: منطقة', f: (v) => pct(v), better: 'low' },
  { k: 'rnd.noMatch', l: 'ما عنده مطابق: عشوائي', f: (v) => pct(v), better: 'low' },
  ...['drawTwo', 'stealTwo', 'giveTake', 'freeze', 'dig'].flatMap((a) => [
    { g: `أكشن: ${ACTION_NAME[a]}` },
    { k: `actions.${a}.perGame`, l: 'استخدام بالمباراة', f: (v) => fmt(v, 2), better: 'none' },
    { k: `actions.${a}.blocked`, l: 'انلغى بـ«لا ما تقدر»', f: (v) => (a === 'freeze' ? 'ما ينلغى' : pct(v)), better: 'none' },
    { k: `actions.${a}.win`, l: 'فاز اللي لعبه', f: (v) => pct(v), better: 'none', baseKey: `actions.${a}.base` },
    { k: `actions.${a}.flip`, l: 'قلب النتيجة', f: (v) => pct(v), better: 'none', note: 'كان متأخر بـ٣ كروت أو أكثر وفاز', warnAbove: 0.15, avail: 'est' },
  ]),
  { g: 'يرجعون؟' },
  { k: 'replay7', l: 'لعب مرة ثانية خلال ٧ أيام', f: (v) => pct(v), better: 'high', note: 'بالحساب، مب المتصفح', avail: 'since' },
  { g: 'الاستبيان' },
  { k: 'fun', l: 'الاستمتاع', f: (v) => fmt(v, 2), better: 'high' },
  { k: 'clarity', l: 'وضوح القوانين', f: (v) => fmt(v, 2), better: 'high' },
  { k: 'wouldReplay', l: 'بيلعب مرة ثانية', f: (v) => pct(v), better: 'high' },
  { k: 'response', l: 'نسبة الرد', f: (v) => pct(v), better: 'none', note: 'الردود ÷ مقاعد اللاعبين' },
  { k: 'note', l: 'أبرز ملاحظة', f: (v) => v, text: true, note: 'آخر تعليق من اللي قيّم ٣ أو أقل أو ما بيرجع' },
];
const AVAIL = {
  new: ['من ديلتا ١٥', 'يبدأ يتسجل مع ديلتا ١٥. المباريات القديمة تطلع فاضية.'],
  est: ['تقدير', 'أيدي الباقين من آخر دور لهم، فالفرق تقريبي.'],
  since: ['من ٢٥ أكتوبر', 'بالحساب من بداية الحسابات. قبلها بالمتصفح.'],
};
const getK = (o, k) => k.split('.').reduce((x, p) => x?.[p], o);
const SMALL = 10;

function RuleMetrics({ versions }) {
  const [ver, setVer] = useState('v2.3');
  const [cmp, setCmp] = useState('v2.2');
  const [pop, setPop] = useState('humans');
  const [open, setOpen] = useState(() => new Set(['طول اللعبة', SPLIT_GROUP, 'تقارب النتيجة (لحظة الفوز)', 'الندرة']));
  const h = pop === 'humans' ? '&humans=1' : '';
  const a = useApi(`rules?version=${ver}${h}`);
  const b = useApi(cmp === 'none' || cmp === ver ? null : `rules?version=${cmp}${h}`);
  const list = versions.length ? versions : [ver];
  const A = a.data?.cells;
  const B = cmp !== 'none' && cmp !== ver ? b.data?.cells : null;
  const groups = RULE_ROWS.filter((r) => r.g).map((r) => r.g);
  const allOpen = open.size >= groups.length;
  const toggle = (g) => setOpen((s) => { const n = new Set(s); n.has(g) ? n.delete(g) : n.add(g); return n; });
  const coverage = a.data?.coverage;
  let group = null;
  return (
    <>
      <div className="rule-intro">
        <div>
          <h2>مؤشرات القواعد</h2>
          <p className="sec-note">كل رقم هنا لنسخة وحدة وعدد لاعبين واحد. لعبة لاعبين اثنين غير عن ٥ أو ٦، فما نخلطهم أبد. والسهم الصغير يقارن بالنسخة المختارة، بنفس عدد اللاعبين.</p>
        </div>
        <div className="rule-ctrls">
          <label>النسخة<select id="r-ver" value={ver} onChange={(e) => { setVer(e.target.value); if (e.target.value === cmp) setCmp('none'); }}>{list.map((v) => <option key={v}>{v}</option>)}</select></label>
          <label>قارن بـ<select id="r-cmp" value={cmp} onChange={(e) => setCmp(e.target.value)}><option value="none">بدون مقارنة</option>{list.filter((v) => v !== ver && v !== 'v1').map((v) => <option key={v}>{v}</option>)}</select></label>
          <div className="seg" role="group" aria-label="المباريات"><button aria-pressed={pop === 'humans'} onClick={() => setPop('humans')}>لاعبين حقيقيين</button><button aria-pressed={pop === 'all'} onClick={() => setPop('all')}>مع البوتات</button></div>
        </div>
      </div>
      {ver === 'v1' && <p className="v1warn">v1 فيها أكثر من تشكيلة قطع وقوانين مخلوطة. استخدمها للاطّلاع بس، لا تقارن فيها.</p>}
      <section className="sec rule-sec">
        <div className="sec-head">
          <p className="sec-note">{a.loading ? 'جاري التحميل…' : 'خانة فيها أقل من ١٠ مباريات تطلع باهتة، وما تدخل بالخلاصة ولا بالتنبيهات.'}</p>
          <button className="link" onClick={() => setOpen(allOpen ? new Set() : new Set(groups))}>{allOpen ? 'اقفل الكل' : 'افتح الكل'}</button>
        </div>
        {!A ? <Status api={a}>{() => null}</Status> : (
          <div className="table-wrap">
            <table className="tbl rules">
              <thead>
                <tr><th className="rcol">المؤشر</th>{PCOUNTS.map((n) => <th key={n} className="pc"><b>{n === 2 ? 'لاعبين اثنين' : `${fmt(n)} لاعبين`}</b><small>{A[n].games ? games(A[n].games) : 'ما فيه'}</small></th>)}</tr>
              </thead>
              <tbody>
                {RULE_ROWS.map((row, i) => {
                  if (row.g) {
                    group = row.g;
                    const isOpen = open.has(row.g);
                    return (
                      <tr key={i} className="grp static" onClick={() => toggle(row.g)}>
                        <td colSpan={6}>
                          <button className="grp-btn" aria-expanded={isOpen}>
                            <span className="chev">{isOpen ? '−' : '+'}</span>{row.g}
                            {row.g === SPLIT_GROUP && coverage?.turnPayload != null && <small className="alias">التقسيم من {pct(coverage.turnPayload)} من الأدوار</small>}
                          </button>
                        </td>
                      </tr>
                    );
                  }
                  if (!open.has(group)) return null;
                  return (
                    <tr key={i} className={`static ${row.strong ? 'strong' : ''}`}>
                      <td className="rcol">{row.l}{row.avail && <span className={`avail ${row.avail}`} title={AVAIL[row.avail][1]}>{AVAIL[row.avail][0]}</span>}{row.note && <small className="alias">{row.note}</small>}</td>
                      {PCOUNTS.map((n) => {
                        const v = getK(A[n], row.k);
                        const low = A[n].games < SMALL;
                        if (!A[n].games || v == null) return <td key={n} className={row.text ? 'rtext none' : 'rv none'}>—</td>;
                        if (row.text) return <td key={n} className={`rtext ${low ? 'lowN' : ''}`}>{v}</td>;
                        // a small cell isn't a base for an arrow either
                        const before = B?.[n] && B[n].games >= SMALL ? getK(B[n], row.k) : null;
                        const d = before != null ? v - before : null;
                        const rel = d != null && Math.abs(before) > 0 ? d / Math.abs(before) : 0;
                        const showD = d != null && Math.abs(rel) >= 0.03;
                        const good = row.better === 'none' ? null : row.better === 'low' ? d < 0 : d > 0;
                        const base = row.baseKey ? getK(A[n], row.baseKey) : null;
                        const warn = !low && ((row.warnAbove && v > row.warnAbove) || (base != null && v > base * 1.35));
                        return (
                          <td key={n} className={`rv ${low ? 'lowN' : ''} ${warn ? 'flag' : ''}`}>
                            <span className="rv-v">{row.f(v)}</span>
                            {base != null && <small className="rv-b">المتوقع {pct(base)}</small>}
                            {showD && <small className={`rv-d ${good == null ? '' : good ? 'up' : 'down'}`}>{d > 0 ? '▲' : '▼'} {fmt(Math.abs(rel * 100), 0)}٪</small>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="legend">
          <span><i className="lg up" />أحسن من {cmp === 'none' ? 'النسخة اللي قبل' : cmp}</span>
          <span><i className="lg down" />أسوأ</span>
          <span><i className="lg flag" />يحتاج نظرة (أعلى من المتوقع بوضوح)</span>
          <span><i className="lg lowN" />أقل من ١٠ مباريات، لا تحكم عليها</span>
        </div>
      </section>
    </>
  );
}

/* ------------------------------------ اللاعبين ------------------------------------ */
function Players({ data, open, focus }) {
  const { rows, duplicates } = data;
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('last');
  const [kind, setKind] = useState('all');
  const byRef = Object.fromEntries(rows.map((r) => [r.ref, r]));
  const weekAgo = Date.now() - 7 * DAY;
  const list = rows
    .filter((r) => (kind === 'all' ? true : kind === 'user' ? r.username : kind === 'guest' ? !r.username : r.lastAt >= weekAgo))
    .filter((r) => !q || [r.name, r.username, ...r.otherNames].some((x) => x && x.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (sort === 'last' ? b.lastAt - a.lastAt : sort === 'games' ? b.completed - a.completed : sort === 'wins' ? b.wins / Math.max(1, b.completed) - a.wins / Math.max(1, a.completed) : b.points - a.points));
  const withUser = rows.filter((r) => r.username).length;
  const dups = duplicates.map((x) => ({ a: byRef[x.a], b: byRef[x.b], commonFriends: x.commonFriends })).filter((x) => x.a && x.b);
  return (
    <>
      <div className="kpis kpis-4">
        <Kpi label="كل اللي لعبوا" value={fmt(rows.length)} sub="حساب" />
        <Kpi label="عندهم اسم مستخدم" value={fmt(withUser)} sub={`${pct(withUser / rows.length)}، الباقي ضيوف`} info="الضيف حسابه مربوط بالمتصفح. لو مسح بيانات سفاري أو فتح من التطبيق، ينشئ له حساب جديد ويضيع ترتيبه." />
        <Kpi label="نشطين آخر ٧ أيام" value={fmt(rows.filter((r) => r.lastAt >= weekAgo).length)} sub="لعبوا مباراة على الأقل" />
        <Kpi label="من التطبيق" value={fmt(rows.filter((r) => r.platform === 'ios_app').length)} sub="ضافوا اللعبة للشاشة الرئيسية" />
      </div>

      {dups.length > 0 && (
        <div className={`dups ${focus === 'dups' ? 'flash' : ''}`}>
          <h3>حسابات يبيّن إنها لنفس الشخص</h3>
          <p className="sec-note">أسماء متقاربة، وما جلسوا على نفس الطاولة أبد. غالبًا واحد فتح مرة من سفاري ومرة من التطبيق. للعلم بس.</p>
          {dups.map((x) => (
            <div className="dup" key={x.a.ref + x.b.ref}>
              <button className="dup-p" onClick={() => open(x.a.ref)}><Avatar a={x.a} size={28} />{accountName(x.a)}<small>{x.a.username ? '@' + x.a.username : 'ضيف'}، {games(x.a.completed)}</small></button>
              <span className="dup-eq">≈</span>
              <button className="dup-p" onClick={() => open(x.b.ref)}><Avatar a={x.b} size={28} />{accountName(x.b)}<small>{x.b.username ? '@' + x.b.username : 'ضيف'}، {games(x.b.completed)}</small></button>
              <span className="dup-why">{x.commonFriends ? `نفس الربع (${fmt(x.commonFriends)})` : ''}</span>
            </div>
          ))}
        </div>
      )}

      <Section title="اللاعبين" note="اضغط على أي لاعب تشوف كل تفاصيله.">
        <div className="toolbar">
          <input id="player-search" type="search" placeholder="ابحث بالاسم أو اليوزر" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="seg" role="group" aria-label="نوع الحساب">
            {[['all', 'الكل'], ['active', 'نشطين'], ['user', 'عندهم يوزر'], ['guest', 'ضيوف']].map(([k, l]) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
          </div>
          <label className="sortby">ترتيب
            <select id="player-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="last">آخر لعب</option><option value="games">المباريات</option><option value="wins">نسبة الفوز</option><option value="points">النقاط</option>
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table className="tbl players">
            <thead><tr><th>اللاعب</th><th>المباريات</th><th>فوز</th><th>نقاط الموسم</th><th>أول لعب</th><th>آخر لعب</th><th>الجهاز</th><th>الاستبيان</th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.ref} onClick={() => open(r.ref)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && open(r.ref)}>
                  <td><div className="pcell"><Avatar a={r} size={30} /><div><b>{accountName(r)}</b><small>{r.username ? '@' + r.username : <span className="guest">ضيف</span>}{r.otherNames.length > 0 && `، كان «${r.otherNames[0]}»`}</small></div></div></td>
                  <td className="num">{fmt(r.completed)}{r.games > r.completed && <small> +{fmt(r.games - r.completed)} ما كملت</small>}</td>
                  <td className="num">{fmt(r.wins)} <small>{pct(r.wins / Math.max(1, r.completed))}</small></td>
                  <td className="num">{fmt(r.points)}</td>
                  <td>{dateAr(r.firstAt)}</td>
                  <td>{ago(r.lastAt)}</td>
                  <td>{platformAr(r.platform)}</td>
                  <td>{r.surveyCount ? <>{r.avgFun != null ? `${fmt(r.avgFun, 1)} ★ ` : ''}<small>({nReplies(r.surveyCount)})</small></> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <Empty />}
        </div>
      </Section>
    </>
  );
}

function PlayerSheet({ r, rows, close, open }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [close]);
  const refs = new Set(rows.map((x) => x.ref));
  const acts = ACTIONS.map((a) => ({ label: a.name, v: r.actions[a.id] || 0 })).filter((x) => x.v);
  return (
    <div className="sheet-back" onClick={close}>
      <aside className="sheet" role="dialog" aria-label={`تفاصيل ${accountName(r)}`} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <Avatar a={r} size={52} />
          <div>
            <h2>{accountName(r)}</h2>
            <p>{r.username ? '@' + r.username : 'ضيف بدون اسم مستخدم'}، {platformAr(r.platform)}، من {dateAr(r.firstAt)}</p>
            {(r.otherNames.length > 0 || r.browsers > 1) && <p className="muted">{r.otherNames.length > 0 && `أسماء ثانية: ${r.otherNames.join('، ')}`}{r.otherNames.length > 0 && r.browsers > 1 && '، '}{r.browsers > 1 && `دخل من ${nBrowsers(r.browsers)}`}</p>}
          </div>
          <button className="x" onClick={close} aria-label="إغلاق">×</button>
        </header>
        <div className="kpis kpis-4 tight">
          <Kpi label="المباريات" value={fmt(r.completed)} sub={r.games > r.completed ? `+${fmt(r.games - r.completed)} ما كملت` : `على ${nDays(r.days)}`} />
          <Kpi label="الفوز" value={pct(r.wins / Math.max(1, r.completed))} sub={`${fmt(r.wins)} فوز`} />
          <Kpi label="النقاط" value={fmt(r.points)} sub="هالموسم" />
          <Kpi label="لما يخسر" value={r.leftOnLoss != null ? nCards(r.leftOnLoss) : '—'} sub="باقي بيده (الوسيط)" />
        </div>

        <h3>المواجهات</h3>
        {r.opponents.length ? (
          <div className="h2h">
            {r.opponents.map((o) => {
              const tot = Math.max(1, o.myWins + o.theirWins);
              return (
                <button key={o.ref} className="h2h-row" onClick={() => refs.has(o.ref) && open(o.ref)}>
                  <span className="h2h-n"><Avatar a={o} size={24} />{accountName(o)}</span>
                  <span className="h2h-bar" aria-label={`${fmt(o.myWins)} مقابل ${fmt(o.theirWins)}`}>
                    <span className="me" style={{ width: `${(o.myWins / tot) * 100}%` }} />
                    <span className="them" style={{ width: `${(o.theirWins / tot) * 100}%` }} />
                  </span>
                  <span className="h2h-s"><span><b>{fmt(o.myWins)}</b> – {fmt(o.theirWins)}</span><small>{games(o.together)}</small></span>
                </button>
              );
            })}
          </div>
        ) : <p className="muted">ما واجه أحد عنده حساب.</p>}

        <div className="cols tight">
          <div>
            <h3>كروت الأكشن اللي لعبها</h3>
            {acts.length ? <HBars rows={acts} /> : <p className="muted">ما فيه سجل (يبدأ من ديلتا ١٤).</p>}
          </div>
          <div>
            <h3>الاستبيان</h3>
            {r.surveyCount ? (
              <>
                <p className="muted">{nReplies(r.surveyCount)}{r.avgFun != null ? `، الاستمتاع ${fmt(r.avgFun, 1)} من ٥` : ''}</p>
                {r.comments.map((x, i) => <blockquote key={i} dir="auto">{x.text}<small>{dateAr(x.at)}</small></blockquote>)}
              </>
            ) : <p className="muted">ما جاوب.</p>}
          </div>
        </div>

        <h3>مبارياته</h3>
        <div className="mlist">
          {r.recent.map((s, i) => (
            <div key={i} className="mrow">
              <span className={`place p${s.place || 0}`}>{s.place ? (s.place === 1 ? 'فاز' : fmt(s.place)) : '—'}</span>
              <span className="mrow-who">{s.others.join('، ')}</span>
              <span className="mrow-meta">{dateAr(s.at, true)}{s.durMin != null ? `، ${fmt(s.durMin, 0)} د` : ''}</span>
              {s.points != null ? <Pill tone="good">+{fmt(s.points)}</Pill> : !s.finished ? <Pill>ما كملت</Pill> : s.missing ? <Pill tone="bad">النتيجة ما انكتبت</Pill> : <Pill>ما تنحسب</Pill>}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------ المباريات ------------------------------------ */
function Matches({ qs, open, focus }) {
  const [show, setShow] = useState(focus === 'missing' ? 'missing' : 'all');
  const [exp, setExp] = useState(null);
  const [before, setBefore] = useState(null);
  const [older, setOlder] = useState([]);
  useEffect(() => { setBefore(null); setOlder([]); }, [qs, show]);
  const api = useApi(`matches?limit=50&show=${show}${qs ? '&' + qs : ''}${before ? '&before=' + encodeURIComponent(before) : ''}`);
  const d = api.data;
  useEffect(() => {
    if (d && before) setOlder((o) => (o.some((x) => x.id === d.sessions[0]?.id) ? o : [...o, ...d.sessions]));
  }, [d, before]);
  const [firstPage, setFirstPage] = useState(null);
  useEffect(() => { if (d && !before) setFirstPage(d); }, [d, before]);
  const head = firstPage || d;
  const list = [...(firstPage?.sessions || []), ...older];
  const toggleTest = async (s) => {
    await fetch('/api/analytics2/matches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, is_test: !s.is_test }) });
    setBefore(null); setOlder([]);
    api.reload();
  };
  const t = head?.totals;
  return (
    <>
      {t && (
        <div className="kpis kpis-4">
          <Kpi label="بدأت" value={fmt(t.started)} />
          <Kpi label="انحسبت كاملة" value={fmt(t.counted)} sub="دخلت بالنقاط والمواجهة" />
          <Kpi label="نتيجة ناقصة" value={fmt(t.missing)} tone={t.missing ? 'bad' : ''} sub="خلصت بس لاعب ما انكتبت نتيجته" info="المباراة عندها فائز، بس صف game_results لأحد اللاعبين مفقود." />
          <Kpi label="ما اكتملت" value={fmt(t.notFinished)} sub="طلعوا قبل الفائز" />
        </div>
      )}
      <Section title="المباريات" note="اضغط على المباراة تشوف ترتيب كل لاعب وكم باقي بيده. «تجربة» تطلعها من كل الأرقام."
        right={<div className="seg" role="group" aria-label="أي مباريات">{[['all', 'الكل'], ['missing', 'نتيجة ناقصة'], ['nocount', 'ما تنحسب'], ['open', 'ما اكتملت']].map(([k, l]) => <button key={k} aria-pressed={show === k} onClick={() => setShow(k)}>{l}</button>)}</div>}>
        {!head ? <Status api={api}>{() => null}</Status> : (
          <div className="table-wrap">
            <table className="tbl matches">
              <thead><tr><th>الوقت (الرياض)</th><th>الغرفة</th><th>اللاعبين</th><th>الفائز</th><th>المدة</th><th>الأدوار</th><th>النسخة</th><th>الحساب</th><th>تجربة</th></tr></thead>
              <tbody>
                {list.map((s) => {
                  const isOpen = exp === s.id;
                  const toggle = () => setExp(isOpen ? null : s.id);
                  return (
                    <React.Fragment key={s.id}>
                      <tr onClick={toggle} className={`${isOpen ? 'open' : ''} ${s.is_test ? 'dim' : ''}`} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && toggle()}>
                        <td>{dateAr(s.startedAt, true)}</td>
                        <td className="mono">{s.code || '—'}</td>
                        <td>{s.seats.filter((p) => !p.bot).map((p) => accountName(p)).join('، ')}{s.bots > 0 && <small> + {fmt(s.bots)} بوت</small>}</td>
                        <td>{s.winner || '—'}</td>
                        <td className="num">{s.durMin != null ? `${fmt(s.durMin, 1)} د` : '—'}</td>
                        <td className="num">{s.turns != null ? fmt(s.turns) : '—'}</td>
                        <td className="mono">{s.version}</td>
                        <td>{s.missing_results ? <Pill tone="bad">ناقصة</Pill> : s.counted ? <Pill tone="good">انحسبت</Pill> : <Pill>{REASON_AR[s.reason] || 'ما تنحسب'}</Pill>}</td>
                        <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label="مباراة تجربة" checked={s.is_test} onChange={() => toggleTest(s)} /></td>
                      </tr>
                      {isOpen && (
                        <tr className="detail"><td colSpan={9}>
                          <div className="seats">
                            {[...s.seats].sort((a, b) => (a.place ?? 9) - (b.place ?? 9)).map((p, i) => (
                              <div className="seat" key={i}>
                                <span className={`place p${p.place === 1 ? 1 : 0}`}>{p.place ? (p.place === 1 ? 'فاز' : fmt(p.place)) : '—'}</span>
                                {p.ref ? <button className="link" onClick={() => open(p.ref)}>{accountName(p)}</button> : <b>{accountName(p)}</b>}
                                <span className="muted">{p.cards_left != null ? `باقي ${nCards(p.cards_left)}، ` : ''}لعب {fmt(p.items_played ?? 0)} قطع{Object.keys(p.actions).length ? `، ${Object.entries(p.actions).map(([k, v]) => (ACTION_NAME[k] || k) + (v > 1 ? ` ×${fmt(v)}` : '')).join('، ')}` : ''}</span>
                                {!p.bot && (p.points != null ? <Pill tone="good">+{fmt(p.points)} نقاط</Pill> : p.hasResult ? <Pill>ما انحسبت</Pill> : s.missing_results ? <Pill tone="bad">ما انكتبت نتيجته</Pill> : s.reason === 'before_accounts' && s.counted ? <Pill>ما عنده حساب وقتها</Pill> : null)}
                              </div>
                            ))}
                          </div>
                          {s.lastItem && <p className="muted">آخر قطعة انلعبت: {s.lastItem}</p>}
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            {!list.length && <Empty />}
          </div>
        )}
        {(before ? d?.nextBefore : firstPage?.nextBefore) && (
          <button className="more" disabled={api.loading} onClick={() => setBefore(before ? d.nextBefore : firstPage.nextBefore)}>اعرض زيادة</button>
        )}
      </Section>
    </>
  );
}

/* ------------------------------------- النشاط ------------------------------------- */
function Activity({ activity, players, qs, tz, setTz, go }) {
  const survey = useApi(`survey?${qs}`);
  const matches = useApi(`matches?limit=1${qs ? '&' + qs : ''}`);
  const { kpis, funnel, games: list } = activity;
  const rows = players.rows;
  const weekAgo = Date.now() - 7 * DAY;
  const fresh = rows.filter((r) => r.createdAt >= weekAgo).length;
  const returning = rows.filter((r) => r.days >= 2).length;
  const s = survey.data?.kpis;
  const missing = matches.data?.totals.missing || 0;
  const dups = players.duplicates.length;
  return (
    <>
      <div className="kpis">
        <Kpi label="اللاعبين" value={fmt(rows.length)} sub={fresh ? `+${nPlayers(fresh)} جدد آخر ٧ أيام` : 'ما فيه جدد آخر ٧ أيام'} info="كل حساب لعب مباراة وحدة على الأقل بهالفلتر. الحساب = الشخص (مب المتصفح)." />
        <Kpi label="المباريات" value={fmt(kpis.finished)} sub={`من ${fmt(kpis.started)} بدأت، ${pct(kpis.finished / Math.max(1, kpis.started))} اكتملت`} info="المكتملة = فيها فائز. اللي انقطعت أو تركوها ما تدخل بالمتوسطات." />
        <Kpi label="مدة المباراة" value={kpis.medianMin != null ? `${fmt(kpis.medianMin, 1)} د` : '—'} sub={kpis.medianTurns != null ? `الوسيط، ${fmt(kpis.medianTurns)} دور` : ''} info="الوسيط مب المتوسط، عشان مباراة وحدة طوّلت ما تخرب الرقم." />
        <Kpi label="رجعوا يلعبون" value={pct(returning / Math.max(1, rows.length))} sub={`${fmt(returning)} من ${fmt(rows.length)} لعبوا بيومين أو أكثر`} info="بالحسابات مب بالمتصفحات." />
        <Kpi label="الاستمتاع" value={s?.fun != null ? `${fmt(s.fun, 1)} / ٥` : '—'} sub={s ? `${nReplies(s.n)}، ${pct(s.response)} من اللي خلّصوا` : ''} info="من الاستبيان بعد المباراة. نسبة الرد مهمة: لو قليلة، الرقم يمثل المتحمسين بس." />
      </div>

      {(missing > 0 || dups > 0) && (
        <div className="alerts">
          {missing > 0 && (
            <button className="alert bad" onClick={() => go('matches', 'missing')}>
              <b>{fmt(missing)}</b> مباريات خلصت بس نتيجة لاعب فيها ما انكتبت
              <span className="alert-go">شوفها ←</span>
            </button>
          )}
          {dups > 0 && (
            <button className="alert warn" onClick={() => go('players', 'dups')}>
              <b>{fmt(dups)}</b> {dups === 1 ? 'حسابين يبيّن إنهم لنفس الشخص' : 'أزواج حسابات يبيّن إنها لنفس الشخص'}
              <span className="alert-go">شوفها ←</span>
            </button>
          )}
        </div>
      )}

      <div className="cols">
        <Section title="المباريات كل يوم" note={`كل عمود يوم ${tz === 3 ? 'بتوقيت الرياض' : 'بتوقيت لوس أنجلوس'}. مرّر على العمود تشوف العدد.`}>
          <DailyBars list={list} tz={tz} />
        </Section>
        <Section title="متى يلعبون" note="كل خانة ٣ ساعات. كل ما غمقت، زادت المباريات."
          right={<div className="seg" role="group" aria-label="التوقيت"><button aria-pressed={tz === 3} onClick={() => setTz(3)}>الرياض</button><button aria-pressed={tz === -7} onClick={() => setTz(-7)}>لوس أنجلوس</button></div>}>
          <Heatmap list={list} tz={tz} />
        </Section>
      </div>

      <div className="cols">
        <Section title="من الحساب لين يرجع" note="وين نخسر الناس. كل خطوة نسبتها من اللي قبلها.">
          <div className="funnel">
            {funnel.map((f, i) => {
              const prev = i ? funnel[i - 1].n : f.n;
              return (
                <div className="fstep" key={f.label}>
                  <div className="fbar" style={{ width: `${(f.n / Math.max(1, funnel[0].n)) * 100}%` }} />
                  <div className="ftext">
                    <span>{f.label}</span>
                    <b>{fmt(f.n)}</b>
                    {i > 0 && <small>{pct(f.n / Math.max(1, prev))}</small>}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
        <Section title="أكثر اللاعبين نشاطًا" note="بعدد المباريات المكتملة بهالفلتر." right={<button className="link" onClick={() => go('players')}>كل اللاعبين ←</button>}>
          <div className="toplist">
            {[...rows].sort((a, b) => b.completed - a.completed).slice(0, 6).map((r) => (
              <button key={r.ref} className="toprow" onClick={() => go('players', null, r.ref)}>
                <Avatar a={r} size={30} />
                <span className="toprow-n">{accountName(r)}{r.username && <small>@{r.username}</small>}</span>
                <span className="toprow-v">{games(r.completed)}</span>
                <span className="toprow-w">{fmt(r.wins)} فوز</span>
              </button>
            ))}
            {!rows.length && <Empty />}
          </div>
        </Section>
      </div>
    </>
  );
}

/* ------------------------------------ الاستبيان ------------------------------------ */
function Survey({ qs }) {
  const api = useApi(`survey?${qs}`);
  return (
    <Status api={api}>{(d) => {
      const s = d.kpis;
      return (
        <>
          <div className="kpis kpis-4">
            <Kpi label="الاستمتاع" value={s.fun != null ? `${fmt(s.fun, 2)} / ٥` : '—'} sub={nReplies(s.n)} />
            <Kpi label="وضوح القوانين" value={s.clarity != null ? `${fmt(s.clarity, 2)} / ٥` : '—'} sub={nReplies(s.n)} />
            <Kpi label="بيرجعون" value={pct(s.wouldReplay)} sub={`${fmt(s.wouldReplayN)} جاوبوا`} />
            <Kpi label="نسبة الرد" value={pct(s.response, 1)} sub={`من ${fmt(s.humanSeats)} مقعد خلّص مباراة`} info="الردود ÷ مقاعد اللاعبين الحقيقيين بالمباريات المكتملة." />
          </div>
          <Section title="وين يوقفون" note={`كم خطوة جاوبوا من ٤. يتسجل من ديلتا ١٤، فالرقم من ${nReplies(d.tracked)} بس.`}>
            {d.tracked ? <HBars rows={d.dropoff.map((x) => ({ label: x.steps === 4 ? 'كمّلوا الأربع' : x.steps === 0 ? 'ولا خطوة' : `${fmt(x.steps)} من ٤`, v: x.n }))} /> : <Empty />}
          </Section>
          <Section title="وش قالوا" note={`${fmt(s.comments)} تعليق مكتوب، الأحدث أول.`}>
            <div className="comments">
              {d.comments.map((c, i) => (
                <figure key={i} className="comment">
                  <blockquote dir="auto">{c.text}</blockquote>
                  <figcaption><b>{c.name || 'بدون اسم'}</b><span className="mono">{c.version}</span><span>{c.players === 2 ? 'لاعبين اثنين' : `${fmt(c.players)} لاعبين`}</span><span>{dateAr(c.at)}</span></figcaption>
                </figure>
              ))}
            </div>
            {!d.comments.length && <Empty />}
          </Section>
        </>
      );
    }}</Status>
  );
}

/* ------------------------------------- الأخطاء ------------------------------------- */
function Errors({ period, players, activity }) {
  const api = useApi(`errors${period !== 'all' ? `?period=${period}` : ''}`);
  const plat = {};
  players.rows.forEach((r) => { if (r.platform) plat[r.platform] = (plat[r.platform] || 0) + 1; });
  return (
    <Status api={api}>{(d) => {
      const t = d.totals;
      return (
        <>
          <div className="kpis kpis-4">
            <Kpi label="أخطاء" value={fmt(t.errors)} sub={t.errors ? `عند ${nPlayers(t.players)}` : ''} tone={t.errors ? 'bad' : ''} />
            <Kpi label="مباريات فيها خطأ" value={pct(t.gamesWithError / Math.max(1, t.games), 1)} />
            <Kpi label="حفظ مرفوض" value={fmt(t.rejected)} info="السيرفر رفض حفظ غرفة (state_rejected). بوضع التسجيل بس، ما يوقف اللعب." />
            <Kpi label="من التطبيق" value={pct((plat.ios_app || 0) / Math.max(1, players.rows.length))} sub="مقابل المتصفح" />
          </div>
          <div className="cols">
            <Section title="الأجهزة" note="بالحسابات.">
              {Object.keys(plat).length ? <HBars rows={Object.entries(plat).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: platformAr(k), v }))} /> : <Empty />}
            </Section>
            <Section title="النسخ" note="المباريات حسب نسخة القوانين.">
              <HBars rows={Object.entries(activity.versions).sort().reverse().map(([k, v]) => ({ label: k, v }))} format={(v) => games(v)} />
            </Section>
          </div>
          <Section title="الأخطاء" note="مجمّعة حسب الرسالة. الأكثر تكرار فوق.">
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>الخطأ</th><th>المرات</th><th>اللاعبين</th><th>آخر مرة</th><th>الجهاز</th></tr></thead>
                <tbody>
                  {d.groups.map((e) => (
                    <tr key={e.message} className="static">
                      <td><b className={/[a-z]/i.test(e.message) ? 'mono ltr' : ''}>{e.message}</b></td>
                      <td className="num">{fmt(e.count)}</td>
                      <td>{e.players.join('، ') || '—'}</td>
                      <td>{ago(e.lastSeen)}</td>
                      <td>{e.platforms.map(platformAr).join('، ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!d.groups.length && <Empty />}
            </div>
          </Section>
        </>
      );
    }}</Status>
  );
}

/* -------------------------------------- shell -------------------------------------- */
const TABS = [
  ['findings', 'الخلاصة'],
  ['rules', 'مؤشرات القواعد'],
  ['players', 'اللاعبين'],
  ['matches', 'المباريات'],
  ['overview', 'النشاط'],
  ['survey', 'الاستبيان'],
  ['tech', 'الأخطاء'],
];
const readHash = () => {
  const h = (location.hash || '').slice(1);
  return TABS.some(([k]) => k === h) ? h : 'findings';
};

export default function AnalyticsApp() {
  const [tab, setTab] = useState('findings');
  const [focus, setFocus] = useState(null);
  const [sel, setSel] = useState(null);
  const [tz, setTz] = useState(3);
  const [f, setF] = useState({ period: 'all', pop: 'humans', version: 'all', n: 'all' });
  useEffect(() => {
    setTab(readHash());
    const h = () => setTab(readHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (f.period !== 'all') p.set('period', f.period);
    if (f.pop !== 'all') p.set('pop', f.pop);
    if (f.n !== 'all') p.set('n', f.n);
    if (f.version !== 'all') p.set('version', f.version);
    return p.toString();
  }, [f]);
  const players = useApi(`players?${qs}`);
  const activity = useApi(`activity?${qs}`);
  const versions = activity.data?.allVersions || [];
  const rows = players.data?.rows || [];
  const go = (t, extra, player) => {
    if (player) setSel(player);
    setFocus(extra || null);
    try { location.hash = t; } catch {}
    setTab(t);
    window.scrollTo({ top: 0 });
  };
  const selRow = rows.find((r) => r.ref === sel);
  return (
    <div className="ha2 app" dir="rtl" lang="ar">
      <header className="top">
        <div className="top-in">
          <div className="brand">
            <span className="mark" aria-hidden="true">ح</span>
            <div>
              <h1>حُلّة · التحليلات</h1>
              <p>{nPlayers(rows.length)}، {activity.data ? `${fmt(activity.data.kpis.finished)} مكتملة` : '…'} · <a className="link" href="/admin/analytics/legacy">اللوحة القديمة</a></p>
            </div>
          </div>
          <div className="filters">
            <label>الفترة<select id="f-period" value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })}><option value="7">آخر ٧ أيام</option><option value="30">آخر ٣٠ يوم</option><option value="all">من البداية</option></select></label>
            <label>المباريات<select id="f-pop" value={f.pop} onChange={(e) => setF({ ...f, pop: e.target.value })}><option value="humans">لاعبين حقيقيين بس</option><option value="bots">مع البوتات</option><option value="all">الكل</option></select></label>
            <label>اللاعبين<select id="f-n" value={f.n} onChange={(e) => setF({ ...f, n: e.target.value })}><option value="all">أي عدد</option>{PCOUNTS.map((n) => <option key={n} value={n}>{n === 2 ? 'اثنين' : fmt(n)}</option>)}</select></label>
            <label>النسخة<select id="f-ver" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })}><option value="all">كل النسخ</option>{versions.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
          </div>
        </div>
        <nav className="tabs" aria-label="أقسام اللوحة">
          <div className="tabs-in">
            {TABS.map(([k, l]) => <a key={k} href={`#${k}`} aria-current={tab === k ? 'page' : undefined} onClick={() => setFocus(null)}>{l}</a>)}
          </div>
        </nav>
      </header>
      <main className="main">
        {tab === 'findings' && <Findings f={f} versions={versions} go={go} />}
        {tab === 'rules' && <RuleMetrics versions={versions} />}
        {tab === 'players' && <Status api={players}>{(d) => <Players data={d} open={setSel} focus={focus} />}</Status>}
        {tab === 'matches' && <Matches qs={qs} open={setSel} focus={focus} />}
        {tab === 'overview' && (activity.data && players.data ? <Activity activity={activity.data} players={players.data} qs={qs} tz={tz} setTz={setTz} go={go} /> : <Status api={activity.error ? activity : players}>{() => null}</Status>)}
        {tab === 'survey' && <Survey qs={qs} />}
        {tab === 'tech' && (activity.data && players.data ? <Errors period={f.period} players={players.data} activity={activity.data} /> : <Status api={activity.error ? activity : players}>{() => null}</Status>)}
      </main>
      {selRow && <PlayerSheet r={selRow} rows={rows} close={() => setSel(null)} open={setSel} />}
    </div>
  );
}

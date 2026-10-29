(() => {
'use strict';
/* The workbench. All numbers come from POST /api/v1/calc; this file only keeps the
   state of the controls and paints what the API returns.
   Two pages run it, one per layout: the tabs (index.html) and the receipt (receipt.html). Their
   controls carry the same ids; what differs is how a result is shown, and each has its own painters. */
const API = '/api/v1';
const RECEIPT = document.documentElement.dataset.layout === 'receipt';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const nf = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SLOTS = ['q', 'w', 'e', 'r'];
const ACTIONS = ['aa', ...SLOTS];
const LINES = ['aa', 'q', 'w', 'e', 'r', 'p', 'items'];

const S = {
  champ: {id:'Kaisa', key:145, name:"Kai'Sa", title:'Daughter of the Void', tags:[]},
  view: null,                       // GET /champions/:id, the kit with model status per ability
  level: 13,
  ranks: {q:5, w:1, e:5, r:2},
  order: 'qew',
  // B's own ranks and max order, used while comparing with the ranks unlinked (the tabs page's chain button)
  split: false,
  ranksB: {q:5, w:1, e:5, r:2},
  orderB: 'qew',
  builds: {a:[6672,3006,3124,3115,null,null], b:[6655,3020,3115,4645,null,null]},
  compare: true,
  target: 'dummy',
  dummy: {hp:2400, ar:80, mr:50},
  enemy: {id:'Ornn', name:'Ornn', level:13, items:[null,null,null,null,null,null]},   // the target champion and its six slots
  enemyView: null,                  // GET /champions/:id of the enemy, for the item picker's order when it picks for the enemy
  combo: {aa:3, q:1, w:1, e:0, r:0},
  crits: 'average',                 // how the combo counts critical strikes: average, never or always
  shops: {aram: false, arena: false},   // shops the item picker adds to Summoner's Rift's
  items: new Map(),
  champs: [],
  res: null,                        // {a, b}: the last results, b null with one build
  options: {},                      // the champion's options the user has set, by id; the rest keep their defaults
  // each build's item settings the user has set: item id -> control id -> value; the rest keep their defaults
  itemOpts: {a: {}, b: {}},
};

/* The item picker's stat words: what a word reads as, the words for it, and the items that have it.
   A chip is a stat word written into the search. */
const hasStat = (...keys) => it => keys.some(k => it.stats?.[k]);
const hasTag = (...tags) => it => tags.some(t => it.tags.includes(t));
const hasTrait = t => it => !!it.traits?.includes(t);
const STAT_WORDS = [
  ['attack damage', ['ad', 'attack damage'], hasStat('ad')],
  ['ability power', ['ap', 'ability power'], hasStat('ap')],
  ['attack speed', ['as', 'attack speed'], hasStat('attackSpeed')],
  ['crit', ['crit', 'critical strike', 'crit chance'], hasStat('critChance', 'critDamage')],
  ['lethality', ['lethality', 'leth', 'armor pen', 'armour pen', 'arpen', 'armor penetration'], hasStat('lethality', 'armorPenPct')],
  ['magic pen', ['magic pen', 'mpen', 'magic penetration'], hasStat('magicPenFlat', 'magicPenPct')],
  ['penetration', ['pen', 'penetration'], hasStat('lethality', 'armorPenPct', 'magicPenFlat', 'magicPenPct')],
  ['ability haste', ['ah', 'haste', 'ability haste', 'cdr', 'cooldown'], hasStat('abilityHaste')],
  ['health', ['hp', 'health'], hasStat('hp')],
  ['armor', ['armor', 'armour'], hasStat('armor')],
  ['magic resist', ['mr', 'magic resist', 'magic resistance'], hasStat('mr')],
  ['resists', ['resists', 'resistances'], hasStat('armor', 'mr')],
  ['defense', ['defense', 'defence'], hasStat('hp', 'armor', 'mr')],
  ['anti-heal', ['anti heal', 'antiheal', 'grievous', 'grievous wounds', 'wounds', 'gw', 'heal cut', 'healing reduction'], hasTrait('antiheal')],
  ['shield', ['shield', 'shields'], hasTrait('shield')],
  ['life steal', ['life steal', 'lifesteal', 'ls'], hasStat('lifeSteal')],
  ['omnivamp', ['omnivamp', 'vamp'], hasStat('omnivamp')],
  ['on-hit', ['on hit', 'onhit'], hasTag('OnHit')],
  ['move speed', ['ms', 'move speed', 'movement speed', 'movespeed'], hasStat('moveSpeed', 'movePct')],
  ['mana', ['mana'], it => !!it.stats?.mana || it.tags.includes('ManaRegen')],
  ['tenacity', ['tenacity'], hasTag('Tenacity')],
  ['slow', ['slow', 'slows'], hasTag('Slow')],
  ['active', ['active'], hasTag('Active')],
  ['boots', ['boots', 'shoes'], hasTag('Boots')],
];
const ITEM_CHIPS = [['Attack damage', 'attack damage'], ['Ability power', 'ability power'], ['Attack speed', 'attack speed'], ['Crit', 'crit'],
  ['On-hit', 'on hit'], ['Penetration', 'pen'], ['Haste', 'haste'], ['Defense', 'defense'], ['Anti-heal', 'anti heal'], ['Boots', 'boots']];
/* the shop's role tabs, in its order; a champion's classes go by the same names */
const ITEM_ROLES = ['All', 'Fighter', 'Marksman', 'Assassin', 'Mage', 'Tank', 'Support'];
const ROLES = ['All','Fighter','Tank','Mage','Assassin','Marksman','Support'];
const STATUS_WORD = {auto:'estimate', unmodeled:'not counted', stale:'needs review'};


/* ---------- pictures ---------- */
/* The site serves its own copies of the game art, packed by the pipeline (src/pipeline/art.ts).
   One sheet holds every item icon and another every champion portrait, so a whole picker is a
   single request: both are fetched in the background at boot and each fades in as one. A
   champion's five ability icons are one strip, and their splash is the only large picture. */
let ART = null;                     // web/art/index.json
const spot = {items: new Map(), champions: new Map()};   // id -> position of its tile on the sheet
const artUrl = path => `/art/${ART.version}/${path}`;
const warmed = new Map();           // url -> {im, done}; holding the Image keeps the decoded picture around
const ready = new Set();            // urls that can be painted at once
function warm(url) {
  let w = warmed.get(url);
  if (!w) {
    const im = new Image();
    im.src = url;
    w = {im, done: im.decode().then(() => { ready.add(url); }, () => {})};
    warmed.set(url, w);
  }
  return w.done;
}
function useArt(art) {
  ART = art;
  const root = document.documentElement.style;
  for (const k of ['items', 'champions']) {
    art[k].ids.forEach((id, n) => spot[k].set(id, n));
    const url = artUrl(`${k}.webp`);
    root.setProperty(`--art-${k}`, `url("${url}")`);
    root.setProperty(`--${k}-cols`, art[k].cols);
    root.setProperty(`--${k}-rows`, art[k].rows);
    warm(url).then(() => document.body.classList.add(`has-${k}`));
  }
  // the game's stat icons, one strip in the order art.stats gives
  if (art.stats) {
    const url = artUrl('stats.webp');
    root.setProperty('--art-stats', `url("${url}")`);
    root.setProperty('--stats-n', art.stats.length);
    warm(url).then(() => document.body.classList.add('has-stats'));
  }
}
/* One of the game's stat icons, by its id in the art index (hp, mana, ad, ap, armor, mr, crit). */
function statIco(id, name) {
  const n = ART?.stats?.indexOf(id) ?? -1;
  if (n < 0) return '';
  const x = ART.stats.length > 1 ? n / (ART.stats.length - 1) * 100 : 0;
  return `<i class="si" style="background-position:${+x.toFixed(3)}% 0" role="img" aria-label="${esc(name)}"></i>`;
}
function tile(k, id) {
  const n = spot[k].get(id), s = ART?.[k];
  if (!s || n === undefined) return '<i class="ico"></i>';
  const x = s.cols > 1 ? (n % s.cols) / (s.cols - 1) * 100 : 0, y = s.rows > 1 ? Math.floor(n / s.cols) / (s.rows - 1) * 100 : 0;
  return `<i class="ico ${k}" style="background-position:${+x.toFixed(3)}% ${+y.toFixed(3)}%"></i>`;
}
const itemIco = id => tile('items', id);
const champIco = id => tile('champions', id);
const kitUrl = id => artUrl(`kit/${id}.webp`);
const splashUrl = id => artUrl(`splash/${id}.webp`);

const api = async (path, init) => {
  const r = await fetch(API + path, init);
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error?.message || `request failed (${r.status})`);
  return j;
};

/* ---------- calculation ---------- */
let timer = 0, seq = 0, feed = false;
/* `quiet` is for a control that changes continuously, a dial being dragged or a number being typed:
   the receipt is then redrawn in place instead of being fed out of the till again. */
function schedule(quiet) { if (!quiet) feed = true; clearTimeout(timer); timer = setTimeout(recalc, 70); }
/* The dials hold totals; saying what stands there lets the engine split them into base and bonus,
   which effects such as Giant Slayer read: the dummy's base is the practice tool's, an enemy's its own.
   An enemy's items are in the dials already (enemyStats); the engine is told them as well. */
const enemyItems = () => S.enemy.items.filter(Boolean);
function targetBody() {
  if (S.target === 'raw') return null;
  const v = readDials(), held = enemyItems();
  const who = S.target === 'champ' ? {champion: S.enemy.id, level: S.enemy.level, ...(held.length && {items: held})} : {dummy: true};
  return {...who, hp: v.hp, armor: v.ar, mr: v.mr};
}
/* A build's item settings, kept only for items it holds and settings those items still have. */
function itemOptsOf(k) {
  const held = new Set(S.builds[k].filter(Boolean)), out = {};
  for (const [id, set] of Object.entries(S.itemOpts[k])) {
    const controls = S.items.get(+id)?.controls || [];
    if (!held.has(+id)) { delete S.itemOpts[k][id]; continue; }
    for (const c of Object.keys(set)) if (!controls.some(x => x.id === c)) delete set[c];
    if (Object.keys(set).length) out[id] = set; else delete S.itemOpts[k][id];
  }
  return out;
}
async function recalc() {
  const mine = ++seq;
  document.body.classList.add('loading');
  runAuto(true);
  const body = {
    champion: S.champ.id, level: S.level, ranks: S.ranks, options: S.options,
    builds: (S.compare ? ['a', 'b'] : ['a']).map(k => {
      const io = itemOptsOf(k);
      return {items: S.builds[k].filter(Boolean), ...(k === 'b' && S.split && {ranks: S.ranksB}), ...(Object.keys(io).length && {itemOptions: io})};
    }),
    target: targetBody(), combo: {counts: S.combo, crits: S.crits},
  };
  try {
    const out = await api('/calc', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
    if (mine !== seq) return;
    S.res = {a: out.results[0], b: out.results[1] || null};
    paintResults(); paintSaved(); paintAutoRes();
    remember();
  } catch (e) {
    if (mine !== seq) return;
    $('#quality').hidden = false;
    $('#quality').className = 'wf warn';
    $('#quality').textContent = 'Could not calculate';
    $('#quality').title = e.message;
  } finally {
    if (mine === seq) document.body.classList.remove('loading');
  }
}

/* ---------- tabs ---------- */
function setTab(t) {
  $$('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  $$('.pane').forEach(p => p.hidden = p.dataset.pane !== t);
  // the picker stays open on the tab with its slots: the builds', or the enemy's
  if (pick && (pick.b === 't') !== (t === 'target')) closePicker();
  if (t !== 'build') closeAuto();
}
function paintTabs() {
  if (RECEIPT) return;
  const na = S.builds.a.filter(Boolean).length, nb = S.builds.b.filter(Boolean).length, v = readDials();
  $('#ts-build').textContent = `${S.champ.name}, level ${S.level}, ` + (S.compare ? `${na} and ${nb} items${S.split ? ', ranks per build' : ''}` : `${na} items`);
  $('#ts-target').textContent = S.target === 'raw' ? 'None, raw output'
    : `${S.target === 'dummy' ? 'Dummy' : enemyName()}, ${nf(v.hp)} HP, ${v.ar} armor, ${v.mr} MR`;
}
/* The enemy as the page names it: "Ornn Lv 13", and its items when it holds any. */
function enemyName() {
  const e = S.enemy, n = enemyItems().length;
  return `${e.name} Lv ${e.level}${n ? ` + ${n} item${n === 1 ? '' : 's'}` : ''}`;
}

/* ---------- champion ---------- */
function paintChamp() {
  const c = S.champ, name = $('#champ-name');
  name.textContent = c.name;
  name.style.setProperty('--len', Math.max(5, c.name.length));   // the receipt page sets the name as large as its length allows
  $('#champ-title').textContent = c.title ? c.title[0].toUpperCase() + c.title.slice(1) : '';
  paintSplash($('#atk-splash'), c.id); paintKit();
  paintSub();
}
function comboText() {
  const parts = [];
  if (S.combo.aa) parts.push(`${S.combo.aa} auto${S.combo.aa === 1 ? '' : 's'}`);
  for (const k of SLOTS) if (S.combo[k]) parts.push(S.combo[k] > 1 ? `${S.combo[k]}× ${k.toUpperCase()}` : k.toUpperCase());
  if (!parts.length) return 'Nothing in the combo';
  return parts.length === 1 ? parts[0] : parts.slice(0, -1).join(', ') + ' and ' + parts.at(-1);
}
function paintSub() {
  const e = S.enemy, t = S.target;
  if (RECEIPT) {
    const v = readDials(), stats = `${nf(v.hp)} HP, ${v.ar} armor, ${v.mr} MR`;
    $('#r-champ').textContent = $('#raw-champ').textContent = S.champ.name;
    $('#r-lvl').textContent = S.level;
    $('#r-target').textContent = t === 'raw' ? 'None' : t === 'dummy' ? `Dummy, ${stats}` : `${enemyName()}, ${stats}`;
    $('#r-combo').textContent = comboText();
    $('#stamp-sm').textContent = t === 'raw' ? 'before resistances' : 'after mitigation';
    $('#stamp-lg').textContent = t === 'raw' ? 'raw output' : t === 'dummy' ? 'vs dummy' : 'vs ' + e.name;
    $('#l-sub').textContent = `${S.champ.name} at level ${S.level}, items included`;
    return;
  }
  $('#combo-sum').textContent = comboText();
  paintSteps();
  paintTabs();
}
/* The combo's dropdown on the tabs page: a count per action, the same counts as the Breakdown's Qty column.
   Built once per kit; paintSteps fills in the counts. */
const deadSlot = k => SLOTS.includes(k) && S.view?.slots[k] && !S.view.slots[k].damaging;
function renderSteps() {
  const el = $('#steps');
  if (!el) return;
  el.innerHTML = ACTIONS.map(k => {
    const name = k === 'aa' ? 'Auto attacks' : S.view?.slots[k]?.name || k.toUpperCase() + ' ability', dead = deadSlot(k);
    const face = k === 'aa' ? 'AA' : `<i class="ico kit ${k}"></i>`;
    const ctl = dead ? '<span class="none">no damage</span>'
      : `<button data-d="-1" aria-label="One fewer: ${esc(name)}">−</button><output></output><button data-d="1" aria-label="One more: ${esc(name)}">+</button>`;
    return `<div class="step${dead ? ' dead' : ''}" data-k="${k}"><span class="sk"${k === 'aa' ? '' : ` data-ab="${k}"`}>${face}</span><span class="nm"${k === 'aa' ? '' : ` data-ab="${k}"`}>${esc(name)}${k === 'aa' ? '' : `<small>${k.toUpperCase()}</small>`}</span>${ctl}</div>`;
  }).join('');
  paintSteps();
}
function paintSteps() {
  for (const el of $$('#steps .step')) {
    const k = el.dataset.k, out = $('output', el);
    if (out) out.textContent = S.combo[k];
    el.classList.toggle('zero', !S.combo[k]);
  }
  // the Breakdown's Qty column shows the same counts; the one being typed in is left alone
  for (const input of $$('#lines input[data-q]')) if (document.activeElement !== input) input.value = S.combo[input.dataset.q];
}
function defaultCombo() {
  S.combo = {aa: 3};
  for (const k of SLOTS) S.combo[k] = deadSlot(k) ? 0 : 1;
}
const maxRank = k => S.view?.slots[k]?.maxRank || (k === 'r' ? 3 : 5);
/* The old picture goes blank at once and the new one fades in when it has arrived. */
function paintSplash(el, id) {
  const url = splashUrl(id);
  if (el.dataset.src === url) return;
  el.dataset.src = url;
  if (!ready.has(url)) el.classList.add('wait');
  warm(url).then(() => { if (el.dataset.src === url) el.src = url; });
}
/* The kit strip is set on each part of the page that shows ability icons: the ranks, and on the tabs
   page also the per-build ranks and the combo's dropdown. */
function paintKit() {
  const row = $('#skill-row'), url = kitUrl(S.champ.id);
  if (row.dataset.kit === url) return;
  row.dataset.kit = url;
  const els = [row, $('#rank-split'), $('#combo-menu')].filter(Boolean);
  const put = () => els.forEach(el => { el.style.setProperty('--art-kit', `url("${url}")`); el.classList.add('has-kit'); });
  if (ready.has(url)) return put();
  els.forEach(el => el.classList.remove('has-kit'));
  warm(url).then(() => { if (row.dataset.kit === url) put(); });
}
/* Each ability's icon shows its card on hover (see abilityCard). */
function nameKit() {
  for (const k of ['p', ...SLOTS]) { const el = $(`.skill[data-k="${k}"]`); el.dataset.ab = k; el.removeAttribute('title'); }
}
async function loadKit() {
  const c = S.champ;
  try {
    const view = await api(`/champions/${encodeURIComponent(c.id)}`);
    if (S.champ !== c) return;
    S.view = view;
  } catch (e) { if (S.champ === c) S.view = null; }
  for (const k of SLOTS) { S.ranks[k] = Math.min(S.ranks[k], maxRank(k)); S.ranksB[k] = Math.min(S.ranksB[k], maxRank(k)); }
  // a shared link may carry options this kit no longer has
  const known = new Set((S.view?.options || []).map(o => o.id));
  for (const id of Object.keys(S.options)) if (!known.has(id)) delete S.options[id];
  nameKit(); paintSkills(); renderLines(); renderSteps(); renderOpts(); schedule();
  // the picker's order follows what this champion's players build
  if (pick) renderItems();
}
function setChamp(c) {
  S.champ = c; S.view = null; S.options = {};
  renderOpts();
  // a new kit gets the default combo: three autos and one of each ability that deals damage
  S.combo = {aa:3, q:1, w:1, e:1, r:1};
  comboFresh = true;
  if (S.order === 'manual') { S.order = 'qew'; $('#order').value = 'qew'; }
  if (S.orderB === 'manual') S.orderB = 'qew';
  S.ranks = autoRanks(S.order); S.ranksB = autoRanks(S.orderB);
  paintChamp(); nameKit(); paintSkills(); renderLines(); renderSteps(); loadKit();
  followChamp();
}
let comboFresh = false;

/* ---------- level and ranks ---------- */
function buildRuler() {
  $('#ruler').innerHTML = Array.from({length: 18}, (_, i) => {
    const l = i + 1, r = {6:'R1', 11:'R2', 16:'R3'}[l];
    return `<button data-l="${l}"${r ? ` data-r="${r}" class="ult"` : ''} aria-label="Level ${l}"><span>${l}</span></button>`;
  }).join('');
}
function paintLevel() {
  $('#lvl-out').textContent = S.level;
  $('#ruler').style.setProperty('--lv', S.level);
  $$('#ruler button').forEach(b => {
    const l = +b.dataset.l;
    b.classList.toggle('past', l <= S.level);
    b.classList.toggle('now', l === S.level);
    b.setAttribute('aria-pressed', l === S.level);
  });
  paintSub();
}
/* The ranks a max order gives at the current level. */
function autoRanks(order) {
  const ord = [...order], r = {q:0, w:0, e:0, r:0};
  for (let l = 1; l <= S.level; l++) {
    if ((l === 6 || l === 11 || l === 16) && r.r < maxRank('r')) { r.r++; continue; }
    const cap = Math.ceil(l / 2);
    const k = l <= 3 ? ord[l - 1] : (ord.find(x => r[x] < maxRank(x) && r[x] < cap) || ord.find(x => r[x] < maxRank(x)));
    if (k) r[k]++;
  }
  return r;
}
const pointsText = (r, short) => {
  const used = r.q + r.w + r.e + r.r;
  return used > S.level ? `<b>${used}</b> of ${S.level}${short ? '' : ' points'}, ${used - S.level} too many`
    : `<b>${used}</b> of ${S.level}${short ? '' : ' points spent'}`;
};
/* Comparing with the ranks unlinked: a compact row per build, each with its own pips and max order.
   A rank that differs from the other build's is underlined in its build's colour, as items are. */
function paintSplit() {
  const el = $('#rank-split');
  if (!el) return;
  const link = $('#rank-link');
  link.setAttribute('aria-pressed', !S.split);
  link.setAttribute('aria-label', S.split ? 'Link the ranks of A and B' : 'Unlink the ranks of A and B');
  link.title = S.split ? 'Unlinked: each build has its own ranks. Click to share A\'s.' : 'Linked: A and B share these ranks. Click to give each build its own.';
  document.body.dataset.ranks = S.split ? 'split' : 'same';
  if (!S.split) { el.innerHTML = ''; return; }
  const options = $('#order').innerHTML;
  const row = (b, r, o, order) => `<div class="rrow ${b}"><span class="tag ${b} sm">${b.toUpperCase()}</span>
      <div class="rs"><div class="ib" data-ab="p"><i class="ico kit p"></i></div></div>
      ${SLOTS.map(k => `<div class="rs${r[k] !== o[k] ? ' diff' : ''}${!r[k] ? ' zero' : ''}" data-ab="${k}"><div class="ib"><i class="ico kit ${k}"></i><span class="k">${k.toUpperCase()}</span></div>`
        + `<span class="pips">${Array.from({length: maxRank(k)}, (_, i) => `<button class="pip${i < r[k] ? ' on' : ''}" data-b="${b}" data-k="${k}" data-n="${i + 1}" aria-label="Build ${b.toUpperCase()}, ${k.toUpperCase()} rank ${i + 1}"></button>`).join('')}</span><b>${r[k]}</b></div>`).join('')}
      <div class="plan"><select data-ob="${b}" aria-label="Max order of build ${b.toUpperCase()}">${options}</select><span class="pts${r.q + r.w + r.e + r.r > S.level ? ' over' : ''}">${pointsText(r, true)}</span></div></div>`;
  el.innerHTML = row('a', S.ranks, S.ranksB, S.order) + row('b', S.ranksB, S.ranks, S.orderB);
  $('select[data-ob="a"]', el).value = S.order;
  $('select[data-ob="b"]', el).value = S.orderB;
}
function setSplit(on) {
  S.split = on;
  // unlinking starts B from A's ranks
  if (on) { S.ranksB = {...S.ranks}; S.orderB = S.order; }
  paintSkills(); renderBuilds(); schedule();
}
function setOrder(b, order) {
  if (b === 'b') { S.orderB = order; if (order !== 'manual') S.ranksB = autoRanks(order); }
  else { S.order = order; $('#order').value = order; if (order !== 'manual') S.ranks = autoRanks(order); }
  paintSkills(); schedule();
}
function setRank(b, k, n) {
  const r = b === 'b' ? S.ranksB : S.ranks;
  r[k] = r[k] === n ? n - 1 : n;
  if (b === 'b') S.orderB = 'manual'; else { S.order = 'manual'; $('#order').value = 'manual'; }
  paintSkills(); schedule();
}
function paintSkills() {
  for (const k of SLOTS) {
    const max = maxRank(k), el = $(`.skill[data-k="${k}"]`);
    $('.pips', el).innerHTML = Array.from({length: max}, (_, i) =>
      `<button class="pip${i < S.ranks[k] ? ' on' : ''}" data-k="${k}" data-n="${i + 1}" aria-label="${k.toUpperCase()} rank ${i + 1}"></button>`).join('');
    $('.rk', el).textContent = S.ranks[k];
    el.classList.toggle('zero', !S.ranks[k]);
  }
  const used = S.ranks.q + S.ranks.w + S.ranks.e + S.ranks.r, pts = $('#pts');
  pts.classList.toggle('over', used > S.level);
  pts.innerHTML = pointsText(S.ranks);
  paintSplit();
}
function setLevel(n) {
  S.level = Math.max(1, Math.min(18, n));
  if (S.order !== 'manual') S.ranks = autoRanks(S.order);
  if (S.orderB !== 'manual') S.ranksB = autoRanks(S.orderB);
  paintLevel(); paintSkills(); schedule();
}

/* ---------- builds and item picker ---------- */
let pick = null;
function renderBuilds() {
  const sets = {a: new Set(S.builds.a.filter(Boolean)), b: new Set(S.builds.b.filter(Boolean))};
  for (const k of ['a','b']) {
    const other = sets[k === 'a' ? 'b' : 'a'], row = $(`.build[data-b="${k}"]`), K = k.toUpperCase();
    $('.slots', row).innerHTML = S.builds[k].map((id, i) => {
      const sel = pick && pick.b === k && pick.i === i ? ' sel' : '';
      if (!id) return `<div class="slot empty${sel}" role="button" tabindex="0" data-b="${k}" data-i="${i}" aria-label="Build ${K}, slot ${i + 1}, empty"></div>`;
      const it = S.items.get(id), name = esc(it?.name || 'Item ' + id), shop = shopOf(it);
      return `<div class="slot${other.has(id) ? '' : ' uniq'}${sel}" role="button" tabindex="0" data-b="${k}" data-i="${i}" data-it="${id}" aria-label="Build ${K}, slot ${i + 1}, ${name}${shop ? `, ${SHOP[shop]} item` : ''}">${itemIco(id)}${badge(it)}${cfgBtn(k, i, it)}<button class="rm" data-rm aria-label="Remove ${name}">×</button></div>`;
    }).join('');
    $('.b-gold b', row).textContent = nf(S.builds[k].reduce((s, id) => s + (S.items.get(id)?.gold || 0), 0));
  }
  paintAutoKeep();
  renderTargetItems();
  const now = $('#shop-now');
  if (now) {
    const on = Object.keys(S.shops).filter(m => S.shops[m]);
    now.textContent = on.length ? `Summoner's Rift + ${on.map(m => SHOP[m]).join(' + ')}` : "Summoner's Rift items";
    $('#items-hint').textContent = S.compare ? '' : 'Click a slot to change it';
  }
  paintTabs();
  if (tipAt) paintTip();
}
/* The enemy champion's six slots, on the Target tab: the same picker fills them ('t' where a build is 'a' or 'b'),
   and their stats go into the dials (enemyStats). */
function renderTargetItems() {
  const el = $('#t-slots');
  if (!el) return;
  const name = esc(S.enemy.name);
  el.innerHTML = S.enemy.items.map((id, i) => {
    const sel = pick && pick.b === 't' && pick.i === i ? ' sel' : '';
    if (!id) return `<div class="slot empty${sel}" role="button" tabindex="0" data-b="t" data-i="${i}" aria-label="${name}'s items, slot ${i + 1}, empty"></div>`;
    const it = S.items.get(id), item = esc(it?.name || 'Item ' + id), shop = shopOf(it);
    return `<div class="slot${sel}" role="button" tabindex="0" data-b="t" data-i="${i}" data-it="${id}" aria-label="${name}'s items, slot ${i + 1}, ${item}${shop ? `, ${SHOP[shop]} item` : ''}">${itemIco(id)}${badge(it)}<button class="rm" data-rm aria-label="Remove ${item}">×</button></div>`;
  }).join('');
  $('#t-gold').textContent = nf(S.enemy.items.reduce((s, id) => s + (S.items.get(id)?.gold || 0), 0));
}
/* The shops: Summoner's Rift's items are always offered; ARAM's and Arena's own can be added.
   An item the Rift does not sell is marked with its shop, in the picker and in a slot. */
const SHOP = {sr: "Summoner's Rift", aram: 'ARAM', arena: 'Arena'};
const ADDABLE = ['aram', 'arena'];
const shopOf = it => it?.shops && !it.shops.includes('sr') ? it.shops[0] : null;
const badge = it => shopOf(it) ? `<span class="md">${shopOf(it)}</span>` : '';
function setShop(m) {
  S.shops[m] = !S.shops[m];
  $$('#shop .chip[data-shop]').forEach(c => c.setAttribute('aria-pressed', !!S.shops[c.dataset.shop]));
  renderItems(); renderBuilds();
}
function pickerLabel() {
  $('#picker-for').innerHTML = pick.b === 't' ? `${esc(S.enemy.name)}, slot ${pick.i + 1}` : `<span class="tag ${pick.b} sm">${pick.b.toUpperCase()}</span>Slot ${pick.i + 1}`;
}
function openPicker(b, i) {
  closeItemMenu(); closeAuto();
  pick = {b, i};
  // the picker opens beside the slots it fills: the builds', or the enemy's on the target's side
  const picker = $('#picker'), home = b === 't' ? $('#t-inv') : $('#builds');
  if (picker.parentElement !== home) home.insertBefore(picker, b === 't' ? null : $('#ab'));
  if (b === 't') enemyKit();
  picker.hidden = false;
  pickerLabel(); renderBuilds();
  const q = $('#item-q'); q.value = ''; searching = false; renderItems();
  if (!touched()) q.focus();
}
function closePicker() {
  if (!pick) return;
  pick = null; $('#picker').hidden = true; renderBuilds();
}
/* The enemy's kit, for its players' items in the picker; the picker is drawn again when it arrives. */
async function enemyKit() {
  const id = S.enemy.id;
  if (S.enemyView?.id === id) return;
  try {
    const v = await api(`/champions/${encodeURIComponent(id)}`);
    if (S.enemy.id !== id) return;
    S.enemyView = v;
    if (pick?.b === 't') renderItems();
  } catch (e) {}
}
/* The search reads what players type: a name or a piece of one, a nickname from the item data ("bork"),
   initials worked out from the name ("ldr"; "botrk" or "brk"), or a stat word ("lethality", "anti heal").
   Words combine, and an item must answer every one. A word on its way to a stat word ("letha") reads as
   that stat once it has four letters, as long as no item answers it by name. Results rank by how they
   answer: a nickname above initials, above the start of the name, above a stat. */
const fold = s => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/['’.,:!]/g, '').replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ').trim();
const STAT_WORD = new Map(STAT_WORDS.flatMap(([, words], i) => words.map(w => [w, i])));
const statsStarting = t => STAT_WORDS.flatMap(([, words], i) => words.some(w => w.length > t.length && w.startsWith(t)) ? [i] : []);
const finds = new WeakMap();
function findOf(it) {
  let f = finds.get(it);
  if (!f) {
    const named = n => { const words = fold(n).split(' '); return {name: words.join(' '), flat: words.join(''), words, form: n}; };
    const own = named(it.name), small = new Set(['of', 'the']);
    const ini = [own.words, own.words.filter(w => !small.has(w))].map(ws => ws.map(w => w[0]).join('')).filter(x => x.length > 1);
    finds.set(it, f = {...own, ini: [...new Set(ini)], nick: it.aliases || [], forms: (it.forms || []).map(named)});
  }
  return f;
}
// how well an item answers one word of the search: [score, how, the form it answered by], or null
function answer(it, t, byStat = true) {
  const f = findOf(it), x = t.text, flat = x.replace(/ /g, '');
  let best = null;
  const hit = (s, how, form) => { if (!best || s > best[0]) best = [s, how, form]; };
  if (f.nick.includes(flat)) hit(100, 'nick');
  else if (flat.length >= 3 && f.nick.some(n => n.startsWith(flat))) hit(50, 'nick');
  // initials that are also a stat word read as the stat first: "mr" is magic resist before Mortal Reminder
  if (f.ini.includes(flat)) hit(t.stat && !t.part ? 20 : 90, 'ini');
  // its own name, then the names of what it turns into ("muramana" finds Manamune), a little below
  for (const [n, less, how] of [[f, 0, 'name'], ...f.forms.map(g => [g, 5, 'form'])]) {
    if (n.name.startsWith(x)) hit(80 - less, how, n.form);
    else if (n.words.some(w => w.startsWith(x))) hit(60 - less, how, n.form);
    else if (flat.length >= 3 && n.flat.includes(flat)) hit(40 - less, how, n.form);
  }
  if (byStat && t.stat?.some(i => STAT_WORDS[i][2](it))) hit(t.part ? 25 : 30, 'stat');
  return best;
}
// the search as words: {text, stat: the stat words it reads as, part: on its way to one}
function readQuery(q) {
  const w = fold(q).split(' ').filter(Boolean), out = [];
  for (let i = 0; i < w.length;) {
    let took = 0;
    for (let n = Math.min(3, w.length - i); n > 0 && !took; n--) {
      const t = w.slice(i, i + n).join(' ');
      if (STAT_WORD.has(t)) { out.push({text: t, stat: [STAT_WORD.get(t)]}); took = n; }
      // a stat phrase still being typed: "armor p", "attack sp"
      else if (n > 1 && i + n === w.length && t.length >= 4 && statsStarting(t).length) { out.push({text: t, stat: statsStarting(t), part: true}); took = n; }
    }
    if (!took) { out.push({text: w[i]}); took = 1; }
    i += took;
  }
  const items = [...S.items.values()];
  for (const t of out) {
    if (t.stat || t.text.length < 4 || items.some(it => answer(it, t, false))) continue;
    const s = statsStarting(t.text);
    if (s.length) Object.assign(t, {stat: s, part: true});
  }
  return out;
}
/* The role tabs: the shop's roles. The picker opens on the champion's class, and a tab chosen stays
   until the champion changes. While searching, each tab counts its matches, and the matches outside
   the open tab are listed after its own, so a search never comes up empty for being on the wrong tab. */
let itemRole = null, found = new Map(), bestFind = null;
// a search being written, which Esc clears; after a pick the words stay, selected, and Esc closes the picker
let searching = false;
/* Whom the picker picks for: the champion, or the enemy when it fills the enemy's slots. */
const pickFor = () => pick?.b === 't' ? S.champs.find(c => c.id === S.enemy.id) || S.enemy : S.champ;
const pickView = () => pick?.b === 't' ? (S.enemyView?.id === S.enemy.id ? S.enemyView : null) : S.view;
const champClass = () => ITEM_ROLES.includes(pickFor().tags?.[0]) ? pickFor().tags[0] : null;
const roleNow = () => itemRole?.champ === pickFor().id ? itemRole.role : champClass() || 'All';
const inRole = (it, role) => role === 'All' || !it.roles || it.roles.includes(role);
const sold = (it, m) => (it.shops || ['sr']).includes(m);
const offered = it => sold(it, 'sr') || ADDABLE.some(m => S.shops[m] && sold(it, m));
/* The list's order: what this champion's players build, most built first, where enough of their games were
   sampled; then what all players build; then the name. A component counts for every build it goes into. */
const champUse = () => { const p = pickView()?.itemPopularity; return p && p.builds >= 20 ? p.shares : null; };const byUse = (mine = champUse()) => (x, y) => (mine?.[y.id] || 0) - (mine?.[x.id] || 0) || (y.popularity || 0) - (x.popularity || 0) || x.name.localeCompare(y.name);
function useText(it) {
  const mine = champUse()?.[it.id], n = mine || it.popularity;
  if (!n) return '';
  return `${it.component ? 'Goes into' : 'In'} ${n < .01 ? 'under 1%' : Math.round(n * 100) + '%'} of ${mine ? pickFor().name + ' ' : ''}builds. `;
}
function setItemRole(role) {
  itemRole = {champ: pickFor().id, role};
  renderItems();
  if (!touched()) $('#item-q').focus();
}
// what found an item, for the footer and the best match: "Nickname “bork”", "Has crit and attack speed"
function foundBy(r) {
  const out = [], stats = [];
  for (const [t, how, form] of r.how) {
    if (how === 'nick') out.push(`Nickname “${t.text}”`);
    else if (how === 'form') out.push(`Turns into ${form}`);
    else if (how === 'ini') out.push(`Initials “${t.text.toUpperCase()}”`);
    else if (how === 'stat') stats.push(STAT_WORDS[t.stat.find(i => STAT_WORDS[i][2](r.it))][0]);
  }
  if (stats.length) out.push('Has ' + stats.join(' and '));
  return [...new Set(out)];
}
function footIdle() {
  $('#item-foot').innerHTML = `<span>${touched() ? 'Tap an item for its details, and again to pick it.'
    : bestFind ? `Enter picks <b>${esc(bestFind.it.name)}</b>.` : 'Hover an item for details. Enter picks the first result.'}</span>`;
}
function paintReading(toks) {
  const el = $('#item-read');
  el.classList.toggle('idle', !toks.length);
  if (!toks.length) { el.innerHTML = `<span>Try</span>${['LDR', 'bork', 'lethality', 'anti heal', 'ap pen'].map(x => `<button data-try="${x}">${x}</button>`).join('')}`; return; }
  el.innerHTML = '<span>Reading as</span>' + toks.map(t => {
    const flat = t.text.replace(/ /g, ''), items = [...S.items.values()].filter(offered);
    // a word names an item when that item answers it best, by nickname or initials, and no other item as well:
    // "bt" is Bloodthirster's nickname before it is Blackfire Torch's initials; "rh" names neither Ravenous Hydra nor Runaan's
    const named = items.map(it => [it, answer(it, t, false)]).filter(([, a]) => a && a[0] >= 90 && (a[1] === 'nick' || a[1] === 'ini'))
      .sort((x, y) => y[1][0] - x[1][0]);
    const by = named[0] && !named.some(([it, a]) => a[0] === named[0][1][0] && it.name !== named[0][0].name) ? named[0][0] : null;
    if (by) return `<b class="nm">${esc(t.text)} = ${esc(by.name)}</b>`;
    if (t.stat) return `<b class="st">${t.stat.map(i => STAT_WORDS[i][0]).join(' or ')}</b>${items.some(it => findOf(it).ini.includes(flat)) ? '<em>or initials</em>' : ''}`;
    return `<b>“${esc(t.text)}”</b>`;
  }).join('<i>+</i>');
}
function renderItems() {
  const toks = readQuery($('#item-q').value), role = roleNow();
  const all = [];
  for (const it of S.items.values()) {
    const how = toks.map(t => [t, answer(it, t)]);
    if (how.some(([, a]) => !a)) continue;
    all.push({it, s: how.reduce((s, [, a]) => s + a[0], 0), top: Math.max(0, ...how.map(([, a]) => a[0])), how: how.map(([t, a]) => [t, a[1], a[2]])});
  }
  const use = byUse();
  const shown = all.filter(r => offered(r.it)).sort(toks.length
    ? (x, y) => y.s - x.s || inRole(y.it, role) - inRole(x.it, role) || sold(y.it, 'sr') - sold(x.it, 'sr') || x.it.component - y.it.component || use(x.it, y.it)
    : (x, y) => use(x.it, y.it));
  found = new Map(shown.map(r => [r.it.id, r]));
  // the best match is what Enter picks: an item a word found by name, ahead of every other
  const top = shown[0], next = shown.find(r => r.it.name !== top?.it.name);
  bestFind = toks.length && top && top.top >= 40 && (!next || top.s > next.s) ? top : null;

  const cell = (it, away) => `<button class="pi${away ? ' away' : ''}" data-id="${it.id}" data-it="${it.id}" aria-label="${esc(it.name)}, ${nf(it.gold)} gold${shopOf(it) ? ', ' + SHOP[shopOf(it)] : ''}">${itemIco(it.id)}${badge(it)}</button>`;
  let html = '';
  if (bestFind) {
    const it = bestFind.it, by = foundBy(bestFind);
    html += `<button class="pbest" data-id="${it.id}" data-it="${it.id}" aria-label="Best match: ${esc(it.name)}, ${nf(it.gold)} gold"><span class="pi">${itemIco(it.id)}${badge(it)}</span>
      <span class="pb-t"><b>${esc(it.name)}</b><span>${[...by, nf(it.gold) + ' gold', !inRole(it, role) && it.roles?.length ? `${it.roles[0]} item` : ''].filter(Boolean).join(' · ')}</span></span>${touched() ? '' : '<kbd>Enter</kbd>'}</button>`;
  }
  const here = shown.filter(r => r !== bestFind && inRole(r.it, role)).map(r => r.it);
  const sr = here.filter(i => sold(i, 'sr')), fin = sr.filter(i => !i.component), comp = sr.filter(i => i.component);
  html += (fin.length ? `<div class="grp">Finished items</div>${fin.map(i => cell(i)).join('')}` : '')
    + (comp.length ? `<div class="grp">Components</div>${comp.map(i => cell(i)).join('')}` : '');
  // an added shop lists what the Rift does not sell: its own items, and its copies of Rift items
  const listed = new Set(sr);
  for (const m of ADDABLE) {
    const list = here.filter(i => !listed.has(i) && S.shops[m] && sold(i, m));
    list.forEach(i => listed.add(i));
    if (list.length) html += `<div class="grp">${SHOP[m]} <em>its own items and its copies of Rift items</em></div>${list.map(i => cell(i)).join('')}`;
  }
  if (toks.length && shown.length && !here.length && !(bestFind && inRole(bestFind.it, role))) html += `<div class="grp">No ${role} item matches</div>`;
  const away = toks.length && role !== 'All' ? shown.filter(r => r !== bestFind && !inRole(r.it, role)).map(r => r.it) : [];
  if (away.length) html += `<div class="grp">Other roles <em>${away.length}</em><button data-role="All">Show all</button></div>${away.map(i => cell(i, true)).join('')}`;
  if (!shown.length) {
    const missed = ADDABLE.filter(m => !S.shops[m] && all.some(r => !sold(r.it, 'sr') && sold(r.it, m)));
    html = missed.length ? `<div class="miss">No ${ADDABLE.some(m => S.shops[m]) ? 'item in these shops' : "Summoner's Rift item"} matches. The ${missed.map(m => SHOP[m]).join(' and ')} shop${missed.length > 1 ? 's have' : ' has'} some: ${missed.map(m => `<button class="chip" data-shop="${m}">+ ${SHOP[m]}</button>`).join('')}</div>`
      : '<div class="grp">No items match</div>';
  }
  $('#item-grid').innerHTML = html;

  const mine = champClass();
  $('#item-roles').innerHTML = ITEM_ROLES.map(r => {
    const n = toks.length ? shown.filter(x => inRole(x.it, r)).length : null;
    return `<button class="role${n === 0 ? ' none' : ''}" role="tab" data-role="${r}" aria-selected="${r === role}">${r}${r === mine ? `<i class="you" title="${esc(pickFor().name)}'s class"></i>` : ''}${n === null ? '' : `<span class="n">${n}</span>`}</button>`;
  }).join('');
  $$('#item-chips [data-w]').forEach(c => c.setAttribute('aria-pressed', toks.some(t => !t.part && t.stat?.[0] === STAT_WORD.get(c.dataset.w))));
  paintReading(toks);
  footIdle();
  if (tipAt) paintTip();
}
function choose(id) {
  if (!pick) return;
  const enemy = pick.b === 't', slots = enemy ? S.enemy.items : S.builds[pick.b];
  slots[pick.i] = id;
  searching = false;
  const next = slots.findIndex((v, j) => !v && j > pick.i);
  if (next > -1) { pick.i = next; pickerLabel(); renderBuilds(); const q = $('#item-q'); if (!touched() || document.activeElement === q) { q.select(); q.focus(); } }
  else closePicker();
  // the enemy's dials take its items' stats first, and recalculate once they have
  if (enemy) enemyStats(); else schedule();
}

/* ---------- auto-build ---------- */
/* Each build's Auto-build button opens a panel over the build pane: a goal (combo damage, sustained DPS or
   effective health), a limit (a number of finished items, or gold for the whole build), items to keep from
   the build and items never to use. The best three builds it finds can be put in either build, so B against
   A becomes the page's own comparison. The search runs in a Web Worker on the engine itself (src/autobuild/),
   from the address the page names in <meta name="engine">; it reads the page as it is (champion, level, ranks,
   target, combo, crits) and runs again when any of that changes. The worker lives on between searches, with
   the data it has loaded: one search runs at a time, and what was asked while it ran waits, the latest only. */
const ENGINE = $('meta[name="engine"]')?.content || '/engine/';
const SPARK = '<svg class="spark" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M7 2l1.6 4.4L13 8l-4.4 1.6L7 14l-1.6-4.4L1 8l4.4-1.6z"/><path d="M13 0l.6 1.4L15 2l-1.4.6L13 4l-.6-1.4L11 2l1.4-.6z"/></svg>';
const AB_GOALS = {
  burst: {label: 'Burst', unit: 'damage', short: 'damage', says: () => S.target === 'raw' ? 'Your combo, before armor and magic resist.' : 'Your combo, against the target.'},
  dps: {label: 'DPS', unit: 'DPS', short: 'DPS', says: () => S.target === 'raw' ? 'Autos, and your combo’s abilities each time they’re ready, over 10 seconds.'
    : 'Autos, and your combo’s abilities each time they’re ready, until the target dies: the fastest kill.'},
  tank: {label: 'Tankiness', unit: 'effective HP', short: 'eff. HP', says: () => S.target === 'champ' ? `Effective health against ${S.enemy.name}’s damage.` : 'Effective health against damage half physical, half magic.'},
};
const AB_GOLD = [3000, 6000, 10000, 15000, 20000];
const AB = {
  for: null,                        // the build the panel is open for, 'a' or 'b'
  // the limit starts at a number of items on each visit and is never saved: a gold limit left on unnoticed
  // looked like poor picks
  goal: 'burst', mode: 'items', gold: 6000, count: 3, fill: true, boots: true,
  // the items tried: what the champion's players build, or any. Any item lets marksman items win a mage's DPS
  pool: 'built',
  goldSet: false,                   // the visitor set the gold; until then it starts at the build's own
  keep: new Set(),                  // item ids of the build that stay
  never: new Set(),                 // item ids never to use
  res: null, busy: false, err: '', asked: '',
};
let abWorker = null, abTimer = 0, abSeq = 0;
let abFlying = false, abNext = null;  // a search the worker is running; the one asked for since, which waits for it
let abWarm = '';                    // the champion the worker last loaded ahead of time
const buildGold = k => S.builds[k].reduce((s, id) => s + (S.items.get(id)?.gold || 0), 0);
function openAuto(k) {
  if (AB.for === k) { closeAuto(); return; }
  closePicker(); closeItemMenu();
  if (!AB.goldSet) { const g = buildGold(k); AB.gold = g >= 1000 ? Math.ceil(g / 100) * 100 : 6000; }
  if (AB.for !== k) { AB.keep = new Set(); AB.res = null; AB.err = ''; AB.asked = ''; }
  AB.for = k;
  $('#ab').hidden = false;
  paintAuto(); paintAutoBtns(); runAuto();
  if (!touched()) $('#ab [data-goal][aria-checked="true"]')?.focus();
}
function closeAuto() {
  if (!AB.for) return;
  AB.for = null; $('#ab').hidden = true;
  clearTimeout(abTimer);
  // what was asked and not answered is of no use now; a search already running finishes unread
  abNext = null;
  if (AB.busy) { AB.busy = false; AB.asked = ''; }
  paintAutoBtns();
}
function autoWorker() {
  if (!abWorker) {
    abWorker = new Worker(ENGINE + 'autobuild/worker.js', {type: 'module'});
    abWorker.onmessage = e => autoDone(e.data);
    abWorker.onerror = e => { e.preventDefault?.(); abWorker = null; abWarm = ''; abFlying = false; abNext = null; autoDone({id: abSeq, error: 'The search could not start.'}); };
  }
  return abWorker;
}
/* Pointing at an Auto-build button starts the worker and its data loading, so the first search starts at once. */
function warmAuto() {
  if (abWarm === S.champ.id) return;
  abWarm = S.champ.id;
  autoWorker().postMessage({warm: S.champ.id});
}
function paintAutoBtns() { $$('[data-auto]').forEach(b => b.setAttribute('aria-pressed', AB.for === b.dataset.auto)); }
/* What the worker is asked: the page's build without its items, the kept ones apart. */
function autoAsk() {
  const k = AB.for, keep = S.builds[k].filter(id => id && AB.keep.has(id));
  return {
    req: {
      build: {champion: S.champ.id, level: S.level, ranks: k === 'b' && S.split ? S.ranksB : S.ranks, options: S.options, items: [], itemOptions: itemOptsOf(k)},
      target: targetBody(), combo: {counts: S.combo, crits: S.crits},
      goal: AB.goal, limit: AB.mode === 'gold' ? {gold: AB.gold} : {items: AB.count},
      keep, never: [...AB.never], fill: AB.fill, boots: AB.boots, pool: AB.pool,
    },
    enemy: S.target === 'champ' ? {id: S.enemy.id, level: S.enemy.level, items: enemyItems()} : null,
  };
}
/* `soon` waits for a moment of quiet first, for a number being typed or the page being changed. */
function runAuto(soon) {
  if (!AB.for) return;
  clearTimeout(abTimer);
  if (soon) { abTimer = setTimeout(runAuto, 250); return; }
  const ask = autoAsk(), key = JSON.stringify(ask);
  if (key === AB.asked) return;
  AB.asked = key; AB.busy = true;
  abNext = {id: ++abSeq, ...ask};
  if (!abFlying) sendAuto();
  paintAutoRes();
}
function sendAuto() {
  if (!abNext) return;
  abFlying = true;
  autoWorker().postMessage(abNext);
  abNext = null;
}
function autoDone(m) {
  abFlying = false;
  // something newer was asked while this ran: this answer is out of date
  if (abNext) { sendAuto(); return; }
  if (m.id !== abSeq || !AB.for) return;
  AB.busy = false;
  if (m.error) { AB.err = m.error; AB.res = null; AB.asked = ''; } else { AB.err = ''; AB.res = m.result; }
  paintAutoRes();
}
/* The build as it is now, by the goal: the page's last calculation has it. */
function autoNow(k) {
  const r = S.res?.[k];
  if (!r) return null;
  if (AB.goal === 'burst') return r.combo.total.dealt;
  if (AB.goal === 'dps') return r.fight.dps.dealt;
  const t = AB.res?.taken || {physical: 0.5, magic: 0.5, true: 0}, m = x => x >= 0 ? 100 / (100 + x) : 2 - 100 / (100 - x);
  const per = t.physical * m(r.stats.armor.total) + t.magic * m(r.stats.mr.total) + t.true;
  return per > 0 ? r.stats.hp.total / per : r.stats.hp.total;
}
const sameItems = (x, y) => x.filter(Boolean).sort((a, b) => a - b).join() === y.filter(Boolean).sort((a, b) => a - b).join();
function putAuto(k, n) {
  const b = AB.res?.builds[n];
  if (!b) return;
  if (k === 'b' && !S.compare) setCompare(true);
  S.builds[k] = slots6(b.items);
  // named after what it was found for, so the name a build had before does not describe it wrongly
  $(`#name-${k}`).value = `Best ${AB_GOALS[AB.goal].label.toLowerCase()}, ${AB.mode === 'gold' ? `${nf(AB.gold)}g` : `${AB.count} item${AB.count === 1 ? '' : 's'}`}`;
  paintNames();
  closeItemMenu(); renderBuilds(); schedule();
  paintAutoRes();
}
function paintAuto() { paintAutoCtl(); paintAutoKeep(); paintAutoRes(); }
function paintAutoCtl() {
  if (!AB.for) return;
  const K = AB.for.toUpperCase(), g = AB_GOALS[AB.goal];
  const amount = AB.mode === 'gold'
    ? `<div class="ab-amt"><input id="ab-gold" type="number" min="0" max="40000" step="500" inputmode="numeric" value="${AB.gold}" aria-label="Gold for the whole build"><span>gold</span></div>
      <div class="chips ab-presets">${AB_GOLD.map(v => `<button class="chip" data-gold="${v}" aria-pressed="${AB.gold === v}">${v / 1000}k</button>`).join('')}</div>
      <label class="ab-chk"><input type="checkbox" id="ab-fill"${AB.fill ? ' checked' : ''}>Spend what is left on components</label>`
    : `<div class="ab-amt"><button class="ab-step" data-count="-1" aria-label="One item fewer"${AB.count <= 1 ? ' disabled' : ''}>−</button><output>${AB.count}</output><button class="ab-step" data-count="1" aria-label="One item more"${AB.count >= 6 ? ' disabled' : ''}>+</button><span>finished item${AB.count === 1 ? '' : 's'}</span></div>
      <label class="ab-chk"><input type="checkbox" id="ab-boots"${AB.boots ? ' checked' : ''}>Boots can be one of them</label>`;
  $('#ab-ctl').innerHTML = `<div class="ab-top"><span class="ab-for">${SPARK}Auto-build <span class="tag ${AB.for} sm">${K}</span></span><button class="esc" id="ab-x">Esc</button></div>
    <span class="lbl">Best at</span>
    <div class="seg ab-goals" role="radiogroup" aria-label="Best at">${Object.entries(AB_GOALS).map(([k, x]) => `<button role="radio" data-goal="${k}" aria-checked="${AB.goal === k}">${x.label}</button>`).join('')}</div>
    <p class="ab-says">${esc(g.says())}</p>
    <span class="lbl">Within</span>
    <div class="ab-limit"><div class="seg" role="radiogroup" aria-label="Limit">${[['items', 'Items'], ['gold', 'Gold']].map(([k, l]) => `<button role="radio" data-mode="${k}" aria-checked="${AB.mode === k}">${l}</button>`).join('')}</div>${amount}</div>
    <span class="lbl">From</span>
    <div class="seg ab-pool" role="radiogroup" aria-label="Items from">${[['built', `${S.champ.name} builds`], ['any', 'Any item']].map(([k, l]) => `<button role="radio" data-pool="${k}" aria-checked="${AB.pool === k}" title="${k === 'built' ? `Items in at least 1% of the ${esc(S.champ.name)} builds sampled` : 'Every finished item the shop allows'}">${esc(l)}</button>`).join('')}</div>`;
}
function paintAutoKeep() {
  if (!AB.for) return;
  const K = AB.for.toUpperCase(), held = S.builds[AB.for].filter(Boolean);
  for (const id of AB.keep) if (!held.includes(id)) AB.keep.delete(id);
  const tile = id => { const it = S.items.get(id), on = AB.keep.has(id);
    return `<button class="ab-it" data-keep="${id}" aria-pressed="${on}" data-it="${id}" data-hint="${on ? 'Kept. Click to let the search replace it.' : 'Click to keep it.'}" aria-label="Keep ${esc(it?.name || 'item')}">${itemIco(id)}</button>`; };
  const never = [...AB.never].map(id => S.items.get(id)).filter(Boolean);
  $('#ab-keep').innerHTML = `<span class="lbl">Keep from <span class="tag ${AB.for} xs">${K}</span></span>
    ${held.length ? `<div class="ab-keeps">${held.map(tile).join('')}</div><p class="hint">${AB.keep.size ? 'Kept items stay, and their gold counts toward the limit.' : 'Click an item to keep it. Nothing kept starts from an empty build.'}</p>` : `<p class="hint">Build ${K} is empty, so the search starts from nothing.</p>`}
    <span class="lbl">Never use</span>
    ${never.length ? `<div class="chips ab-nevers">${never.map(it => `<button class="chip" data-unnever="${it.id}" title="Use it again">${esc(it.name)}<i aria-hidden="true">×</i></button>`).join('')}</div>`
      : '<p class="hint">Click an item in a result to leave it out.</p>'}`;
}
function paintAutoRes() {
  if (!AB.for) return;
  const k = AB.for, K = k.toUpperCase(), r = AB.res, g = AB_GOALS[AB.goal], now = autoNow(k);
  const el = $('#ab-res');
  el.classList.toggle('busy', AB.busy);
  let rows;
  if (AB.err) rows = `<p class="ab-msg">${esc(AB.err)}</p>`;
  else if (!r) rows = `<p class="ab-msg">${AB.busy ? 'Searching…' : ''}</p>`;
  else if (r.problem || !r.builds.length) rows = `<p class="ab-msg">${esc(r.problem || 'Nothing found.')}</p>`;
  else rows = r.builds.map((b, n) => {
    const kept = new Set(), tiles = b.items.map(id => {
      const it = S.items.get(id), name = esc(it?.name || 'Item ' + id);
      // the kept items lead the build, each once
      if (AB.keep.has(id) && !kept.has(id) && S.builds[k].includes(id)) { kept.add(id); return `<span class="ab-it kept" role="img" data-it="${id}" data-hint="Kept from the build." aria-label="${name}, kept">${itemIco(id)}</span>`; }
      return `<button class="ab-it${it?.component ? ' part' : ''}" data-never="${id}" data-it="${id}" data-hint="Click to leave it out." aria-label="Leave out ${name}">${itemIco(id)}</button>`;
    }).join('');
    const d = now ? (b.score / now - 1) * 100 : null;
    const put = x => sameItems(S.builds[x], b.items) ? `<span class="ab-in">In ${x.toUpperCase()}</span>` : `<button class="ab-put ${x}" data-put="${x}" data-n="${n}">Put in ${x.toUpperCase()}</button>`;
    return `<div class="ab-row${n ? '' : ' top'}"><span class="ab-rk">${n + 1}</span><div class="ab-items">${tiles}</div>
      <div class="ab-sc"><b>${nf(b.score)}</b><span>${d === null || !isFinite(d) ? `<i class="u">${g.short}</i>`
        : `<i class="u">${g.short} · </i><em class="${d < 0 ? 'neg' : ''}">${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(0)}%</em>`}</span></div>
      <span class="ab-g">${nf(b.gold)} g</span><div class="ab-puts">${put('a')}${put('b')}</div></div>`;
  }).join('');
  const t = r?.taken, split = AB.goal === 'tank' && t ? ` · against ${Math.round(t.physical * 100)}% physical, ${Math.round(t.magic * 100)}% magic${t.true >= 0.005 ? `, ${Math.round(t.true * 100)}% true` : ''}` : '';
  // the champion's own items, unless too few of its games were sampled to say what they are
  const from = r?.pool === 'built' ? `in ${esc(S.champ.name)} builds` : 'allowed';
  const fell = r && AB.pool === 'built' && r.pool === 'any' ? ` · too few ${esc(S.champ.name)} games sampled, so any item` : '';
  const foot = r && !AB.err ? `<span title="Items the shop's rules allow${r.pool === 'built' ? ` that ${esc(S.champ.name)} players build` : ''}, the ones worth trying, and the builds the engine scored"><b>${r.allowed}</b> ${from} <i>→</i> <b>${r.tried}</b> tried <i>→</i> <b>${nf(r.scored)}</b> builds scored${split}${fell}</span>
    <span class="ab-how" title="${r.exact ? 'Every build that could win was scored.' : 'Too many builds to score them all: it built slot by slot and then swapped items while that helped.'}">${r.exact ? 'Exact' : 'Best found'} · ${r.ms < 100 ? '<0.1' : (r.ms / 1000).toFixed(1)} s</span>` : '';
  el.innerHTML = `<div class="ab-head"><b>Best builds</b>${AB.busy && r ? '<span class="ab-wait">Searching…</span>' : ''}<span class="hint">${K} now: ${now === null ? '–' : `<b>${nf(now)}</b> ${g.unit}`}</span></div>
    <div class="ab-rows">${rows}</div><div class="ab-foot">${foot}</div>`;
}
function wireAuto() {
  document.addEventListener('click', e => { const b = e.target.closest('[data-auto]'); if (b) openAuto(b.dataset.auto); });
  for (const t of ['pointerover', 'focusin']) document.addEventListener(t, e => { if (e.target.closest?.('[data-auto]')) warmAuto(); });
  const el = $('#ab');
  el.innerHTML = '<div class="ab-ctl" id="ab-ctl"></div><div class="ab-keep" id="ab-keep"></div><div class="ab-res" id="ab-res"></div>';
  el.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    const d = t.dataset;
    if (t.id === 'ab-x') { const k = AB.for; closeAuto(); $(`[data-auto="${k}"]`)?.focus(); return; }
    if (d.goal) { AB.goal = d.goal; paintAutoCtl(); paintAutoRes(); runAuto(); $(`#ab [data-goal="${d.goal}"]`)?.focus(); return; }
    if (d.mode) { AB.mode = d.mode; paintAutoCtl(); runAuto(); $(`#ab [data-mode="${d.mode}"]`)?.focus(); return; }
    if (d.pool) { AB.pool = d.pool; paintAutoCtl(); runAuto(); $(`#ab [data-pool="${d.pool}"]`)?.focus(); return; }
    if (d.gold) { AB.gold = +d.gold; AB.goldSet = true; paintAutoCtl(); runAuto(); return; }
    if (d.count) { AB.count = Math.max(1, Math.min(6, AB.count + +d.count)); paintAutoCtl(); runAuto(); $(`#ab [data-count="${d.count}"]`)?.focus(); return; }
    if (d.keep) { const id = +d.keep; AB.keep.has(id) ? AB.keep.delete(id) : AB.keep.add(id); paintAutoKeep(); runAuto(); $(`#ab [data-keep="${id}"]`)?.focus(); return; }
    if (d.never) { AB.never.add(+d.never); paintAutoKeep(); runAuto(); return; }
    if (d.unnever) { AB.never.delete(+d.unnever); paintAutoKeep(); runAuto(); return; }
    if (d.put) putAuto(d.put, +d.n);
  });
  el.addEventListener('input', e => {
    if (e.target.id !== 'ab-gold') return;
    AB.gold = Math.max(0, Math.min(40000, Math.round(+e.target.value || 0))); AB.goldSet = true;
    $$('#ab [data-gold]').forEach(c => c.setAttribute('aria-pressed', AB.gold === +c.dataset.gold));
    runAuto(true);
  });
  el.addEventListener('change', e => {
    if (e.target.id === 'ab-fill') { AB.fill = e.target.checked; runAuto(); }
    if (e.target.id === 'ab-boots') { AB.boots = e.target.checked; runAuto(); }
  });
  // a click elsewhere on the page closes it, as it does the item picker; the builds stay in reach
  document.addEventListener('mousedown', e => { if (AB.for && !e.target.closest('#ab, [data-auto], #builds, #tip')) closeAuto(); });
}

/* ---------- an item's settings ---------- */
/* An item whose passive stacks, procs or has an active carries a small button on its slot. It opens the
   item's card (itemCard) with more under it: what one firing of each of its effects deals, as the last
   calculation found, and the item's settings: a toggle, stacks, uses of the active, or a proc's count in the
   combo (left unset, the combo decides). The menu is kept short; what explains the numbers is behind its
   Details button. Settings are per build; the API takes them as itemOptions. */
const GEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>';
const hasMenu = it => !!(it?.controls?.length || it?.effects?.length);
function cfgBtn(k, i, it) {
  if (!hasMenu(it)) return '';
  const set = Object.keys(S.itemOpts[k][it.id] || {}).length, open = itemMenu && itemMenu.b === k && itemMenu.i === i;
  const what = it.controls?.length ? 'Settings' : 'Effects';
  return `<button class="cfg${it.controls?.length ? '' : ' info'}${set ? ' set' : ''}" data-cfg aria-haspopup="dialog" aria-expanded="${!!open}" aria-label="${what} of ${esc(it.name)}" title="${what}${set ? `, ${set} set` : ''}">${GEAR}</button>`;
}
let itemMenu = null;                // {b, i, id}: the slot whose menu is open
function openItemMenu(b, i) {
  const id = S.builds[b][i];
  if (!hasMenu(S.items.get(id))) return;
  closePicker();
  itemMenu = {b, i, id};
  renderBuilds(); paintItemMenu();
  $('#item-menu').hidden = false;
  placeItemMenu();
  $('#item-menu button, #item-menu input')?.focus();
}
function closeItemMenu() {
  if (!itemMenu) return;
  itemMenu = null;
  $('#item-menu').hidden = true;
  renderBuilds();
}
/* Fixed to the window, under the slot, or over it when there is no room below. */
function placeItemMenu() {
  const el = $('#item-menu'), slot = itemMenu && $(`.slot[data-b="${itemMenu.b}"][data-i="${itemMenu.i}"]`);
  if (!slot || el.hidden) return;
  const r = slot.getBoundingClientRect(), m = el.getBoundingClientRect(), gap = 8;
  const below = r.bottom + gap + m.height <= innerHeight - gap;
  el.style.top = `${Math.max(gap, below ? r.bottom + gap : r.top - gap - m.height)}px`;
  el.style.left = `${Math.max(gap, Math.min(r.left, innerWidth - m.width - gap))}px`;
}
const TYPE_NAME = {physical: 'physical', magic: 'magic', true: 'true'};
let itemDetails = false;            // the menu's Details: off at first, then as the visitor left it, for this visit
const UNDO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';
const CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
/* A setting's name as the menu shows it, and the rest of it for Details: "Seething Strike stacks when the combo
   starts" is "Seething Strike stacks", at the start of the combo; "Distance to the target when attacking, in
   hundreds of units" is the distance, in hundreds of units. */
function splitLabel(label) {
  let [name, ...rest] = label.split(', ');
  const start = / when the (combo|fight) starts$/.exec(name);
  if (start) name = name.slice(0, start.index);
  const more = [start && 'At the start of the combo', ...rest].filter(Boolean).join(', ');
  return [name, more && more[0].toUpperCase() + more.slice(1) + '.'];
}
const inDetails = text => itemDetails && text ? `<p class="im-d">${esc(text)}</p>` : '';
/* One effect: its name, its type, and what one firing deals after the target's resistances (before them in raw
   output). A proc or use the visitor can count has its stepper under it. Details says how often it fired in the
   combo and what that added up to. */
function effectRow(it, e, R, k) {
  const raw = S.target === 'raw', shown = R?.items.find(x => x.id === it.id)?.effects.find(x => x.id === e.id);
  const val = shown && (raw ? shown.one.raw : shown.one.dealt), ctl = it.controls?.find(c => c.rule === e.id);
  // what it added up to in the combo: a burn kept alive pays per second, so this is not always one firing times the count
  const part = R?.combo.lines.find(l => l.key === 'items')?.parts.filter(p => p.id === `item:${it.id}/${e.id}`);
  const total = part?.reduce((s, p) => s + (raw ? p.total.raw : p.total.dealt), 0) || 0;
  const mine = ctl && S.itemOpts[k][it.id]?.[ctl.id] !== undefined;
  const more = shown ? [
    // a share of missing health, an execute: nothing against a target at full health
    `${ctl?.kind === 'uses' ? 'Each use' : 'Each time it fires'}, ${raw ? 'before' : 'after'} armor and magic resist${val === 0 ? ': nothing against a target at full health' : ''}.`,
    shown.fired ? `${shown.fired === 1 ? 'Once' : `${shown.fired} times`} in the combo, ${nf(total)} in all.` : 'Not set off in the combo.',
    ctl?.kind === 'procs' ? (mine ? 'Procs set by hand.' : 'Procs counted from the combo.') : '',
  ].filter(Boolean).join(' ') : 'Calculating…';
  return `<div class="ie"><div class="ie-h"><b>${esc(e.label)}</b><span class="ie-t ${e.type}">${TYPE_NAME[e.type] || e.type}</span><span class="ie-n">${val === undefined ? '–' : nf(val)}</span></div>
    ${inDetails(more)}${ctl ? controlRow(it, ctl, R, k, true) : ''}</div>`;
}
/* A setting. Its value is what the user set, else what the last calculation used (a default can depend on the build).
   A proc left to the combo shows the combo's count, dimmed; once set by hand, ↺ gives it back to the combo. */
function controlRow(it, c, R, k, inEffect) {
  const mine = S.itemOpts[k][it.id]?.[c.id], used = R?.items.find(x => x.id === it.id)?.settings?.[c.id];
  const v = mine ?? used, id = `io-${k}-${it.id}-${c.id}`, [short, more] = splitLabel(c.label);
  const name = c.kind === 'procs' ? (inEffect ? 'Procs' : `${short} procs`) : c.kind === 'uses' ? (inEffect ? 'Uses' : `${short} uses`) : short;
  const label = `<span${name !== c.label ? ` title="${esc(c.label)}"` : ''}>${esc(name)}</span>`;
  if (c.kind === 'bool') return `<label class="ic" for="${id}">${label}<input type="checkbox" id="${id}" data-c="${esc(c.id)}"${v ? ' checked' : ''}></label>${inDetails(more)}`;
  const fired = R?.items.find(x => x.id === it.id)?.effects.find(x => x.id === c.rule)?.fired;
  const auto = c.kind === 'procs' && mine === undefined, n = auto ? (fired ?? 0) : (v ?? 0);
  // a count of procs or uses has a cap only to keep requests small; stacks have the game's own limit
  const max = c.kind === 'int' && c.max !== undefined ? `<small>/ ${c.max}</small>` : '';
  const back = (c.kind === 'procs' || c.kind === 'uses') && mine !== undefined
    ? `<button class="ireset" data-reset="${esc(c.id)}" title="${c.kind === 'procs' ? "Back to the combo's own count" : 'Back to the default'}" aria-label="${c.kind === 'procs' ? "Back to the combo's own count" : 'Back to the default'}: ${esc(c.label)}">${UNDO}</button>` : '';
  return `<div class="ic${auto ? ' auto' : ''}">${label}${back}<span class="stp">
      <button data-c="${esc(c.id)}" data-d="-1" aria-label="One fewer: ${esc(c.label)}"${n <= (c.min ?? 0) ? ' disabled' : ''}>−</button>
      <output${auto ? ' title="Counted from the combo"' : ''}>${n}</output>
      <button data-c="${esc(c.id)}" data-d="1" aria-label="One more: ${esc(c.label)}"${c.max !== undefined && n >= c.max ? ' disabled' : ''}>+</button>${max}</span></div>${inEffect ? '' : inDetails(more)}`;
}
function paintItemMenu() {
  const el = $('#item-menu');
  if (!itemMenu || !el) return;
  const {b: k, id} = itemMenu, it = S.items.get(id), R = S.res?.[k];
  if (!it) return closeItemMenu();
  // an effect without a firing in this build is still listed: its proc may be set by hand
  const effects = (it.effects || []).map(e => effectRow(it, e, R, k)).join('');
  // the rest of the settings: states the combo starts in, and counts of an effect the item doesn't list
  const rest = (it.controls || []).filter(c => !c.rule || !(it.effects || []).some(e => e.id === c.rule));
  const set = Object.keys(S.itemOpts[k][id] || {}).length, stats = itemStats(it);
  const where = `${S.compare ? `Build ${k.toUpperCase()}, slot` : 'Slot'} ${itemMenu.i + 1}.`;
  // a redraw keeps the focus on the same control
  const f = document.activeElement, back = el.contains(f) && f.matches('button')
    && (f.dataset.d ? `[data-c="${CSS.escape(f.dataset.c)}"][data-d="${f.dataset.d}"]` : f.matches('[data-details]') ? '[data-details]' : null);
  el.innerHTML = itemHead(it, {build: S.compare && k, after: '<button class="esc" data-close aria-label="Close">Esc</button>'})
    + (stats ? `<div class="tip-g">${stats}</div>` : '')
    + (effects ? `<div class="im-sec">${effects}</div>` : '')
    + (rest.length ? `<div class="im-sec">${rest.map(c => controlRow(it, c, R, k)).join('')}</div>` : '')
    + (itemDetails ? `<div class="im-notes">${[...(it.notes || []), where].map(n => `<p>${esc(n)}</p>`).join('')}</div>` : '')
    + `<div class="im-foot"><button class="im-det" data-details aria-expanded="${itemDetails}">${CHEVRON}Details</button>${set ? '<button class="act" data-reset-all>Reset all</button>' : ''}</div>`;
  if (back) $(back, el)?.focus();
  placeItemMenu();
}
function setItemOpt(c, v) {
  const {b: k, id} = itemMenu, set = S.itemOpts[k][id] ??= {};
  if (v === undefined) delete set[c.id];
  else set[c.id] = c.kind === 'bool' ? (v ? 1 : 0) : Math.max(c.min ?? 0, Math.min(c.max ?? 99, Math.round(v)));
  if (!Object.keys(set).length) delete S.itemOpts[k][id];
  renderBuilds(); paintItemMenu(); schedule();
}
function wireItemMenu() {
  const el = $('#item-menu');
  const control = id => S.items.get(itemMenu?.id)?.controls?.find(c => c.id === id);
  el.addEventListener('click', e => {
    if (!itemMenu) return;
    if (e.target.closest('[data-close]')) { const slot = $(`.slot[data-b="${itemMenu.b}"][data-i="${itemMenu.i}"] [data-cfg]`); closeItemMenu(); slot?.focus(); return; }
    if (e.target.closest('[data-details]')) { itemDetails = !itemDetails; paintItemMenu(); return; }
    if (e.target.closest('[data-reset-all]')) { delete S.itemOpts[itemMenu.b][itemMenu.id]; renderBuilds(); paintItemMenu(); schedule(); return; }
    const r = e.target.closest('[data-reset]');
    if (r) { const c = control(r.dataset.reset); if (c) setItemOpt(c, undefined); return; }
    const b = e.target.closest('button[data-d]');
    if (!b) return;
    const c = control(b.dataset.c);
    if (!c) return;
    // a stepper starts from what is shown: the user's value, the default the calculation used, or the combo's own count
    const R = S.res?.[itemMenu.b], mine = S.itemOpts[itemMenu.b][itemMenu.id]?.[c.id];
    const from = mine ?? (c.kind === 'procs' ? R?.items.find(x => x.id === itemMenu.id)?.effects.find(x => x.id === c.rule)?.fired : R?.items.find(x => x.id === itemMenu.id)?.settings?.[c.id]) ?? 0;
    setItemOpt(c, from + +b.dataset.d);
  });
  el.addEventListener('change', e => {
    const input = e.target.closest('input[type="checkbox"][data-c]');
    const c = input && control(input.dataset.c);
    if (c) setItemOpt(c, input.checked);
  });
  document.addEventListener('mousedown', e => {
    if (itemMenu && !e.target.closest('#item-menu') && !e.target.closest('[data-cfg]')) closeItemMenu();
  });
  addEventListener('resize', placeItemMenu);
  document.addEventListener('scroll', placeItemMenu, true);
}

/* ---------- an ability's card ---------- */
/* Pointing at an ability (its icon among the ranks, its step in the combo, its row in the breakdown)
   shows a card: its name, what one cast deals with each build, and its cooldown after ability haste.
   One cast is played on its own against the target at full health, with whatever its build's items and
   their settings add (Shojin's stacks, Luden's Echo, a Spellblade it arms and spends itself). */
let tipAt = null;                   // the element the card is showing for
const sec = s => `${+s.toFixed(s < 10 ? 1 : 0)} s`;
function abilityCard(k) {
  const v = S.view?.slots[k], name = v?.name || lineLabel(k)[1], raw = S.target === 'raw';
  const ks = S.res ? (S.compare && S.res.b ? ['a', 'b'] : ['a']) : [], two = ks.length > 1;
  const ranks = b => b === 'b' && S.split ? S.ranksB : S.ranks;
  const head = `<div class="tip-h"><span class="k">${k.toUpperCase()}</span><b>${esc(name)}</b>`
    + (k === 'p' ? '<span class="hint">passive</span>' : two && S.split && ranks('a')[k] !== ranks('b')[k]
      ? `<span class="hint">rank ${ranks('a')[k]} / ${ranks('b')[k]}</span>` : `<span class="hint">rank ${ranks('a')[k]} of ${maxRank(k)}</span>`) + '</div>';
  if (!ks.length) return head;
  const cols = two ? `<span></span>${ks.map(b => `<span class="tag ${b} xs">${b.toUpperCase()}</span>`).join('')}` : '';
  const row = (label, cells, sub) => `<span class="tl">${label}</span>${cells.join('')}${sub ? `<span class="ts">${sub}</span>` : ''}`;
  const cell = (b, text, win) => `<span class="tv ${b}${win ? ' win' : ''}">${text}</span>`;
  let body = '';
  if (k === 'p') {
    const line = b => S.res[b].combo.lines.find(l => l.key === 'p');
    const val = b => line(b) ? (raw ? line(b).total.raw : line(b).total.dealt) : 0;
    body = row('In the combo', ks.map(b => cell(b, val(b) ? nf(val(b)) : '–', two && val(b) > val(b === 'a' ? 'b' : 'a'))));
  } else {
    const info = b => S.res[b].abilities[k], dead = v && !v.damaging;
    const dmg = b => info(b).cast ? (raw ? info(b).cast.raw : info(b).cast.dealt) : null;
    const cd = b => info(b).cooldown;
    const typeOf = b => {
      const t = info(b).cast?.byType; if (!t) return '';
      const used = ['physical', 'magic', 'true'].filter(x => t[x].raw > 0);
      return used.length === 1 ? used[0] : used.length ? 'mixed' : '';
    };
    const other = b => b === 'a' ? 'b' : 'a';
    // an ability that deals no damage still has its cooldown to show
    body = dead ? row('One cast', ks.map(b => cell(b, info(b).cast ? 'no damage' : 'not learned')))
      : row('One cast', ks.map(b => cell(b, dmg(b) === null ? 'not learned' : nf(dmg(b)), two && dmg(b) > (dmg(other(b)) ?? 0))),
        ks.map(b => typeOf(b)).filter((t, i, all) => t && all.indexOf(t) === i).join(' / ') + (raw ? ', before resistances' : ', after resistances'));
    const why = ks.map(b => cd(b) && `${two ? b.toUpperCase() + ': ' : ''}${cd(b).base} s, ${Math.round(cd(b).haste)} haste`).filter(Boolean);
    body += row('Cooldown', ks.map(b => cell(b, cd(b) ? sec(cd(b).seconds) : '–', two && cd(b) && cd(other(b)) && cd(b).seconds < cd(other(b)).seconds - 0.005)),
      [...new Set(why)].join(' · '));
    // the line's own total in the combo, when the combo casts it
    const line = b => S.res[b].combo.lines.find(l => l.key === k);
    if (!dead && ks.some(b => line(b)?.qty)) body += row(`In the combo, ${line('a')?.qty || 0}×`, ks.map(b => cell(b, line(b)?.total.dealt ? nf(raw ? line(b).total.raw : line(b).total.dealt) : '–')));
  }
  // what the combo's line is made of, as the breakdown row's tooltip used to say, when it is more than one thing
  const of = b => S.res[b].combo.lines.find(l => l.key === k);
  const parts = ks.some(b => (of(b)?.parts.length || 0) > 1) ? lineParts(of('a'), two ? of('b') : null) : '';
  return `${head}<div class="tip-g${two ? ' two' : ''}">${cols}${body}</div>${parts ? `<div class="tip-p">${esc(parts).replace(/\n/g, '<br>')}</div>` : ''}`;
}
/* ---------- an item's card ---------- */
/* Pointing at an item (in a build's slot, the enemy's, the picker or an auto-build result) shows a card: its
   name, what it costs and the stats it gives, in the shop's order. An item's settings menu opens on the same
   card. [stat, name, its icon, shown as a percent]. The game has one icon for a stat's flat and percent forms,
   and none of its own for crit damage or basic and ultimate haste, which take crit's and ability haste's. */
const ITEM_STATS = [
  ['ad', 'Attack damage', 'ad'], ['attackSpeed', 'Attack speed', 'as', 1], ['critChance', 'Crit chance', 'crit', 1], ['critDamage', 'Crit damage', 'crit', 1],
  ['lethality', 'Lethality', 'armorpen'], ['armorPenPct', 'Armor penetration', 'armorpen', 1], ['ap', 'Ability power', 'ap'], ['magicPenFlat', 'Magic penetration', 'magicpen'],
  ['magicPenPct', 'Magic penetration', 'magicpen', 1], ['abilityHaste', 'Ability haste', 'haste'], ['basicHaste', 'Basic ability haste', 'haste'], ['ultHaste', 'Ultimate haste', 'haste'],
  ['hp', 'Health', 'hp'], ['mana', 'Mana', 'mana'], ['armor', 'Armor', 'armor'], ['mr', 'Magic resist', 'mr'],
  ['lifeSteal', 'Life steal', 'lifesteal', 1], ['omnivamp', 'Omnivamp', 'omnivamp', 1], ['moveSpeed', 'Move speed', 'ms'], ['movePct', 'Move speed', 'ms', 1],
];
// a stat's icon, or an empty one of the same size so that the names line up while the art index is an older one
const statMark = (ico, name) => statIco(ico, name) || '<i class="si no"></i>';
/* The card's head: the item's icon, name, what kind of item it is and its cost; `build` adds its build's tag,
   `after` goes at the end of the line (the settings menu's Esc). */
function itemHead(it, {build, after = ''} = {}) {
  const shop = shopOf(it), about = [it.component && 'Component', shop && `${SHOP[shop]} item`].filter(Boolean).join(' · ');
  const tag = build ? `<span class="tag ${build} xs">${build.toUpperCase()}</span>` : '';
  return `<div class="tip-h"><span class="ti">${itemIco(it.id)}</span><span class="tn"><b>${esc(it.name)}</b>${tag || about ? `<small>${tag}${about}</small>` : ''}</span><span class="hint gold">${nf(it.gold)} gold</span>${after}</div>`;
}
const itemStats = it => ITEM_STATS.filter(([k]) => it.stats?.[k]).map(([k, name, ico, per]) =>
  `<span class="tl">${statMark(ico, name)}${name}</span><span class="tv">+${per ? pct(it.stats[k], 1) : nf(it.stats[k])}</span>`).join('');
function itemCard(id, hint) {
  const it = S.items.get(id);
  if (!it) return '';
  return itemHead(it) + `<div class="tip-g">${itemStats(it) || '<span class="tl">No stats</span>'}</div>${hint ? `<div class="tip-p">${esc(hint)}</div>` : ''}`;
}
function showTip(el) {
  const k = el.dataset.ab, id = +el.dataset.it, tip = $('#tip');
  if (!tip || !(k || id)) return;
  tipAt = el;
  tip.innerHTML = k ? abilityCard(k) : itemCard(id, el.dataset.hint);
  tip.hidden = false;
  const r = el.getBoundingClientRect(), m = tip.getBoundingClientRect(), gap = 8;
  // an item in the picker has its card beside it, so the row under it stays in view
  if (!k && el.closest('#item-grid')) {
    const right = r.right + gap + m.width <= innerWidth - gap;
    tip.style.left = `${right ? r.right + gap : Math.max(gap, r.left - gap - m.width)}px`;
    tip.style.top = `${Math.max(gap, Math.min(r.top, innerHeight - m.height - gap))}px`;
    return;
  }
  // inside a dropdown the card sits beside it, so the rest of the list stays in view
  const menuBox = el.closest('.menu')?.getBoundingClientRect();
  // a menu as wide as the screen (a phone's sheet) has no side to spare, and the card goes above it
  if (menuBox && menuBox.width + m.width + 3 * gap > innerWidth) {
    tip.style.top = `${Math.max(gap, menuBox.top - gap - m.height)}px`;
    tip.style.left = `${Math.max(gap, Math.min(r.left, innerWidth - m.width - gap))}px`;
    return;
  }
  if (menuBox) {
    const right = menuBox.right + gap + m.width <= innerWidth - gap;
    tip.style.left = `${right ? menuBox.right + gap : Math.max(gap, menuBox.left - gap - m.width)}px`;
    tip.style.top = `${Math.max(gap, Math.min(r.top, innerHeight - m.height - gap))}px`;
    return;
  }
  const below = r.bottom + gap + m.height <= innerHeight - gap;
  tip.style.top = `${Math.max(gap, below ? r.bottom + gap : r.top - gap - m.height)}px`;
  tip.style.left = `${Math.max(gap, Math.min(r.left + r.width / 2 - m.width / 2, innerWidth - m.width - gap))}px`;
}
function hideTip() { tipAt = null; const tip = $('#tip'); if (tip) tip.hidden = true; }
// drawn again, or put away when what it was showing for is gone or hidden (a closed picker)
function paintTip() { if (tipAt?.isConnected && tipAt.getClientRects().length) showTip(tipAt); else hideTip(); }
/* What a card would show for: an ability, or an item. A finger taps an item to pick or change it, so an item's
   card is the mouse's and the keyboard's; a slot's own buttons (settings, remove) go without it. */
const tipOf = t => {
  const el = t.closest('[data-ab], [data-it]');
  return el?.dataset.it && (touched() || t.closest('[data-cfg], [data-rm]')) ? null : el;
};
function wireTip() {
  document.addEventListener('mouseover', e => {
    const el = tipOf(e.target);
    if (el && el !== tipAt) showTip(el); else if (!el && tipAt) hideTip();
  });
  document.addEventListener('focusin', e => {
    const el = tipOf(e.target);
    // a click focuses a slot too; an item's card comes with focus only from the keyboard
    if (el?.dataset.it && !el.matches(':focus-visible')) return;
    if (el) showTip(el); else if (tipAt) hideTip();
  });
  document.addEventListener('scroll', hideTip, true);
  // clicking a rank pip keeps the card, which then shows the new rank's numbers; clicking an item puts its card away
  document.addEventListener('mousedown', e => { if (tipAt && (!tipAt.contains(e.target) || tipAt.dataset.it)) hideTip(); });
}

/* ---------- phones and touch ---------- */
/* A finger has no hover, so what a mouse finds by pointing is found by tapping: an ability's card, the
   text a desktop keeps in a tooltip, an item's details in the picker (one tap shows them, a second picks
   the item). Opening a picker does not raise the keyboard, which would hide the picker. The level ruler
   can be slid along. On a phone's layout (index.html, receipt.html) the menus are sheets over a dimmed
   page, and a tap on the dimmed page only closes the sheet. A mouse meets none of this. */
const PHONE = matchMedia('(max-width:700px),(max-width:1100px) and (max-height:500px)');
let pointer = matchMedia('(pointer:coarse)').matches ? 'touch' : 'mouse', tipBefore = null, noteAt = null, sheetTap = false, swallow = 0;
const touched = () => pointer === 'touch';
/* The text of a tooltip, as a card under or over what was tapped. */
function showNote(el) {
  const tip = $('#tip');
  hideTip(); noteAt = el;
  tip.innerHTML = `<div class="tip-note">${el.title.split('\n').map(p => `<p>${esc(p)}</p>`).join('')}</div>`;
  tip.hidden = false;
  const r = el.getBoundingClientRect(), m = tip.getBoundingClientRect(), gap = 8;
  const below = r.bottom + gap + m.height <= innerHeight - gap;
  tip.style.top = `${Math.max(gap, below ? r.bottom + gap : r.top - gap - m.height)}px`;
  tip.style.left = `${Math.max(gap, Math.min(r.left + r.width / 2 - m.width / 2, innerWidth - m.width - gap))}px`;
}
function hideNote() { if (noteAt) { noteAt = null; hideTip(); } }
/* The sheet open on a phone, if any: a menu's panel or an item's settings. */
const openSheet = () => PHONE.matches && (itemMenu ? $('#item-menu') : menu ? $('#' + menu.getAttribute('aria-controls')) : null);
function wireTouch() {
  document.addEventListener('pointerdown', e => {
    pointer = e.pointerType;
    if (!touched()) return;
    tipBefore = tipAt;
    if (noteAt && !noteAt.contains(e.target)) hideNote();
    const sheet = openSheet();
    sheetTap = !!sheet && !sheet.contains(e.target) && !e.target.closest('.menu-btn, [data-cfg]');
  }, true);
  // the sheet closes when the finger lifts (a click may never come over plain text), and the click is dropped
  document.addEventListener('pointerup', e => {
    if (e.pointerType !== 'touch' || !sheetTap) return;
    sheetTap = false; swallow = e.timeStamp;
    closeItemMenu(); setMenu(null);
  }, true);
  document.addEventListener('pointercancel', () => { sheetTap = false; }, true);
  document.addEventListener('click', e => {
    if (!touched()) return;
    if (swallow && e.timeStamp - swallow < 800) { swallow = 0; e.preventDefault(); e.stopPropagation(); return; }
    const ab = e.target.closest('[data-ab]');
    if (ab) {
      // a second tap on the same ability puts its card away; a pip sets a rank, and keeps the card only if
      // it was open, so that setting ranks does not cover the abilities under it
      if (e.target.closest('.pip')) { if (tipBefore !== ab) hideTip(); }
      else if (tipBefore === ab && !e.target.closest('button')) hideTip(); else if (tipAt !== ab) showTip(ab);
      return;
    }
    const titled = e.target.closest('[title]:not([title=""])');
    if (!titled || titled.closest('button, a, input, select, label, .slot')) return;
    if (titled === noteAt && !$('#tip').hidden) hideNote(); else showNote(titled);
  }, true);
  // the item picker: the first tap on an item shows its details in the footer, a second tap picks it
  $('#item-grid').addEventListener('click', e => {
    const p = e.target.closest('[data-id]');
    if (!p || !touched() || p.classList.contains('peek')) return;
    e.stopPropagation();
    $$('#item-grid .peek').forEach(x => x.classList.remove('peek'));
    p.classList.add('peek');
    p.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
    $('#item-foot .g')?.insertAdjacentHTML('afterend', '<em>Tap again to pick</em>');
  }, true);
  // the tab bar is at the bottom of a phone's screen: a tab opens at its content, just under the totals
  $('.tabs')?.addEventListener('click', e => {
    const t = e.target.closest('.tab');
    if (!t || !PHONE.matches) return;
    const first = t.dataset.tab === 'build' ? null : [...$(`.pane[data-pane="${t.dataset.tab}"]`).children].find(x => x.getClientRects().length);
    scrollTo({top: first ? first.getBoundingClientRect().top + scrollY - $('.tot').offsetHeight - 12 : 0});
  });
  // a slot tapped on a phone is kept in view above the picker's sheet
  for (const el of [$('#builds'), $('#t-slots')]) el.addEventListener('click', () => { if (PHONE.matches && pick) $('.slot.sel')?.scrollIntoView({block: 'nearest', behavior: 'smooth'}); });
  // a finger sliding along the level ruler sets the level under it
  const ruler = $('#ruler');
  let slide = null;
  ruler.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') slide = e.pointerId; });
  ruler.addEventListener('pointermove', e => {
    if (e.pointerId !== slide) return;
    const r = ruler.getBoundingClientRect(), l = Math.max(1, Math.min(18, Math.ceil((e.clientX - r.left) / r.width * 18)));
    if (l !== S.level) setLevel(l);
  });
  for (const t of ['pointerup', 'pointercancel']) ruler.addEventListener(t, () => { slide = null; });
}

/* ---------- champion picker ---------- */
let champFor = 'atk', role = 0;
function openChamps(who) {
  champFor = who; closePicker(); setMenu(null);
  $('#cm-title').textContent = who === 'atk' ? 'Choose a champion' : 'Choose the target';
  $('#champ-modal').hidden = false;
  const q = $('#champ-q'); q.value = ''; renderChamps();
  if (!touched()) q.focus();
}
function closeChamps() { $('#champ-modal').hidden = true; }
const nameOf = k => $(`#name-${k}`).value || `Build ${k.toUpperCase()}`;
function paintNames() {
  if (RECEIPT) return;
  for (const k of ['a', 'b']) $(`#h-name-${k}`).textContent = nameOf(k);
  if (S.res) paintAhead(S.res.a.stats, S.compare ? S.res.b?.stats : null);
}
function renderChamps() {
  const q = $('#champ-q').value.trim().toLowerCase(), r = ROLES[role];
  const list = S.champs.filter(c => (!q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) && (r === 'All' || c.tags.includes(r)));
  $('#champ-grid').innerHTML = list.map(c => `<button class="ct" data-id="${c.id}"><span class="ci">${champIco(c.id)}</span>${esc(c.name)}</button>`).join('')
    || '<span class="hint">No champion matches</span>';
}
function chooseChamp(id) {
  const c = S.champs.find(x => x.id === id);
  if (!c) return;
  closeChamps();
  if (champFor === 'atk') setChamp(c);
  // the items stay with the target: another champion holding them
  else { S.enemy = {id: c.id, name: c.name, level: S.enemy.level, items: S.enemy.items}; if (pick?.b === 't') { closePicker(); } enemyStats(); }
}

/* ---------- target ---------- */
const dial = k => [$(`#t-${k}`), $(`#t-${k}-r`)];
function readDials() { return {hp: Math.max(1, +$('#t-hp').value || 1), ar: +$('#t-ar').value || 0, mr: +$('#t-mr').value || 0}; }
function writeDials(v) { for (const k of ['hp','ar','mr']) dial(k).forEach(el => el.value = v[k]); }
async function enemyStats() {
  const e = S.enemy, held = enemyItems();
  $('#auto-note').textContent = `Base stats at level ${e.level}${held.length ? ', with its items' : ''}. Anything you add counts as bonus.`;
  paintTarget();
  try {
    const t = await api(`/champions/${encodeURIComponent(e.id)}/target?level=${e.level}${held.length ? `&items=${held.join(',')}` : ''}`);
    if (S.enemy !== e || S.target !== 'champ') return;
    writeDials({hp: t.hp, ar: t.armor, mr: t.mr});
  } catch (err) {}
  paintTarget(); schedule();
}
function paintTarget() {
  const v = readDials(), raw = S.target === 'raw', cut = x => Math.round(x / (100 + Math.max(0, x)) * 100);
  const eff = [nf(v.hp * (1 + v.ar / 100)), nf(v.hp * (1 + v.mr / 100))];
  // the receipt page's target column is narrow, so its dials get the short form
  $('#n-hp').textContent = RECEIPT ? `eff. ${eff[0]} / ${eff[1]}` : `Effective ${eff[0]} vs physical, ${eff[1]} vs magic`;
  $('#n-hp').title = RECEIPT ? 'Effective health against physical / magic damage' : '';
  $('#n-ar').textContent = RECEIPT ? `blocks ${cut(v.ar)}% physical` : `Blocks ${cut(v.ar)}% of physical damage`;
  $('#n-mr').textContent = RECEIPT ? `blocks ${cut(v.mr)}% magic` : `Blocks ${cut(v.mr)}% of magic damage`;
  $('#hits').style.setProperty('--hpv', v.hp);
  for (const k of ['a','b']) {
    const r = S.res?.[k], total = r ? r.combo.total.dealt : 0;
    const left = r && r.combo.hpLeft !== null ? r.combo.hpLeft : Math.max(0, v.hp - total), share = Math.min(100, total / v.hp * 100);
    $(`#bar-${k}`).style.setProperty('--left', (left / v.hp * 100).toFixed(1) + '%');
    $(`#left-${k}`).textContent = r ? nf(left) : '–';
    if (RECEIPT) continue;
    $(`#h-bar-${k}`).style.setProperty('--w', (r ? share : 0).toFixed(1) + '%');
    // raw output has no target to measure against: only how crits are counted, if it isn't the average
    const when = {never: 'no crits', always: 'all crits'}[r?.combo.crits] || '';
    $(`#h-cap-${k}`).innerHTML = !r ? '' : raw ? (when && when[0].toUpperCase() + when.slice(1))
      : (r.combo.kills ? `<b>Kills</b> the target, ${nf(v.hp)} HP` : `<b>${Math.round(share)}%</b> of the target's ${nf(v.hp)} HP`) + (when && ', ' + when);
  }
  $$('#presets .chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.preset === `${v.hp},${v.ar},${v.mr}`));
  const e = S.enemy, eb = $('#enemy-btn');
  eb.textContent = e.name;
  eb.style.setProperty('--len', Math.max(4, e.name.length));
  $('#el').textContent = e.level;
  // the enemy is a portrait on the tabs and a splash behind the column on the receipt page
  const face = $('#enemy-img');
  if (RECEIPT) { if (S.target === 'champ') paintSplash($('#enemy-splash'), e.id); }
  else if (face.dataset.id !== e.id) { face.dataset.id = e.id; face.innerHTML = champIco(e.id); }
  paintSub();
}
function setTarget(t) {
  if (S.target === 'dummy') S.dummy = readDials();
  if (t !== 'champ' && pick?.b === 't') closePicker();
  S.target = t;
  document.body.dataset.target = t;
  $$('#tseg button').forEach(b => b.setAttribute('aria-checked', b.dataset.t === t));
  if (t === 'champ') enemyStats(); else { writeDials(S.dummy); paintTarget(); schedule(); }
}
function setCrits(m) {
  S.crits = m;
  $$('#crit-seg button').forEach(b => b.setAttribute('aria-checked', b.dataset.crit === m));
  schedule();
}
function setCompare(on) {
  S.compare = on;
  document.body.dataset.compare = on ? 'on' : 'off';
  $$('#cmp-seg button').forEach(b => b.setAttribute('aria-checked', (b.dataset.cmp === 'on') === on));
  if (!on && pick && pick.b === 'b') closePicker();
  if (!on && itemMenu?.b === 'b') closeItemMenu();
  if (!on && AB.for === 'b') closeAuto();
  renderBuilds(); schedule();
}

/* ---------- breakdown ---------- */
const TYPE = {physical: ['p', 'physical'], magic: ['m', 'magic'], true: ['', 'true'], mixed: ['', 'mixed']};
function lineLabel(k) {
  if (k === 'aa') return ['AA', 'Auto attack'];
  if (k === 'items') return ['+', 'Item effects'];
  return [k.toUpperCase(), S.view?.slots[k]?.name || (k === 'p' ? 'Passive' : k.toUpperCase() + ' ability')];
}
/* The rows are built once per kit so that typing in a quantity keeps its focus; numbers are filled in place. */
function renderLines() {
  $('#lines').innerHTML = LINES.map(k => {
    const [key, name] = lineLabel(k), slot = S.view?.slots[k];
    const castable = ACTIONS.includes(k), dead = SLOTS.includes(k) && slot && !slot.damaging;
    if (dead && comboFresh) S.combo[k] = 0;
    const qty = !castable ? '<span class="q"></span>' : dead ? '<span class="q">–</span>'
      : `<label class="q"><input type="number" data-q="${k}" value="${S.combo[k]}" min="0" max="30" aria-label="Number of ${k === 'aa' ? 'auto attacks' : k.toUpperCase() + ' casts'}"><span>×</span></label>`;
    const word = slot && STATUS_WORD[slot.status];
    // on the receipt a line has one short note: its status if it has one, else what paintReceipt finds to say
    const ab = k === 'p' || SLOTS.includes(k) ? ` data-ab="${k}"` : '';
    if (RECEIPT) return `<div class="r-row r-line" data-k="${k}">${qty}
      <span class="src"${ab}><span class="k">${key}</span><span class="nm">${esc(name)}</span><span class="note" data-fixed="${word || (dead ? 'no damage' : '')}"${word ? ` title="${esc(slot.notes.join(' ') || word)}"` : ''}></span></span>
      <span class="n a"><i>–</i><small></small></span><span class="n b only-cmp"><i>–</i><small></small></span>
      <span class="n sh only-solo">–</span></div>`;
    const status = word ? ` <span class="est" title="${esc(slot.notes.join(' ') || word)}">${word}</span>` : '';
    // under a line that can crit: one hit without a crit, with one, and on average (filled in by paintLines)
    const crit = castable ? `<div class="critrow" data-k="${k}" hidden><span></span><div class="cr"><span class="cr-l" title="The line's total in each way of counting crits, divided by its count">One hit</span><span class="cr-b a"></span><span class="cr-b b only-cmp"></span></div></div>` : '';
    return `<div class="row line" data-k="${k}">${qty}
      <span class="src"${ab}><span class="k">${key}</span><span class="nm">${esc(name)}</span>${status}</span><span class="ty none"></span>
      <span class="bars"><i class="a"></i><i class="b only-cmp"></i></span>
      <span class="n a"><i>–</i><small></small></span><span class="n b only-cmp"><i>–</i><small></small></span>
      <span class="g only-cmp"><i></i></span><span class="sh only-solo">–</span></div>${crit}`;
  }).join('');
  // the default combo can only be trimmed once the kit says which abilities deal damage
  if (S.view) comboFresh = false;
  if (!RECEIPT) $('#total-row').innerHTML = `<span class="tl">Total</span>
    <span class="n a"><i>–</i></span><span class="n b only-cmp"><i>–</i></span>
    <span class="g only-cmp"><i></i></span><span class="sh only-solo">100%</span>`;
  paintSub();
  if (S.res) RECEIPT ? paintReceipt() : paintLines();
}
function gap(el, a, b) {
  const d = Math.round(a) - Math.round(b);
  el.className = `g only-cmp ${d > 0 ? 'a' : d < 0 ? 'b' : ''}`;
  $('i', el).textContent = d ? '+' + nf(Math.abs(d)) : '';
}
const secs = s => `${+s.toFixed(1)}s`;
/* "240/s · 15s": what a line's over-time part deals each second while it runs, and for how long. */
const rate = l => l?.over && l.total.dealt ? `${nf(l.over.perSecond.dealt)}/s · ${secs(l.over.seconds)}` : '';
/* What a line is made of in each build, for its tooltip. One burn is often several parts (applied by
   an attack, refreshed by a spell), so only the line's rate is given. */
function lineParts(a, b) {
  const part = (tag, p) => `${tag}: ${p.label}${p.hits > 1 ? ' ×' + p.hits : ''} ${nf(p.total.dealt)}${p.over ? ', over time' : ''}`;
  const timed = (tag, l) => l.over && l.total.dealt ? [`${tag}: ${nf(l.over.perSecond.dealt)} per second for ${secs(l.over.seconds)} while it runs`] : [];
  return [...a.parts.map(p => part('A', p)), ...timed('A', a), ...(b ? [...b.parts.map(p => part('B', p)), ...timed('B', b)] : [])].join('\n');
}
function paintLines() {
  const A = S.res.a, B = S.compare ? S.res.b : null;
  const of = (r, k) => r?.combo.lines.find(l => l.key === k);
  const max = Math.max(1, ...LINES.map(k => Math.max(of(A, k)?.total.dealt || 0, of(B, k)?.total.dealt || 0)));
  for (const k of LINES) {
    const row = $(`.line[data-k="${k}"]`), a = of(A, k), b = of(B, k);
    if (!row || !a) continue;
    const va = a.total.dealt, vb = b ? b.total.dealt : 0, slot = S.view?.slots[k];
    const type = a.type !== 'none' ? a.type : b ? b.type : 'none';
    const ty = $('.ty', row);
    if (type === 'none') { ty.className = 'ty none'; ty.textContent = slot?.status === 'unmodeled' ? 'not counted' : SLOTS.includes(k) && slot && !slot.damaging ? 'no damage' : '–'; }
    else { ty.className = `ty ${TYPE[type][0]}`; ty.textContent = TYPE[type][1]; }
    row.classList.toggle('off', !va && !vb);
    const [ba, bb] = $$('.bars i', row);
    ba.style.setProperty('--w', (va / max * 100).toFixed(1) + '%');
    bb.style.setProperty('--w', (vb / max * 100).toFixed(1) + '%');
    $('.n.a i', row).textContent = va ? nf(va) : '–';
    $('.n.b i', row).textContent = vb ? nf(vb) : '–';
    // damage that takes time to land also shows its rate and how long it runs, under the total
    $('.n.a small', row).textContent = rate(a);
    $('.n.b small', row).textContent = rate(b);
    $('.n.a', row).classList.toggle('win', !B || va > vb);
    $('.n.b', row).classList.toggle('win', !!B && vb > va);
    gap($('.g', row), va, vb);
    $('.sh', row).textContent = va && A.combo.total.dealt ? Math.round(va / A.combo.total.dealt * 100) + '%' : '–';
    // an ability's row has its card instead (abilityCard), which lists the same parts
    if (!$('.src[data-ab]', row)) $('.nm', row).title = lineParts(a, b);
    const cr = $(`.critrow[data-k="${k}"]`);
    if (!cr) continue;
    const ca = critCells(k, 'a', a, A), cb = B ? critCells(k, 'b', b, B) : '';
    cr.hidden = !ca && !cb;
    row.classList.toggle('crits', !cr.hidden);
    $('.cr-b.a', cr).innerHTML = ca;
    $('.cr-b.b', cr).innerHTML = cb;
  }
  const ta = A.combo.total.dealt, tb = B ? B.combo.total.dealt : 0, tot = $('#total-row');
  $('.n.a i', tot).textContent = nf(ta);
  $('.n.b i', tot).textContent = B ? nf(tb) : '–';
  $('.n.a', tot).classList.toggle('win', !B || ta > tb);
  $('.n.b', tot).classList.toggle('win', !!B && tb > ta);
  gap($('.g', tot), ta, tb);
}

/* ---------- crits ---------- */
const pct = (x, d = 0) => (Math.round(x * 100 * 10 ** d) / 10 ** d) + '%';
const buildItems = k => S.builds[k].filter(Boolean).map(id => S.items.get(id)).filter(Boolean);
/* How a build's crit multiplier is made: the champion's base, crit damage from items added to it, then the kit. */
function multWhy(k, R) {
  const base = S.champ.critDamage ?? 2, extra = buildItems(k).filter(it => it.stats?.critDamage), total = R.stats.critDamage;
  const sum = base + extra.reduce((s, it) => s + it.stats.critDamage, 0);
  let text = `${pct(base)} base` + (extra.length ? ` + ${extra.map(it => `${pct(it.stats.critDamage)} ${it.name}`).join(' + ')} = ${pct(sum, 1)}` : '');
  if (Math.abs(total - sum) > 0.0005) text += `, × ${pct(total / sum, 1)} from ${S.champ.name}'s kit = ${pct(total, 1)}`;
  return 'Crits deal ' + text;
}
/* One hit of a line that can crit, in each build: without a crit, with one (and its multiplier), and the
   average at the build's chance. The hit is the line's total over its count; the way the combo is counting
   crits is marked. */
function critCells(k, b, line, R) {
  const n = line?.qty || 0, c = line?.crits;
  if (!c || !n || !c.always.dealt) return '';
  const one = m => nf(c[m].dealt / n), on = m => R.combo.crits === m ? ' on' : '';
  const ratio = c.never.raw ? c.always.raw / c.never.raw : 0;
  const mult = k === 'aa' ? pct(R.stats.critDamage, 1) : ratio ? '×' + ratio.toFixed(2) : '';
  const why = k === 'aa' ? multWhy(b, R)
    : `${lineLabel(k)[1]} does ×${ratio.toFixed(2)} when it crits${ratio < R.stats.critDamage - 0.005 ? ': only part of it can crit' : ''}. ${multWhy(b, R)}.`;
  return `<span class="tag ${b} xs only-cmp">${b.toUpperCase()}</span>
    <span class="cv${on('never')}"><b>${one('never')}</b>no crit</span>
    <span class="cv${on('always')}" title="${esc(why)}"><b>${one('always')}</b>crit${mult ? `<em>${mult}</em>` : ''}</span>
    <span class="cv${on('average')}"><b>${one('average')}</b>avg at ${pct(R.stats.critChance)}</span>`;
}
/* The Breakdown's side column on crits, when anything in the combo can crit: each build's chance and multiplier,
   and the abilities that can crit, if any (auto attacks always can). */
function critSide(A, B) {
  const of = (r, k) => r?.combo.lines.find(l => l.key === k), crits = k => !!(of(A, k)?.crits || of(B, k)?.crits);
  if (!LINES.some(crits)) return '';
  const can = LINES.filter(k => (k === 'p' || SLOTS.includes(k)) && crits(k)).map(k => lineLabel(k)[1]);
  const cb = (k, R) => `<div class="cb"><span class="tag ${k} sm">${k.toUpperCase()}</span><span><b>${pct(R.stats.critChance)}</b> chance, crits deal <b>${pct(R.stats.critDamage, 1)}</b></span></div>`;
  return `<div class="bs"><span class="lbl">Crits</span>${cb('a', A)}${B ? cb('b', B) : ''}
    <div class="notes">${can.length ? `<p><b>Can crit:</b> ${esc(can.join(', '))}.</p>` : ''}
      <p>"Crits" above the totals counts them at the average, never or always. DPS and time to kill stay on the average.</p></div></div>`;
}

/* A build's damage by type: the two bars of its split, and the same in words. */
function mix(r) {
  const t = r.combo.byType, sum = r.combo.total.dealt || 1;
  const pct = x => Math.round(t[x].dealt / sum * 100);
  return {
    bars: `<i class="p" style="width:${pct('physical')}%"></i><i class="m" style="width:${pct('magic')}%"></i>`,
    text: [`${pct('physical')}% physical`, `${pct('magic')}% magic`, ...(t.true.dealt > 0 ? [`${pct('true')}% true`] : [])].join(', '),
  };
}
function mixRow(k, r, cmpOnly) {
  const m = mix(r);
  return `<div class="mixrow${cmpOnly ? ' only-cmp' : ''}"><span class="tag ${k} sm">${k.toUpperCase()}</span><span class="split">${m.bars}</span><span>${m.text}</span></div>`;
}
function verdicts(A, B) {
  const pc = (x, y) => y > 0 ? Math.round((x / y - 1) * 100) : null;
  const say = {a: [], b: []};
  const ca = A.combo.total.dealt, cb = B.combo.total.dealt;
  if (Math.round(ca) !== Math.round(cb)) {
    const w = ca > cb ? 'a' : 'b', [x, y] = w === 'a' ? [A, B] : [B, A], p = pc(x.combo.total.dealt, y.combo.total.dealt);
    // the single source where the winner pulls furthest ahead, if it is a clear multiple
    let best = null;
    for (const l of x.combo.lines) {
      const o = y.combo.lines.find(m => m.key === l.key);
      if (o && o.total.dealt > 0 && l.total.dealt / o.total.dealt >= 1.3 && (!best || l.total.dealt - o.total.dealt > best.d)) best = {l, d: l.total.dealt - o.total.dealt, r: l.total.dealt / o.total.dealt};
    }
    const who = best && ({aa: 'autos hit', p: 'passive hits', items: 'items hit'}[best.l.key] || best.l.key.toUpperCase() + ' hits');
    say[w].push(`<b>Burst.</b> ${p === null ? 'More' : '+' + p + '%'} combo${best ? `, ${who} ${best.r.toFixed(1)}× harder` : ''}`);
  }
  const da = A.fight.dps.dealt, db = B.fight.dps.dealt;
  if (Math.round(da) !== Math.round(db)) {
    const w = da > db ? 'a' : 'b', p = pc(Math.max(da, db), Math.min(da, db));
    const ta = A.fight.timeToKill, tb = B.fight.timeToKill, sooner = ta !== null && tb !== null ? Math.abs(ta - tb) : null;
    say[w].push(`<b>To the kill.</b> ${p === null ? 'More' : '+' + p + '%'} DPS${sooner ? `, kills ${sooner.toFixed(1)} s sooner` : ''}`);
  }
  return ['a', 'b'].map(k => `<div class="vd"><span class="tag ${k} sm">${k.toUpperCase()}</span><p>${say[k].join('. ') || 'Behind on this combo and in a fight to the kill'}</p></div>`).join('');
}
/* What the numbers on screen assume: the engine's caveats, and the notes of every model that took part. */
function assumptions() {
  const notes = new Set();
  for (const r of [S.res.a, S.compare ? S.res.b : null]) {
    if (!r) continue;
    r.caveats.forEach(n => notes.add(n));
    for (const s of ['p', ...SLOTS]) if (s === 'p' || S.combo[s]) r.abilities[s].notes.forEach(n => notes.add(`${lineLabel(s)[1]}: ${n}`));
    for (const it of r.items) it.notes.forEach(n => notes.add(`${S.items.get(it.id)?.name || 'Item'}: ${n}`));
  }
  return [...notes];
}
/* A build's fight: how long it took and what it used, the source of the DPS and time to kill above. */
function fightRow(k, r, cmpOnly) {
  const f = r.fight, u = f.uses;
  const used = [u.aa ? `${u.aa} auto${u.aa === 1 ? '' : 's'}` : '', ...SLOTS.filter(s => u[s]).map(s => `${s.toUpperCase()}${u[s] > 1 ? ' ×' + u[s] : ''}`)].filter(Boolean);
  const head = S.target === 'raw' ? `In <b>10 s</b>` : f.timeToKill === null ? `No kill in <b>${f.seconds} s</b>` : `Kills in <b>${f.timeToKill.toFixed(1)} s</b>`;
  return `<div class="fightrow${cmpOnly ? ' only-cmp' : ''}"><span class="tag ${k} sm">${k.toUpperCase()}</span><span>${head}: ${used.join(', ') || 'nothing'}</span></div>`;
}
function paintSide() {
  const A = S.res.a, B = S.compare ? S.res.b : null, raw = S.target === 'raw', notes = assumptions();
  $('#bside').innerHTML = `${critSide(A, B)}
    <div class="bs"><span class="lbl">To the kill</span>${fightRow('a', A)}${B ? fightRow('b', B, true) : ''}
      <span class="hint">${raw ? 'With nothing to kill, DPS is over 10 seconds' : 'DPS and time to kill come from this fight'}: autos, and the combo's abilities each time they're ready.</span></div>
    <div class="bs"><span class="lbl">Damage mix</span>${mixRow('a', A)}${B ? mixRow('b', B, true) : ''}</div>
    <div class="bs"><span class="lbl">Blocked by the target</span>
      <div class="pair">
        <span class="mv a"><span class="tag a sm only-cmp">A</span><i>${raw ? '–' : nf(A.combo.blocked)}</i></span>
        ${B ? `<span class="mv b only-cmp"><span class="tag b sm">B</span><i>${raw ? '–' : nf(B.combo.blocked)}</i></span>` : ''}
      </div></div>
    ${B ? `<div class="bs only-cmp"><span class="lbl">Where each build wins</span>${verdicts(A, B)}</div>` : ''}
    ${notes.length ? `<div class="bs"><span class="lbl">What these numbers assume</span><div class="notes">${notes.map(n => `<p>${esc(n)}</p>`).join('')}</div></div>` : ''}`;
}
const killTime = r => !r || S.target === 'raw' || r.fight.timeToKill === null ? '–' : r.fight.timeToKill.toFixed(1) + ' s';
/* DPS and time to kill are the fight's (FightResult in src/engine/types.ts): autos, and the combo's abilities again
   each time they are ready, from full health until the target dies. Its label is just DPS; its tooltip says how. */
function paintFightLabel(A, B) {
  const el = $('#dps-lbl');
  if (!el) return;
  const used = SLOTS.filter(k => [A, B].some(r => r?.fight.abilities.includes(k))), names = used.map(k => k.toUpperCase());
  const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names.at(-1) : names[0];
  el.textContent = 'DPS';
  el.title = (S.target === 'raw' ? 'Over 10 seconds, as there is nothing to kill: ' : 'From full health until the target dies: ')
    + (used.length ? `basic attacks, and ${list} again each time ${used.length > 1 ? 'they come' : 'it comes'} back off cooldown. ` : 'basic attacks and what they set off. Put abilities in the combo and the fight casts them too. ')
    + (S.target === 'raw' ? '' : 'A tanky target makes a long fight, where steady damage counts; a squishy one a short fight, where burst does.');
}

/* ---------- hero ---------- */
function paintHero() {
  const A = S.res.a, B = S.compare ? S.res.b : null, raw = S.target === 'raw';
  const ta = A.combo.total.dealt, tb = B ? B.combo.total.dealt : 0;
  $('.tot.a .tot-n i').textContent = nf(ta);
  $('.tot.b .tot-n i').textContent = B ? nf(tb) : '–';
  $('.tot.a').classList.toggle('win', !B || ta >= tb);
  $('.tot.b').classList.toggle('win', !!B && tb > ta);
  paintGlance(A, B);
  paintFightLabel(A, B);
  const [dps, ttk] = $$('.metric');
  const put = (box, k, text, win) => { const el = $(`.mv.${k}`, box); $('i', el).textContent = text; el.classList.toggle('win', win); };
  const da = A.fight.dps.dealt, db = B ? B.fight.dps.dealt : 0;
  put(dps, 'a', nf(da), !B || da >= db);
  put(dps, 'b', B ? nf(db) : '–', !!B && db > da);
  const ka = A.fight.timeToKill ?? Infinity, kb = B ? B.fight.timeToKill ?? Infinity : Infinity;
  put(ttk, 'a', killTime(A), !raw && (!B || ka <= kb) && ka < Infinity);
  put(ttk, 'b', killTime(B), !raw && !!B && kb < ka);
}

/* Stats at a glance, beside the totals: seven stats for each build, under the game's own icons. Where
   the builds differ the higher number is in its build's colour; a number's tooltip says where it comes from. */
const GLANCE = [
  {k: 'hp', name: 'Health', get: s => s.hp.total, why: s => `${nf(s.hp.base)} base + ${nf(s.hp.bonus)} bonus`},
  {k: 'mana', name: 'Mana', get: s => s.mana.total || null, why: s => s.mana.total ? `${nf(s.mana.base)} base + ${nf(s.mana.bonus)} bonus`
    : `${S.champ.name} has no mana${S.view?.resource && S.view.resource !== 'None' ? `: uses ${S.view.resource}` : ''}`},
  {k: 'ad', name: 'Attack damage', get: s => s.ad.total, why: s => `${nf(s.ad.base)} base + ${nf(s.ad.bonus)} bonus`},
  {k: 'ap', name: 'Ability power', get: s => s.ap.total, why: s => s.ap.total ? 'All of it bonus' : 'None'},
  {k: 'armor', name: 'Armor', get: s => s.armor.total, why: s => `${nf(s.armor.base)} base + ${nf(s.armor.bonus)} bonus`},
  {k: 'mr', name: 'Magic resist', get: s => s.mr.total, why: s => `${nf(s.mr.base)} base + ${nf(s.mr.bonus)} bonus`},
  {k: 'crit', name: 'Crit chance', get: s => s.critChance, why: s => `${pct(s.critChance)} crit chance; crits deal ${pct(s.critDamage, 1)}`},
];
function paintGlance(A, B) {
  const el = $('#glance');
  if (!el) return;
  const text = (g, v) => v === null ? '–' : g.k === 'crit' ? pct(v) : nf(v);
  const head = '<span class="gl-h first"></span>' + GLANCE.map(g => `<span class="gl-h" title="${g.name}">${statIco(g.k, g.name)}</span>`).join('');
  const row = (k, s, o) => `<span class="gl-t">${o ? `<span class="tag ${k} sm">${k.toUpperCase()}</span>` : ''}</span>` + GLANCE.map(g => {
    // compared as shown, so two numbers that read the same are not told apart
    const v = text(g, g.get(s)), w = o && text(g, g.get(o)), win = o && v !== w && g.get(s) > g.get(o);
    const cls = g.get(s) === null ? 'none' : !o || v === w ? 'same' : win ? 'win' : 'lose';
    return `<span class="gl-v ${k} ${cls}" title="${esc(`${g.name}: ${g.why(s)}`)}">${v}</span>`;
  }).join('');
  el.innerHTML = head + row('a', A.stats, B?.stats) + (B ? row('b', B.stats, A.stats) : '');
}

/* ---------- the receipt page ---------- */
/* The same result as the hero and the breakdown tab, printed as one slip. In a comparison the
   larger of two numbers is marked with its build's highlighter. */
const TYPE_LETTER = {physical: 'P', magic: 'M', true: 'T', mixed: '*', none: ''};
function paintReceipt() {
  const A = S.res.a, B = S.compare ? S.res.b : null, raw = S.target === 'raw';
  const of = (r, k) => r?.combo.lines.find(l => l.key === k);
  const put = (el, text, win) => { $('i', el).textContent = text; el.classList.toggle('win', win); };
  for (const k of LINES) {
    const row = $(`.r-line[data-k="${k}"]`), a = of(A, k), b = of(B, k);
    if (!row || !a) continue;
    const va = a.total.dealt, vb = b ? b.total.dealt : 0;
    put($('.n.a', row), va ? nf(va) : '–', !!B && va > vb);
    put($('.n.b', row), vb ? nf(vb) : '–', !!B && vb > va);
    $('.n.a small', row).textContent = va ? TYPE_LETTER[a.type] : '';
    $('.n.b small', row).textContent = vb ? TYPE_LETTER[b.type] : '';
    $('.sh', row).textContent = va && A.combo.total.dealt ? Math.round(va / A.combo.total.dealt * 100) + '%' : '–';
    // a line with nothing else to say gives the rate of its damage over time, per build when they differ
    const note = $('.note', row), ra = rate(a), rb = rate(b);
    note.textContent = note.dataset.fixed || (!B || ra === rb ? ra : [ra && 'A ' + ra, rb && 'B ' + rb].filter(Boolean).join(', '));
    if (!$('.src[data-ab]', row)) $('.nm', row).title = lineParts(a, b);
  }
  const ta = A.combo.total.dealt, tb = B ? B.combo.total.dealt : 0, tot = $('#total-row');
  put($('.n.a', tot), nf(ta), !B || ta > tb);
  put($('.n.b', tot), B ? nf(tb) : '–', !!B && tb > ta);
  $('#pop-a').textContent = nf(ta);
  $('#pop-b').textContent = B ? nf(tb) : '';
  for (const [k, r] of [['a', A], ['b', B]]) {
    if (!r) continue;
    const m = mix(r), el = $(`#split-${k}`);
    el.innerHTML = m.bars;
    el.title = `${nameOf(k)}: ${m.text}`;
  }
  const [blocked, dps, ttk] = $$('#more .r-row');
  put($('.n.a', blocked), raw ? '–' : '−' + nf(A.combo.blocked), false);
  put($('.n.b', blocked), raw || !B ? '–' : '−' + nf(B.combo.blocked), false);
  paintFightLabel(A, B);
  const da = A.fight.dps.dealt, db = B ? B.fight.dps.dealt : 0;
  put($('.n.a', dps), nf(da), !!B && da > db);
  put($('.n.b', dps), B ? nf(db) : '–', !!B && db > da);
  const ka = A.fight.timeToKill ?? Infinity, kb = B ? B.fight.timeToKill ?? Infinity : Infinity;
  put($('.n.a', ttk), killTime(A), !raw && !!B && ka < kb);
  put($('.n.b', ttk), killTime(B), !raw && !!B && kb < ka);
  $('#verdict').innerHTML = B ? verdicts(A, B) : '';
  // a verdict is one line on the slip; the full sentence is its tooltip when it is cut short
  for (const p of $$('#verdict p')) p.title = p.textContent;
  const notes = assumptions(), fine = $('#r-notes');
  fine.textContent = notes.length ? `${notes.length} assumption${notes.length === 1 ? '' : 's'}, ${touched() ? 'tap' : 'hover'} to read` : '';
  fine.title = notes.join('\n');
}
/* The receipt feeds a notch out of the till when a new one is printed. Not for a quiet change
   (see schedule), and not for the first, which is still rolling out. */
let printed = false;
function reprint() {
  const s = $('#sheet');
  if (feed && printed) { s.classList.remove('feed'); void s.offsetWidth; s.classList.add('feed'); }
  feed = false; printed = true;
}

/* ---------- stats tab ---------- */
function statGroups(A, B) {
  const s = [A.stats, (B || A).stats], pct = x => Math.round(x * 100) + '%';
  const both = (f, note) => [f(s[0]), f(s[1]), note(s[0])];
  const baseNote = l => l.bonus ? `${nf(l.base)} base + ${nf(l.bonus)}` : `base at level ${A.stats.level}`;
  return [
    ['Offense', [
      ['Attack damage', ...both(x => Math.round(x.ad.total), x => baseNote(x.ad))],
      ['Ability power', ...both(x => Math.round(x.ap.total), x => x.ap.total ? 'all from items' : 'none')],
      ['Attack speed', ...both(x => +x.attackSpeed.total.toFixed(2), x => `${x.attackSpeed.base} base, +${Math.round(x.attackSpeed.bonus * 100)}%`)],
      ['Crit chance', ...both(x => pct(x.critChance), x => x.critChance ? `crits deal ${Math.round(x.critDamage * 100)}%` : 'no crit items')],
    ]],
    ['Penetration and tempo', [
      ['Lethality', ...both(x => x.armorPenPct ? `${Math.round(x.lethality)} + ${pct(x.armorPenPct)}` : Math.round(x.lethality), x => x.armorPenPct ? 'flat + armor penetration' : x.lethality ? 'flat armor penetration' : 'none')],
      ['Magic pen', ...both(x => x.magicPenPct ? `${Math.round(x.magicPenFlat)} + ${pct(x.magicPenPct)}` : Math.round(x.magicPenFlat), x => x.magicPenPct ? 'flat + percent' : x.magicPenFlat ? 'flat' : 'none')],
      ['Ability haste', ...both(x => Math.round(x.abilityHaste), x => x.abilityHaste ? `${Math.round(x.abilityHaste / (100 + x.abilityHaste) * 100)}% shorter cooldowns` : 'none')],
      ['Move speed', ...both(x => Math.round(x.moveSpeed.total), x => baseNote(x.moveSpeed))],
    ]],
    ['Health and resistances', [
      ['Health', ...both(x => Math.round(x.hp.total), x => baseNote(x.hp))],
      ['Mana', ...both(x => Math.round(x.mana.total), x => x.mana.total ? baseNote(x.mana) : 'no mana')],
      ['Armor', ...both(x => Math.round(x.armor.total), x => baseNote(x.armor))],
      ['Magic resist', ...both(x => Math.round(x.mr.total), x => baseNote(x.mr))],
    ]],
  ];
}
/* A stat is a number, or text that starts with one ("25%", "18 + 35%"). */
const statText = x => typeof x === 'number' ? (Number.isInteger(x) ? nf(x) : x.toFixed(2)) : x;
const statNum = x => typeof x === 'number' ? x : parseFloat(x) || 0;
/* The tabs page's More stats: every stat the calculation returns, as [label, value, format, note, the game's icon for it]. */
const n0 = v => nf(v), p0 = v => pct(v), p1 = v => pct(v, 1), as2 = v => v.toFixed(2);
const baseNote = l => l.bonus ? `${nf(l.base)} base + ${nf(l.bonus)}` : `base at level ${S.level}`;
const MORE = [
  ['Offense', [
    ['Attack damage', s => s.ad.total, n0, s => baseNote(s.ad), 'ad'],
    ['Ability power', s => s.ap.total, n0, s => s.ap.total ? 'all of it bonus' : 'none', 'ap'],
    ['Attack speed', s => s.attackSpeed.total, as2, s => `${s.attackSpeed.base} base, +${Math.round(s.attackSpeed.bonus * 100)}%`, 'as'],
    ['Crit chance', s => s.critChance, p0, s => s.critChance ? 'chance a hit that can crit does' : 'none', 'crit'],
    ['Crit damage', s => s.critDamage, p1, () => 'what a crit deals', 'crit'],
    ['Attack range', s => s.attackRange, n0, () => S.champ.ranged ? 'ranged' : 'melee', 'range'],
  ]],
  ['Penetration and tempo', [
    ['Lethality', s => s.lethality, n0, s => s.lethality ? 'flat armor penetration' : 'none', 'armorpen'],
    ['Armor penetration', s => s.armorPenPct, p0, s => s.armorPenPct ? 'percent' : 'none', 'armorpen'],
    ['Magic penetration', s => s.magicPenFlat, n0, s => s.magicPenFlat ? 'flat' : 'none', 'magicpen'],
    ['Magic penetration %', s => s.magicPenPct, p0, s => s.magicPenPct ? 'percent' : 'none', 'magicpen'],
    ['Ability haste', s => s.abilityHaste, n0, s => s.abilityHaste ? `${Math.round(s.abilityHaste / (100 + s.abilityHaste) * 100)}% shorter cooldowns` : 'none', 'haste'],
    ['Move speed', s => s.moveSpeed.total, n0, s => baseNote(s.moveSpeed), 'ms'],
  ]],
  ['Health and sustain', [
    ['Health', s => s.hp.total, n0, s => baseNote(s.hp), 'hp'],
    ['Mana', s => s.mana.total, v => v ? nf(v) : '–', s => s.mana.total ? baseNote(s.mana) : 'no mana', 'mana'],
    ['Armor', s => s.armor.total, n0, s => baseNote(s.armor), 'armor'],
    ['Magic resist', s => s.mr.total, n0, s => baseNote(s.mr), 'mr'],
    ['Life steal', s => s.lifeSteal, p0, s => s.lifeSteal ? 'on attacks' : 'none', 'lifesteal'],
    ['Omnivamp', s => s.omnivamp, p0, s => s.omnivamp ? 'on all damage' : 'none', 'omnivamp'],
  ]],
];
function renderStats() {
  const A = S.res.a, B = S.compare ? S.res.b : null, sa = A.stats, sb = B?.stats;
  let diff = 0, all = 0;
  $('#more-grid').innerHTML = MORE.map(([group, rows]) => {
    const head = B
      ? `<div class="srow shead"><span class="lbl">${group}</span><span class="tag a xs">A</span><span class="tag b xs">B</span><span class="lbl">Gap</span></div>`
      : `<div class="srow shead"><span class="lbl">${group}</span><span></span><span></span></div>`;
    return `<div>${head}${rows.map(([label, get, fmt, note, ico]) => {
      all++;
      const a = get(sa), sn = `<span class="sn">${statMark(ico, label)}${label}</span>`;
      if (!B) return `<div class="srow">${sn}<span class="n">${fmt(a)}</span><span class="note">${esc(note(sa))}</span></div>`;
      const b = get(sb);
      // compared as shown: two numbers that read the same are the same
      if (fmt(a) === fmt(b)) return `<div class="srow same">${sn}<span class="n">${fmt(a)}</span><span class="n">${fmt(b)}</span><span class="g">same</span></div>`;
      diff++;
      const w = a > b ? 'a' : 'b';
      return `<div class="srow">${sn}<span class="n${w === 'a' ? ' win' : ''}">${fmt(a)}</span><span class="n${w === 'b' ? ' win' : ''}">${fmt(b)}</span><span class="g ${w}">+${fmt(Math.abs(a - b))}</span></div>`;
    }).join('')}</div>`;
  }).join('');
  $('#ts-stats').textContent = B ? `All ${all}, ${diff} differ; where each is ahead` : `All ${all} stats`;
  paintAhead(sa, sb);
}
/* Where each build is ahead: every stat above that one build has more of, and by how much. Stats that
   match are named underneath, leaving out the ones neither build has. */
function paintAhead(sa, sb) {
  const el = $('#ahead');
  if (!sb) { el.innerHTML = '<span class="hint">With a second build, this lists where each one is ahead of the other.</span>'; return; }
  const rows = MORE.flatMap(g => g[1]);
  const side = (k, s, o) => {
    const up = rows.filter(([, get, fmt]) => fmt(get(s)) !== fmt(get(o)) && get(s) > get(o));
    return `<div class="ah ${k}"><div class="ah-head"><span class="tag ${k} sm">${k.toUpperCase()}</span>${esc(nameOf(k))}</div>`
      + (up.map(([label, get, fmt, , ico]) => `<div class="ah-row"><b>+${fmt(get(s) - get(o))}</b><span>${statMark(ico, label)}${label}</span></div>`).join('')
        || '<div class="ah-none">Ahead on nothing</div>') + '</div>';
  };
  const same = rows.filter(([, get, fmt]) => fmt(get(sa)) === fmt(get(sb)) && get(sa)).map(([label, get, fmt]) => `${label.toLowerCase()} <b>${fmt(get(sa))}</b>`);
  el.innerHTML = `<div class="sec-head"><span class="lbl">Where each build is ahead</span></div>
    <div class="ah-cols">${side('a', sa, sb)}${side('b', sb, sa)}</div>
    ${same.length ? `<p class="ah-same">Same in both: ${same.join(', ')}.</p>` : ''}`;
}
/* The receipt page's strip along the bottom: the same twelve stats, one cell each. */
function renderLedger() {
  const A = S.res.a, B = S.compare ? S.res.b : null;
  $('#ledger-cells').innerHTML = statGroups(A, B).flatMap(g => g[1]).map(([label, a, b, note]) => {
    const head = `<span class="eyebrow">${label}</span>`;
    if (!B) return `<div class="cell">${head}<div class="v solo${String(statText(a)).length > 5 ? ' long' : ''}"><b>${statText(a)}</b></div><em>${esc(note)}</em></div>`;
    if (a === b) return `<div class="cell same">${head}<div class="v"><i class="dot a"></i><i class="dot b"></i><b>${statText(a)}</b></div><em>same in both</em></div>`;
    // B's line says how far it is from A's; nothing when only the text after the number differs
    const d = statNum(b) - statNum(a), ds = d ? (d > 0 ? '+' : '−') + statText(+Math.abs(d).toFixed(2)) + (String(a).endsWith('%') ? '%' : '') : '';
    return `<div class="cell">${head}<div class="v a${d < 0 ? ' win' : ''}"><i class="dot a"></i><b>${statText(a)}</b></div><div class="v b${d > 0 ? ' win' : ''}"><i class="dot b"></i><b>${statText(b)}</b><em>${ds}</em></div></div>`;
  }).join('');
}

/* ---------- data quality ---------- */
function paintQuality() {
  const weak = new Set();
  for (const r of [S.res.a, S.compare ? S.res.b : null]) {
    if (!r) continue;
    for (const s of ['p', ...SLOTS]) if ((s === 'p' || S.combo[s]) && STATUS_WORD[r.abilities[s].status]) weak.add(`${lineLabel(s)[1]}: ${STATUS_WORD[r.abilities[s].status]}`);
    for (const it of r.items) if (STATUS_WORD[it.status]) weak.add(`${S.items.get(it.id)?.name || 'Item'}: ${STATUS_WORD[it.status]}`);
  }
  const q = $('#quality');
  q.hidden = !weak.size;
  q.className = 'wf warn';
  q.textContent = weak.size === 1 ? '1 number is an estimate' : `${weak.size} numbers are estimates`;
  q.title = [...weak].join('\n');
}

function paintResults() {
  if (RECEIPT) { paintReceipt(); renderLedger(); reprint(); }
  else { paintHero(); paintLines(); paintSide(); renderStats(); }
  paintOpts(); paintTarget(); paintQuality(); paintItemMenu(); paintTip(); paintIntro();
}

/* ---------- champion options ---------- */
/* What a kit lets the user say about the fight: a form, stacks, seconds spent in an aura. Like the
   breakdown rows they are built once per kit, so typing a number keeps its focus. */
function renderOpts() {
  const list = S.view?.options || [], el = $('#opts');
  el.hidden = !list.length;
  el.innerHTML = !list.length ? '' : `<div class="sec-head"><span class="lbl">${esc(S.champ.name)} options</span><button class="act" id="opts-reset" hidden>Reset</button></div>`
    + list.map(o => `<label class="opt" data-o="${esc(o.id)}">${o.kind === 'bool'
      ? `<input type="checkbox" data-o="${esc(o.id)}">`
      : `<input type="number" data-o="${esc(o.id)}"${o.min !== undefined ? ` min="${o.min}"` : ''}${o.max !== undefined ? ` max="${o.max}"` : ''}>`}<span>${esc(o.label)}</span></label>`).join('');
  paintOpts();
}
/* An option the user has not touched shows the default the calculation used for build A. */
function paintOpts() {
  const used = S.res?.a?.options || {};
  for (const row of $$('#opts .opt')) {
    const id = row.dataset.o, input = $('input', row), v = S.options[id] ?? used[id];
    row.classList.toggle('set', id in S.options);
    if (input.type === 'checkbox') input.checked = !!v;
    else if (document.activeElement !== input) input.value = v ?? '';
  }
  const reset = $('#opts-reset'), set = Object.keys(S.options).length;
  if (reset) reset.hidden = !set;
  // the receipt page keeps the options in a menu, and its button says how many are set
  const btn = $('#opts-btn');
  if (btn) { btn.hidden = $('#opts').hidden; btn.textContent = `${S.champ.name} options` + (set ? ` · ${set} set` : ''); }
}
function setOpt(input) {
  const o = S.view?.options.find(x => x.id === input.dataset.o);
  if (!o) return;
  if (o.kind === 'bool') S.options[o.id] = input.checked ? 1 : 0;
  else if (input.value.trim() === '' || !Number.isFinite(+input.value)) delete S.options[o.id];
  else S.options[o.id] = Math.max(o.min ?? -1e6, Math.min(o.max ?? 1e6, Math.round(+input.value)));
  paintOpts(); schedule(o.kind !== 'bool');
}

/* ---------- menus ---------- */
/* A .menu-btn opens the panel its aria-controls names; one is open at a time. The settings gear is
   one, and so is the receipt page's button for the champion's options. The combo's dropdown has two,
   its line and its pencil, so a button toggles its panel whichever of them opened it. */
let menu = null;                    // the button of the open menu
function setMenu(btn) {
  const panel = b => b?.getAttribute('aria-controls');
  const show = (b, on) => { $$(`[aria-controls="${panel(b)}"]`).forEach(x => x.setAttribute('aria-expanded', on)); $('#' + panel(b)).hidden = !on; };
  const same = btn && menu && panel(btn) === panel(menu);
  if (menu) show(menu, false);
  menu = same ? null : btn;
  if (menu) show(menu, true);
  // a panel that is there to be written in (Feedback) takes the typing at once, except on a touch screen
  if (menu && !touched()) $(`#${panel(menu)} [data-focus]`)?.focus();
}
/* The two layouts are two pages, so choosing the other one is a link. The choice is remembered
   (layout.js sends later visits to that page) and the build is handed over, so nothing but the
   layout changes. */
function setLayout(link) {
  if (link.getAttribute('aria-checked') === 'true') return setMenu(null);
  try { localStorage.setItem('layout', link.dataset.layout); } catch (e) {}
  let hash = '';
  try { sessionStorage.setItem('carry', encodeState()); } catch (e) { hash = '#s=' + encodeState(); }
  location.assign(link.getAttribute('href') + hash);
}

/* ---------- the remembered build ---------- */
/* The build a visitor last worked on comes back on their next visit, on either layout. It is kept in this
   browser (localStorage `build`, the share link's encoding) whenever a change settles, that is when its
   calculation is in, so a state the API turns down is never kept. A build that came in a link is someone
   else's until it is edited: looking at it leaves the visitor's own in place. Until the visitor presses
   something the page is still settling on what it opened with (the kit trims the ranks, an enemy's stats
   arrive), so no settle before that counts as an edit. */
const KEEP = 'build';
let opened = null;                  // the state the page settled on before the visitor did anything
let owned = false;                  // the page has been edited since, so what it shows is the visitor's build
let kept = null;                    // the state last written
let pressed = false;                // the visitor has pressed a key or a pointer
function remembered() {
  try {
    const r = JSON.parse(localStorage.getItem(KEEP));
    return r && typeof r.s === 'string' ? r : null;
  } catch (e) { return null; }
}
/* What the page opens on: the build the visit brought, else the visitor's own from last time, else the
   default. applyState checks every field and loadKit checks the options against the kit, so a build kept
   before a patch removed an item, a setting or an option comes back without just that. */
function restore() {
  const given = brought();
  cameWith = !!given;
  if (given) return applyState(given);
  const r = remembered(), s = r && decodeState(r.s);
  // a champion's page (/vayne) opens on that champion: the visitor's own build only if it is for them
  if (!s || (PAGE_CHAMP && s.c !== S.champ.id)) return;
  kept = r.s; back = r;
  try { applyState(s); } catch (e) {}
}
/* The record also holds what the visitor saw with the build, for the patch notice: the dataset (`data`)
   and each build's numbers (`seen`). */
function remember() {
  if (!S.res) return;
  const now = encodeState();
  if (!owned) {
    if (!pressed || opened === null) { opened = now; review(); return; }
    if (now === opened) return;
    owned = true;
    notice(null);
  }
  if (now === kept) return;
  try { localStorage.setItem(KEEP, JSON.stringify({s: now, data: dataOf(served), seen: seenNow(), dps: SEEN})); kept = now; dropLink(); } catch (e) {}
}
function wireRemember() {
  const touch = () => { pressed = true; };
  document.addEventListener('pointerdown', touch, {capture: true, once: true});
  document.addEventListener('keydown', touch, {capture: true, once: true});
  // a build's name changes no number, so nothing recalculates: it is kept on its own once typing pauses
  let wait = 0;
  for (const k of ['a', 'b']) $(`#name-${k}`).addEventListener('input', () => { clearTimeout(wait); wait = setTimeout(remember, 400); });
  $('#patch-note')?.addEventListener('click', e => { if (e.target.closest('.pn-x')) notice(null); });
}

/* ---------- the patch notice ---------- */
/* A patch, or the dataset rebuilt, can change what the build a visitor comes back to deals. Once the first
   calculation of such a visit is in, one line says what moved since they last saw it, and only if something
   did: a build's combo or DPS by at least NOTICE of what it was (and by a whole point, the totals' own
   step), or which build leads. 1% is the step in which the page itself compares builds (a verdict's
   "+12% combo"); less than that cannot change how two builds compare, and is the drift a balance pass
   leaves on things it did not touch. The record then takes the new numbers, so the line shows once; it goes
   when dismissed or when the build is edited. */
const NOTICE = 0.01;
let served = null;                  // GET /meta: the dataset the numbers come from
let back = null;                    // the remembered record the page opened on, as it was before this visit
const dataOf = m => m && {patch: m.patch, built: m.builtAt};
/* Each build's combo and DPS against the target, as the page shows them. */
function seenNow() {
  const out = {};
  for (const k of S.compare && S.res.b ? ['a', 'b'] : ['a']) out[k] = [Math.round(S.res[k].combo.total.dealt), Math.round(S.res[k].fight.dps.dealt)];
  return out;
}
/* What seenNow's DPS is: the fight's since it counts abilities. A record from before has auto attacks' DPS,
   which is not compared with the fight's: it is only brought up to date. */
const SEEN = 'fight';
/* Each settle before the visitor does anything is still the build they came back to: it is compared with what
   they saw last time, and that is updated. The receipt page counts crits at the average and shows one set of
   ranks, so a build kept with others is left for the tabs page. */
function review() {
  const was = back && decodeState(back.s), data = dataOf(served);
  if (!was || !data || (was.k ?? 'average') !== S.crits || !!was.rb !== S.split) return;
  const seen = seenNow(), news = back.seen && back.dps === SEEN && (back.data?.patch !== data.patch || back.data?.built !== data.built);
  notice(news ? patchNews(back.seen, seen, back.data?.patch !== data.patch) : null);
  try { localStorage.setItem(KEEP, JSON.stringify({...back, data, seen, dps: SEEN})); } catch (e) {}
}
/* The line, or null when nothing moved enough. `was` and `now` are seenNow()'s. One build's line names each
   number that moved; a comparison's names one: the combo if it moved or changed hands, else DPS, so the line
   fits above the totals. */
function patchNews(was, now, patched) {
  const ks = Object.keys(now);
  if (ks.join() !== Object.keys(was).join() || !ks.every(k => Array.isArray(was[k]) && was[k].every(Number.isFinite))) return null;
  const moved = (x, y) => Math.abs(y - x) >= Math.max(1, Math.abs(x) * NOTICE);
  const lead = (s, i) => !s.b ? 'a' : s.a[i] > s.b[i] ? 'a' : s.b[i] > s.a[i] ? 'b' : '';
  const on = [0, 1].filter(i => ks.some(k => moved(was[k][i], now[k][i])) || lead(was, i) !== lead(now, i));
  if (!on.length) return null;
  const tag = k => `<span class="tag ${k} xs">${k.toUpperCase()}</span>`;
  const step = (k, i) => was[k][i] === now[k][i] ? `still <b>${nf(now[k][i])}</b>` : `<b>${nf(was[k][i])} → ${nf(now[k][i])}</b>`;
  let text;
  if (ks.length === 1) text = 'your ' + on.map((i, n) => `${['combo', 'DPS'][i]} ${n ? '' : 'went '}${step('a', i)}`).join(', ');
  else {
    const i = on[0], dps = i ? ' on DPS' : '', l = lead(now, i);
    text = (i ? 'DPS ' : '') + ks.map(k => `<span class="pn-k">${tag(k)} ${step(k, i)}</span>`).join(', ');
    if (lead(was, i) !== l) text += `. <em>${l ? `${tag(l)} leads${dps} now` : `A and B tie${dps} now`}</em>.`;
  }
  return `<strong>${patched ? `Patch ${esc(served.displayPatch)}` : `Updated ${esc(served.displayPatch)} data`}:</strong> ${text}`;
}
function notice(html) {
  const el = $('#patch-note');
  if (!el) return;
  el.hidden = !html;
  el.innerHTML = html ? `<span class="pn-t">${html}</span><button class="pn-x" aria-label="Dismiss" title="Dismiss">×</button>` : '';
  // cut short when the line is longer than its room: the whole of it is the tooltip
  if (html) $('.pn-t', el).title = $('.pn-t', el).textContent;
}

/* ---------- saved builds ---------- */
/* Builds kept in this browser, to come back to and switch between. Both pages list them in a menu under Saved
   builds in the top bar, and both read one list in localStorage.
   An entry keeps encodeState()'s string, which is all that loading it needs, and a summary for the list (the
   champion, level and items) so that drawing the list never has to read that string. Loading one is what a
   shared link does at boot: applyState, then paintAll. */
const SAVED = 'saved', SAVED_V = 1, SAVED_MAX = 50;
const SAVED_NONE = {
  '': 'Nothing saved yet. Save this setup and it waits here, a click away.',
  blocked: "This browser isn't keeping data for this site, so builds can't be saved here. Copy build link keeps one in a link.",
  newer: 'These were saved by a newer version of this page. Reload it to see them.',
};
let savedErr = '';                  // why the list can't be kept: 'blocked' (no storage) or 'newer' (see readSaved)
let savedShown = new Map();         // id -> state of each entry on screen, to mark the one that is loaded
let savedEdit = null;               // the id of the entry being renamed
let savedUndo = null;               // the entry deleted last, until something else happens to the list
let savedTyped = false;             // the name field holds a name the visitor typed, not the suggestion
const slots6 = v => Array.from({length: 6}, (_, i) => Number.isInteger(v?.[i]) ? v[i] : null);
/* The list, newest first. What storage holds is checked: unreadable JSON counts as no list, and an entry that
   isn't whole is left out. */
function readSaved() {
  let j = null;
  savedErr = '';
  try { j = localStorage.getItem(SAVED); } catch (e) { savedErr = 'blocked'; return []; }
  try { j = JSON.parse(j); } catch (e) { j = null; }
  // a later version of the page, open in another window after a deploy, may have written it: left alone
  if (j?.v > SAVED_V) { savedErr = 'newer'; return []; }
  return (Array.isArray(j?.builds) ? j.builds : [])
    .filter(e => typeof e?.id === 'string' && /^[\w-]{1,32}$/.test(e.id) && typeof e.s === 'string' && e.s)
    .map(e => ({id: e.id, name: String(e.name || 'Saved build').slice(0, 80), at: Number.isFinite(e.at) && Math.abs(e.at) < 8.64e15 ? e.at : 0,
      patch: String(e.patch || ''), s: e.s, c: String(e.c || ''), l: Number.isFinite(e.l) ? Math.max(1, Math.min(18, Math.round(e.l))) : 1,
      a: slots6(e.a), b: Array.isArray(e.b) ? slots6(e.b) : null}))
    .sort((x, y) => y.at - x.at).slice(0, SAVED_MAX);
}
function writeSaved(list) {
  if (savedErr === 'newer') return false;
  try { localStorage.setItem(SAVED, JSON.stringify({v: SAVED_V, builds: list})); return true; } catch (e) {
    savedSay(/quota/i.test(e?.name) ? "Not saved: this browser's storage for the site is full" : "Not saved: this browser isn't keeping data for this site");
    return false;
  }
}
function savedSay(text, undo) {
  const el = $('#saved-status');
  if (el) el.innerHTML = esc(text || '') + (undo ? ' <button class="act" data-act="undo">Undo</button>' : '');
}
/* A name that says what the setup is: the champion, then each build's own name if the visitor gave it one,
   else its dearest item (in a comparison, the dearest one the other build lacks). */
function suggestName() {
  const about = k => {
    const named = $(`#name-${k}`), its = buildItems(k).sort((x, y) => y.gold - x.gold);
    if (named.value.trim() && named.value !== named.defaultValue) return named.value.trim();
    if (!its.length) return 'no items';
    if (!S.compare) return its.slice(0, 2).map(it => it.name).join(' and ');
    const other = new Set(S.builds[k === 'a' ? 'b' : 'a']);
    return (its.find(it => !other.has(it.id)) || its[0]).name;
  };
  return `${S.champ.name}, ${(S.compare ? ['a', 'b'] : ['a']).map(about).join(' vs ')}`.slice(0, 80);
}
function ago(t) {
  const now = new Date(), m = Math.floor((now - t) / 6e4), day = x => new Date(x).setHours(0, 0, 0, 0);
  const days = Math.round((day(now) - day(t)) / 864e5);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (days < 1) return `${Math.floor(m / 60)} h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(t).toLocaleDateString('en-US', {month: 'short', day: 'numeric', ...(new Date(t).getFullYear() !== now.getFullYear() && {year: 'numeric'})});
}
/* One entry: a button that loads it, and its Rename and Delete, as icons. While renamed, its name is a field instead.
   Items that have left the game since it was saved are empty slots, as loading will leave them. The entry on
   screen carries a small "On screen" mark (paintSaved sets aria-current). */
const PENCIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>';
const TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>';
function savedRow(e) {
  const here = id => id && S.items.has(id), when = new Date(e.at), champ = S.champs.find(c => c.id === e.c)?.name || e.c;
  const face = `<span class="sv-face" aria-hidden="true" title="${esc(champ)}">${champIco(e.c)}</span>`;
  if (savedEdit === e.id) return `<li class="sv editing" data-id="${e.id}">${face}<input class="search" data-act="name" value="${esc(e.name)}" maxlength="80" autocomplete="off" spellcheck="false" aria-label="New name for ${esc(e.name)}">
    <span class="sv-acts"><button class="act" data-act="keep">Save</button><button class="act" data-act="cancel">Cancel</button></span></li>`;
  const gone = [...e.a, ...(e.b || [])].filter(id => id && !here(id)).length, patch = $('#patch').textContent, said = ago(e.at);
  const also = [e.patch && e.patch !== patch && `patch ${e.patch}`, gone && `${gone} item${gone === 1 ? '' : 's'} no longer in the game`].filter(Boolean);
  const meta = [`Level ${e.l}`, `<time datetime="${when.toISOString()}" title="Saved ${esc(when.toLocaleString('en-US', {dateStyle: 'medium', timeStyle: 'short'}))}">${said}</time>`, ...also.map(esc)].join(' · ');
  const build = k => !e[k] ? '<span class="sv-b"></span>' : `<span class="sv-b ${k}">${e.b ? `<span class="tag ${k} xs">${k.toUpperCase()}</span>` : '<span></span>'}`
    + e[k].map(id => `<span class="sv-it${here(id) ? '' : ' empty'}">${here(id) ? itemIco(id) : ''}</span>`).join('') + '</span>';
  // read out as one line; the pictures are for the eye
  const label = [e.name, `${champ}, level ${e.l}`, `saved ${said}`, ...also].join(', ');
  return `<li class="sv" data-id="${e.id}"><button class="sv-load" data-act="load" aria-label="${esc(label)}" title="Load this build">${face}<span class="sv-txt"><span class="sv-l1"><b>${esc(e.name)}</b><i class="sv-on" aria-hidden="true">On screen</i></span><span class="sv-meta">${meta}</span></span>
    <span class="sv-bs" aria-hidden="true">${build('a')}${build('b')}</span></button>
    <span class="sv-acts"><button class="sv-ib" data-act="rename" aria-label="Rename ${esc(e.name)}" title="Rename">${PENCIL}</button><button class="sv-ib del" data-act="delete" aria-label="Delete ${esc(e.name)}" title="Delete">${TRASH}</button></span></li>`;
}
function renderSaved() {
  const ul = $('#saved-list');
  if (!ul || !S.items.size) return;
  const list = readSaved(), n = list.length, badge = $('#saved-n'), count = $('#saved-count');
  if (badge) { badge.textContent = n; badge.hidden = !n; badge.parentElement.setAttribute('aria-label', `Saved builds${n ? `, ${n}` : ''}`); }
  if (count) count.textContent = n ? `${n} of ${SAVED_MAX}` : '';
  $('#saved-save').disabled = $('#saved-name').disabled = !!savedErr;
  // redrawing keeps the focus on the same button of the same entry
  const f = document.activeElement, back = ul.contains(f) && `[data-id="${f.closest('[data-id]')?.dataset.id}"] [data-act="${f.dataset.act}"]`;
  savedShown = new Map(list.map(e => [e.id, e.s]));
  ul.innerHTML = list.map(savedRow).join('') || `<li class="sv-none">${SAVED_NONE[savedErr]}</li>`;
  if (back) $(back, ul)?.focus();
  paintSaved();
}
/* After each result: which entry is the setup on screen, and the name field's suggestion, unless the visitor
   has typed a name of their own. */
function paintSaved() {
  const input = $('#saved-name');
  if (!input || !S.items.size) return;
  // the receipt page has no crits switch and one set of ranks (see applyState), so a build saved with either
  // is on screen there once it matches without them
  const now = encodeState(), bare = s => { const {k, rb, ob, ...rest} = decodeState(s) || {}; return JSON.stringify(rest); }, nowBare = RECEIPT && bare(now);
  for (const b of $$('#saved-list .sv-load')) {
    const s = savedShown.get(b.parentElement.dataset.id);
    b.setAttribute('aria-current', s === now || !!nowBare && bare(s) === nowBare);
  }
  input.placeholder = suggestName();
  if (!savedTyped && document.activeElement !== input) input.value = input.placeholder;
}
function saveBuild() {
  const list = readSaved();
  if (savedErr) return renderSaved();
  const s = encodeState(), was = list.findIndex(e => e.s === s);
  const e = {id: was > -1 ? list[was].id : Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: $('#saved-name').value.trim().slice(0, 80) || suggestName(), at: Date.now(), patch: $('#patch').textContent,
    s, c: S.champ.id, l: S.level, a: [...S.builds.a], b: S.compare ? [...S.builds.b] : null};
  // the same setup saved again replaces the older entry, under the new name
  if (was > -1) list.splice(was, 1);
  list.unshift(e);
  const out = list.splice(SAVED_MAX);
  if (!writeSaved(list)) return;
  savedTyped = false; savedEdit = null; savedUndo = null;
  renderSaved();
  savedSay(was > -1 ? `Saved "${e.name}" in place of the same setup` : out.length ? `Saved. ${SAVED_MAX} are kept, so "${out[0].name}", the oldest, made room` : `Saved "${e.name}"`);
}
function loadSaved(id) {
  const e = readSaved().find(x => x.id === id), s = e && decodeState(e.s);
  if (!s) { renderSaved(); return savedSay(e ? "That build can't be read" : 'That build is no longer saved'); }
  closePicker(); closeItemMenu(); hideTip();
  const was = S.champ, gone = [...e.a, ...(e.b || [])].filter(x => x && !S.items.has(x)).length;
  // a state leaves out what is at its default (see encodeState), so that goes back to its default first
  S.options = {}; S.itemOpts = {a: {}, b: {}}; S.split = false; S.crits = 'average'; S.shops = {aram: false, arena: false};
  applyState(s);
  if (S.champ !== was) S.view = null;
  comboFresh = false; savedEdit = null; savedUndo = null;
  paintAll(); renderSaved(); followChamp(); loadKit();
  // what a patch took away since: applyState leaves a champion it can't find as it was, and empties an item's slot
  savedSay(`Loaded "${e.name}"` + (S.champ.id !== s.c ? `, but its champion is no longer in the game` : '')
    + (gone ? `. ${gone} of its items ${gone === 1 ? 'is' : 'are'} no longer in the game, so ${gone === 1 ? 'its slot is' : 'their slots are'} empty` : ''));
}
/* Renaming happens in place: the entry's line becomes a field. Only that line is redrawn, so a click that
   ends a rename by landing on another entry still reaches its button. */
function redrawSaved(id) {
  const li = id && $(`#saved-list [data-id="${id}"]`), e = li && readSaved().find(x => x.id === id);
  if (e) { li.outerHTML = savedRow(e); paintSaved(); } else if (li) renderSaved();
}
/* `back` is the entry whose Rename gets the focus back. */
function editSaved(id, back) {
  const was = savedEdit;
  savedEdit = id;
  redrawSaved(was); redrawSaved(id);
  const input = id && $(`#saved-list [data-id="${id}"] input`);
  if (input) { input.focus(); input.select(); } else if (back) $(`#saved-list [data-id="${back}"] [data-act="rename"]`)?.focus();
}
function renameSaved(id, name, refocus) {
  const list = readSaved(), e = list.find(x => x.id === id);
  name = name.trim().slice(0, 80);
  savedEdit = null;
  if (e && name && name !== e.name) { e.name = name; if (writeSaved(list)) savedSay(`Renamed "${name}"`); }
  redrawSaved(id);
  if (refocus) $(`#saved-list [data-id="${id}"] [data-act="rename"]`)?.focus();
}
function deleteSaved(id) {
  const list = readSaved(), at = list.findIndex(e => e.id === id);
  if (at < 0) return renderSaved();
  const [e] = list.splice(at, 1);
  if (!writeSaved(list)) return;
  savedUndo = e; savedEdit = null;
  renderSaved();
  // the focus goes to the entry that took its place, else the one above it, else the name field
  const rows = $$('#saved-list .sv[data-id]'), next = rows[Math.min(at, rows.length - 1)];
  (next ? $('[data-act="load"]', next) : $('#saved-name')).focus();
  savedSay(`Deleted "${e.name}"`, true);
}
function undoDelete() {
  const e = savedUndo, list = readSaved();
  if (!e) return;
  savedUndo = null;
  if (!list.some(x => x.id === e.id)) list.push(e);
  if (!writeSaved(list.sort((x, y) => y.at - x.at).slice(0, SAVED_MAX))) return;
  renderSaved();
  $(`#saved-list [data-id="${e.id}"] [data-act="load"]`)?.focus();
  savedSay(`Restored "${e.name}"`);
}
function wireSaved() {
  const box = $('.saved'), input = $('#saved-name');
  if (!box) return;
  input.addEventListener('input', () => { savedTyped = !!input.value.trim(); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveBuild(); } });
  $('#saved-save').addEventListener('click', saveBuild);
  const acts = {load: loadSaved, rename: editSaved, delete: deleteSaved, undo: undoDelete, cancel: id => editSaved(null, id),
    keep: id => renameSaved(id, $(`#saved-list [data-id="${id}"] input`).value, true)};
  box.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b || !acts[b.dataset.act]) return;
    // a click here redraws the list under the pointer, so it stops here, or wire()'s handler would take the
    // vanished button for a click outside the menu and close it
    e.stopPropagation();
    acts[b.dataset.act](b.closest('[data-id]')?.dataset.id);
  });
  // the field of an entry being renamed: Enter keeps the name, Esc goes back to the old one, and so does
  // leaving it empty; leaving it otherwise keeps what was typed. Its own buttons take a click without the focus.
  box.addEventListener('keydown', e => {
    const field = e.target.closest('input[data-act="name"]'), id = field?.closest('[data-id]').dataset.id;
    if (!field) return;
    if (e.key === 'Enter') { e.preventDefault(); renameSaved(id, field.value, true); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); editSaved(null, id); }
  });
  box.addEventListener('mousedown', e => { if (e.target.closest('.editing .act')) e.preventDefault(); });
  box.addEventListener('focusout', e => {
    const li = e.target.closest('.sv.editing');
    if (li && savedEdit === li.dataset.id && !li.contains(e.relatedTarget)) renameSaved(li.dataset.id, $('input', li).value);
  });
  // Saved builds in the top bar is the menu's button (see setMenu): the menu opens freshly drawn, with the
  // focus in its name field
  $('#saved-link')?.addEventListener('click', e => {
    e.preventDefault();
    savedSay(''); savedUndo = null; savedEdit = null; renderSaved();
    setTimeout(() => { if (!$('#saved-menu').hidden) input.focus(); });
  });
  // another window of the site changed the list
  addEventListener('storage', e => { if (e.key === SAVED || e.key === null) renderSaved(); });
}

/* ---------- share link ---------- */
/* A shared build is a short link, /b/<id>: the share button sends the build (encodeState) to
   POST /api/v1/links, which keeps it and names it. The Worker answers that address with this layout's page,
   the build written into it (#shared-build) and link-preview tags that describe it (src/worker/preview.ts).
   src/server/share.ts reads the state exactly as applyState does and builds the request recalc would send,
   so keep the two in step. When no short link can be had (offline, the limit, the store down), the link
   carries the build itself in its query, `?s=`, as all links once did; older ones carried it after `#`.
   Those still open the build, but show the site's own preview. */
const shareUrl = (s = encodeState()) => `${location.origin}${RECEIPT ? '/receipt' : '/'}?s=${s}`;
/* The short link for a state, or the long one if none can be had. Never rejects. */
async function linkFor(s) {
  try {
    const j = await api('/links', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({s, layout: RECEIPT ? 'receipt' : 'tabs'})});
    // on this page's own origin, whatever address the server was reached at (wrangler dev calls itself itemize.lol)
    if (/^[0-9A-Za-z]+$/.test(j?.id)) return `${location.origin}/b/${j.id}`;
  } catch (e) {}
  return shareUrl(s);
}
/* Copies a link that is still on its way. Safari lets a page write to the clipboard only while it is handling
   the click, so the write starts now with a promise of the text (ClipboardItem), and the link fills it in when
   it arrives; where that is not supported the text is written once it is there. Resolves to whether it worked. */
async function copyLater(text) {
  try {
    if (window.ClipboardItem && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({'text/plain': text.then(t => new Blob([t], {type: 'text/plain'}))})]);
      return true;
    }
  } catch (e) {}
  try { await navigator.clipboard.writeText(await text); return true; } catch (e) { return false; }
}
function encodeState() {
  const s = {c: S.champ.id, l: S.level, r: SLOTS.map(k => S.ranks[k]), o: S.order, a: S.builds.a, b: S.builds.b, n: [$('#name-a').value, $('#name-b').value],
    m: S.compare ? 1 : 0, t: S.target, d: S.target === 'raw' ? S.dummy : readDials(),
    e: [S.enemy.id, S.enemy.level, ...(enemyItems().length ? [S.enemy.items] : [])], q: ACTIONS.map(k => S.combo[k]),
    ...(Object.keys(S.options).length && {x: S.options}),
    ...(S.crits !== 'average' && {k: S.crits}),
    ...(S.split && {rb: SLOTS.map(k => S.ranksB[k]), ob: S.orderB}),
    ...(ADDABLE.some(m => S.shops[m]) && {sh: ADDABLE.filter(m => S.shops[m])})};
  const io = {a: itemOptsOf('a'), b: itemOptsOf('b')};
  if (Object.keys(io.a).length || Object.keys(io.b).length) s.io = io;
  return btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/* The build this visit brought, if it brought one: from the other layout's page when the visitor has just
   swapped (or layout.js has swapped for them), else written into the page by a short link, else in a long
   link. Read once, at boot; the hand-over is used up. */
function brought() {
  let text = null;
  try { text = sessionStorage.getItem('carry'); sessionStorage.removeItem('carry'); } catch (e) {}
  try { text ||= JSON.parse($('#shared-build')?.textContent || 'null')?.s; } catch (e) {}
  text ||= /[?&]s=([\w-]+)/.exec(location.search)?.[1] || /[#&]s=([\w-]+)/.exec(location.hash)?.[1];
  return text ? decodeState(text) : null;
}
/* Takes the build out of the address once the page has moved on from it, so a reload shows the build kept
   since (see remember) rather than the link's. It is in the query, or after `#` in older links; a short link
   is the whole address, which becomes the layout's own page (the champion's, on a champion page that shared one). */
function dropLink() {
  const drop = (part, lead) => part.replace(/([?#&])s=[\w-]+&?/, '$1').replace(new RegExp(`^\\${lead}$|&$`), '');
  const q = drop(location.search, '?'), h = drop(location.hash, '#');
  const root = (RECEIPT ? '/receipt' : '') + (PAGE_CHAMP && S.champ.slug ? '/' + S.champ.slug : RECEIPT ? '' : '/');
  const path = location.pathname.startsWith('/b/') ? root : location.pathname;
  if (q !== location.search || h !== location.hash || path !== location.pathname) history.replaceState(history.state, '', path + q + h);
}
function decodeState(text) {
  try {
    const s = JSON.parse(decodeURIComponent(escape(atob(text.replace(/-/g, '+').replace(/_/g, '/')))));
    return s && typeof s === 'object' && !Array.isArray(s) ? s : null;
  } catch (e) { return null; }
}
function applyState(s) {
  const int = (v, lo, hi, d) => Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : d;
  const build = v => Array.from({length: 6}, (_, i) => Array.isArray(v) && S.items.has(v[i]) ? v[i] : null);
  const c = S.champs.find(x => x.id === s.c);
  if (c) S.champ = c;
  S.level = int(s.l, 1, 18, S.level);
  if (Array.isArray(s.r)) SLOTS.forEach((k, i) => S.ranks[k] = int(s.r[i], 0, 6, 0));
  if (typeof s.o === 'string' && $(`#order option[value="${CSS.escape(s.o)}"]`)) S.order = s.o;
  S.builds.a = build(s.a); S.builds.b = build(s.b);
  if (Array.isArray(s.n)) { $('#name-a').value = String(s.n[0] ?? '').slice(0, 40); $('#name-b').value = String(s.n[1] ?? '').slice(0, 40); }
  S.compare = !!s.m;
  if (['raw', 'dummy', 'champ'].includes(s.t)) S.target = s.t;
  if (s.d) S.dummy = {hp: int(s.d.hp, 1, 100000, 2400), ar: int(s.d.ar, 0, 2000, 80), mr: int(s.d.mr, 0, 2000, 50)};
  const e = Array.isArray(s.e) && S.champs.find(x => x.id === s.e[0]);
  if (e) S.enemy = {id: e.id, name: e.name, level: int(s.e[1], 1, 18, 13), items: build(s.e[2])};
  if (Array.isArray(s.q)) ACTIONS.forEach((k, i) => S.combo[k] = int(s.q[i], 0, 30, 0));
  // ids are checked against the kit once it has loaded
  if (s.x && typeof s.x === 'object') for (const [id, v] of Object.entries(s.x).slice(0, 24)) if (Number.isFinite(+v)) S.options[id] = Math.round(+v);
  // the receipt page has no switch for crits and shows one set of ranks, so there they stay at the average and A's
  if (['average', 'never', 'always'].includes(s.k) && !RECEIPT) S.crits = s.k;
  if (Array.isArray(s.rb) && !RECEIPT) {
    S.split = true;
    SLOTS.forEach((k, i) => S.ranksB[k] = int(s.rb[i], 0, 6, 0));
    if (typeof s.ob === 'string' && $(`#order option[value="${CSS.escape(s.ob)}"]`)) S.orderB = s.ob;
  }
  if (Array.isArray(s.sh)) for (const m of ADDABLE) S.shops[m] = s.sh.includes(m);
  // item settings are checked against the items' controls; anything else in the link is dropped
  for (const k of ['a', 'b']) {
    const given = s.io?.[k];
    if (!given || typeof given !== 'object') continue;
    for (const [id, set] of Object.entries(given).slice(0, 6)) {
      const it = S.items.get(+id);
      if (!it || !set || typeof set !== 'object') continue;
      for (const c of it.controls || []) if (Number.isFinite(+set[c.id])) (S.itemOpts[k][id] ??= {})[c.id] = Math.round(+set[c.id]);
    }
  }
}

/* ---------- champion pages ---------- */
/* /vayne is the tabs page with Vayne already chosen, and /receipt/vayne the receipt's (src/server/pages.ts makes them).
   The page names its champion's slug on <html> and shows her name before any script runs, so it starts on her and
   never shows Kai'Sa first. There the address follows the champion: choosing another moves it to that champion's
   page, the tab's title follows, and the layout menu leads to the same champion in the other layout.
   On / and /receipt nothing here does anything. */
const PAGE_CHAMP = document.documentElement.dataset.champ;
let pageTitle = null;               // the page's title after its champion's name
/* At boot, before a link's build is applied: the page's champion, with the combo any kit starts with
   (the default one is Kai'Sa's, which leaves out her E and R). */
function startOnPageChamp() {
  const c = PAGE_CHAMP && S.champs.find(x => x.slug === PAGE_CHAMP);
  if (!c) return;
  S.champ = c;
  S.combo = {aa:3, q:1, w:1, e:1, r:1};
  comboFresh = true;
  if (document.title.startsWith(c.name)) pageTitle = document.title.slice(c.name.length);
}
function followChamp() {
  if (!PAGE_CHAMP || !S.champ.slug) return;
  const page = layout => (layout === 'receipt' ? '/receipt/' : '/') + S.champ.slug, here = page(RECEIPT ? 'receipt' : 'tabs');
  if (location.pathname !== here) history.replaceState(null, '', here + location.search + location.hash);
  if (pageTitle !== null) document.title = S.champ.name + pageTitle;
  for (const a of $$('#set-menu a[data-layout]')) a.setAttribute('href', page(a.dataset.layout));
}

/* ---------- contact ---------- */
/* The envelope in the bar lists where the maker can be reached, and Feedback in the footer writes an email.
   The email opens in the visitor's own mail app (mailto:), with the note, the build's link when the box is
   ticked, and the patch and layout it was seen on; the page itself sends nothing. */
const CONTACT_MAIL = 'contact@itemize.lol';
function wireContact() {
  document.addEventListener('click', async e => {
    const b = e.target.closest('button[data-copy]'); if (!b) return;
    const ok = await copyLater(Promise.resolve(b.dataset.copy));
    b.textContent = ok ? 'Copied' : 'Copy failed';
    setTimeout(() => b.textContent = 'Copy', 1600);
  });
  $('#fb-send').addEventListener('click', async () => {
    const b = $('#fb-send'), note = $('#fb-text').value.trim();
    let link = '';
    if ($('#fb-build').checked) {
      // the short link, unless it is slow to come: then the long one, which needs nothing from the server
      b.disabled = true; b.textContent = 'Getting the link…';
      const s = encodeState();
      link = await Promise.race([linkFor(s), new Promise(r => setTimeout(() => r(shareUrl(s)), 2500))]);
      b.disabled = false; b.textContent = 'Write email';
    }
    const about = `Patch ${served?.displayPatch || '?'}, ${RECEIPT ? 'Receipt' : 'Tabs'} layout`;
    const body = [note, link && `Build: ${link}`, about].filter(Boolean).join('\n\n');
    location.href = `mailto:${CONTACT_MAIL}?subject=${encodeURIComponent('itemize.lol feedback')}&body=${encodeURIComponent(body)}`;
    $('#fb-status').textContent = 'Your email app should open now. If it does not, copy the address below.';
  });
}

/* ---------- the introduction ---------- */
/* A first visit opens a welcome: what the site is for, and its three steps drawn from what is on the page
   behind it (the champion, the builds, what each deals). From there a short tour shows the page one part at
   a time. The veil over the page is the shadow of a hole: on the welcome the hole is the card itself, on
   the tour it is the part being shown, and it glides from one stop to the next. A click inside the hole goes
   through to the page and ends the tour, and so does a click outside it. Once closed it stays closed in this
   browser; the ? in the top bar, or the ? key, brings it back. Inside a frame (the promo video's stage) it
   never opens by itself.
   On a phone's layout (PHONE) the welcome and the tour's card are sheets along the bottom edge, as the
   pickers are there, and the tour shows the parts that layout has where the desktop's are taken apart or
   too tall for the screen. On a touch screen the words say tap, and no key is offered. */
const INTRO_KEY = 'intro';
let intro = null;                   // {step: -1 on the welcome, else the tour's stop; auto: a first visit opened it; back, scroll: where focus and the page return to; shown; timer; sheet: the card's height on a phone}
let cameWith = false;               // the visit brought a build (a link, short or long), set by restore(): the welcome says it was shared
const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize);
const val = x => typeof x === 'function' ? x() : x;
const tap = () => touched() ? 'Tap' : 'Click';
const kb = s => touched() ? '' : s;
const allChamps = () => S.champs.length ? `all ${S.champs.length}` : 'every champion';
const comboNow = () => ACTIONS.some(k => S.combo[k]) ? `<b>${esc(comboText())}</b>` : '<b>empty</b>';
const buildsText = () => (S.compare
  ? `${tap()} a slot to choose an item. A and B share the champion and level, so the items are the only difference; the ones that differ are underlined.`
  : `${tap()} a slot to choose an item. Add a second build to compare the two side by side.`)
  + ($('.slot .cfg:not(.info)') ? ' The round button on an item sets its stacks or active.' : '');
const ranksText = () => `ability ranks follow the <b>max order</b>, or ${tap().toLowerCase()} a pip to set one yourself.`;
/* Where the tour stops: the parts of the page it shows (one hole around all of them), and the side of the
   hole its card goes on when there is room. `ph` is what changes on a phone. */
const STOPS = RECEIPT ? [
  {at: ['#champ-btn', '.lvl', '.skills'], title: 'Your champion',
    text: () => `${tap()} the name${kb(', or press <span class="key">C</span>,')} to choose from ${allChamps()}. Set the level on the ruler; ${ranksText()}`,
    ph: {at: ['#champ-btn'], text: () => `${tap()} the name to choose from ${allChamps()}. Further down, under the builds, set the level on the ruler; ${ranksText()}`}},
  {at: ['#builds'], side: 'above', title: () => S.compare ? 'Two builds, A and B' : 'Your build', text: buildsText},
  {at: ['.tgt'], side: 'left', title: "Who you're hitting",
    text: 'A <b>target dummy</b> with the health, armor and magic resist you set, or a real <b>enemy champion</b> at its level, with its <b>items</b>. The bars show the health each build leaves it.',
    ph: {at: ['.tgt-mode', '.stage', '.hits']}},
  {at: ['.till'], side: 'right', title: 'The receipt',
    text: 'Every ability, auto attack and item effect in the combo, itemized, with the bigger number highlighted. <b>DPS</b> and <b>time to kill</b> say who wins a longer fight. Type in the <b>Qty</b> column to change the combo.',
    ph: {at: ['.r-cols', '#lines', '.r-total', '#more'],
      text: 'Every ability, auto attack and item effect in the combo, itemized, with the bigger number highlighted. Type in the <b>Qty</b> column to change the combo. Under the total, <b>DPS</b> and <b>time to kill</b> say who wins a longer fight.'}},
  {at: ['.ledger'], side: 'above', title: 'Every stat',
    text: () => `${S.compare ? "Both builds' stats, side by side" : "Your build's stats"}. When you're done, <b>Copy build link</b> at the top shares the whole setup, and <b>Saved builds</b> keeps it in this browser.`},
] : [
  {at: ['.setup'], title: 'Your champion',
    text: () => `${tap()} the champion${kb(', or press <span class="key">C</span>,')} to choose from ${allChamps()}. Set the level on the ruler; ${ranksText()}`,
    ph: {at: ['#champ-btn', '.lvl'], text: () => `${tap()} the champion to choose from ${allChamps()}, and set the level on the ruler. Further down, ${ranksText()}`}},
  {at: ['#builds > .sec-head', '#builds .build', '#add-b'], side: 'above', title: () => S.compare ? 'Two builds, A and B' : 'Your build', text: buildsText},
  {at: ['#tseg'], title: "Who you're hitting",
    text: 'A <b>target dummy</b> with the health, armor and magic resist you set, or a real <b>enemy champion</b> at its level, with its <b>items</b>. <b>Raw output</b> is the damage before either. The numbers are in the <b>Target</b> tab.'},
  {at: ['.totals', '.hero-side'], title: 'Who hits harder',
    text: () => `What the combo deals to the target, and the share of its health that is. <b>DPS</b> and <b>time to kill</b> say who wins a longer fight. The combo, top left, is ${comboNow()}; its pencil changes it.`,
    // on a phone the totals are the strip pinned at the top, and the rest of the band comes after the builds
    ph: {at: ['.tot.a', '.tot.b'], text: () => `What the combo deals to the target, and the share of its health that is. This strip stays in view as you scroll. Under the builds, <b>DPS</b> and <b>time to kill</b> say who wins a longer fight, and the combo is ${comboNow()}; its pencil changes it.`}},
  {at: ['.tab'], title: 'Every number, explained',
    text: () => `<b>Breakdown</b> splits the damage by source and <b>More stats</b> lists every stat${kb('; keys <span class="key">1</span> to <span class="key">4</span> switch tabs')}. <b>Copy build link</b>, top right, shares the whole setup, and <b>Saved builds</b>, top left, keeps it in this browser.`},
];
const stopAt = i => PHONE.matches && STOPS[i].ph ? {...STOPS[i], ...STOPS[i].ph} : STOPS[i];
function introDue() {
  if (self !== top) return false;
  try { return !localStorage.getItem(INTRO_KEY); } catch (e) { return false; }
}
function helloHtml() {
  const shared = intro.auto && cameWith, ks = S.compare ? ['a', 'b'] : ['a'];
  const items = k => [...S.builds[k].filter(Boolean), null, null, null, null].slice(0, 4)
    .map(id => `<span class="in-it${id ? '' : ' empty'}">${id ? itemIco(id) : ''}</span>`).join('');
  const tag = k => `<span class="tag ${k} xs">${k.toUpperCase()}</span>`;
  return `<img class="in-art wait" alt="">
    <div class="in-top">
      <span class="in-eyebrow">${shared ? 'Someone shared a build with you' : 'Welcome to itemize.lol'}</span>
      <h2 class="in-h" id="in-h">Which build <br><mark>hits harder?</mark></h2>
      <p class="in-lede" id="in-lede">Put two League of Legends item builds side by side and see the damage each one really deals: every ability, auto attack and item effect, after the target's armor and magic resist.</p>
    </div>
    <ol class="in-steps">
      <li><div class="in-pic in-champ"><span class="in-face">${champIco(S.champ.id)}</span><span class="in-who"><b>${esc(S.champ.name)}</b><small>Level ${S.level}</small></span></div>
        <b><i>1</i>Pick a champion</b><span>Any of ${S.champs.length || 'them'}, at any level</span></li>
      <li><div class="in-pic">${ks.map(k => `<div class="in-row">${tag(k)}${items(k)}</div>`).join('')}</div>
        <b><i>2</i>${S.compare ? 'Fill two builds' : 'Fill a build'}</b><span>${tap()} a slot, choose an item</span></li>
      <li><div class="in-pic" id="in-res">${ks.map(k => `<div class="in-row ${k}" data-k="${k}">${tag(k)}<span class="in-bar"><i></i></span><b>–</b></div>`).join('')}</div>
        <b><i>3</i>Read the damage</b><span>On a dummy or a real champion</span></li>
    </ol>
    <div class="in-acts">
      <button class="in-go" data-in="tour">Show me around <span class="key">Enter</span></button>
      <button class="in-skip" data-in="close">I'll explore on my own <span class="key">Esc</span></button>
    </div>
    <p class="in-foot">Patch ${esc($('#patch').textContent)} · Every number comes from the game's own files · The <b>?</b> at the top right brings this back</p>`;
}
function openIntro(auto) {
  if (intro) return;
  closePicker(); closeItemMenu(); closeChamps(); setMenu(null); hideTip();
  const me = intro = {step: -1, auto: !!auto, back: document.activeElement, scroll: [scrollX, scrollY], shown: false, sheet: remPx() * 12};
  const root = $('#intro');
  root.className = `intro hello${touched() ? ' touch' : ''}`;
  root.innerHTML = `<div class="in-catch"></div><div class="in-hole"></div>
    <div class="in-card hello" role="dialog" aria-modal="true" aria-labelledby="in-h" aria-describedby="in-lede">${helloHtml()}</div>`;
  root.hidden = false;
  if (ART) { const art = $('.in-art', root), url = splashUrl(S.champ.id); warm(url).then(() => { if (art.isConnected) art.src = url; }); }
  placeIntro(true);
  $('.in-go', root).focus({preventScroll: true});
  // the damage is the welcome's last line, counted up once the card has come in
  setTimeout(() => { if (intro === me) { me.shown = true; paintIntro(); } }, 420);
}
/* The welcome's third step: what each build deals, as the page shows it. */
function paintIntro() {
  const box = intro?.step === -1 && intro.shown && S.res && $('#in-res');
  if (!box) return;
  const v = {a: S.res.a.combo.total.dealt, b: S.compare && S.res.b ? S.res.b.combo.total.dealt : 0}, max = Math.max(1, v.a, v.b);
  const still = box.dataset.done || matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const row of $$('.in-row', box)) {
    const k = row.dataset.k, n = $('b', row);
    $('.in-bar i', row).style.width = `${(v[k] / max * 100).toFixed(1)}%`;
    row.classList.toggle('lose', S.compare && Math.round(v[k]) < Math.round(v[k === 'a' ? 'b' : 'a']));
    if (still) { n.textContent = nf(v[k]); continue; }
    const t0 = performance.now();
    const tick = t => { const p = Math.min(1, (t - t0) / 900); n.textContent = nf(v[k] * (1 - (1 - p) ** 3)); if (p < 1 && n.isConnected) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  box.dataset.done = 1;
}
/* A stop's hole: around everything it shows, with a little room, and kept inside the window. Around a part
   pinned over the page (a phone's strip and tab bar) the room would show the page scrolling under it. */
function holeAt(s) {
  const els = s.at.flatMap(q => $$(q)).filter(el => el.getClientRects().length), boxes = els.map(el => el.getBoundingClientRect());
  const m = 4, pad = remPx() * (PHONE.matches && els.every(pinned) ? .1 : .55);
  if (!boxes.length) return {l: m, t: m, r: innerWidth - m, b: innerHeight - m};
  return {l: Math.max(m, Math.min(...boxes.map(b => b.left)) - pad), t: Math.max(m, Math.min(...boxes.map(b => b.top)) - pad),
    r: Math.min(innerWidth - m, Math.max(...boxes.map(b => b.right)) + pad), b: Math.min(innerHeight - m, Math.max(...boxes.map(b => b.bottom)) + pad)};
}
/* The tour's card goes beside the hole: on the stop's own side if it fits there, else the first side that does,
   else over the page at the bottom of the window. */
function placeCard(card, h, s) {
  const w = card.offsetWidth, ht = card.offsetHeight, gap = remPx() * .9, m = remPx(), W = innerWidth, H = innerHeight;
  const fits = {below: h.b + gap + ht <= H - m, above: h.t - gap - ht >= m, right: h.r + gap + w <= W - m, left: h.l - gap - w >= m};
  const side = [s.side, 'below', 'above', 'right', 'left'].find(x => fits[x]);
  const cx = x => Math.max(m, Math.min(x, W - w - m)), cy = y => Math.max(m, Math.min(y, H - ht - m));
  const [x, y] = side === 'below' ? [cx(h.l), h.b + gap] : side === 'above' ? [cx(h.l), h.t - gap - ht]
    : side === 'right' ? [h.r + gap, cy(h.t)] : side === 'left' ? [h.l - gap - w, cy(h.t)] : [cx((W - w) / 2), H - ht - m];
  card.style.left = `${x}px`; card.style.top = `${y}px`;
}
/* On a phone the card is a sheet at the bottom of the window, or right above a hole that is down there (the
   tab bar). Where it would cover the hole anyway (a part taller than the room left), the hole stops short
   of it, so that what it frames is what can be seen. */
function sheetY(h, ht) {
  const m = remPx() / 2, gap = remPx() * .6, low = innerHeight - ht - m;
  return h.b + gap <= low || h.t - gap - ht < m ? low : h.t - gap - ht;
}
const pinned = el => { for (; el && el !== document.body; el = el.parentElement) if (/fixed|sticky/.test(getComputedStyle(el).position)) return true; return false; };
/* Scrolls the stop into view. On a phone it goes between what stays pinned at the top (the tabs page's
   strip) and the card's sheet, its top first if it is taller than that; a part pinned itself (the strip, the
   tab bar) is in view already. Says whether the page moved. */
function reveal(s) {
  if (!PHONE.matches) { $(s.at[0])?.scrollIntoView({block: 'nearest', inline: 'nearest'}); return false; }
  const els = s.at.flatMap(q => $$(q)).filter(el => el.getClientRects().length);
  if (!els.length || els.some(pinned)) return false;
  const pad = remPx() * .55, rs = els.map(el => el.getBoundingClientRect());
  const t = Math.min(...rs.map(r => r.top)) - pad, b = Math.max(...rs.map(r => r.bottom)) + pad;
  const top = Math.max(0, ...(RECEIPT ? [] : $$('.tot')).filter(el => el.getClientRects().length && pinned(el)).map(el => el.offsetHeight)) + remPx() * .5;
  const bottom = innerHeight - intro.sheet - remPx() * 1.3;
  const d = t < top || b - t > bottom - top ? t - top : b > bottom ? b - bottom : 0, y = scrollY;
  if (Math.abs(d) > 1) scrollBy(0, d);
  // the scroll's own event would only redraw what placeIntro is about to (and cut the card's fade short)
  return scrollY !== y && (intro.quiet = true);
}
/* Puts the hole and the card where they belong now. `still` is for the window moving under them (a resize, a
   scroll): they jump there instead of gliding. */
function placeIntro(still) {
  const root = $('#intro');
  if (!intro || !root) return;
  const card = $('.in-card', root), hole = $('.in-hole', root), m = remPx() / 2, out = card.classList.contains('out');
  if (still) root.classList.add('still');
  let h;
  if (intro.step < 0) {
    // on a phone the welcome is a sheet at the bottom too, where the thumb is
    const w = card.offsetWidth, ht = card.offsetHeight, x = Math.max(m, (innerWidth - w) / 2), y = Math.max(m, PHONE.matches ? innerHeight - ht - m : (innerHeight - ht) / 2);
    card.style.left = `${x}px`; card.style.top = `${y}px`;
    h = {l: x, t: y, r: x + w, b: y + ht};
    $('.in-catch', root).style.clipPath = '';
  } else {
    const s = stopAt(intro.step);
    h = holeAt(s);
    if (PHONE.matches) {
      if (!out) intro.sheet = card.offsetHeight;
      const y = sheetY(h, intro.sheet);
      if (y > h.t) h.b = Math.min(h.b, Math.max(h.t + remPx() * 2, y - remPx() * .3));
      if (!out) { card.style.left = `${Math.max(0, (innerWidth - card.offsetWidth) / 2)}px`; card.style.top = `${y}px`; }
    } else if (!out) placeCard(card, h, s);
    // the clicks outside the hole are caught; the ones inside reach the page
    $('.in-catch', root).style.clipPath = `polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,${h.l}px ${h.t}px,${h.l}px ${h.b}px,${h.r}px ${h.b}px,${h.r}px ${h.t}px,${h.l}px ${h.t}px)`;
  }
  Object.assign(hole.style, {left: `${h.l}px`, top: `${h.t}px`, width: `${h.r - h.l}px`, height: `${h.b - h.t}px`});
  if (still) { void root.offsetWidth; root.classList.remove('still'); }
}
/* To the tour's stop i: the hole glides there at once, the card fades out and comes back beside it. */
function go(i) {
  if (!intro || i < 0) return;
  if (i >= STOPS.length) return closeIntro();
  const from = intro.step, root = $('#intro'), card = $('.in-card', root), hole = $('.in-hole', root);
  intro.step = i;
  if (!RECEIPT) setTab('build');
  root.className = `intro tour${touched() ? ' touch' : ''}`;
  card.classList.add('out');
  reveal(stopAt(i));
  placeIntro();
  hole.classList.remove('ping'); void hole.offsetWidth; hole.classList.add('ping');
  clearTimeout(intro.timer);
  intro.timer = setTimeout(() => {
    if (intro?.step !== i) return;
    if (from < 0) {
      card.className = 'in-card stop out';
      card.setAttribute('aria-labelledby', 'in-t'); card.setAttribute('aria-describedby', 'in-p');
      card.innerHTML = `<div class="st-top"><span class="st-n"></span><span class="st-segs">${STOPS.map(() => '<i></i>').join('')}</span><button class="esc" data-in="close" title="End the tour">Esc</button></div>
        <div class="st-body" aria-live="polite"><h3 class="in-t" id="in-t"></h3><p class="in-p" id="in-p"></p></div>
        <div class="st-acts"><button class="btn" data-in="back"><span class="key">←</span> Back</button><button class="in-go" data-in="next"></button></div>`;
    }
    const s = stopAt(i), last = i === STOPS.length - 1, next = $('[data-in="next"]', card);
    $('.st-n', card).textContent = `${i + 1} / ${STOPS.length}`;
    $$('.st-segs i', card).forEach((el, j) => el.classList.toggle('on', j <= i));
    $('#in-t').textContent = val(s.title);
    $('#in-p').innerHTML = val(s.text);
    $('[data-in="back"]', card).hidden = !i;
    next.innerHTML = last ? 'Start building' : 'Next <span class="key">→</span>';
    card.classList.remove('out');
    // on a phone the page was scrolled for the card's height before this one's text was in: once more, now it is
    if (PHONE.matches) { intro.sheet = card.offsetHeight; reveal(s); }
    placeIntro();
    if (!card.contains(document.activeElement) || document.activeElement.hidden) next.focus({preventScroll: true});
  }, from < 0 ? 240 : 150);
}
/* `through`: the visitor clicked into the page, so the page stays where the tour scrolled it (in a window
   narrower than the page) and focus goes where that click puts it. */
function closeIntro(through) {
  if (!intro) return;
  const {back, scroll} = intro, root = $('#intro');
  clearTimeout(intro.timer);
  intro = null;
  try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) {}
  root.classList.add('bye');
  setTimeout(() => { if (!intro) { root.hidden = true; root.innerHTML = ''; } }, 220);
  if (through) return;
  scrollTo(...scroll);
  if (back?.isConnected && back !== document.body) back.focus({preventScroll: true});
}
function wireIntro() {
  const root = $('#intro');
  $('#intro-btn').addEventListener('click', () => openIntro());
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-in]');
    if (b) ({tour: () => go(0), next: () => go(intro.step + 1), back: () => go(intro.step - 1), close: () => closeIntro()})[b.dataset.in]();
    else if (e.target.closest('.in-catch')) closeIntro();
  });
  // while it is open the page's own keys wait: Esc closes it, Enter (off its buttons) and the arrows step through
  // the tour, Tab stays on its card
  addEventListener('keydown', e => {
    if (!intro) return;
    e.stopPropagation();
    const step = {ArrowRight: 1, ArrowLeft: -1}[e.key];
    if (e.key === 'Escape') { e.preventDefault(); closeIntro(); }
    else if (e.key === 'Enter' && !e.target.closest?.('button')) { e.preventDefault(); go(intro.step + 1); }
    else if (step && intro.step >= 0) { e.preventDefault(); go(intro.step + step); }
    else if (e.key === 'Tab') {
      const keys = $$('#intro .in-card button:not([hidden])'), at = keys.indexOf(document.activeElement);
      if (!keys.length) return;
      e.preventDefault();
      keys[(at + (e.shiftKey ? -1 : 1) + keys.length) % keys.length].focus();
    }
  }, true);
  // a click through the hole is the visitor taking over: the tour ends and the click goes on to the page
  document.addEventListener('pointerdown', e => { if (intro?.step >= 0 && !e.target.closest('#intro')) closeIntro(true); }, true);
  addEventListener('resize', () => placeIntro(true));
  document.addEventListener('scroll', e => { if (intro?.quiet) intro.quiet = false; else if (!e.target.closest?.('#intro')) placeIntro(true); }, true);
  // turning a phone can swap layouts under the tour: the stop is shown again as the new one has it
  PHONE.addEventListener('change', () => { if (intro?.step >= 0) go(intro.step); });
}

/* ---------- wiring ---------- */
function wire() {
  wireTip(); wireIntro(); wireContact();
  $('.tabs')?.addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) setTab(t.dataset.tab); });
  document.addEventListener('click', e => {
    const b = e.target.closest('.menu-btn');
    if (b) setMenu(b); else if (menu && !e.target.closest('.menu')) setMenu(null);
  });
  $('#set-menu').addEventListener('click', e => { const a = e.target.closest('a[data-layout]'); if (a) { e.preventDefault(); setLayout(a); } });
  $('#cmp-seg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setCompare(b.dataset.cmp === 'on'); });
  $('#add-b').addEventListener('click', () => setCompare(true));
  $('#rm-b').addEventListener('click', () => setCompare(false));
  $('#copy-a').addEventListener('click', () => { S.builds.b = [...S.builds.a]; S.itemOpts.b = structuredClone(S.itemOpts.a); closeItemMenu(); renderBuilds(); schedule(); });
  $('#clear-a').addEventListener('click', () => { S.builds.a = Array(6).fill(null); S.itemOpts.a = {}; closeItemMenu(); renderBuilds(); schedule(); });
  $('#name-a').addEventListener('input', paintNames);
  $('#name-b').addEventListener('input', paintNames);
  document.addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (b) setTarget(b.dataset.t); });

  $('#ruler').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setLevel(+b.dataset.l); });
  $('#ruler').addEventListener('keydown', e => {
    const d = {ArrowLeft:-1, ArrowDown:-1, ArrowRight:1, ArrowUp:1}[e.key];
    if (!d) return;
    e.preventDefault(); setLevel(S.level + d); $(`#ruler button[data-l="${S.level}"]`).focus();
  });
  $('#order').addEventListener('change', e => setOrder('a', e.target.value));
  $('#skill-row').addEventListener('click', e => { const p = e.target.closest('.pip'); if (p) setRank('a', p.dataset.k, +p.dataset.n); });
  // the tabs page: the chain that links the builds' ranks, and each build's own row when unlinked
  $('#rank-link')?.addEventListener('click', () => setSplit(!S.split));
  $('#rank-split')?.addEventListener('click', e => { const p = e.target.closest('.pip'); if (p) setRank(p.dataset.b, p.dataset.k, +p.dataset.n); });
  $('#rank-split')?.addEventListener('change', e => { const s = e.target.closest('select[data-ob]'); if (s) setOrder(s.dataset.ob, s.value); });
  $('#lines').addEventListener('input', e => {
    const k = e.target.dataset.q; if (!k) return;
    S.combo[k] = Math.max(0, Math.min(30, Math.round(+e.target.value) || 0));
    paintSub(); schedule(true);
  });
  // the tabs page: the combo's dropdown, and how crits count
  $('#steps')?.addEventListener('click', e => {
    const b = e.target.closest('button[data-d]'); if (!b) return;
    const k = b.closest('.step').dataset.k;
    S.combo[k] = Math.max(0, Math.min(30, S.combo[k] + +b.dataset.d));
    paintSub(); schedule();
  });
  $('#combo-reset')?.addEventListener('click', () => { defaultCombo(); paintSub(); schedule(); });
  $('#crit-seg')?.addEventListener('click', e => { const b = e.target.closest('button[data-crit]'); if (b) setCrits(b.dataset.crit); });
  $('#opts').addEventListener('input', e => { if (e.target.matches('input[data-o]')) setOpt(e.target); });
  $('#opts').addEventListener('click', e => { if (e.target.closest('#opts-reset')) { S.options = {}; paintOpts(); schedule(); } });

  const builds = $('#builds');
  builds.addEventListener('click', e => {
    // the shops button opens the picker on A's first empty slot
    if (e.target.closest('#shop-now')) { openPicker('a', Math.max(0, S.builds.a.findIndex(v => !v))); return; }
    const slot = e.target.closest('.slot'); if (!slot) return;
    const b = slot.dataset.b, i = +slot.dataset.i;
    if (e.target.closest('[data-cfg]')) { itemMenu && itemMenu.b === b && itemMenu.i === i ? closeItemMenu() : openItemMenu(b, i); return; }
    if (itemMenu && itemMenu.b === b && itemMenu.i === i) closeItemMenu();
    if (e.target.closest('[data-rm]')) { S.builds[b][i] = null; renderBuilds(); schedule(); return; }
    openPicker(b, i);
  });
  wireItemMenu();
  wireAuto();
  wireTouch();
  builds.addEventListener('keydown', e => {
    const slot = e.target.closest('.slot');
    if (slot && e.target === slot && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPicker(slot.dataset.b, +slot.dataset.i); }
  });
  // the enemy's slots: a click opens the picker for that slot, × takes the item out
  const tslots = $('#t-slots');
  tslots.addEventListener('click', e => {
    const slot = e.target.closest('.slot'); if (!slot) return;
    const i = +slot.dataset.i;
    if (e.target.closest('[data-rm]')) { S.enemy.items[i] = null; renderTargetItems(); enemyStats(); return; }
    openPicker('t', i);
  });
  tslots.addEventListener('keydown', e => {
    const slot = e.target.closest('.slot');
    if (slot && e.target === slot && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPicker('t', +slot.dataset.i); }
  });
  // a chip writes its stat word into the search, or takes it out
  $('#item-chips').innerHTML = ITEM_CHIPS.map(([l, w]) => `<button class="chip" data-w="${w}" aria-pressed="false">${l}</button>`).join('');
  $('#item-chips').addEventListener('click', e => {
    const c = e.target.closest('.chip'); if (!c) return;
    const q = $('#item-q'), toks = readQuery(q.value), k = STAT_WORD.get(c.dataset.w);
    const on = toks.some(t => !t.part && t.stat?.[0] === k);
    q.value = on ? toks.filter(t => t.part || t.stat?.[0] !== k).map(t => t.text).join(' ') : `${q.value.trim()} ${c.dataset.w}`.trim();
    searching = true; renderItems();
    if (!touched()) q.focus();
  });
  $('#item-roles').addEventListener('click', e => { const r = e.target.closest('[data-role]'); if (r) setItemRole(r.dataset.role); });
  $('#item-read').addEventListener('click', e => {
    const t = e.target.closest('[data-try]'); if (!t) return;
    $('#item-q').value = t.dataset.try; searching = true; renderItems();
    if (!touched()) $('#item-q').focus();
  });
  $('#item-q').addEventListener('input', () => { searching = true; renderItems(); });
  $('#item-q').addEventListener('keydown', e => {
    // Enter picks the best match, or the first item; the down arrow goes into the list
    if (e.key === 'Enter') { const f = $('#item-grid [data-id]'); if (f) choose(+f.dataset.id); }
    if (e.key === 'ArrowDown') { const f = $('#item-grid [data-id]'); if (f) { e.preventDefault(); f.focus(); } }
  });
  $('#item-grid').addEventListener('click', e => {
    const r = e.target.closest('[data-role]'); if (r) { setItemRole(r.dataset.role); return; }
    const p = e.target.closest('[data-id]'); if (p) choose(+p.dataset.id);
  });
  $('#item-grid').addEventListener('mouseover', e => {
    const p = e.target.closest('[data-id]'); if (!p) return;
    const it = S.items.get(+p.dataset.id), shop = shopOf(it), by = found.get(it.id) ? foundBy(found.get(it.id)) : [];
    const about = (by.length ? `${by.join('. ')}. ` : '') + useText(it) + (shop ? `${SHOP[shop]} item. ` : '')
      + (it.status === 'unmodeled' ? 'Stats are counted; its passive is not yet.' : it.plaintext || it.tags.join(', '));
    $('#item-foot').innerHTML = `<b>${esc(it.name)}</b><span class="g">${nf(it.gold)} g</span><span>${esc(about)}</span>`;
  });
  $('#item-grid').addEventListener('mouseleave', footIdle);
  $('#picker').addEventListener('click', e => { const c = e.target.closest('[data-shop]'); if (c) setShop(c.dataset.shop); });
  $('#picker-x').addEventListener('click', closePicker);
  document.addEventListener('mousedown', e => { if (pick && !e.target.closest('#picker') && !e.target.closest('.slot') && !e.target.closest('#shop-now')) closePicker(); });

  $('#champ-btn').addEventListener('click', () => openChamps('atk'));
  $('#enemy-btn').addEventListener('click', () => openChamps('enemy'));
  $('#enemy-swap').addEventListener('click', () => openChamps('enemy'));
  $('#champ-chips').innerHTML = ROLES.map((r, i) => `<button class="chip" data-r="${i}" aria-pressed="${i === 0}">${r}</button>`).join('');
  $('#champ-chips').addEventListener('click', e => {
    const c = e.target.closest('.chip'); if (!c) return;
    role = +c.dataset.r;
    $$('#champ-chips .chip').forEach(x => x.setAttribute('aria-pressed', x === c));
    renderChamps();
  });
  $('#champ-q').addEventListener('input', renderChamps);
  $('#champ-q').addEventListener('keydown', e => { if (e.key === 'Enter') { const f = $('#champ-grid .ct'); if (f) chooseChamp(f.dataset.id); } });
  $('#champ-grid').addEventListener('click', e => { const c = e.target.closest('.ct'); if (c) chooseChamp(c.dataset.id); });
  // start on a champion's own pictures as soon as they are pointed at
  $('#champ-grid').addEventListener('mouseover', e => {
    const c = e.target.closest('.ct');
    if (c && champFor === 'atk') { warm(splashUrl(c.dataset.id)); warm(kitUrl(c.dataset.id)); }
  });
  $('#champ-x').addEventListener('click', closeChamps);
  $('#champ-modal').addEventListener('mousedown', e => { if (e.target.id === 'champ-modal') closeChamps(); });

  const lvl = d => { S.enemy = {...S.enemy, level: Math.max(1, Math.min(18, S.enemy.level + d))}; enemyStats(); };
  $('#el-dn').addEventListener('click', () => lvl(-1));
  $('#el-up').addEventListener('click', () => lvl(1));
  for (const k of ['hp','ar','mr']) {
    const [num, rng] = dial(k);
    num.addEventListener('input', () => { rng.value = num.value; paintTarget(); schedule(true); });
    rng.addEventListener('input', () => { num.value = rng.value; paintTarget(); schedule(true); });
  }
  $('#presets').addEventListener('click', e => {
    const c = e.target.closest('.chip'); if (!c) return;
    const [hp, ar, mr] = c.dataset.preset.split(',').map(Number);
    writeDials({hp, ar, mr}); paintTarget(); schedule();
  });

  $('#share').addEventListener('click', async e => {
    const b = e.currentTarget, s = encodeState(), url = linkFor(s);
    b.textContent = 'Copying…';
    const ok = await copyLater(url);
    // the address becomes the link, as long as the page still shows what it was made from
    if (encodeState() === s) history.replaceState(null, '', await url);
    b.textContent = ok ? 'Link copied' : 'Link is in the address bar';
    setTimeout(() => b.textContent = 'Copy build link', 1600);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (itemMenu) { const k = itemMenu; closeItemMenu(); $(`.slot[data-b="${k.b}"][data-i="${k.i}"] [data-cfg]`)?.focus(); }
      else if (menu) { const b = menu; setMenu(null); b.focus(); }
      else if (!$('#champ-modal').hidden) closeChamps();
      // a search being written is cleared first, and the picker closes on the next press
      else if (pick && searching && $('#item-q').value) { e.preventDefault(); $('#item-q').value = ''; searching = false; renderItems(); }
      else if (AB.for) { const k = AB.for; closeAuto(); $(`[data-auto="${k}"]`)?.focus(); }
      else closePicker();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) || !$('#champ-modal').hidden) return;
    if (e.key === '?') { openIntro(); return; }
    const tab = !RECEIPT && {1:'build', 2:'target', 3:'break', 4:'stats'}[e.key];
    if (tab) { setTab(tab); return; }
    if (e.key.toLowerCase() === 'c') { e.preventDefault(); openChamps('atk'); }
  });
  /* a missing splash leaves the card plain instead of showing a broken-image glyph */
  document.addEventListener('error', e => { if (e.target.tagName === 'IMG') { e.target.style.visibility = 'hidden'; e.target.classList.remove('wait'); } }, true);
  document.addEventListener('load', e => {
    if (e.target.tagName !== 'IMG') return;
    e.target.style.visibility = '';
    e.target.classList.remove('wait');
  }, true);
  wireRemember();
  wireSaved();
}

/* Every control painted from S: at boot, once a link's build is in, and when a saved build is loaded. */
function paintAll() {
  $('#order').value = S.order;
  paintNames();
  document.body.dataset.compare = S.compare ? 'on' : 'off';
  $$('#cmp-seg button').forEach(b => b.setAttribute('aria-checked', (b.dataset.cmp === 'on') === S.compare));
  document.body.dataset.target = S.target;
  $$('#tseg button').forEach(b => b.setAttribute('aria-checked', b.dataset.t === S.target));
  writeDials(S.dummy);

  $$('#crit-seg button').forEach(b => b.setAttribute('aria-checked', b.dataset.crit === S.crits));
  $$('#shop .chip[data-shop]').forEach(c => c.setAttribute('aria-pressed', !!S.shops[c.dataset.shop]));
  paintLevel(); paintSkills(); paintChamp(); renderBuilds(); renderLines(); renderSteps(); paintTarget();
  if (S.target === 'champ') enemyStats();
}

async function boot() {
  buildRuler(); wire();
  // the built site carries the art index in the page; the dev server leaves it to be fetched
  const inline = $('#art-index');
  const [meta, champs, items, art] = await Promise.all([api('/meta'), api('/champions'), api('/items'),
    inline ? JSON.parse(inline.textContent) : fetch('/art/index.json').then(r => r.json())]);
  useArt(art);
  $('#patch').textContent = meta.displayPatch;
  $('#legal-text').textContent = meta.legal;
  served = meta;
  S.champs = champs.map(c => ({id: c.id, key: c.key, name: c.name, title: c.title, tags: c.tags || [], ranged: !!c.ranged, critDamage: c.stats?.critDamage, slug: c.slug}))
    .sort((x, y) => x.name.localeCompare(y.name));
  S.items = new Map(items.map(i => [i.id, i]));
  S.champ = S.champs.find(c => c.id === S.champ.id) || S.champs[0];
  startOnPageChamp();

  restore();
  followChamp();
  const tab = /[#&]tab=(build|target|break|stats)\b/.exec(location.hash);
  if (tab && !RECEIPT) setTab(tab[1]);
  paintAll(); renderSaved();
  // a first visit: the welcome comes in over the page once the page is there to be seen behind it
  if (introDue()) setTimeout(() => openIntro(true), 450);
  await loadKit();
}
boot().catch(e => {
  const q = $('#quality');
  q.hidden = false; q.className = 'wf warn'; q.textContent = 'Could not load game data'; q.title = e.message;
});
})();

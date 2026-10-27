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
  enemy: {id:'Ornn', name:'Ornn', level:13},
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

const ITEM_FILTERS = [
  ['All', null], ['Attack damage',['Damage']], ['Ability power',['SpellDamage']], ['Attack speed',['AttackSpeed']],
  ['Crit',['CriticalStrike']], ['On-hit',['OnHit']], ['Penetration',['ArmorPenetration','MagicPenetration']],
  ['Haste',['AbilityHaste','CooldownReduction']], ['Defense',['Health','Armor','SpellBlock']], ['Boots',['Boots']],
];
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
function targetBody() {
  if (S.target === 'raw') return null;
  const v = readDials();
  return {hp: v.hp, armor: v.ar, mr: v.mr};
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
    paintResults();
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
  if (t !== 'build') closePicker();
}
function paintTabs() {
  if (RECEIPT) return;
  const na = S.builds.a.filter(Boolean).length, nb = S.builds.b.filter(Boolean).length, v = readDials(), e = S.enemy;
  $('#ts-build').textContent = `${S.champ.name}, level ${S.level}, ` + (S.compare ? `${na} and ${nb} items${S.split ? ', ranks per build' : ''}` : `${na} items`);
  $('#ts-target').textContent = S.target === 'raw' ? 'None, raw output'
    : `${S.target === 'dummy' ? 'Dummy' : e.name + ' Lv ' + e.level}, ${nf(v.hp)} HP, ${v.ar} armor, ${v.mr} MR`;
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
    $('#r-target').textContent = t === 'raw' ? 'None' : t === 'dummy' ? `Dummy, ${stats}` : `${e.name} Lv ${e.level}, ${stats}`;
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
let pick = null, itemFilter = 0;
function renderBuilds() {
  const sets = {a: new Set(S.builds.a.filter(Boolean)), b: new Set(S.builds.b.filter(Boolean))};
  for (const k of ['a','b']) {
    const other = sets[k === 'a' ? 'b' : 'a'], row = $(`.build[data-b="${k}"]`), K = k.toUpperCase();
    $('.slots', row).innerHTML = S.builds[k].map((id, i) => {
      const sel = pick && pick.b === k && pick.i === i ? ' sel' : '';
      if (!id) return `<div class="slot empty${sel}" role="button" tabindex="0" data-b="${k}" data-i="${i}" aria-label="Build ${K}, slot ${i + 1}, empty"></div>`;
      const it = S.items.get(id), name = esc(it?.name || 'Item ' + id), shop = shopOf(it);
      return `<div class="slot${other.has(id) ? '' : ' uniq'}${sel}" role="button" tabindex="0" data-b="${k}" data-i="${i}" title="${name}${shop ? `, ${SHOP[shop]} item` : ''}" aria-label="Build ${K}, slot ${i + 1}, ${name}">${itemIco(id)}${badge(it)}${cfgBtn(k, i, it)}<button class="rm" data-rm aria-label="Remove ${name}">×</button></div>`;
    }).join('');
    $('.b-gold b', row).textContent = nf(S.builds[k].reduce((s, id) => s + (S.items.get(id)?.gold || 0), 0));
  }
  const now = $('#shop-now');
  if (now) {
    const on = Object.keys(S.shops).filter(m => S.shops[m]);
    now.textContent = on.length ? `Summoner's Rift + ${on.map(m => SHOP[m]).join(' + ')}` : "Summoner's Rift items";
    $('#items-hint').textContent = !S.compare ? 'Click a slot to change it'
      : S.split ? 'Both builds use the champion and level above; ranks are per build. Underlined items differ.'
      : 'Both builds use the champion, level and ranks above. Underlined items differ.';
  }
  paintTabs();
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
  $('#picker-for').innerHTML = `<span class="tag ${pick.b} sm">${pick.b.toUpperCase()}</span>Slot ${pick.i + 1}`;
}
function openPicker(b, i) {
  closeItemMenu();
  pick = {b, i};
  $('#picker').hidden = false;
  pickerLabel(); renderBuilds();
  const q = $('#item-q'); q.value = ''; renderItems(); q.focus();
}
function closePicker() {
  if (!pick) return;
  pick = null; $('#picker').hidden = true; renderBuilds();
}
function footIdle() { $('#item-foot').innerHTML = '<span>Hover an item for details. Enter picks the first result.</span>'; }
function renderItems() {
  const q = $('#item-q').value.trim().toLowerCase(), f = ITEM_FILTERS[itemFilter][1];
  const match = it => (!q || it.name.toLowerCase().includes(q)) && (!f || it.tags.some(t => f.includes(t)));
  const sold = (it, m) => (it.shops || ['sr']).includes(m);
  const all = [...S.items.values()].filter(match).sort((x, y) => x.name.localeCompare(y.name));
  const cell = it => `<button class="pi" data-id="${it.id}" aria-label="${esc(it.name)}, ${nf(it.gold)} gold${shopOf(it) ? ', ' + SHOP[shopOf(it)] : ''}">${itemIco(it.id)}${badge(it)}</button>`;
  const sr = all.filter(i => sold(i, 'sr'));
  const fin = sr.filter(i => !i.component), comp = sr.filter(i => i.component);
  let html = (fin.length ? `<div class="grp">Finished items</div>${fin.map(cell).join('')}` : '')
    + (comp.length ? `<div class="grp">Components</div>${comp.map(cell).join('')}` : '');
  // an added shop lists what the Rift does not sell: its own items, and its copies of Rift items
  const shown = new Set(sr), missed = [];
  for (const m of ADDABLE) {
    const list = all.filter(i => !shown.has(i) && sold(i, m));
    if (!list.length) continue;
    if (!S.shops[m]) { missed.push(m); continue; }
    list.forEach(i => shown.add(i));
    html += `<div class="grp">${SHOP[m]} <em>its own items and its copies of Rift items</em></div>${list.map(cell).join('')}`;
  }
  if (!sr.length && missed.length) html = `<div class="miss">No Summoner's Rift item matches. The ${missed.map(m => SHOP[m]).join(' and ')} shop${missed.length > 1 ? 's have' : ' has'} some: ${missed.map(m => `<button class="chip" data-shop="${m}">+ ${SHOP[m]}</button>`).join('')}</div>` + html;
  $('#item-grid').innerHTML = html || '<div class="grp">No items match</div>';
  footIdle();
}
function choose(id) {
  if (!pick) return;
  S.builds[pick.b][pick.i] = id;
  const next = S.builds[pick.b].findIndex((v, j) => !v && j > pick.i);
  if (next > -1) { pick.i = next; pickerLabel(); renderBuilds(); const q = $('#item-q'); q.select(); q.focus(); }
  else closePicker();
  schedule();
}

/* ---------- an item's settings ---------- */
/* An item whose passive stacks, procs or has an active carries a small button on its slot. It opens a
   menu with what one firing of each of its effects deals, as the last calculation found, and the item's
   settings: a toggle, stacks, uses of the active, or a proc's count in the combo (left unset, the combo
   decides). Settings are per build; the API takes them as itemOptions. */
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
/* One effect: what one firing deals after the target's resistances (before them in raw output), and how
   often it fired in the combo. A proc the user counts has its stepper on the same line. */
function effectRow(it, e, R, k) {
  const raw = S.target === 'raw', shown = R?.items.find(x => x.id === it.id)?.effects.find(x => x.id === e.id);
  const val = shown && (raw ? shown.one.raw : shown.one.dealt), ctl = it.controls?.find(c => c.rule === e.id);
  const amount = val === undefined ? '–' : nf(val);
  // what it added up to in the combo: a burn kept alive pays per second, so this is not always one firing times the count
  const part = R?.combo.lines.find(l => l.key === 'items')?.parts.filter(p => p.id === `item:${it.id}/${e.id}`);
  const total = part?.reduce((s, p) => s + (raw ? p.total.raw : p.total.dealt), 0) || 0;
  const sum = shown ? `${ctl ? '' : `${shown.fired}× · `}${total ? nf(total) : '0'} in the combo` : '';
  // a share of missing health, an execute: nothing against a target at full health
  const note = shown && val === 0 ? '<em>nothing against a target at full health</em>' : '';
  return `<div class="ie"><div class="ie-h"><b>${esc(e.label)}</b><span class="ie-t ${e.type}">${TYPE_NAME[e.type] || e.type}</span></div>
    <div class="ie-v"><span class="ie-n"><i>${amount}</i>each${ctl?.kind === 'uses' ? ' use' : ''}, ${raw ? 'raw' : 'after resistances'}</span>
    <span class="ie-f">${sum}</span>${note}</div>
    ${ctl ? controlRow(it, ctl, R, k, shown) : ''}</div>`;
}
/* A setting. Its value is what the user set, else what the last calculation used (a default can depend on the build). */
function controlRow(it, c, R, k, effect) {
  const mine = S.itemOpts[k][it.id]?.[c.id], used = R?.items.find(x => x.id === it.id)?.settings?.[c.id];
  const v = mine ?? used, id = `io-${k}-${it.id}-${c.id}`;
  if (c.kind === 'bool') {
    return `<label class="ic" for="${id}"><span>${esc(c.label)}</span><input type="checkbox" id="${id}" data-c="${esc(c.id)}"${v ? ' checked' : ''}></label>`;
  }
  const auto = c.kind === 'procs' && mine === undefined, n = auto ? (effect?.fired ?? 0) : (v ?? 0);
  const label = c.kind === 'procs' ? 'In the combo' : c.kind === 'uses' ? 'Uses in the combo' : esc(c.label);
  // a count of procs or uses has a cap only to keep requests small; stacks have the game's own limit
  const max = c.kind === 'int' && c.max !== undefined ? `<small>of ${c.max}</small>` : '';
  return `<div class="ic${auto ? ' auto' : ''}"><span>${label}</span><span class="stp">
      <button data-c="${esc(c.id)}" data-d="-1" aria-label="One fewer: ${esc(c.label)}"${n <= (c.min ?? 0) ? ' disabled' : ''}>−</button>
      <output>${auto ? `<em>auto</em>${n}` : n}</output>
      <button data-c="${esc(c.id)}" data-d="1" aria-label="One more: ${esc(c.label)}"${c.max !== undefined && n >= c.max ? ' disabled' : ''}>+</button>${max}</span>
    ${c.kind === 'procs' || c.kind === 'uses' ? (mine === undefined ? '' : `<button class="act" data-reset="${esc(c.id)}" title="${c.kind === 'procs' ? 'Let the combo decide' : 'Back to the default'}">${c.kind === 'procs' ? 'Auto' : 'Reset'}</button>`) : ''}</div>`;
}
function paintItemMenu() {
  const el = $('#item-menu');
  if (!itemMenu || !el) return;
  const {b: k, id} = itemMenu, it = S.items.get(id), R = S.res?.[k];
  if (!it) return closeItemMenu();
  const states = (it.controls || []).filter(c => !c.rule);
  // an effect without a firing in this build is still listed: its proc may be set by hand
  const effects = (it.effects || []).map(e => effectRow(it, e, R, k)).join('');
  const lone = (it.controls || []).filter(c => c.rule && !(it.effects || []).some(e => e.id === c.rule));
  const set = Object.keys(S.itemOpts[k][id] || {}).length;
  el.innerHTML = `<div class="im-head"><span class="im-ico">${itemIco(id)}</span><div><b>${esc(it.name)}</b>
      <span class="hint">${S.compare ? `<span class="tag ${k} xs">${k.toUpperCase()}</span> ` : ''}Slot ${itemMenu.i + 1}${R ? '' : ', calculating…'}</span></div>
      <button class="esc" data-close aria-label="Close">Esc</button></div>
    ${effects ? `<div class="im-sec"><span class="lbl">Effects</span>${effects}</div>` : ''}
    ${lone.length ? `<div class="im-sec">${lone.map(c => controlRow(it, c, R, k)).join('')}</div>` : ''}
    ${states.length ? `<div class="im-sec"><span class="lbl">Going into the combo</span>${states.map(c => controlRow(it, c, R, k)).join('')}</div>` : ''}
    ${it.notes?.length ? `<div class="im-notes">${it.notes.map(n => `<p>${esc(n)}</p>`).join('')}</div>` : ''}
    ${set ? '<div class="im-foot"><button class="act" data-reset-all>Reset all</button></div>' : ''}`;
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
function showTip(el) {
  const k = el.dataset.ab, tip = $('#tip');
  if (!tip || !k) return;
  tipAt = el;
  tip.innerHTML = abilityCard(k);
  tip.hidden = false;
  const r = el.getBoundingClientRect(), m = tip.getBoundingClientRect(), gap = 8;
  // inside a dropdown the card sits beside it, so the rest of the list stays in view
  const menuBox = el.closest('.menu')?.getBoundingClientRect();
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
function paintTip() { if (tipAt?.isConnected) showTip(tipAt); else hideTip(); }
function wireTip() {
  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-ab]');
    if (el && el !== tipAt) showTip(el); else if (!el && tipAt) hideTip();
  });
  document.addEventListener('focusin', e => { const el = e.target.closest('[data-ab]'); if (el) showTip(el); else if (tipAt) hideTip(); });
  document.addEventListener('scroll', hideTip, true);
  // clicking a rank pip keeps the card, which then shows the new rank's numbers
  document.addEventListener('mousedown', e => { if (tipAt && !tipAt.contains(e.target)) hideTip(); });
}

/* ---------- champion picker ---------- */
let champFor = 'atk', role = 0;
function openChamps(who) {
  champFor = who; closePicker(); setMenu(null);
  $('#cm-title').textContent = who === 'atk' ? 'Choose a champion' : 'Choose the target';
  $('#champ-modal').hidden = false;
  const q = $('#champ-q'); q.value = ''; renderChamps(); q.focus();
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
  else { S.enemy = {id: c.id, name: c.name, level: S.enemy.level}; enemyStats(); }
}

/* ---------- target ---------- */
const dial = k => [$(`#t-${k}`), $(`#t-${k}-r`)];
function readDials() { return {hp: Math.max(1, +$('#t-hp').value || 1), ar: +$('#t-ar').value || 0, mr: +$('#t-mr').value || 0}; }
function writeDials(v) { for (const k of ['hp','ar','mr']) dial(k).forEach(el => el.value = v[k]); }
async function enemyStats() {
  const e = S.enemy;
  $('#auto-note').textContent = `Base stats at level ${e.level}. Edit to override.`;
  paintTarget();
  try {
    const t = await api(`/champions/${encodeURIComponent(e.id)}/target?level=${e.level}`);
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
    const when = {never: ', no crits', always: ', all crits'}[r?.combo.crits] || '';
    $(`#h-cap-${k}`).innerHTML = !r ? '' : (raw ? 'Before armor and magic resist'
      : r.combo.kills ? `<b>Kills</b> the target, ${nf(v.hp)} HP` : `<b>${Math.round(share)}%</b> of the target's ${nf(v.hp)} HP`) + when;
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
/* How a build's crit chance is made: what its items give, and what the champion's kit makes of it. */
function chanceWhy(k, R) {
  const items = buildItems(k).reduce((s, it) => s + (it.stats?.critChance || 0), 0), total = R.stats.critChance;
  if (!items && !total) return 'No crit chance';
  if (Math.abs(items - total) < 0.0005) return `Crit chance: ${pct(items)} from items`;
  return `Crit chance: ${pct(items)} from items, ${pct(total)} with ${S.champ.name}'s kit${total >= 1 && items < 1 ? ' (at most 100%)' : ''}`;
}
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
/* The Breakdown's side column on crits: each build's chance and multiplier, and which sources can crit. */
function critSide(A, B) {
  const of = (r, k) => r?.combo.lines.find(l => l.key === k);
  const can = [], cannot = [];
  for (const k of LINES) {
    const a = of(A, k), b = of(B, k);
    if (!a) continue;
    if (a.crits || b?.crits) can.push(lineLabel(k)[1]);
    else if (a.total.raw || b?.total.raw) cannot.push(lineLabel(k)[1]);
  }
  if (!can.length) return '';
  const cb = (k, R) => `<div class="cb"><span class="tag ${k} sm">${k.toUpperCase()}</span><span><b>${pct(R.stats.critChance)}</b> chance, crits deal <b>${pct(R.stats.critDamage, 1)}</b></span><p>${esc(chanceWhy(k, R))}. ${esc(multWhy(k, R))}.</p></div>`;
  return `<div class="bs"><span class="lbl">Crits</span>${cb('a', A)}${B ? cb('b', B) : ''}
    <div class="notes"><p><b>Can crit:</b> ${esc(can.join(', '))}.</p>${cannot.length ? `<p><b>Can't crit:</b> ${esc(cannot.join(', '))}.</p>` : ''}
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
  const da = A.dps.dealt, db = B.dps.dealt;
  if (Math.round(da) !== Math.round(db)) {
    const w = da > db ? 'a' : 'b', p = pc(Math.max(da, db), Math.min(da, db));
    const ta = A.timeToKill, tb = B.timeToKill, sooner = ta !== null && tb !== null ? Math.abs(ta - tb) : null;
    say[w].push(`<b>Long fights.</b> ${p === null ? 'More' : '+' + p + '%'} DPS${sooner ? `, kills ${sooner.toFixed(1)} s sooner` : ''}`);
  }
  return ['a', 'b'].map(k => `<div class="vd"><span class="tag ${k} sm">${k.toUpperCase()}</span><p>${say[k].join('. ') || 'Behind on this combo and in long fights'}</p></div>`).join('');
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
function paintSide() {
  const A = S.res.a, B = S.compare ? S.res.b : null, raw = S.target === 'raw', notes = assumptions();
  $('#bside').innerHTML = `${critSide(A, B)}
    <div class="bs"><span class="lbl">Damage mix</span>${mixRow('a', A)}${B ? mixRow('b', B, true) : ''}</div>
    <div class="bs"><span class="lbl">Blocked by the target</span>
      <div class="pair">
        <span class="mv a"><span class="tag a sm only-cmp">A</span><i>${raw ? '–' : nf(A.combo.blocked)}</i></span>
        ${B ? `<span class="mv b only-cmp"><span class="tag b sm">B</span><i>${raw ? '–' : nf(B.combo.blocked)}</i></span>` : ''}
      </div><span class="hint">Damage lost to armor and magic resist</span></div>
    ${B ? `<div class="bs only-cmp"><span class="lbl">Where each build wins</span>${verdicts(A, B)}</div>` : ''}
    ${notes.length ? `<div class="bs"><span class="lbl">What these numbers assume</span><div class="notes">${notes.map(n => `<p>${esc(n)}</p>`).join('')}</div></div>` : ''}`;
}
const killTime = r => !r || S.target === 'raw' || r.timeToKill === null ? '–' : r.timeToKill.toFixed(1) + ' s';

/* ---------- hero ---------- */
function paintHero() {
  const A = S.res.a, B = S.compare ? S.res.b : null, raw = S.target === 'raw';
  const ta = A.combo.total.dealt, tb = B ? B.combo.total.dealt : 0;
  $('.tot.a .tot-n i').textContent = nf(ta);
  $('.tot.b .tot-n i').textContent = B ? nf(tb) : '–';
  $('.tot.a').classList.toggle('win', !B || ta >= tb);
  $('.tot.b').classList.toggle('win', !!B && tb > ta);
  paintGlance(A, B);
  const [dps, ttk] = $$('.metric');
  const put = (box, k, text, win) => { const el = $(`.mv.${k}`, box); $('i', el).textContent = text; el.classList.toggle('win', win); };
  const da = A.dps.dealt, db = B ? B.dps.dealt : 0;
  put(dps, 'a', nf(da), !B || da >= db);
  put(dps, 'b', B ? nf(db) : '–', !!B && db > da);
  const ka = A.timeToKill ?? Infinity, kb = B ? B.timeToKill ?? Infinity : Infinity;
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
  const da = A.dps.dealt, db = B ? B.dps.dealt : 0;
  put($('.n.a', dps), nf(da), !!B && da > db);
  put($('.n.b', dps), B ? nf(db) : '–', !!B && db > da);
  const ka = A.timeToKill ?? Infinity, kb = B ? B.timeToKill ?? Infinity : Infinity;
  put($('.n.a', ttk), killTime(A), !raw && !!B && ka < kb);
  put($('.n.b', ttk), killTime(B), !raw && !!B && kb < ka);
  $('#verdict').innerHTML = B ? verdicts(A, B) : '';
  // a verdict is one line on the slip; the full sentence is its tooltip when it is cut short
  for (const p of $$('#verdict p')) p.title = p.textContent;
  const notes = assumptions(), fine = $('#r-notes');
  fine.textContent = notes.length ? `${notes.length} assumption${notes.length === 1 ? '' : 's'}, hover to read` : '';
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
/* The tabs page's More stats: every stat the calculation returns, as [label, value, format, note]. */
const n0 = v => nf(v), p0 = v => pct(v), p1 = v => pct(v, 1), as2 = v => v.toFixed(2);
const baseNote = l => l.bonus ? `${nf(l.base)} base + ${nf(l.bonus)}` : `base at level ${S.level}`;
const MORE = [
  ['Offense', [
    ['Attack damage', s => s.ad.total, n0, s => baseNote(s.ad)],
    ['Ability power', s => s.ap.total, n0, s => s.ap.total ? 'all of it bonus' : 'none'],
    ['Attack speed', s => s.attackSpeed.total, as2, s => `${s.attackSpeed.base} base, +${Math.round(s.attackSpeed.bonus * 100)}%`],
    ['Crit chance', s => s.critChance, p0, s => s.critChance ? 'chance a hit that can crit does' : 'none'],
    ['Crit damage', s => s.critDamage, p1, () => 'what a crit deals'],
    ['Attack range', s => s.attackRange, n0, () => S.champ.ranged ? 'ranged' : 'melee'],
  ]],
  ['Penetration and tempo', [
    ['Lethality', s => s.lethality, n0, s => s.lethality ? 'flat armor penetration' : 'none'],
    ['Armor penetration', s => s.armorPenPct, p0, s => s.armorPenPct ? 'percent' : 'none'],
    ['Magic penetration', s => s.magicPenFlat, n0, s => s.magicPenFlat ? 'flat' : 'none'],
    ['Magic penetration %', s => s.magicPenPct, p0, s => s.magicPenPct ? 'percent' : 'none'],
    ['Ability haste', s => s.abilityHaste, n0, s => s.abilityHaste ? `${Math.round(s.abilityHaste / (100 + s.abilityHaste) * 100)}% shorter cooldowns` : 'none'],
    ['Move speed', s => s.moveSpeed.total, n0, s => baseNote(s.moveSpeed)],
  ]],
  ['Health and sustain', [
    ['Health', s => s.hp.total, n0, s => baseNote(s.hp)],
    ['Mana', s => s.mana.total, v => v ? nf(v) : '–', s => s.mana.total ? baseNote(s.mana) : 'no mana'],
    ['Armor', s => s.armor.total, n0, s => baseNote(s.armor)],
    ['Magic resist', s => s.mr.total, n0, s => baseNote(s.mr)],
    ['Life steal', s => s.lifeSteal, p0, s => s.lifeSteal ? 'on attacks' : 'none'],
    ['Omnivamp', s => s.omnivamp, p0, s => s.omnivamp ? 'on all damage' : 'none'],
  ]],
];
function renderStats() {
  const A = S.res.a, B = S.compare ? S.res.b : null, sa = A.stats, sb = B?.stats;
  let diff = 0, all = 0;
  $('#more-grid').innerHTML = MORE.map(([group, rows]) => {
    const head = B
      ? `<div class="srow shead"><span class="lbl">${group}</span><span class="tag a xs">A</span><span class="tag b xs">B</span><span class="lbl">Gap</span></div>`
      : `<div class="srow shead"><span class="lbl">${group}</span><span></span><span></span></div>`;
    return `<div>${head}${rows.map(([label, get, fmt, note]) => {
      all++;
      const a = get(sa);
      if (!B) return `<div class="srow"><span class="sn">${label}</span><span class="n">${fmt(a)}</span><span class="note">${esc(note(sa))}</span></div>`;
      const b = get(sb);
      // compared as shown: two numbers that read the same are the same
      if (fmt(a) === fmt(b)) return `<div class="srow same"><span class="sn">${label}</span><span class="n">${fmt(a)}</span><span class="n">${fmt(b)}</span><span class="g">same</span></div>`;
      diff++;
      const w = a > b ? 'a' : 'b';
      return `<div class="srow"><span class="sn">${label}</span><span class="n${w === 'a' ? ' win' : ''}">${fmt(a)}</span><span class="n${w === 'b' ? ' win' : ''}">${fmt(b)}</span><span class="g ${w}">+${fmt(Math.abs(a - b))}</span></div>`;
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
      + (up.map(([label, get, fmt]) => `<div class="ah-row"><b>+${fmt(get(s) - get(o))}</b><span>${label}</span></div>`).join('')
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

/* ---------- share link ---------- */
function encodeState() {
  const s = {c: S.champ.id, l: S.level, r: SLOTS.map(k => S.ranks[k]), o: S.order, a: S.builds.a, b: S.builds.b, n: [$('#name-a').value, $('#name-b').value],
    m: S.compare ? 1 : 0, t: S.target, d: S.target === 'raw' ? S.dummy : readDials(), e: [S.enemy.id, S.enemy.level], q: ACTIONS.map(k => S.combo[k]),
    ...(Object.keys(S.options).length && {x: S.options}),
    ...(S.crits !== 'average' && {k: S.crits}),
    ...(S.split && {rb: SLOTS.map(k => S.ranksB[k]), ob: S.orderB}),
    ...(ADDABLE.some(m => S.shops[m]) && {sh: ADDABLE.filter(m => S.shops[m])})};
  const io = {a: itemOptsOf('a'), b: itemOptsOf('b')};
  if (Object.keys(io.a).length || Object.keys(io.b).length) s.io = io;
  return btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/* A build arrives in the link, or from the other layout's page when the visitor has just swapped. */
function decodeState() {
  let text = null;
  try { text = sessionStorage.getItem('carry'); sessionStorage.removeItem('carry'); } catch (e) {}
  text ||= /[#&]s=([\w-]+)/.exec(location.hash)?.[1];
  if (!text) return null;
  try { return JSON.parse(decodeURIComponent(escape(atob(text.replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return null; }
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
  if (e) S.enemy = {id: e.id, name: e.name, level: int(s.e[1], 1, 18, 13)};
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

/* ---------- the introduction ---------- */
/* A first visit opens a welcome: what the site is for, and its three steps drawn from what is on the page
   behind it (the champion, the builds, what each deals). From there a short tour shows the page one part at
   a time. The veil over the page is the shadow of a hole: on the welcome the hole is the card itself, on
   the tour it is the part being shown, and it glides from one stop to the next. A click inside the hole goes
   through to the page and ends the tour, and so does a click outside it. Once closed it stays closed in this
   browser; the ? in the top bar, or the ? key, brings it back. Inside a frame (the promo video's stage) it
   never opens by itself. */
const INTRO_KEY = 'intro';
let intro = null;                   // {step: -1 on the welcome, else the tour's stop; auto: a first visit opened it; back, scroll: where focus and the page return to; shown; timer}
const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize);
const val = x => typeof x === 'function' ? x() : x;
const allChamps = () => S.champs.length ? `all ${S.champs.length}` : 'every champion';
const comboNow = () => ACTIONS.some(k => S.combo[k]) ? `<b>${esc(comboText())}</b>` : '<b>empty</b>';
const buildsText = () => (S.compare
  ? 'Click a slot to choose an item. A and B share the champion and level, so the items are the only difference; the ones that differ are underlined.'
  : 'Click a slot to choose an item. Add a second build to compare the two side by side.')
  + ($('.slot .cfg:not(.info)') ? ' The round button on an item sets its stacks or active.' : '');
/* Where the tour stops: the parts of the page it shows (one hole around all of them), and the side of the
   hole its card goes on when there is room. */
const STOPS = RECEIPT ? [
  {at: ['#champ-btn', '.lvl', '.skills'], title: 'Your champion',
    text: () => `Click the name, or press <span class="key">C</span>, to choose from ${allChamps()}. Set the level on the ruler; ability ranks follow the <b>max order</b>, or click a pip to set one yourself.`},
  {at: ['#builds'], side: 'above', title: () => S.compare ? 'Two builds, A and B' : 'Your build', text: buildsText},
  {at: ['.tgt'], side: 'left', title: "Who you're hitting",
    text: 'A <b>target dummy</b> with the health, armor and magic resist you set, or a real <b>enemy champion</b> at its level. The bars show the health each build leaves it.'},
  {at: ['.till'], side: 'right', title: 'The receipt',
    text: 'Every ability, auto attack and item effect in the combo, itemized, with the bigger number highlighted. <b>DPS</b> and <b>time to kill</b> say who wins a longer fight. Type in the <b>Qty</b> column to change the combo.'},
  {at: ['.ledger'], side: 'above', title: 'Every stat',
    text: () => `${S.compare ? "Both builds' stats, side by side" : "Your build's stats"}. When you're done, <b>Copy build link</b> at the top shares the whole setup.`},
] : [
  {at: ['.setup'], title: 'Your champion',
    text: () => `Click the champion, or press <span class="key">C</span>, to choose from ${allChamps()}. Set the level on the ruler; ability ranks follow the <b>max order</b>, or click a pip to set one yourself.`},
  {at: ['#builds > .sec-head', '#builds .build', '#add-b'], side: 'above', title: () => S.compare ? 'Two builds, A and B' : 'Your build', text: buildsText},
  {at: ['#tseg'], title: "Who you're hitting",
    text: 'A <b>target dummy</b> with the health, armor and magic resist you set, or a real <b>enemy champion</b> at its level. <b>Raw output</b> is the damage before either. The numbers are in the <b>Target</b> tab.'},
  {at: ['.totals', '.hero-side'], title: 'Who hits harder',
    text: () => `What the combo deals to the target, and the share of its health that is. <b>DPS</b> and <b>time to kill</b> say who wins a longer fight. The combo, top left, is ${comboNow()}; its pencil changes it.`},
  {at: ['.tab'], title: 'Every number, explained',
    text: '<b>Breakdown</b> splits the damage by source and <b>More stats</b> lists every stat; keys <span class="key">1</span> to <span class="key">4</span> switch tabs. <b>Copy build link</b>, top right, shares the whole setup.'},
];
function introDue() {
  if (self !== top) return false;
  try { return !localStorage.getItem(INTRO_KEY); } catch (e) { return false; }
}
function helloHtml() {
  const shared = intro.auto && /[#&]s=/.test(location.hash), ks = S.compare ? ['a', 'b'] : ['a'];
  const items = k => [...S.builds[k].filter(Boolean), null, null, null, null].slice(0, 4)
    .map(id => `<span class="in-it${id ? '' : ' empty'}">${id ? itemIco(id) : ''}</span>`).join('');
  const tag = k => `<span class="tag ${k} xs">${k.toUpperCase()}</span>`;
  return `<img class="in-art wait" alt="">
    <div class="in-top">
      <span class="in-eyebrow">${shared ? 'Someone shared a build with you' : 'Welcome to itemize.lol'}</span>
      <h2 class="in-h" id="in-h">Which build<br><mark>hits harder?</mark></h2>
      <p class="in-lede" id="in-lede">Put two League of Legends item builds side by side and see the damage each one really deals: every ability, auto attack and item effect, after the target's armor and magic resist.</p>
    </div>
    <ol class="in-steps">
      <li><div class="in-pic in-champ"><span class="in-face">${champIco(S.champ.id)}</span><span class="in-who"><b>${esc(S.champ.name)}</b><small>Level ${S.level}</small></span></div>
        <b><i>1</i>Pick a champion</b><span>Any of ${S.champs.length || 'them'}, at any level</span></li>
      <li><div class="in-pic">${ks.map(k => `<div class="in-row">${tag(k)}${items(k)}</div>`).join('')}</div>
        <b><i>2</i>${S.compare ? 'Fill two builds' : 'Fill a build'}</b><span>Click a slot, choose an item</span></li>
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
  const me = intro = {step: -1, auto: !!auto, back: document.activeElement, scroll: [scrollX, scrollY], shown: false};
  const root = $('#intro');
  root.className = 'intro hello';
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
/* A stop's hole: around everything it shows, with a little room, and kept inside the window. */
function holeAt(s) {
  const boxes = s.at.flatMap(q => $$(q)).filter(el => el.getClientRects().length).map(el => el.getBoundingClientRect());
  const m = 4, pad = remPx() * .55;
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
/* Puts the hole and the card where they belong now. `still` is for the window moving under them (a resize, a
   scroll): they jump there instead of gliding. */
function placeIntro(still) {
  const root = $('#intro');
  if (!intro || !root) return;
  const card = $('.in-card', root), hole = $('.in-hole', root), m = remPx() / 2;
  if (still) root.classList.add('still');
  let h;
  if (intro.step < 0) {
    const w = card.offsetWidth, ht = card.offsetHeight, x = Math.max(m, (innerWidth - w) / 2), y = Math.max(m, (innerHeight - ht) / 2);
    card.style.left = `${x}px`; card.style.top = `${y}px`;
    h = {l: x, t: y, r: x + w, b: y + ht};
    $('.in-catch', root).style.clipPath = '';
  } else {
    h = holeAt(STOPS[intro.step]);
    // the clicks outside the hole are caught; the ones inside reach the page
    $('.in-catch', root).style.clipPath = `polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,${h.l}px ${h.t}px,${h.l}px ${h.b}px,${h.r}px ${h.b}px,${h.r}px ${h.t}px,${h.l}px ${h.t}px)`;
    if (!card.classList.contains('out')) placeCard(card, h, STOPS[intro.step]);
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
  root.className = 'intro tour';
  card.classList.add('out');
  $(STOPS[i].at[0])?.scrollIntoView({block: 'nearest', inline: 'nearest'});
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
    const s = STOPS[i], last = i === STOPS.length - 1, next = $('[data-in="next"]', card);
    $('.st-n', card).textContent = `${i + 1} / ${STOPS.length}`;
    $$('.st-segs i', card).forEach((el, j) => el.classList.toggle('on', j <= i));
    $('#in-t').textContent = val(s.title);
    $('#in-p').innerHTML = val(s.text);
    $('[data-in="back"]', card).hidden = !i;
    next.innerHTML = last ? 'Start building' : 'Next <span class="key">→</span>';
    placeCard(card, holeAt(s), s);
    card.classList.remove('out');
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
  document.addEventListener('scroll', e => { if (!e.target.closest?.('#intro')) placeIntro(true); }, true);
}

/* ---------- wiring ---------- */
function wire() {
  wireTip(); wireIntro();
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
  builds.addEventListener('keydown', e => {
    const slot = e.target.closest('.slot');
    if (slot && e.target === slot && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPicker(slot.dataset.b, +slot.dataset.i); }
  });
  $('#item-chips').innerHTML = ITEM_FILTERS.map(([l], i) => `<button class="chip" data-f="${i}" aria-pressed="${i === 0}">${l}</button>`).join('');
  $('#item-chips').addEventListener('click', e => {
    const c = e.target.closest('.chip'); if (!c) return;
    itemFilter = +c.dataset.f;
    $$('#item-chips .chip').forEach(x => x.setAttribute('aria-pressed', x === c));
    renderItems();
  });
  $('#item-q').addEventListener('input', renderItems);
  $('#item-q').addEventListener('keydown', e => { if (e.key === 'Enter') { const f = $('#item-grid .pi'); if (f) choose(+f.dataset.id); } });
  $('#item-grid').addEventListener('click', e => { const p = e.target.closest('.pi'); if (p) choose(+p.dataset.id); });
  $('#item-grid').addEventListener('mouseover', e => {
    const p = e.target.closest('.pi'); if (!p) return;
    const it = S.items.get(+p.dataset.id), shop = shopOf(it);
    const about = (shop ? `${SHOP[shop]} item. ` : '') + (it.status === 'unmodeled' ? 'Stats are counted; its passive is not yet.' : it.plaintext || it.tags.join(', '));
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
    const b = e.currentTarget, url = `${location.origin}${location.pathname}#s=${encodeState()}`;
    history.replaceState(null, '', url);
    let ok = true;
    try { await navigator.clipboard.writeText(url); } catch (err) { ok = false; }
    b.textContent = ok ? 'Link copied' : 'Link is in the address bar';
    setTimeout(() => b.textContent = 'Copy build link', 1600);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (itemMenu) { const k = itemMenu; closeItemMenu(); $(`.slot[data-b="${k.b}"][data-i="${k.i}"] [data-cfg]`)?.focus(); }
      else if (menu) { const b = menu; setMenu(null); b.focus(); }
      else if (!$('#champ-modal').hidden) closeChamps(); else closePicker();
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
}

async function boot() {
  buildRuler(); wire();
  // the built site carries the art index in the page; the dev server leaves it to be fetched
  const inline = $('#art-index');
  const [meta, champs, items, art] = await Promise.all([api('/meta'), api('/champions'), api('/items'),
    inline ? JSON.parse(inline.textContent) : fetch('/art/index.json').then(r => r.json())]);
  useArt(art);
  $('#patch').textContent = meta.displayPatch;
  $('#legal').textContent = meta.legal;
  S.champs = champs.map(c => ({id: c.id, key: c.key, name: c.name, title: c.title, tags: c.tags || [], ranged: !!c.ranged, critDamage: c.stats?.critDamage}))
    .sort((x, y) => x.name.localeCompare(y.name));
  S.items = new Map(items.map(i => [i.id, i]));
  S.champ = S.champs.find(c => c.id === S.champ.id) || S.champs[0];

  const saved = decodeState();
  if (saved) applyState(saved);
  const tab = /[#&]tab=(build|target|break|stats)\b/.exec(location.hash);
  if (tab && !RECEIPT) setTab(tab[1]);
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
  // a first visit: the welcome comes in over the page once the page is there to be seen behind it
  if (introDue()) setTimeout(() => openIntro(true), 450);
  await loadKit();
}
boot().catch(e => {
  const q = $('#quality');
  q.hidden = false; q.className = 'wf warn'; q.textContent = 'Could not load game data'; q.title = e.message;
});
})();

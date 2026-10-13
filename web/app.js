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
  builds: {a:[6672,3006,3124,3115,null,null], b:[6655,3020,3115,4645,null,null]},
  compare: true,
  target: 'dummy',
  dummy: {hp:2400, ar:80, mr:50},
  enemy: {id:'Ornn', name:'Ornn', level:13},
  combo: {aa:3, q:1, w:1, e:0, r:0},
  items: new Map(),
  champs: [],
  res: null,                        // {a, b}: the last results, b null with one build
  options: {},                      // the champion's options the user has set, by id; the rest keep their defaults
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
async function recalc() {
  const mine = ++seq;
  document.body.classList.add('loading');
  const body = {
    champion: S.champ.id, level: S.level, ranks: S.ranks, options: S.options,
    builds: (S.compare ? ['a', 'b'] : ['a']).map(k => ({items: S.builds[k].filter(Boolean)})),
    target: targetBody(), combo: {counts: S.combo},
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
  $('#ts-build').textContent = `${S.champ.name}, level ${S.level}, ` + (S.compare ? `${na} and ${nb} items` : `${na} items`);
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
  $('#h-ctx').textContent = `${S.champ.name}, level ${S.level}, ` +
    (t === 'raw' ? 'no target' : t === 'dummy' ? 'against a dummy' : `against ${e.name} at level ${e.level}`);
  $('#h-combo').textContent = comboText();
  $('#h-mode').textContent = t === 'raw' ? 'Raw output.' : 'After mitigation.';
  paintTabs();
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
function paintKit() {
  const row = $('#skill-row'), url = kitUrl(S.champ.id);
  if (row.dataset.kit === url) return;
  row.dataset.kit = url;
  const put = () => { row.style.setProperty('--art-kit', `url("${url}")`); row.classList.add('has-kit'); };
  if (ready.has(url)) return put();
  row.classList.remove('has-kit');
  warm(url).then(() => { if (row.dataset.kit === url) put(); });
}
function nameKit() {
  for (const k of ['p', ...SLOTS]) $(`.skill[data-k="${k}"]`).title = S.view?.slots[k]?.name || '';
}
async function loadKit() {
  const c = S.champ;
  try {
    const view = await api(`/champions/${encodeURIComponent(c.id)}`);
    if (S.champ !== c) return;
    S.view = view;
  } catch (e) { if (S.champ === c) S.view = null; }
  for (const k of SLOTS) S.ranks[k] = Math.min(S.ranks[k], maxRank(k));
  // a shared link may carry options this kit no longer has
  const known = new Set((S.view?.options || []).map(o => o.id));
  for (const id of Object.keys(S.options)) if (!known.has(id)) delete S.options[id];
  nameKit(); paintSkills(); renderLines(); renderOpts(); schedule();
}
function setChamp(c) {
  S.champ = c; S.view = null; S.options = {};
  renderOpts();
  // a new kit gets the default combo: three autos and one of each ability that deals damage
  S.combo = {aa:3, q:1, w:1, e:1, r:1};
  comboFresh = true;
  if (S.order === 'manual') { S.order = 'qew'; $('#order').value = 'qew'; }
  autoRanks();
  paintChamp(); nameKit(); paintSkills(); renderLines(); loadKit();
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
function autoRanks() {
  const ord = [...S.order], r = {q:0, w:0, e:0, r:0};
  for (let l = 1; l <= S.level; l++) {
    if ((l === 6 || l === 11 || l === 16) && r.r < maxRank('r')) { r.r++; continue; }
    const cap = Math.ceil(l / 2);
    const k = l <= 3 ? ord[l - 1] : (ord.find(x => r[x] < maxRank(x) && r[x] < cap) || ord.find(x => r[x] < maxRank(x)));
    if (k) r[k]++;
  }
  S.ranks = r;
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
  pts.innerHTML = used > S.level ? `<b>${used}</b> of ${S.level} points, ${used - S.level} too many`
    : `<b>${used}</b> of ${S.level} points spent`;
}
function setLevel(n) {
  S.level = Math.max(1, Math.min(18, n));
  if (S.order !== 'manual') autoRanks();
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
      const name = esc(S.items.get(id)?.name || 'Item ' + id);
      return `<div class="slot${other.has(id) ? '' : ' uniq'}${sel}" role="button" tabindex="0" data-b="${k}" data-i="${i}" title="${name}" aria-label="Build ${K}, slot ${i + 1}, ${name}">${itemIco(id)}<button class="rm" data-rm aria-label="Remove ${name}">×</button></div>`;
    }).join('');
    $('.b-gold b', row).textContent = nf(S.builds[k].reduce((s, id) => s + (S.items.get(id)?.gold || 0), 0));
  }
  paintTabs();
}
function pickerLabel() {
  $('#picker-for').innerHTML = `<span class="tag ${pick.b} sm">${pick.b.toUpperCase()}</span>Slot ${pick.i + 1}`;
}
function openPicker(b, i) {
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
  const list = [...S.items.values()].filter(it => (!q || it.name.toLowerCase().includes(q)) && (!f || it.tags.some(t => f.includes(t))))
    .sort((x, y) => x.name.localeCompare(y.name));
  const cell = it => `<button class="pi" data-id="${it.id}" aria-label="${esc(it.name)}, ${nf(it.gold)} gold">${itemIco(it.id)}</button>`;
  const fin = list.filter(i => !i.component), comp = list.filter(i => i.component);
  $('#item-grid').innerHTML = (fin.length ? `<div class="grp">Finished items</div>${fin.map(cell).join('')}` : '')
    + (comp.length ? `<div class="grp">Components</div>${comp.map(cell).join('')}` : '')
    || '<div class="grp">No items match</div>';
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
function paintNames() { if (!RECEIPT) for (const k of ['a', 'b']) $(`#h-name-${k}`).textContent = nameOf(k); }
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
    $(`#h-cap-${k}`).innerHTML = !r ? '' : raw ? 'Before armor and magic resist'
      : r.combo.kills ? `<b>Kills</b> the target, ${nf(v.hp)} HP` : `<b>${Math.round(share)}%</b> of the target's ${nf(v.hp)} HP`;
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
function setCompare(on) {
  S.compare = on;
  document.body.dataset.compare = on ? 'on' : 'off';
  $$('#cmp-seg button').forEach(b => b.setAttribute('aria-checked', (b.dataset.cmp === 'on') === on));
  if (!on && pick && pick.b === 'b') closePicker();
  paintTabs(); schedule();
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
    if (RECEIPT) return `<div class="r-row r-line" data-k="${k}">${qty}
      <span class="src"><span class="k">${key}</span><span class="nm">${esc(name)}</span><span class="note" data-fixed="${word || (dead ? 'no damage' : '')}"${word ? ` title="${esc(slot.notes.join(' ') || word)}"` : ''}></span></span>
      <span class="n a"><i>–</i><small></small></span><span class="n b only-cmp"><i>–</i><small></small></span>
      <span class="n sh only-solo">–</span></div>`;
    const badge = word ? ` <span class="est" title="${esc(slot.notes.join(' ') || word)}">${word}</span>` : '';
    return `<div class="row line" data-k="${k}">${qty}
      <span class="src"><span class="k">${key}</span><span class="nm">${esc(name)}</span>${badge}</span><span class="ty none"></span>
      <span class="bars"><i class="a"></i><i class="b only-cmp"></i></span>
      <span class="n a"><i>–</i><small></small></span><span class="n b only-cmp"><i>–</i><small></small></span>
      <span class="g only-cmp"><i></i></span><span class="sh only-solo">–</span></div>`;
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
    $('.nm', row).title = lineParts(a, b);
  }
  const ta = A.combo.total.dealt, tb = B ? B.combo.total.dealt : 0, tot = $('#total-row');
  $('.n.a i', tot).textContent = nf(ta);
  $('.n.b i', tot).textContent = B ? nf(tb) : '–';
  $('.n.a', tot).classList.toggle('win', !B || ta > tb);
  $('.n.b', tot).classList.toggle('win', !!B && tb > ta);
  gap($('.g', tot), ta, tb);
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
  $('#bside').innerHTML = `
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
  if (B) {
    const w = tb > ta ? 'b' : 'a', d = Math.abs(Math.round(ta) - Math.round(tb)), lo = Math.min(ta, tb), lead = $('.lead');
    lead.className = `lead ${w} only-cmp`;
    $('.lead-main', lead).innerHTML = d ? `<span class="tag ${w} sm">${w.toUpperCase()}</span>ahead by <i>${nf(d)}</i>` : 'Dead even';
    $('.lead-sub', lead).innerHTML = d && lo > 0 ? `<span>+${((Math.max(ta, tb) / lo - 1) * 100).toFixed(1)}%</span> on this combo` : '';
  }
  const [dps, ttk] = $$('.metric');
  const put = (box, k, text, win) => { const el = $(`.mv.${k}`, box); $('i', el).textContent = text; el.classList.toggle('win', win); };
  const da = A.dps.dealt, db = B ? B.dps.dealt : 0;
  put(dps, 'a', nf(da), !B || da >= db);
  put(dps, 'b', B ? nf(db) : '–', !!B && db > da);
  const ka = A.timeToKill ?? Infinity, kb = B ? B.timeToKill ?? Infinity : Infinity;
  put(ttk, 'a', killTime(A), !raw && (!B || ka <= kb) && ka < Infinity);
  put(ttk, 'b', killTime(B), !raw && !!B && kb < ka);
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
    $('.nm', row).title = lineParts(a, b);
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
function renderStats() {
  const A = S.res.a, B = S.compare ? S.res.b : null, groups = statGroups(A, B);
  $('#stats-pane').innerHTML = groups.map(([group, rows]) => {
    const head = B
      ? `<div class="srow shead"><span class="lbl">${group}</span><span class="tag a xs">A</span><span class="tag b xs">B</span><span class="lbl">Gap</span></div>`
      : `<div class="srow shead"><span class="lbl">${group}</span><span></span><span></span></div>`;
    return `<div class="sgroup">${head}${rows.map(([label, a, b, note]) => {
      if (!B) return `<div class="srow"><span class="sn">${label}</span><span class="n">${statText(a)}</span><span class="note">${esc(note)}</span></div>`;
      if (a === b) return `<div class="srow same"><span class="sn">${label}</span><span class="n">${statText(a)}</span><span class="n">${statText(b)}</span><span class="g">same</span></div>`;
      const w = statNum(a) >= statNum(b) ? 'a' : 'b', d = Math.abs(statNum(b) - statNum(a));
      return `<div class="srow"><span class="sn">${label}</span><span class="n${w === 'a' ? ' win' : ''}">${statText(a)}</span><span class="n${w === 'b' ? ' win' : ''}">${statText(b)}</span><span class="g ${w}">+${statText(+d.toFixed(2))}${String(a).endsWith('%') ? '%' : ''}</span></div>`;
    }).join('')}</div>`;
  }).join('');
  const all = groups.flatMap(g => g[1]), diff = all.filter(r => r[1] !== r[2]).length;
  $('#ts-stats').textContent = B ? `${diff} of ${all.length} differ` : `${S.champ.name} with items`;
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
  paintOpts(); paintTarget(); paintQuality();
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
   one, and so is the receipt page's button for the champion's options. */
let menu = null;                    // the button of the open menu
function setMenu(btn) {
  const show = (b, on) => { b.setAttribute('aria-expanded', on); $('#' + b.getAttribute('aria-controls')).hidden = !on; };
  if (menu) show(menu, false);
  menu = btn === menu ? null : btn;
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
    ...(Object.keys(S.options).length && {x: S.options})};
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
}

/* ---------- wiring ---------- */
function wire() {
  $('.tabs')?.addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) setTab(t.dataset.tab); });
  document.addEventListener('click', e => {
    const b = e.target.closest('.menu-btn');
    if (b) setMenu(b); else if (menu && !e.target.closest('.menu')) setMenu(null);
  });
  $('#set-menu').addEventListener('click', e => { const a = e.target.closest('a[data-layout]'); if (a) { e.preventDefault(); setLayout(a); } });
  $('#cmp-seg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setCompare(b.dataset.cmp === 'on'); });
  $('#add-b').addEventListener('click', () => setCompare(true));
  $('#rm-b').addEventListener('click', () => setCompare(false));
  $('#copy-a').addEventListener('click', () => { S.builds.b = [...S.builds.a]; renderBuilds(); schedule(); });
  $('#clear-a').addEventListener('click', () => { S.builds.a = Array(6).fill(null); renderBuilds(); schedule(); });
  $('#name-a').addEventListener('input', paintNames);
  $('#name-b').addEventListener('input', paintNames);
  document.addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (b) setTarget(b.dataset.t); });

  $('#ruler').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setLevel(+b.dataset.l); });
  $('#ruler').addEventListener('keydown', e => {
    const d = {ArrowLeft:-1, ArrowDown:-1, ArrowRight:1, ArrowUp:1}[e.key];
    if (!d) return;
    e.preventDefault(); setLevel(S.level + d); $(`#ruler button[data-l="${S.level}"]`).focus();
  });
  $('#order').addEventListener('change', e => { S.order = e.target.value; if (S.order !== 'manual') autoRanks(); paintSkills(); schedule(); });
  $('#skill-row').addEventListener('click', e => {
    const p = e.target.closest('.pip'); if (!p) return;
    const k = p.dataset.k, n = +p.dataset.n;
    S.ranks[k] = S.ranks[k] === n ? n - 1 : n;
    S.order = 'manual'; $('#order').value = 'manual'; paintSkills(); schedule();
  });
  $('#lines').addEventListener('input', e => {
    const k = e.target.dataset.q; if (!k) return;
    S.combo[k] = Math.max(0, Math.min(30, Math.round(+e.target.value) || 0));
    paintSub(); schedule(true);
  });
  $('#opts').addEventListener('input', e => { if (e.target.matches('input[data-o]')) setOpt(e.target); });
  $('#opts').addEventListener('click', e => { if (e.target.closest('#opts-reset')) { S.options = {}; paintOpts(); schedule(); } });

  const builds = $('#builds');
  builds.addEventListener('click', e => {
    const slot = e.target.closest('.slot'); if (!slot) return;
    const b = slot.dataset.b, i = +slot.dataset.i;
    if (e.target.closest('[data-rm]')) { S.builds[b][i] = null; renderBuilds(); schedule(); return; }
    openPicker(b, i);
  });
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
    const it = S.items.get(+p.dataset.id);
    const about = it.status === 'unmodeled' ? 'Stats are counted; its passive is not yet.' : it.plaintext || it.tags.join(', ');
    $('#item-foot').innerHTML = `<b>${esc(it.name)}</b><span class="g">${nf(it.gold)} g</span><span>${esc(about)}</span>`;
  });
  $('#item-grid').addEventListener('mouseleave', footIdle);
  $('#picker-x').addEventListener('click', closePicker);
  document.addEventListener('mousedown', e => { if (pick && !e.target.closest('#picker') && !e.target.closest('.slot')) closePicker(); });

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
      if (menu) { const b = menu; setMenu(null); b.focus(); }
      else if (!$('#champ-modal').hidden) closeChamps(); else closePicker();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) || !$('#champ-modal').hidden) return;
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
  S.champs = champs.map(c => ({id: c.id, key: c.key, name: c.name, title: c.title, tags: c.tags || []})).sort((x, y) => x.name.localeCompare(y.name));
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

  paintLevel(); paintSkills(); paintChamp(); renderBuilds(); renderLines(); paintTarget();
  if (S.target === 'champ') enemyStats();
  await loadKit();
}
boot().catch(e => {
  const q = $('#quality');
  q.hidden = false; q.className = 'wf warn'; q.textContent = 'Could not load game data'; q.title = e.message;
});
})();

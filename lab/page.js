/* The Fight Lab page: a scenario editor around src/lab/timeline.ts, a floor that plays the result
   back, a timeline of every lock, cooldown, flight and hit underneath, and a rune page. Everything runs
   in the page; scripts/lab.ts bundles it with the dataset into one file. */
import { play, TICK } from '../src/lab/timeline.ts';

const DATA = JSON.parse(document.getElementById('data').textContent);
const champs = new Map(DATA.champions.map(c => [c.id, c]));
const items = new Map(DATA.items.map(i => [i.id, i]));
const RUNES = DATA.runes ?? { styles: [], shards: [], runes: [] };
const runeById = new Map(RUNES.runes.map(r => [r.id, r]));
const styleById = new Map(RUNES.styles.map(s => [s.id, s]));
const SLOTS = ['q', 'w', 'e', 'r'];
const ACTIONS = ['aa', ...SLOTS];
const $ = id => document.getElementById(id);
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const COLORS = {};
const loadColors = () => { for (const n of ['bg', 'band', 'well', 'rule', 'text', 'dim', 'faint', 'a', 'b', 'phys', 'magic', 'true', 'warn']) COLORS[n] = css(`--${n}`); };
const LANE_COLOR = { aa: 'text', q: 'a', w: 'magic', e: 'phys', r: 'b', item: 'dim' };
const typeColor = t => COLORS[t === 'physical' ? 'phys' : t === 'magic' ? 'magic' : 'true'];

// ---------- state ----------

const DEFAULT = {
  champ: 'Samira', level: 13, ranks: { q: 5, w: 1, e: 3, r: 2 }, items: [3031, 6672, 3036, null, null, null], options: {},
  target: 'Ornn', tlevel: 13, distance: 750, behaviour: 'stand',
  mode: 'script', script: ['e', 'q', 'aa', 'w', 'aa', 'q', 'aa', 'r'], fill: true, keep: true,
  seconds: 8, prio: ['r', 'e', 'q', 'w'],
  crits: 'average', edits: {},
  runes: { primary: 8000, secondary: 8100, keystone: 8008, minors: [9111, 9104, 8014], extra: [{ row: 3, id: 8135 }, { row: 1, id: 8143 }], shards: [5005, 5008, 5011] },
  runeOptions: {},
};
const KEY = 'itemize-lab-v2';
let S;
try { S = { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { S = { ...DEFAULT }; }
if (!champs.has(S.champ)) S.champ = DEFAULT.champ;
if (!champs.has(S.target)) S.target = DEFAULT.target;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* the page works without it */ } };

/** Points spread the usual way for a level: R at 6, 11 and 16, then Q, E and W maxed in that order. */
function ranksFor(champ, level) {
  const max = Object.fromEntries(SLOTS.map(s => [s, champ.slots[s].maxRank]));
  const r = Math.min(max.r, level >= 16 ? 3 : level >= 11 ? 2 : level >= 6 ? 1 : 0);
  let left = level - r;
  const out = { q: 0, w: 0, e: 0, r };
  for (const s of ['q', 'w', 'e']) if (left > 0) { out[s] = 1; left--; }
  for (const s of ['q', 'e', 'w']) { const add = Math.min(max[s] - out[s], left); out[s] += add; left -= add; }
  return out;
}

// ---------- runes ----------

const runeIds = () => [S.runes.keystone, ...S.runes.minors, ...S.runes.extra.map(x => x.id), ...S.runes.shards].filter(id => id && runeById.has(id));

function renderRuneSummary() {
  const names = runeIds().filter(id => runeById.get(id).kind !== 'shard').map(id => runeById.get(id).name);
  $('runes-sum').textContent = names.length ? names.join(' · ') : 'None picked';
}

let detail = null;
function renderRuneSheet() {
  const seg = (el, chosen, skip, attr) => {
    el.innerHTML = RUNES.styles.map(s => `<button data-${attr}="${s.id}" aria-selected="${s.id === chosen}" ${s.id === skip ? 'disabled' : ''}>${esc(s.name)}</button>`).join('');
  };
  seg($('primary'), S.runes.primary, null, 'primary');
  seg($('secondary'), S.runes.secondary, S.runes.primary, 'secondary');
  const p = styleById.get(S.runes.primary), sec = styleById.get(S.runes.secondary);
  const card = (id, pressed, data) => {
    const r = runeById.get(id);
    return `<button class="rune" aria-pressed="${pressed}" ${data}><span>${esc(r.name)}</span><span class="st ${r.model.status}">${r.model.status === 'unmodeled' ? 'not modelled' : r.model.rules.some(x => x.label) || r.model.amps?.length ? 'damage' : r.model.statMods.length ? 'stats' : 'no damage'}</span></button>`;
  };
  let html = '';
  if (p) {
    p.rows.forEach((row, i) => {
      const chosen = i === 0 ? S.runes.keystone : S.runes.minors[i - 1];
      html += `<div class="rune-row"><span>${esc(p.name)} · ${i === 0 ? 'Keystone' : `Row ${i}`}</span><div class="rune-opts">${row.perks.map(id => runeById.has(id) ? card(id, id === chosen, `data-prow="${i}" data-id="${id}"`) : '').join('')}</div></div>`;
    });
  }
  if (sec) {
    html += `<div class="rune-row"><span>${esc(sec.name)} · two runes from different rows</span>`;
    sec.rows.slice(1).forEach((row, i) => {
      html += `<div class="rune-opts" style="margin-bottom:6px">${row.perks.map(id => runeById.has(id) ? card(id, S.runes.extra.some(x => x.id === id), `data-srow="${i + 1}" data-id="${id}"`) : '').join('')}</div>`;
    });
    html += '</div>';
  }
  RUNES.shards.forEach((row, i) => {
    html += `<div class="rune-row"><span>Stat shard ${i + 1}</span><div class="rune-opts">${row.map(id => runeById.has(id) ? card(id, S.runes.shards[i] === id, `data-shard="${i}" data-id="${id}"`) : '').join('')}</div></div>`;
  });
  $('rune-rows').innerHTML = html;
  renderRuneDetail();
}

function renderRuneDetail() {
  const r = detail && runeById.get(detail);
  if (!r) { $('rune-detail').innerHTML = '<p class="small">Tap a rune to read it. Picked runes show their settings here.</p>'; return; }
  const set = S.runeOptions[r.id] ?? {};
  const controls = (r.model.controls ?? []).map(c => {
    const v = set[c.id];
    if (c.kind === 'bool') return `<label><input type="checkbox" data-rc="${c.id}" ${v ? 'checked' : ''}> ${esc(c.label)}</label>`;
    return `<label>${esc(c.label)} <input type="number" data-rc="${c.id}" min="${c.min ?? 0}" ${c.max !== undefined ? `max="${c.max}"` : ''} value="${v ?? ''}" placeholder="${c.kind === 'procs' ? 'auto' : 'default'}"></label>`;
  }).join('');
  const picked = runeIds().includes(r.id);
  $('rune-detail').innerHTML = `<h3>${esc(r.name)}</h3><p>${esc(r.desc)}</p>
    ${picked && controls ? `<div class="controls" data-rune="${r.id}">${controls}</div>` : ''}
    ${r.model.notes.length ? `<ul class="notes">${r.model.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}`;
}

$('runes-open').addEventListener('click', () => { $('rune-sheet').hidden = false; renderRuneSheet(); $('runes-close').focus(); });
$('runes-close').addEventListener('click', () => { $('rune-sheet').hidden = true; $('runes-open').focus(); });
$('rune-sheet').addEventListener('click', e => { if (e.target === $('rune-sheet')) $('rune-sheet').hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('rune-sheet').hidden) $('rune-sheet').hidden = true; });
$('runes-clear').addEventListener('click', () => {
  S.runes = { ...S.runes, keystone: null, minors: [null, null, null], extra: [], shards: [null, null, null] };
  renderRuneSheet(); renderRuneSummary(); run();
});
$('primary').addEventListener('click', e => {
  const id = Number(e.target.dataset?.primary); if (!id || id === S.runes.primary) return;
  const secondary = S.runes.secondary === id ? RUNES.styles.find(s => s.id !== id).id : S.runes.secondary;
  S.runes = { ...S.runes, primary: id, secondary, keystone: null, minors: [null, null, null], ...(secondary !== S.runes.secondary && { extra: [] }) };
  renderRuneSheet(); renderRuneSummary(); run();
});
$('secondary').addEventListener('click', e => {
  const id = Number(e.target.dataset?.secondary); if (!id || id === S.runes.secondary) return;
  S.runes = { ...S.runes, secondary: id, extra: [] };
  renderRuneSheet(); renderRuneSummary(); run();
});
$('rune-rows').addEventListener('click', e => {
  const b = e.target.closest('.rune'); if (!b) return;
  const id = Number(b.dataset.id);
  detail = id;
  if (b.dataset.prow !== undefined) {
    const i = Number(b.dataset.prow);
    if (i === 0) S.runes = { ...S.runes, keystone: S.runes.keystone === id ? null : id };
    else S.runes = { ...S.runes, minors: S.runes.minors.map((m, j) => j === i - 1 ? (m === id ? null : id) : m) };
  } else if (b.dataset.srow !== undefined) {
    const row = Number(b.dataset.srow);
    let extra = S.runes.extra.filter(x => x.id !== id);
    if (extra.length === S.runes.extra.length) {
      // one rune per row; a third row drops the earliest pick
      extra = [...extra.filter(x => x.row !== row), { row, id }];
      if (extra.length > 2) extra = extra.slice(-2);
    }
    S.runes = { ...S.runes, extra };
  } else if (b.dataset.shard !== undefined) {
    const i = Number(b.dataset.shard);
    S.runes = { ...S.runes, shards: S.runes.shards.map((x, j) => j === i ? id : x) };
  }
  renderRuneSheet(); renderRuneSummary(); run();
});
$('rune-detail').addEventListener('change', e => {
  const box = e.target.closest('[data-rune]'), k = e.target.dataset.rc; if (!box || !k) return;
  const id = Number(box.dataset.rune), mine = { ...(S.runeOptions[id] ?? {}) };
  if (e.target.type === 'checkbox') mine[k] = e.target.checked;
  else if (e.target.value === '') delete mine[k];
  else mine[k] = Number(e.target.value);
  S.runeOptions = { ...S.runeOptions, [id]: mine };
  run();
});

// ---------- the scenario ----------

let result;
function scenario() {
  const champ = champs.get(S.champ);
  const ids = S.items.filter(id => id && items.has(id));
  const runes = runeIds();
  const runeOptions = Object.fromEntries(Object.entries(S.runeOptions).filter(([id, v]) => runes.includes(Number(id)) && Object.keys(v).length));
  const mode = S.mode === 'seconds'
    ? { kind: 'seconds', seconds: S.seconds, abilities: S.prio }
    : { kind: 'script', script: S.script, keepAttacking: S.keep, fillWithAutos: S.fill };
  return {
    champ, items: ids.map(id => items.get(id)), runes: runes.map(id => runeById.get(id)),
    build: { champion: champ.id, level: S.level, ranks: S.ranks, items: ids, options: S.options, runes, runeOptions },
    target: { champ: champs.get(S.target), level: S.tlevel },
    distance: S.distance, behaviour: S.behaviour, mode, edits: S.edits[S.champ] ?? {}, crits: S.crits, horizon: 15,
  };
}

function run() {
  save();
  try { result = play(scenario()); }
  catch (err) { $('notes').innerHTML = `<li>Could not play this: ${esc(err.message)}</li>`; return; }
  $('scrub').max = String(result.end);
  if (now > result.end) now = result.end;
  renderScript();
  renderOpts();
  renderTimings();
  renderLog();
  renderNotes();
  const t = result.target;
  $('tstats').textContent = `${Math.round(t.hp)} health, ${Math.round(t.armor)} armor, ${Math.round(t.mr)} magic resist at level ${S.tlevel}. No items yet.`;
  $('r-kill').textContent = result.killedAt === null ? 'alive' : `${result.killedAt.toFixed(2)} s`;
  frameView();
}

// ---------- the form ----------

function fillForm() {
  const sorted = [...champs.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const sel of [$('champ'), $('tchamp')]) sel.innerHTML = sorted.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  $('patch').textContent = `patch ${DATA.patch}`;
  const itemOpts = '<option value="">Empty slot</option>' + DATA.items.slice().sort((a, b) => a.name.localeCompare(b.name)).map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join('');
  $('items').innerHTML = S.items.map((_, i) => `<select id="item-${i}" data-i="${i}" aria-label="Item slot ${i + 1}">${itemOpts}</select>`).join('');
  syncForm();
}
function syncForm() {
  const champ = champs.get(S.champ);
  $('champ').value = S.champ; $('level').value = S.level; $('tchamp').value = S.target; $('tlevel').value = S.tlevel;
  $('dist').value = S.distance; $('dist-v').textContent = `${S.distance}`; $('behaviour').value = S.behaviour;
  $('fill').checked = S.fill; $('keep').checked = S.keep; $('crits').value = S.crits; $('seconds').value = S.seconds;
  $('ranks').innerHTML = SLOTS.map(s => `<label>${s.toUpperCase()}<input type="number" id="rank-${s}" data-s="${s}" min="0" max="${champ.slots[s].maxRank}" value="${S.ranks[s]}"></label>`).join('');
  $('items').querySelectorAll('select').forEach(sel => { sel.value = S.items[+sel.dataset.i] ?? ''; });
  for (const m of ['script', 'seconds']) $(`mode-${m}`).setAttribute('aria-selected', String(S.mode === m));
  $('script-pane').hidden = S.mode !== 'script';
  $('seconds-pane').hidden = S.mode !== 'seconds';
  renderPrio();
  renderRuneSummary();
}
function renderOpts() {
  const champ = champs.get(S.champ), managed = new Set(result?.managed ?? []);
  const shown = champ.options.filter(o => !managed.has(o.id) && !o.timeline);
  $('opts').innerHTML = shown.map(o => o.kind === 'bool'
    ? `<label><input type="checkbox" id="opt-${o.id}" data-o="${o.id}" ${S.options[o.id] ? 'checked' : ''}> ${esc(o.label)}</label>`
    : `<label>${esc(o.label)} <input type="number" id="opt-${o.id}" data-o="${o.id}" min="${o.min ?? 0}" max="${o.max ?? 99}" value="${S.options[o.id] ?? ''}" placeholder="auto"></label>`).join('')
    + (managed.size ? `<span class="small">Set by the timeline: ${[...managed].map(id => esc(champ.options.find(o => o.id === id)?.label ?? id)).join(', ')}.</span>` : '');
}
function renderPrio() {
  $('prio').innerHTML = SLOTS.map(s => {
    const i = S.prio.indexOf(s);
    return `<button data-s="${s}" aria-pressed="${i >= 0}">${s.toUpperCase()}${i >= 0 ? `<small>${i + 1}</small>` : ''}</button>`;
  }).join('');
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));
$('champ').addEventListener('change', e => {
  S.champ = e.target.value; S.options = {};
  S.ranks = ranksFor(champs.get(S.champ), S.level);
  syncForm(); run();
});
$('level').addEventListener('change', e => { S.level = clamp(e.target.value, 1, 18); S.ranks = ranksFor(champs.get(S.champ), S.level); syncForm(); run(); });
$('ranks').addEventListener('change', e => { const s = e.target.dataset.s; if (!s) return; S.ranks = { ...S.ranks, [s]: clamp(e.target.value, 0, champs.get(S.champ).slots[s].maxRank) }; syncForm(); run(); });
$('items').addEventListener('change', e => { const i = +e.target.dataset.i; S.items = S.items.map((v, j) => j === i ? (Number(e.target.value) || null) : v); run(); });
$('opts').addEventListener('change', e => {
  const id = e.target.dataset.o; if (!id) return;
  if (e.target.type === 'checkbox') S.options = { ...S.options, [id]: e.target.checked };
  else if (e.target.value === '') { const { [id]: _, ...rest } = S.options; S.options = rest; }
  else S.options = { ...S.options, [id]: Number(e.target.value) };
  run();
});
$('crits').addEventListener('change', e => { S.crits = e.target.value; run(); });
$('tchamp').addEventListener('change', e => { S.target = e.target.value; run(); });
$('tlevel').addEventListener('change', e => { S.tlevel = clamp(e.target.value, 1, 18); e.target.value = S.tlevel; run(); });
$('dist').addEventListener('input', e => { S.distance = Number(e.target.value); $('dist-v').textContent = `${S.distance}`; run(); });
$('behaviour').addEventListener('change', e => { S.behaviour = e.target.value; run(); });
$('fill').addEventListener('change', e => { S.fill = e.target.checked; run(); });
$('keep').addEventListener('change', e => { S.keep = e.target.checked; run(); });
document.querySelector('.seg[role=tablist]').addEventListener('click', e => { const m = e.target.dataset?.mode; if (!m) return; S.mode = m; now = 0; syncForm(); run(); });
$('seconds').addEventListener('change', e => { S.seconds = clamp(e.target.value, 1, 60); e.target.value = S.seconds; run(); });
$('prio').addEventListener('click', e => {
  const s = e.target.closest('button')?.dataset.s; if (!s) return;
  S.prio = S.prio.includes(s) ? S.prio.filter(x => x !== s) : [...S.prio, s];
  renderPrio(); run();
});

// ---------- the script ----------

function renderScript() {
  $('script').innerHTML = S.script.length
    ? S.script.map((a, i) => `<button class="chip ${a === 'aa' ? '' : 'cast'}" data-a="${a}" data-i="${i}" aria-label="Remove ${a.toUpperCase()}">${a.toUpperCase()}</button>`).join('')
    : '<span class="small" style="padding:4px">Empty: add actions below.</span>';
}
$('script').addEventListener('click', e => { const i = e.target.dataset?.i; if (i === undefined) return; S.script = S.script.filter((_, j) => j !== +i); run(); });
$('add').addEventListener('click', e => { const a = e.target.dataset?.a; if (!a) return; S.script = [...S.script, a]; run(); });
$('undo').addEventListener('click', () => { S.script = S.script.slice(0, -1); run(); });
$('clear').addEventListener('click', () => { S.script = []; run(); });

// ---------- timings ----------

const pill = t => `<span class="src ${t.from}">${t.from}</span>`;
function renderTimings() {
  const champ = champs.get(S.champ);
  const cell = (a, key, t, step) => `<td class="num"><input type="number" step="${step}" min="0" id="tm-${a}-${key}" data-a="${a}" data-k="${key}" value="${+t.v.toFixed(3)}">${pill(t)}</td>`;
  const shown = t => `<td class="num">${+t.v.toFixed(3)}${pill(t)}</td>`;
  $('timings').innerHTML = ACTIONS.map(a => {
    const t = result.timings[a], name = a === 'aa' ? 'Basic attack' : champ.slots[a].name;
    const spell = t.spell ? `<br><span class="small mono">${esc(t.spell)}</span>` : '';
    const reset = t.resetsAttack ? ' <span class="src data" title="resets the attack timer">reset</span>' : '';
    let rows = `<tr><td>${a.toUpperCase()} <span class="small">${esc(name)}</span>${reset}${spell}</td>${cell(a, 'lock', t.lock, a === 'aa' ? 0.01 : 0.05)}${cell(a, 'range', t.range, 25)}${cell(a, 'speed', t.speed, 100)}${a === 'aa' ? '<td></td>' : cell(a, 'channel', t.channel, 0.25)}</tr>`;
    if (t.dash) rows += `<tr><td class="variant">dash, ${t.dash.direction}</td><td></td>${cell(a, 'dashDistance', t.dash.distance, 25)}${cell(a, 'dashSpeed', t.dash.speed, 100)}<td></td></tr>`;
    for (const v of t.variants) {
      const vt = v.timing;
      rows += `<tr><td class="variant">${esc(v.label)}${vt.spell && vt.spell !== t.spell ? `<br><span class="mono">${esc(vt.spell)}</span>` : ''}</td>${shown(vt.lock)}${shown(vt.range)}${shown(vt.speed)}${a === 'aa' ? '<td></td>' : shown(vt.channel)}</tr>`;
    }
    return rows;
  }).join('');
}
$('timings').addEventListener('change', e => {
  const { a, k } = e.target.dataset; if (!a) return;
  const v = Math.max(0, Number(e.target.value) || 0);
  const mine = S.edits[S.champ] ?? {};
  S.edits = { ...S.edits, [S.champ]: { ...mine, [a]: { ...mine[a], [k]: v } } };
  run();
});
$('reset').addEventListener('click', () => { const { [S.champ]: _, ...rest } = S.edits; S.edits = rest; run(); });

// ---------- log and notes ----------

function renderLog() {
  const champ = champs.get(S.champ);
  const from = e => e.action === 'aa' ? 'AA' : e.action === 'item' ? 'Item' : e.action === 'rune' ? 'Rune' : e.action === 'passive' ? 'Passive' : e.action.toUpperCase();
  $('log').innerHTML = result.events.map((e, i) => `<tr data-i="${i}"><td class="num">${e.t.toFixed(2)}</td><td>${from(e)}</td><td>${esc(e.label)}</td><td class="num type-${e.type}">${Math.round(e.dealt)}</td></tr>`).join('')
    || `<tr><td colspan="4" class="small">Nothing landed. ${esc(champ.name)} may not reach the target: try a shorter start or a standing target.</td></tr>`;
}
const GAPS = [
  'Crowd control, slows and the target fighting back: the target only walks.',
  'Skillshots missing: every projectile homes in on the target.',
  'Mana and other resources.',
];
function renderNotes() {
  $('notes').innerHTML = [...result.notes, ...GAPS].map(n => `<li>${esc(n)}</li>`).join('');
}

// ---------- drawing ----------

let now = 0, playing = false, last = 0;
const frameAt = t => result.frames[Math.min(result.frames.length - 1, Math.max(0, Math.round(t / TICK)))];

function fitCanvas(c) {
  const r = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: r.width, h: r.height };
}

/** The world box the whole fight happens in, so the camera holds still while it plays. */
function bounds() {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const f of result.frames) for (const p of [f.a, f.b]) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const pad = Math.max(result.timings.aa.range.v, 300) + result.radius.a * 2;
  return { x0: x0 - pad, x1: x1 + pad, y0: y0 - pad, y1: y1 + pad };
}

function drawFloor() {
  const { ctx, w, h } = fitCanvas($('floor'));
  ctx.fillStyle = COLORS.well; ctx.fillRect(0, 0, w, h);
  const B = bounds(), scale = Math.min(w / (B.x1 - B.x0), h / (B.y1 - B.y0));
  const cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2;
  const X = x => w / 2 + (x - cx) * scale, Y = y => h / 2 + (y - cy) * scale;
  const { a: rA, b: rB } = result.radius;

  // grid: a line every 100 units, stronger every 500
  for (let g = Math.floor(B.x0 / 100) * 100; g <= B.x1; g += 100) {
    ctx.strokeStyle = COLORS.rule; ctx.globalAlpha = g % 500 === 0 ? 0.7 : 0.25;
    ctx.beginPath(); ctx.moveTo(X(g), 0); ctx.lineTo(X(g), h); ctx.stroke();
  }
  for (let g = Math.floor(B.y0 / 100) * 100; g <= B.y1; g += 100) {
    ctx.strokeStyle = COLORS.rule; ctx.globalAlpha = g % 500 === 0 ? 0.7 : 0.25;
    ctx.beginPath(); ctx.moveTo(0, Y(g)); ctx.lineTo(w, Y(g)); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.faint; ctx.font = `10px ${css('--font-mono')}`;
  ctx.fillText('grid: 100 units', 10, h - 10);

  const f = frameAt(now);
  const trail = (key, color) => {
    ctx.strokeStyle = color; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.beginPath();
    result.frames.forEach((fr, i) => { if (fr.t > now) return; const p = fr[key]; i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y)); });
    ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1;
  };
  trail('a', COLORS.a); trail('b', COLORS.b);

  // attack range reaches the target's edge from the champion's edge; an ability's from the champion's centre
  const ring = (r, color, dash) => {
    ctx.strokeStyle = color; ctx.setLineDash(dash); ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(X(f.a.x), Y(f.a.y), r * scale, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  };
  ring(result.timings.aa.range.v + rA, COLORS.dim, [4, 4]);
  const doing = result.started.filter(s => s.t <= now).at(-1);
  if (doing && doing.action !== 'aa' && (f.a.state === 'cast' || f.a.state === 'dash' || f.a.state === 'channel')) {
    const t = doing.variant >= 0 ? result.timings[doing.action].variants[doing.variant].timing : result.timings[doing.action];
    ring(t.range.v, COLORS[LANE_COLOR[doing.action]], [2, 3]);
  }

  const body = (p, r, color, label) => {
    ctx.fillStyle = color; ctx.globalAlpha = 0.18;
    ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), r * scale, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = color; ctx.font = `600 ${Math.max(10, Math.min(14, r * scale * 0.7))}px ${css('--font-mono')}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, X(p.x), Y(p.y));
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  };
  const me = champs.get(S.champ), them = champs.get(S.target);
  body(f.a, rA, COLORS.a, me.name.slice(0, 3));
  body(f.b, rB, COLORS.b, them.name.slice(0, 3));

  const bw = Math.max(44, rB * 2.4 * scale), bx = X(f.b.x) - bw / 2, by = Y(f.b.y) - rB * scale - 14;
  ctx.fillStyle = COLORS.band; ctx.fillRect(bx, by, bw, 6);
  ctx.fillStyle = COLORS.b; ctx.fillRect(bx, by, bw * f.hp / result.maxHp, 6);
  ctx.strokeStyle = COLORS.rule; ctx.strokeRect(bx, by, bw, 6);

  for (const s of f.shots) {
    ctx.fillStyle = COLORS[LANE_COLOR[s.action]];
    ctx.beginPath(); ctx.arc(X(s.x), Y(s.y), 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.font = `600 13px ${css('--font-mono')}`; ctx.textAlign = 'center';
  let stack = 0;
  for (const e of result.events) {
    const age = now - e.t;
    if (age < 0 || age > 0.7 || e.dealt < 1) continue;
    ctx.globalAlpha = 1 - age / 0.7;
    ctx.fillStyle = typeColor(e.type);
    ctx.fillText(Math.round(e.dealt), X(f.b.x) + (stack % 2 ? 22 : -22), by - 6 - age * 40 - Math.floor(stack / 2) * 14);
    stack++;
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'start';

  const stateText = { idle: '', move: 'walking into range', windup: 'winding up', cast: 'casting', dash: 'dashing', channel: 'channelling', wait: 'waiting on a cooldown' }[f.a.state];
  $('state').textContent = `${me.name} ${stateText}`.trim();
}

const LANES = ['aa', 'q', 'w', 'e', 'r', 'item'];
function laneGeometry(w) {
  const left = 34, right = 10, laneH = 22, top = 6, hpH = 34;
  const span = Math.max(1, result.end);
  return { left, right, laneH, top, hpH, X: t => left + (w - left - right) * t / span, T: x => (x - left) / (w - left - right) * span, height: top + LANES.length * laneH + hpH + 20 };
}
function drawLanes() {
  const c = $('lanes');
  const g = laneGeometry(c.getBoundingClientRect().width || 300);
  c.style.height = `${g.height}px`;
  const { ctx, w } = fitCanvas(c);
  ctx.fillStyle = COLORS.well; ctx.fillRect(0, 0, w, g.height);
  ctx.font = `600 11px ${css('--font-mono')}`; ctx.textBaseline = 'middle';
  const laneOf = a => LANES.includes(a) ? a : 'item';
  const laneY = l => g.top + LANES.indexOf(laneOf(l)) * g.laneH;

  LANES.forEach((l, i) => {
    const y = g.top + i * g.laneH;
    ctx.fillStyle = COLORS.faint; ctx.fillText(l === 'item' ? '+' : l.toUpperCase(), 8, y + g.laneH / 2);
    ctx.strokeStyle = COLORS.rule; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(g.left, y + g.laneH); ctx.lineTo(w - g.right, y + g.laneH); ctx.stroke(); ctx.globalAlpha = 1;
  });
  ctx.fillStyle = COLORS.faint; ctx.font = `10px ${css('--font-mono')}`; ctx.textAlign = 'center';
  const yTicks = g.top + LANES.length * g.laneH + g.hpH + 12;
  const step = result.end > 8 ? 2 : result.end > 3 ? 1 : 0.5;
  for (let s = 0; s <= result.end + 1e-9; s += step) {
    ctx.strokeStyle = COLORS.rule; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(g.X(s), g.top); ctx.lineTo(g.X(s), yTicks - 8); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillText(`${+s.toFixed(1)}s`, g.X(s), yTicks);
  }
  ctx.textAlign = 'start';

  for (const sp of result.spans) {
    const y = laneY(sp.lane), color = COLORS[LANE_COLOR[laneOf(sp.lane)]];
    const x0 = g.X(sp.from), x1 = Math.max(x0 + 2, g.X(Math.min(sp.to, result.end)));
    if (sp.kind === 'cooldown') { ctx.fillStyle = color; ctx.globalAlpha = 0.12; ctx.fillRect(x0, y + 4, x1 - x0, g.laneH - 8); }
    else if (sp.kind === 'travel') { ctx.strokeStyle = color; ctx.globalAlpha = 0.8; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.moveTo(x0, y + g.laneH / 2); ctx.lineTo(x1, y + g.laneH / 2); ctx.stroke(); ctx.setLineDash([]); }
    else if (sp.kind === 'channel') { ctx.strokeStyle = color; ctx.globalAlpha = 0.9; ctx.strokeRect(x0 + 0.5, y + 6.5, x1 - x0 - 1, g.laneH - 13); }
    else { ctx.fillStyle = color; ctx.globalAlpha = sp.kind === 'dash' ? 0.55 : 0.9; ctx.fillRect(x0, y + 6, x1 - x0, g.laneH - 12); }
    ctx.globalAlpha = 1;
  }
  for (const e of result.events) {
    const y = laneY(e.action);
    ctx.fillStyle = typeColor(e.type);
    ctx.fillRect(g.X(e.t) - 1, y + 2, 2, g.laneH - 4);
  }
  const hy = g.top + LANES.length * g.laneH + 4, hh = g.hpH - 8;
  ctx.strokeStyle = COLORS.b; ctx.lineWidth = 1.5; ctx.beginPath();
  result.frames.forEach((f, i) => { const x = g.X(f.t), y = hy + hh * (1 - f.hp / result.maxHp); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke(); ctx.lineWidth = 1;
  ctx.fillStyle = COLORS.faint; ctx.font = `10px ${css('--font-mono')}`; ctx.textBaseline = 'top'; ctx.fillText('HP', 6, hy); ctx.textBaseline = 'alphabetic';
  if (result.killedAt !== null) { ctx.fillStyle = COLORS.a; ctx.fillRect(g.X(result.killedAt) - 1, hy, 2, hh); }
  ctx.fillStyle = COLORS.text; ctx.fillRect(g.X(now) - 1, 0, 2, yTicks - 8);
}

function frameView() {
  const f = frameAt(now);
  $('clock').textContent = `${now.toFixed(2)} s`;
  $('scrub').value = String(now);
  $('r-hp').textContent = `${Math.round(f.hp)}`;
  const dealt = result.maxHp - f.hp;
  $('r-dealt').textContent = `${Math.round(dealt)}`;
  const span = result.killedAt ?? result.end;
  $('r-dps').textContent = span > 0 ? `${Math.round((result.maxHp - frameAt(span).hp) / span)}/s` : '–';
  $('play').textContent = playing ? '❚❚' : '▶';
  $('play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  drawFloor();
  drawLanes();
  const played = new Map(result.started.filter(s => s.index >= 0 && s.t <= now + 1e-9).map(s => [s.index, s]));
  $('script').querySelectorAll('.chip').forEach(ch => {
    const s = played.get(+ch.dataset.i);
    ch.classList.toggle('played', !!s);
    ch.title = s ? `${s.t.toFixed(2)} s${s.woven ? ', woven in' : ''}` : '';
  });
  $('log').querySelectorAll('tr[data-i]').forEach(tr => { const e = result.events[+tr.dataset.i]; tr.classList.toggle('now', e.t <= now && now - e.t < 0.35); });
}

function tick(ts) {
  if (!playing) return;
  const dt = Math.min(0.1, (ts - last) / 1000); last = ts;
  now += dt * Number($('speed').value);
  if (now >= result.end) { now = result.end; playing = false; }
  frameView();
  if (playing) requestAnimationFrame(tick);
}
$('play').addEventListener('click', () => {
  if (playing) { playing = false; frameView(); return; }
  if (now >= result.end - 1e-6) now = 0;
  playing = true; last = performance.now(); requestAnimationFrame(tick);
});
$('scrub').addEventListener('input', e => { playing = false; now = Number(e.target.value); frameView(); });
const seek = ev => {
  const c = $('lanes'), r = c.getBoundingClientRect(), g = laneGeometry(r.width);
  playing = false; now = Math.min(result.end, Math.max(0, g.T(ev.clientX - r.left))); frameView();
};
$('lanes').addEventListener('pointerdown', ev => { seek(ev); $('lanes').setPointerCapture(ev.pointerId); });
$('lanes').addEventListener('pointermove', ev => { if (ev.buttons) seek(ev); });
window.addEventListener('resize', () => frameView());

loadColors();
fillForm();
run();

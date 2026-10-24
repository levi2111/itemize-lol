/* The Fight Lab page: a scenario editor around src/lab/timeline.ts, a floor that plays the result
   back, and a timeline of every lock, cooldown, flight and hit underneath. Everything runs in the
   page; scripts/lab.ts bundles it with the dataset into one file. */
import { play, timingsFor, RADIUS, TICK } from '../src/lab/timeline.ts';

const DATA = JSON.parse(document.getElementById('data').textContent);
const champs = new Map(DATA.champions.map(c => [c.id, c]));
const items = new Map(DATA.items.map(i => [i.id, i]));
const SLOTS = ['q', 'w', 'e', 'r'];
const ACTIONS = ['aa', ...SLOTS];
const $ = id => document.getElementById(id);
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const COLORS = {};
const loadColors = () => { for (const n of ['bg', 'band', 'well', 'rule', 'text', 'dim', 'faint', 'a', 'b', 'phys', 'magic', 'true', 'warn']) COLORS[n] = css(`--${n}`); };
const LANE_COLOR = { aa: 'text', q: 'a', w: 'magic', e: 'phys', r: 'b', item: 'dim' };

// ---------- state ----------

const DEFAULT = {
  champ: 'Samira', level: 13, ranks: { q: 5, w: 1, e: 3, r: 2 }, items: [3031, 6672, 3036, null, null, null], options: {},
  target: 'Ornn', tlevel: 13, distance: 700, behaviour: 'stand',
  script: ['e', 'aa', 'q', 'aa', 'w', 'r'], fill: true, keep: true, crits: 'average', edits: {},
};
const KEY = 'itemize-lab-v1';
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

// ---------- the scenario ----------

let result, timings;
function scenario() {
  const champ = champs.get(S.champ);
  const base = timingsFor(champ, S.ranks), edits = S.edits[S.champ] ?? {};
  timings = structuredClone(base);
  for (const [a, e] of Object.entries(edits)) {
    for (const [k, v] of Object.entries(e)) {
      if (k === 'dashSpeed' || k === 'dashDistance') { if (timings[a].dash) timings[a].dash[k === 'dashSpeed' ? 'speed' : 'distance'] = { v, from: 'edited' }; }
      else timings[a][k] = { v, from: 'edited' };
    }
  }
  const ids = S.items.filter(id => id && items.has(id));
  return {
    champ, items: ids.map(id => items.get(id)),
    build: { champion: champ.id, level: S.level, ranks: S.ranks, items: ids, options: S.options },
    target: { champ: champs.get(S.target), level: S.tlevel },
    distance: S.distance, behaviour: S.behaviour, script: S.script, keepAttacking: S.keep, fillWithAutos: S.fill,
    timings, crits: S.crits, horizon: 15,
  };
}

function run() {
  save();
  result = play(scenario());
  $('scrub').max = String(result.end);
  if (now > result.end) now = result.end;
  frameView();
  renderScript();
  renderTimings();
  renderLog();
  renderNotes();
  const t = result.target;
  $('tstats').textContent = `${Math.round(t.hp)} health, ${Math.round(t.armor)} armor, ${Math.round(t.mr)} magic resist at level ${S.tlevel}. No items yet.`;
  $('r-kill').textContent = result.killedAt === null ? 'alive' : `${result.killedAt.toFixed(2)} s`;
}

// ---------- the form ----------

function fillForm() {
  const sorted = [...champs.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const sel of [$('champ'), $('tchamp')]) sel.innerHTML = sorted.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  $('patch').textContent = `patch ${DATA.patch}`;
  const itemOpts = '<option value="">Empty slot</option>' + DATA.items.slice().sort((a, b) => a.name.localeCompare(b.name)).map(i => `<option value="${i.id}">${i.name}</option>`).join('');
  $('items').innerHTML = S.items.map((_, i) => `<select data-i="${i}" aria-label="Item slot ${i + 1}">${itemOpts}</select>`).join('');
  syncForm();
}
function syncForm() {
  const champ = champs.get(S.champ);
  $('champ').value = S.champ; $('level').value = S.level; $('tchamp').value = S.target; $('tlevel').value = S.tlevel;
  $('dist').value = S.distance; $('dist-v').textContent = `${S.distance}`; $('behaviour').value = S.behaviour;
  $('fill').checked = S.fill; $('keep').checked = S.keep; $('crits').value = S.crits;
  $('ranks').innerHTML = SLOTS.map(s => `<label>${s.toUpperCase()}<input type="number" id="rank-${s}" data-s="${s}" min="0" max="${champ.slots[s].maxRank}" value="${S.ranks[s]}"></label>`).join('');
  $('items').querySelectorAll('select').forEach(sel => { sel.value = S.items[+sel.dataset.i] ?? ''; });
  $('opts').innerHTML = champ.options.map(o => o.kind === 'bool'
    ? `<label><input type="checkbox" id="opt-${o.id}" data-o="${o.id}" ${S.options[o.id] ? 'checked' : ''}> ${o.label}</label>`
    : `<label>${o.label} <input type="number" id="opt-${o.id}" data-o="${o.id}" min="${o.min ?? 0}" max="${o.max ?? 99}" value="${S.options[o.id] ?? ''}" placeholder="auto"></label>`).join('');
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

// ---------- the script ----------

function renderScript() {
  const played = new Set(result.started.filter(s => !s.filler && s.t <= now + 1e-9).map(s => s.index));
  $('script').innerHTML = S.script.length
    ? S.script.map((a, i) => `<button class="chip ${a === 'aa' ? '' : 'cast'} ${played.has(i) ? 'played' : ''}" data-a="${a}" data-i="${i}" aria-label="Remove ${a.toUpperCase()}">${a.toUpperCase()}</button>`).join('')
    : '<span class="small" style="padding:4px">Empty: add actions below.</span>';
}
$('script').addEventListener('click', e => { const i = e.target.dataset?.i; if (i === undefined) return; S.script = S.script.filter((_, j) => j !== +i); run(); });
$('add').addEventListener('click', e => { const a = e.target.dataset?.a; if (!a) return; S.script = [...S.script, a]; run(); });
$('undo').addEventListener('click', () => { S.script = S.script.slice(0, -1); run(); });
$('clear').addEventListener('click', () => { S.script = []; run(); });

// ---------- timings ----------

function renderTimings() {
  const champ = champs.get(S.champ);
  const cell = (a, key, t, step) => `<td class="num"><input type="number" step="${step}" min="0" id="tm-${a}-${key}" data-a="${a}" data-k="${key}" value="${+t.v.toFixed(3)}"><span class="src ${t.from}">${t.from}</span></td>`;
  $('timings').innerHTML = ACTIONS.map(a => {
    const t = timings[a], name = a === 'aa' ? 'Basic attack' : champ.slots[a].name;
    const row = `<tr><td>${a.toUpperCase()} <span class="small">${name}</span></td>${cell(a, 'lock', t.lock, a === 'aa' ? 0.01 : 0.05)}${cell(a, 'range', t.range, 25)}${cell(a, 'speed', t.speed, 100)}</tr>`;
    const dash = t.dash ? `<tr><td class="small" style="padding-left:20px">dash</td><td></td>${cell(a, 'dashDistance', t.dash.distance, 25)}${cell(a, 'dashSpeed', t.dash.speed, 100)}</tr>` : '';
    return row + dash;
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
  const from = e => e.action === 'aa' ? 'AA' : e.action === 'item' ? (e.line === 'p' ? 'Passive' : 'Item') : `${e.action.toUpperCase()}`;
  $('log').innerHTML = result.events.map((e, i) => `<tr data-i="${i}"><td class="num">${e.t.toFixed(2)}</td><td>${from(e)}</td><td>${e.label}${e.over ? ` <span class="small">over ${e.over.toFixed(1)} s</span>` : ''}</td><td class="num type-${e.type}">${Math.round(e.dealt)}</td></tr>`).join('')
    || `<tr><td colspan="4" class="small">Nothing landed. ${champ.name} may not reach the target: try a shorter start or a standing target.</td></tr>`;
}
const GAPS = [
  'Attack resets and animation cancels: an ability does not reset the attack timer.',
  'Crowd control, slows and the target fighting back. The target only walks.',
  'Skillshots missing: every projectile homes in on the target.',
  'Buffs running out on the clock, recasts, channels that root, and mana.',
  'Windup shares, attack projectile speeds and most ability ranges are placeholders until the timing data is mirrored.',
];
function renderNotes() {
  $('notes').innerHTML = [...result.notes, ...GAPS].map(n => `<li>${n}</li>`).join('');
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
  const pad = Math.max(timings.aa.range.v, 300) + RADIUS * 2;
  return { x0: x0 - pad, x1: x1 + pad, y0: y0 - pad, y1: y1 + pad };
}

function drawFloor() {
  const { ctx, w, h } = fitCanvas($('floor'));
  ctx.fillStyle = COLORS.well; ctx.fillRect(0, 0, w, h);
  const B = bounds(), scale = Math.min(w / (B.x1 - B.x0), h / (B.y1 - B.y0));
  const cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2;
  const X = x => w / 2 + (x - cx) * scale, Y = y => h / 2 + (y - cy) * scale;

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
  ctx.fillText(`${Math.round(100 * scale) >= 18 ? '100' : '500'} units`, 10, h - 10);

  const f = frameAt(now);
  // the paths so far
  const trail = (key, color) => {
    ctx.strokeStyle = color; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.beginPath();
    for (const fr of result.frames) { if (fr.t > now) break; const p = fr[key]; fr === result.frames[0] ? ctx.moveTo(X(p.x), Y(p.y)) : ctx.lineTo(X(p.x), Y(p.y)); }
    ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1;
  };
  trail('a', COLORS.a); trail('b', COLORS.b);

  // attack range, edge to edge: drawn from the attacker's centre it reaches the target's edge
  const ring = (r, color, dash) => {
    ctx.strokeStyle = color; ctx.setLineDash(dash); ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(X(f.a.x), Y(f.a.y), (r + RADIUS) * scale, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  };
  ring(timings.aa.range.v, COLORS.dim, [4, 4]);
  const doing = result.started.filter(s => s.t <= now).at(-1);
  if (doing && doing.action !== 'aa' && (f.a.state === 'cast' || f.a.state === 'dash')) ring(timings[doing.action].range.v, COLORS[LANE_COLOR[doing.action]], [2, 3]);

  const body = (p, color, label) => {
    ctx.fillStyle = color; ctx.globalAlpha = 0.18;
    ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), RADIUS * scale, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = color; ctx.font = `600 ${Math.max(10, Math.min(14, RADIUS * scale * 0.7))}px ${css('--font-mono')}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, X(p.x), Y(p.y));
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  };
  const me = champs.get(S.champ), them = champs.get(S.target);
  body(f.a, COLORS.a, me.name.slice(0, 3));
  body(f.b, COLORS.b, them.name.slice(0, 3));

  // health bar over the target
  const bw = Math.max(44, RADIUS * 2.4 * scale), bx = X(f.b.x) - bw / 2, by = Y(f.b.y) - RADIUS * scale - 14;
  ctx.fillStyle = COLORS.band; ctx.fillRect(bx, by, bw, 6);
  ctx.fillStyle = COLORS.b; ctx.fillRect(bx, by, bw * f.hp / result.maxHp, 6);
  ctx.strokeStyle = COLORS.rule; ctx.strokeRect(bx, by, bw, 6);

  for (const s of f.shots) {
    ctx.fillStyle = COLORS[LANE_COLOR[s.action]];
    ctx.beginPath(); ctx.arc(X(s.x), Y(s.y), 4, 0, Math.PI * 2); ctx.fill();
  }
  // damage numbers rise and fade for 0.7 s
  ctx.font = `600 13px ${css('--font-mono')}`; ctx.textAlign = 'center';
  let stack = 0;
  for (const e of result.events) {
    const age = now - e.t;
    if (age < 0 || age > 0.7 || e.dealt < 1) continue;
    ctx.globalAlpha = 1 - age / 0.7;
    ctx.fillStyle = COLORS[e.type === 'physical' ? 'phys' : e.type === 'magic' ? 'magic' : 'true'];
    ctx.fillText(Math.round(e.dealt), X(f.b.x) + (stack % 2 ? 22 : -22), by - 6 - age * 40 - Math.floor(stack / 2) * 14);
    stack++;
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'start';

  const stateText = { idle: '', move: 'walking into range', windup: 'winding up', cast: 'casting', dash: 'dashing', wait: 'waiting on a cooldown' }[f.a.state];
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
  const laneY = l => g.top + LANES.indexOf(l) * g.laneH;

  LANES.forEach((l, i) => {
    const y = g.top + i * g.laneH;
    ctx.fillStyle = COLORS.faint; ctx.fillText(l === 'item' ? 'ITM' : l.toUpperCase(), 6, y + g.laneH / 2);
    ctx.strokeStyle = COLORS.rule; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(g.left, y + g.laneH); ctx.lineTo(w - g.right, y + g.laneH); ctx.stroke(); ctx.globalAlpha = 1;
  });
  // seconds
  ctx.fillStyle = COLORS.faint; ctx.font = `10px ${css('--font-mono')}`; ctx.textAlign = 'center';
  const yTicks = g.top + LANES.length * g.laneH + g.hpH + 12;
  const step = result.end > 8 ? 2 : result.end > 3 ? 1 : 0.5;
  for (let s = 0; s <= result.end + 1e-9; s += step) {
    ctx.strokeStyle = COLORS.rule; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(g.X(s), g.top); ctx.lineTo(g.X(s), yTicks - 8); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillText(`${+s.toFixed(1)}s`, g.X(s), yTicks);
  }
  ctx.textAlign = 'start';

  for (const sp of result.spans) {
    const y = laneY(sp.lane), color = COLORS[LANE_COLOR[sp.lane]];
    const x0 = g.X(sp.from), x1 = Math.max(x0 + 2, g.X(Math.min(sp.to, result.end)));
    if (sp.kind === 'cooldown') { ctx.fillStyle = color; ctx.globalAlpha = 0.12; ctx.fillRect(x0, y + 4, x1 - x0, g.laneH - 8); }
    else if (sp.kind === 'travel') { ctx.strokeStyle = color; ctx.globalAlpha = 0.8; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.moveTo(x0, y + g.laneH / 2); ctx.lineTo(x1, y + g.laneH / 2); ctx.stroke(); ctx.setLineDash([]); }
    else { ctx.fillStyle = color; ctx.globalAlpha = sp.kind === 'dash' ? 0.55 : 0.9; ctx.fillRect(x0, y + 6, x1 - x0, g.laneH - 12); }
    ctx.globalAlpha = 1;
  }
  // hits: a tick where damage lands, a bar for damage spread over time
  for (const e of result.events) {
    const lane = LANES.includes(e.action) ? e.action : 'item', y = laneY(lane);
    ctx.fillStyle = COLORS[e.type === 'physical' ? 'phys' : e.type === 'magic' ? 'magic' : 'true'];
    if (e.over > 0) { ctx.globalAlpha = 0.45; ctx.fillRect(g.X(e.t), y + g.laneH - 5, g.X(Math.min(e.t + e.over, result.end)) - g.X(e.t), 3); ctx.globalAlpha = 1; }
    ctx.fillRect(g.X(e.t) - 1, y + 2, 2, g.laneH - 4);
  }
  // the target's health
  const hy = g.top + LANES.length * g.laneH + 4, hh = g.hpH - 8;
  ctx.strokeStyle = COLORS.b; ctx.lineWidth = 1.5; ctx.beginPath();
  result.frames.forEach((f, i) => { const x = g.X(f.t), y = hy + hh * (1 - f.hp / result.maxHp); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke(); ctx.lineWidth = 1;
  ctx.fillStyle = COLORS.faint; ctx.font = `10px ${css('--font-mono')}`; ctx.textBaseline = 'top'; ctx.fillText('HP', 6, hy); ctx.textBaseline = 'alphabetic';
  if (result.killedAt !== null) { ctx.fillStyle = COLORS.a; ctx.fillRect(g.X(result.killedAt) - 1, hy, 2, hh); }
  // playhead
  ctx.fillStyle = COLORS.text; ctx.fillRect(g.X(now) - 1, 0, 2, yTicks - 8);
}

function frameView() {
  const f = frameAt(now);
  $('clock').textContent = `${now.toFixed(2)} s`;
  $('scrub').value = String(now);
  $('r-hp').textContent = `${Math.round(f.hp)}`;
  $('r-dealt').textContent = `${Math.round(result.maxHp - f.hp)}`;
  $('play').textContent = playing ? '❚❚' : '▶';
  $('play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  drawFloor();
  drawLanes();
  const played = new Set(result.started.filter(s => !s.filler && s.t <= now + 1e-9).map(s => s.index));
  $('script').querySelectorAll('.chip').forEach(ch => ch.classList.toggle('played', played.has(+ch.dataset.i)));
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

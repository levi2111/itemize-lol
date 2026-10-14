/* Reviewer's view of the compiled data: everything needed to write or check a model.
     npm run data:report -- --champion Samira
     npm run data:report -- --item 3153
     npm run data:report                      (coverage overview) */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { formatExpr } from '../shared/expr.ts';
import type { AbilityModel, CalcData, ChampionData, DamageRef, ItemData, ItemModel, Rule } from '../shared/types.ts';
import { SLOTS } from '../shared/types.ts';
import { DATA_DIR, distDir } from './paths.ts';
import { plain } from './tooltip.ts';

const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));

export async function currentPatch(patch?: string): Promise<string> {
  if (patch) return patch;
  const latest = join(DATA_DIR, 'dist', 'latest.json');
  if (!existsSync(latest)) throw new Error('no dataset built yet: run `npm run data:build`');
  return (await readJson(latest)).patch;
}

const ranks = (v: number[], max: number) => {
  const xs = v.slice(1, Math.max(2, max + 1));
  return xs.every(x => x === xs[0]) ? String(xs[0]) : xs.join('/');
};
const showCalcs = (calcs: Record<string, CalcData>, out: string[]) => {
  for (const [name, c] of Object.entries(calcs)) out.push(`    ${name}${c.damageType ? ` <${c.damageType}>` : ''}${c.percent ? ' %' : ''} = ${formatExpr(c.expr)}`);
};
const showRefs = (refs: DamageRef[], out: string[]) => {
  let g = -1;
  for (const r of refs) {
    if (r.group !== g) { g = r.group; out.push(`    [${r.section}] …${r.context.slice(-230)}`); }
    out.push(`        ${r.type}: ${r.ref.spell ? r.ref.spell + '.' : ''}${r.ref.kind === 'eff' ? 'e' : ''}${r.ref.name}${r.times100 ? ' (×100%)' : ''}${r.qualifier ? `  "${r.qualifier}"` : ''}`);
  }
};
const showRule = (r: Rule) => `${r.on} ${r.type} ${r.count ? `${formatExpr(r.count)} × ` : ''}${formatExpr(r.amount)}`
  + `${r.over ? `  over ${formatExpr(r.over)} s` : ''}`
  + `${r.when ? `  when ${formatExpr(r.when)}` : ''}${r.crit ? `  crit ${formatExpr(r.crit)}` : ''}${r.appliesOnHit ? `  on-hit×${r.appliesOnHit}` : ''}`
  + `${r.then ? `  then ${r.then.map(t => `${t.counter} ${t.op === 'add' ? '+=' : '='} ${formatExpr(t.value)}`).join(', ')}` : ''}`;
const showModel = (m: AbilityModel | ItemModel, out: string[]) => {
  out.push(`  model: ${m.status}`);
  for (const r of m.rules) out.push(`    ${r.id}${r.label ? ` "${r.label}"` : ''}: ${showRule(r)}`);
  for (const s of m.statMods ?? []) out.push(`    stat ${s.stat} ${s.phase} ${formatExpr(s.value)}${s.when ? ` when ${formatExpr(s.when)}` : ''}`);
  for (const a of m.amps ?? []) out.push(`    amp +${formatExpr(a.value)}${a.types ? ` to ${a.types.join('/')}` : ''}${a.from ? ` from ${a.from.join('/')}` : ''}${a.when ? ` when ${formatExpr(a.when)}` : ''}`);
  for (const r of m.resists ?? []) out.push(`    ${r.stat} ${r.kind} ${formatExpr(r.value)}${r.when ? ` when ${formatExpr(r.when)}` : ''}`);
  if ('counters' in m) for (const [id, c] of Object.entries(m.counters)) out.push(`    counter ${id}${c.max ? ` max ${formatExpr(c.max)}` : ''}${c.start ? ` start ${formatExpr(c.start)}` : ''}`);
  if ('controls' in m) for (const c of m.controls ?? []) {
    const range = c.kind === 'bool' ? '' : ` ${c.min ?? 0}..${c.max ?? '∞'}`;
    out.push(`    control ${c.id} [${c.kind}${range}] "${c.label}"${c.default ? ` default ${formatExpr(c.default)}` : c.kind === 'procs' ? ' default: what the combo sets off' : ''}`);
  }
  for (const n of m.notes) out.push(`    note: ${n}`);
};

function championReport(c: ChampionData): string[] {
  const out: string[] = [`${c.name} (${c.id}, ${c.ranged ? 'ranged' : 'melee'})`, `  stats: ${JSON.stringify(c.stats)}`];
  for (const w of c.warnings) out.push(`  warning: ${w}`);
  const slotSpells = new Set(SLOTS.map(s => c.slots[s].spell));
  for (const slot of SLOTS) {
    const info = c.slots[slot], spell = c.spells[info.spell];
    out.push('', `${slot.toUpperCase()}  ${info.name}  [${info.spell}]`);
    if (!spell) { out.push('  (no game data)'); continue; }
    if (spell.cooldown) out.push(`  cooldown ${ranks(spell.cooldown, spell.maxRank)}${spell.cost ? `, cost ${ranks(spell.cost, spell.maxRank)}` : ''}`);
    if (spell.tooltip) out.push(`  tooltip: ${plain(spell.tooltip)}`);
    for (const [n, v] of Object.entries(spell.dataValues)) out.push(`    ${n}: ${ranks(v, spell.maxRank || 1)}`);
    spell.effects.forEach((v, i) => { if (i && v.some(x => x !== 0)) out.push(`    e${i}: ${ranks(v, spell.maxRank || 1)}`); });
    showCalcs(spell.calcs, out);
    if (spell.damageRefs.length) { out.push('  damage in tooltip:'); showRefs(spell.damageRefs, out); }
    showModel(c.models[slot], out);
  }
  // recasts, forms and empowered versions: a form's spell may have only a tooltip, its formulas living on the ability that grants the form
  const extra = Object.values(c.spells).filter(s => !slotSpells.has(s.id) && (Object.keys(s.calcs).length || s.tooltip));
  if (extra.length) out.push('', 'other spells with calculations or a tooltip:');
  for (const s of extra) {
    out.push(`  ${s.id}${s.slot ? ` (follows ${s.slot.toUpperCase()})` : ''}${s.name ? ` "${s.name}"` : ''}`);
    if (s.tooltip) out.push(`    tooltip: ${plain(s.tooltip)}`);
    for (const [n, v] of Object.entries(s.dataValues)) out.push(`    ${n}: ${ranks(v, s.maxRank || 1)}`);
    showCalcs(s.calcs, out);
    if (s.damageRefs.length) { out.push('    damage in tooltip:'); showRefs(s.damageRefs, out); }
  }
  return out;
}

function itemReport(i: ItemData): string[] {
  const out = [`${i.name} (${i.id}), ${i.gold} gold, tier ${i.tier}${i.component ? ', component' : ''}`, `  stats: ${JSON.stringify(i.stats)}`];
  if (i.tooltip) out.push(`  tooltip: ${plain(i.tooltip)}`);
  for (const [n, v] of Object.entries(i.dataValues)) out.push(`    ${n}: ${v}`);
  showCalcs(i.calcs, out);
  if (i.damageRefs.length) { out.push('  damage in tooltip:'); showRefs(i.damageRefs, out); }
  showModel(i.model, out);
  return out;
}

export interface ReportOptions {
  patch?: string; champion?: string; item?: string; status?: string;
  /** show the champion, or the item, with its model file as it is on disk now, not as last built */
  draft?: boolean;
  log?: (msg: string) => void;
}

export async function printReport(opts: ReportOptions = {}): Promise<void> {
  const log = opts.log ?? console.log;
  if (opts.champion && opts.draft) {
    const { draftChampion } = await import('./draft.ts');
    const d = await draftChampion(opts.champion, opts.patch);
    log(championReport(d.champion).join('\n'));
    for (const i of d.issues) log(`MODEL DOES NOT BIND  ${i.where}: ${i.message}`);
    if (d.issues.length) process.exitCode = 1;
    return;
  }
  const dir = distDir(await currentPatch(opts.patch));
  if (opts.champion) {
    const index: { id: string; name: string }[] = await readJson(join(dir, 'champions.json'));
    const q = opts.champion.toLowerCase();
    const hit = index.find(c => c.id.toLowerCase() === q || c.name.toLowerCase() === q);
    if (!hit) throw new Error(`no champion "${opts.champion}"`);
    log(championReport(await readJson(join(dir, 'champions', `${hit.id}.json`))).join('\n'));
    return;
  }
  let items: ItemData[] = await readJson(join(dir, 'items.json'));
  if (opts.item && opts.draft) {
    const { draftItems } = await import('./draft.ts');
    const d = await draftItems(opts.patch);
    items = d.items;
    const q = opts.item.toLowerCase(), shown = (id: number) => { const it = items.find(i => i.id === id); return !!it && (String(id) === q || it.name.toLowerCase().includes(q)); };
    // another item's model, half written, is not this report's business; a file that cannot be loaded is
    const mine = d.issues.filter(i => i.item === undefined || shown(i.item));
    for (const i of mine) log(`MODEL DOES NOT BIND  ${i.where}: ${i.message}`);
    if (mine.length) process.exitCode = 1;
  }
  if (opts.item) {
    const q = opts.item.toLowerCase();
    const hits = items.filter(i => String(i.id) === q || i.name.toLowerCase().includes(q));
    if (!hits.length) throw new Error(`no item "${opts.item}"`);
    log(hits.map(i => itemReport(i).join('\n')).join('\n\n'));
    return;
  }
  const report = await readJson(join(dir, 'report.json'));
  log(JSON.stringify({ patch: report.patch, coverage: report.coverage, anchors: report.anchors, modelIssues: report.modelIssues, stale: report.stale, sourceMismatches: report.sourceMismatches, unknownParts: report.unknownParts, unknownStats: report.unknownStats }, null, 1));
  if (opts.status) {
    const index: { id: string; status: Record<string, string> }[] = await readJson(join(dir, 'champions.json'));
    for (const c of index) {
      const slots = Object.entries(c.status).filter(([, s]) => s === opts.status).map(([s]) => s.toUpperCase());
      if (slots.length) log(`${c.id}: ${slots.join(' ')}`);
    }
    for (const i of items) if (i.model.status === opts.status && !i.component) log(`item ${i.id} ${i.name}`);
  }
}

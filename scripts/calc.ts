/* Runs one calculation from the command line and prints the breakdown. A quick way to
   sanity-check a model while writing it.

     node scripts/calc.ts Samira --level 13 --ranks 5,1,5,2 --items 6672,3031 --combo aa:3,q:1,r:1 --target 2400,80,50
     node scripts/calc.ts Kaisa --combo aa,aa,w,aa,aa,aa --raw
     node scripts/calc.ts Ahri --draft          (src/models/champions/Ahri.ts and src/models/items/*.ts as they are now, without a data:build)
     node scripts/calc.ts Garen --items 3078,3161 --settings 3078:spellblade=3,3161:stacks=4
                                                (an item's settings: the ids `data:report -- --item` lists under "controls") */
import { calculate } from '../src/engine/calc.ts';
import type { Action, DataSource } from '../src/engine/types.ts';
import { Dataset } from '../src/server/dataset.ts';

const [champion = '', ...rest] = process.argv.slice(2);
const arg = (name: string) => { const i = rest.indexOf(`--${name}`); return i > -1 ? rest[i + 1] : undefined; };
const nums = (s: string | undefined, fallback: number[]) => s ? s.split(',').map(Number) : fallback;

const built = new Dataset(arg('patch'));
let data: DataSource = built;
if (rest.includes('--draft')) {
  // the model files as they are on disk now, bound in memory; everything else as last built
  const { draftChampion, draftItems } = await import('../src/pipeline/draft.ts');
  const d = await draftChampion(champion, built.patch), di = await draftItems(built.patch);
  // another item's model, half written, does not stop this calculation; a file that cannot be loaded does
  const wanted = new Set(nums(arg('items'), []));
  const blocking = [...d.issues, ...di.issues.filter(i => i.item === undefined || wanted.has(i.item))];
  for (const i of blocking) console.log(`MODEL DOES NOT BIND  ${i.where}: ${i.message}`);
  if (blocking.length) process.exit(1);
  const items = new Map(di.items.map(i => [i.id, i]));
  data = { patch: built.patch, champion: id => id.toLowerCase() === d.champion.id.toLowerCase() ? d.champion : built.champion(id), item: id => items.get(id) };
}
// --settings 3161:stacks=4,3078:spellblade=2
const itemOptions: Record<string, Record<string, number>> = {};
for (const part of (arg('settings') ?? '').split(',').filter(Boolean)) {
  const [id, kv = ''] = part.split(':'), [k, v] = kv.split('=');
  (itemOptions[id!] ??= {})[k!] = Number(v ?? 1);
}
const [q, w, e, r] = nums(arg('ranks'), [5, 5, 5, 3]) as [number, number, number, number];
const [hp, armor, mr] = nums(arg('target'), [2400, 80, 50]) as [number, number, number];
const combo = arg('combo') ?? 'aa:3,q:1,w:1,e:1,r:1';
const options = Object.fromEntries((arg('options') ?? '').split(',').filter(Boolean).map(kv => { const [k, v] = kv.split('='); return [k!, Number(v ?? 1)]; }));

const res = calculate(data, {
  build: { champion, level: Number(arg('level') ?? 18), ranks: { q, w, e, r }, items: nums(arg('items'), []), options, itemOptions },
  target: rest.includes('--raw') ? null : { hp, armor, mr },
  combo: combo.includes(':')
    ? { counts: Object.fromEntries(combo.split(',').map(p => { const [a, n] = p.split(':'); return [a!, Number(n)]; })) }
    : { sequence: combo.split(',') as Action[] },
});

if (rest.includes('--json')) { console.log(JSON.stringify(res, null, 1)); process.exit(0); }
const s = res.stats;
console.log(`${champion} L${s.level}  AD ${s.ad.total.toFixed(1)} (${s.ad.bonus.toFixed(0)} bonus)  AP ${s.ap.total.toFixed(0)}  AS ${s.attackSpeed.total.toFixed(3)}  crit ${(s.critChance * 100).toFixed(0)}% x${s.critDamage}  leth ${s.lethality}  apen ${(s.armorPenPct * 100).toFixed(0)}%  mpen ${s.magicPenFlat}/${(s.magicPenPct * 100).toFixed(0)}%  HP ${s.hp.total.toFixed(0)}`);
console.log(`sequence: ${res.sequence.join(' ')}`);
for (const l of res.combo.lines) {
  if (l.type === 'none' && !l.qty) continue;
  console.log(`  ${(l.qty === null ? '' : l.qty + '×').padEnd(4)}${l.label.padEnd(22)} ${l.type.padEnd(9)} raw ${String(l.total.raw).padStart(9)}  dealt ${String(l.total.dealt).padStart(9)}   [${res.abilities[l.key as 'q']?.status ?? ''}]`);
  if (l.over) console.log(`        over time: ${l.over.perSecond.raw}/s raw, ${l.over.perSecond.dealt}/s dealt for ${l.over.seconds} s`);
  for (const p of l.parts) console.log(`        ${p.label} (${p.id}) ${p.type} ×${p.hits}: raw ${p.total.raw}, dealt ${p.total.dealt}${p.over ? `   over ${p.over.seconds} s: ${p.over.perSecond.raw}/s raw, ${p.over.perSecond.dealt}/s dealt` : ''}`);
}
console.log(`  TOTAL raw ${res.combo.total.raw}  dealt ${res.combo.total.dealt}  blocked ${res.combo.blocked}  hp left ${res.combo.hpLeft}`);
console.log(`  DPS raw ${res.dps.raw} dealt ${res.dps.dealt}   time to kill ${res.timeToKill ?? '–'} s`);
for (const [slot, a] of Object.entries(res.abilities)) {
  if (!a.cast) continue;
  const cd = a.cooldown ? `cooldown ${a.cooldown.seconds} s (${a.cooldown.base} s, ${a.cooldown.haste} haste)` : 'no cooldown in the game data';
  console.log(`  one ${slot.toUpperCase()}: raw ${a.cast.raw}  dealt ${a.cast.dealt}   ${cd}`);
}
for (const i of res.items) {
  const set = Object.entries(i.settings).map(([k, v]) => `${k}=${v ?? 'auto'}`).join(' ');
  if (set || i.effects.length) console.log(`  item ${i.id}${set ? `  settings: ${set}` : ''}`);
  for (const e of i.effects) console.log(`        ${e.label} (${e.id}) ${e.type}: one ${e.one.raw} raw, ${e.one.dealt} dealt; fired ${e.fired}× in the combo`);
}
for (const c of res.caveats) console.log(`  ! ${c}`);
for (const [slot, a] of Object.entries(res.abilities)) for (const n of a.notes) console.log(`  ${slot.toUpperCase()} (${a.status}): ${n}`);
for (const i of res.items) for (const n of i.notes) console.log(`  item ${i.id} (${i.status}): ${n}`);

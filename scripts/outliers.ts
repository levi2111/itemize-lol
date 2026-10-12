/* Sanity scan: every champion's full combo at level 18 with no items, raw output.
   Prints the extremes, which is where a wrong model shows first: an ability counted
   as a percentage of nothing, a multiplier applied twice, a kit that does no damage.

     node scripts/outliers.ts [--top 12] */
import { calculate } from '../src/engine/calc.ts';
import { Dataset } from '../src/server/dataset.ts';
import { CAST_SLOTS } from '../src/shared/types.ts';

const top = Number(process.argv[process.argv.indexOf('--top') + 1]) || 12;
const data = new Dataset();
const rows = data.index.map(c => {
  const champ = data.champion(c.id)!;
  const ranks = { q: champ.slots.q.maxRank, w: champ.slots.w.maxRank, e: champ.slots.e.maxRank, r: champ.slots.r.maxRank };
  const res = calculate(data, { build: { champion: c.id, level: 18, ranks, items: [] }, target: null, combo: { counts: { q: 1, w: 1, e: 1, r: 1 } } });
  const per = Object.fromEntries(CAST_SLOTS.map(s => [s, Math.round(res.combo.lines.find(l => l.key === s)!.total.raw)]));
  return { id: c.id, total: Math.round(res.combo.total.raw), per, status: CAST_SLOTS.map(s => champ.models[s].status[0]).join(''), caveats: res.caveats.length };
});
const show = (r: typeof rows[number]) => console.log(`  ${r.id.padEnd(14)} ${String(r.total).padStart(6)}   Q ${String(r.per.q).padStart(5)}  W ${String(r.per.w).padStart(5)}  E ${String(r.per.e).padStart(5)}  R ${String(r.per.r).padStart(5)}   [${r.status}]${r.caveats ? `  ${r.caveats} caveats` : ''}`);
rows.sort((a, b) => b.total - a.total);
console.log(`highest raw QWER at 18, no items (status letters: c curated, a auto, n none, u unmodeled, s stale, v verified)`);
rows.slice(0, top).forEach(show);
console.log('lowest');
rows.slice(-top).forEach(show);
const single = rows.flatMap(r => CAST_SLOTS.map(s => ({ id: r.id, slot: s, v: r.per[s]! }))).sort((a, b) => b.v - a.v).slice(0, top);
console.log('largest single abilities:', single.map(x => `${x.id} ${x.slot.toUpperCase()} ${x.v}`).join(', '));
const median = rows[Math.floor(rows.length / 2)]!.total;
console.log(`median ${median}; ${rows.filter(r => r.total === 0).length} champions with no ability damage counted`);

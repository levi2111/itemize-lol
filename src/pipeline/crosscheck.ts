/* Development aid: compares the structure of our models with the community wiki's
   ability tables (via Meraki Analytics' export of them).

   The wiki often lists both "Damage Per Shot" and "Total Damage". Their ratio is the
   hit count, which is exactly what game data does not contain. This prints every
   ability where that ratio disagrees with what our model counts, as a to-do list
   for whoever writes models.

   It is a pointer for a human, nothing more. The wiki is CC BY-SA and lags behind
   patches (its Samira numbers were a balance pass out of date when this was
   written), so none of it is copied into the dataset: the file is downloaded to
   data/crosscheck/, which is ignored by git and never served. */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ChampionData, Slot } from '../shared/types.ts';
import { SLOTS } from '../shared/types.ts';
import { crosscheckDir, distDir } from './paths.ts';
import { currentPatch } from './report.ts';

const SOURCE = 'https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json';

interface WikiLevel { attribute: string; modifiers: { values: number[] }[] }
interface WikiAbility { name: string; effects: { leveling: WikiLevel[] }[] }

/** "Total Physical Damage" + "Physical Damage Per Shot" with a constant whole ratio -> that many hits. */
function wikiHitCounts(abilities: WikiAbility[]): { n: number; total: string; per: string }[] {
  const rows = abilities.flatMap(a => a.effects.flatMap(e => e.leveling)).filter(l => l.modifiers[0]?.values.length);
  const out: { n: number; total: string; per: string }[] = [];
  for (const total of rows.filter(r => /\btotal\b|\bmaximum\b/i.test(r.attribute))) {
    const kind = /(physical|magic|true)/i.exec(total.attribute)?.[1]?.toLowerCase();
    for (const per of rows) {
      if (per === total || /\btotal\b|\bmaximum\b|minion|monster/i.test(per.attribute) || /minion|monster/i.test(total.attribute)) continue;
      if (kind && !per.attribute.toLowerCase().includes(kind)) continue;
      if (!/damage/i.test(per.attribute)) continue;
      // "Minimum" and "Maximum" rows are the two ends of a scaling range, not a hit and its total
      if (/\bminimum\b/i.test(per.attribute)) continue;
      const a = total.modifiers[0]!.values, b = per.modifiers[0]!.values;
      if (a.length !== b.length || b.some(v => v <= 0)) continue;
      const ratios = a.map((v, i) => v / b[i]!);
      const n = Math.round(ratios[0]!);
      if (n >= 2 && n <= 30 && ratios.every(r => Math.abs(r - n) < 1e-6)) out.push({ n, total: total.attribute, per: per.attribute });
    }
  }
  return out;
}

/** The largest fixed repeat count among a slot's rules; formulas that are not plain numbers show as "formula". */
function modelCount(c: ChampionData, slot: Slot): number | 'formula' {
  let best = 1;
  for (const r of c.models[slot].rules) {
    if (!r.count) continue;
    if (r.count.k !== 'num') return 'formula';
    best = Math.max(best, r.count.v);
  }
  return best;
}

export interface CrosscheckOptions { patch?: string; champion?: string; refresh?: boolean; log?: (msg: string) => void }

export async function crosscheck(opts: CrosscheckOptions = {}): Promise<void> {
  const log = opts.log ?? console.log;
  const file = join(crosscheckDir(), 'meraki-champions.json');
  if (opts.refresh || !existsSync(file)) {
    log(`downloading ${SOURCE}`);
    const res = await fetch(SOURCE, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`${res.status} from ${SOURCE}`);
    await mkdir(crosscheckDir(), { recursive: true });
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  const wiki: Record<string, { abilities: Record<string, WikiAbility[]> }> = JSON.parse(await readFile(file, 'utf8'));
  const dir = distDir(await currentPatch(opts.patch));
  const index: { id: string }[] = JSON.parse(await readFile(join(dir, 'champions.json'), 'utf8'));

  let flagged = 0, agreed = 0;
  for (const { id } of index) {
    if (opts.champion && id.toLowerCase() !== opts.champion.toLowerCase()) continue;
    const w = wiki[id];
    if (!w) { if (opts.champion) log(`${id}: not in the wiki export`); continue; }
    const c: ChampionData = JSON.parse(await readFile(join(dir, 'champions', `${id}.json`), 'utf8'));
    for (const slot of SLOTS) {
      const hits = wikiHitCounts(w.abilities[slot.toUpperCase()] ?? []);
      if (!hits.length) continue;
      const ours = modelCount(c, slot), status = c.models[slot].status;
      // several pairs can match; the model agrees if it matches any of them
      const ok = ours === 'formula' || hits.some(h => h.n === ours);
      if (ok) { agreed++; if (!opts.champion) continue; } else flagged++;
      const h = hits[0]!;
      log(`${ok ? '  ok  ' : 'REVIEW'}  ${id} ${slot.toUpperCase()} (${status}): wiki implies ${[...new Set(hits.map(x => x.n))].join(' or ')} hits ("${h.total}" / "${h.per}"); model counts ${ours}`);
    }
  }
  log(`${flagged} abilities to review, ${agreed} agree with the wiki's hit counts`);
}

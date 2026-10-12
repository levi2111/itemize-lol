/* Canaries for the undocumented parts of the game data format.

   Each anchor names a calculation whose meaning is common knowledge and says which
   stat it must read. If a patch renumbers the stat enum again (it has before), these
   stop matching and the build fails instead of shipping, say, every AD ratio as AP. */
import { walk } from '../shared/expr.ts';
import type { CalcData, StatId } from '../shared/types.ts';

interface Anchor {
  /** champion id, or an item id */
  owner: string | number;
  spell?: string;
  calc: string;
  reads: StatId[];
  /** the stat must be read from the target */
  ofTarget?: boolean;
  why: string;
}

const ANCHORS: Anchor[] = [
  { owner: 'Ahri', spell: 'AhriQ', calc: 'TotalDamage', reads: ['ap'], why: 'Orb of Deception scales with AP' },
  { owner: 'Samira', spell: 'SamiraR', calc: 'DamageCalc', reads: ['ad'], why: 'Inferno Trigger scales with AD' },
  { owner: 'Samira', spell: 'SamiraR', calc: 'CriticalDamageCalc', reads: ['critDamage'], why: 'Inferno Trigger shots can crit' },
  { owner: 'Malphite', spell: 'Landslide', calc: 'EDamageCalc', reads: ['armor'], why: 'Ground Slam scales with armor' },
  { owner: 'Galio', spell: 'GalioPassive', calc: 'TotalDamage', reads: ['mr'], why: 'Colossal Smash scales with magic resist' },
  { owner: 'Kaisa', spell: 'KaisaE', calc: 'TotalCastTime', reads: ['attackSpeed'], why: 'Supercharge charges faster with attack speed' },
  { owner: 'Hecarim', spell: 'HecarimPassive', calc: 'BonusAD', reads: ['moveSpeed'], why: 'Warpath turns move speed into AD' },
  { owner: 'Jhin', spell: 'JhinPassive', calc: 'TotalADPercent', reads: ['critChance', 'attackSpeed'], why: 'Whisper turns crit and attack speed into AD' },
  { owner: 'Braum', spell: 'BraumQ', calc: 'TotalDamage', reads: ['maxHealth'], why: "Winter's Bite scales with max health" },
  { owner: 'Pyke', spell: 'PykeR', calc: 'RLethalityDamage', reads: ['lethality'], why: 'Death from Below scales with lethality' },
  { owner: 'Urgot', spell: 'UrgotW', calc: 'RangeCheck', reads: ['attackRange'], why: 'Purge uses attack range' },
  { owner: 3115, calc: 'TotalOnHitDamage', reads: ['ap'], why: "Nashor's Tooth on-hit scales with AP" },
  { owner: 3153, calc: '{405deeb1}', reads: ['currentHealth'], ofTarget: true, why: "Blade of the Ruined King reads the target's current health" },
];

export interface AnchorResult { failed: string[]; missing: string[]; passed: number }

export function checkAnchors(calcOf: (owner: string | number, spell: string | undefined, calc: string) => CalcData | undefined): AnchorResult {
  const res: AnchorResult = { failed: [], missing: [], passed: 0 };
  for (const a of ANCHORS) {
    const name = `${a.owner}${a.spell ? '.' + a.spell : ''}.${a.calc}`;
    const c = calcOf(a.owner, a.spell, a.calc);
    if (!c) { res.missing.push(`${name} (${a.why})`); continue; }
    const stats = [...walk(c.expr)].flatMap(n => n.k === 'stat' ? [n] : []);
    const ok = a.reads.every(want => stats.some(s => s.stat === want && (!a.ofTarget || s.of === 'target')));
    if (ok) res.passed++;
    else res.failed.push(`${name}: expected it to read ${a.reads.join(' and ')}${a.ofTarget ? ' of the target' : ''}, found ${stats.map(s => s.stat).join(', ') || 'no known stat'} (${a.why})`);
  }
  return res;
}

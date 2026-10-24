import { champion } from '../dsl.ts';

/* Naafiri's Packmates are the part the game data cannot place: it has the damage
   of one Packmate attack and how many she may have, but not when they attack. The
   model paces them by her own basic attacks, and counts each one again when it
   dashes in with Hounds' Pursuit.

   The game files keep the two swapped abilities under their old spell ids: the W
   slot, The Call of the Pack, is NaafiriR, and the R slot, Hounds' Pursuit, is
   NaafiriW. Each slot reads its own spell, so only `vars` have to spell that out. */
export default champion('Naafiri', {
  reviewed: '16.20.1',
  vars: {
    // The Call of the Pack's extra Packmates go over the cap
    pack: 'min(packmates, NaafiriP.PackmateCap) + if(hunt && rank.w, NaafiriR.PackmatesToAdd, 0)',
    frenzied: 'time < frenzyUntil',
  },
  options: {
    packmates: { label: 'Packmates alive', kind: 'int', default: 'NaafiriP.PackmateCap', min: 0 },
    hunt: { label: 'The Call of the Pack active', default: false },
    qCast: { label: 'Darkin Daggers cast counted (0 both, 1 the first, 2 the recast)', kind: 'int', default: 0, min: 0, max: 2, timeline: true },
  },
  // frenzyUntil: the moment the Packmates' increased damage from the last ability runs out
  counters: { frenzyUntil: {} },
  p: {
    rules: [
      { id: 'frenzy', on: 'ability', type: 'physical', amount: 0, then: 'frenzyUntil = time + PackmateFrenzyDuration' },
      // the game data has a base attack speed for Packmates, close to hers, and nothing on how it grows: they bite when she does
      {
        id: 'packmates', label: 'Packmate attacks', on: 'attack', type: 'physical', count: 'pack',
        amount: 'PackmateTotalDamage * if(frenzied, PackmateFrenzyDamageMult, 1)',
        note: 'Every Packmate attacks once per basic attack Naafiri makes, at its increased damage for a few seconds after each ability in the combo. All of them are counted alive: the most her level allows unless "Packmates alive" is changed.',
      },
    ],
  },
  q: {
    hits: [
      { id: 'dagger', label: 'First dagger', type: 'physical', amount: 'TotalDamageFirstCast', when: 'qCast != 2' },
      // the recast works out its bonus from the health missing before it deals the rest of the bleed
      {
        id: 'recast', label: 'Second dagger', type: 'physical', when: 'qCast != 1',
        amount: 'TotalMinDamageSecondCast + (TotalMaxDamageSecondCast - TotalMinDamageSecondCast) * target.missingHpPct',
        note: 'Both daggers are counted; the second grows with the health the target has lost by then.',
      },
      // ticking down or cashed in by the second dagger, the bleed deals the same total
      { id: 'bleed', label: 'Bleed', type: 'physical', amount: 'TotalBleedDamage', when: 'qCast != 2', note: 'The whole bleed of Darkin Daggers is counted.' },
    ],
  },
  w: {
    // BonusAD is a share of total attack damage, which is what a percent change adds
    statMods: [{ stat: 'ad', phase: 'percent', value: 'NaafiriADPercentBoost', when: 'hunt' }],
    notes: ['The Call of the Pack deals no damage. Its attack damage and extra Packmates count only when "The Call of the Pack active" is set, and then for the whole fight.'],
  },
  e: {
    hits: [
      { id: 'dash', label: 'Dash', type: 'physical', amount: 'TotalDamageFirstSlash' },
      { id: 'flurry', label: 'Flurry of blades', type: 'physical', amount: 'TotalDamageSecondSlash', note: 'Both the dash and the flurry of Eviscerate are counted.' },
    ],
  },
  r: {
    hits: [
      { id: 'dash', type: 'physical', amount: 'TotalDamage' },
      {
        id: 'packmates', label: 'Packmates dashing in', type: 'physical', amount: 'PackmateDamage', count: 'pack',
        note: 'Every Packmate is counted as landing its dash with Hounds\' Pursuit.',
      },
    ],
  },
});

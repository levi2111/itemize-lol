import { champion } from '../dsl.ts';

/* A Powder Keg has no damage of its own: it repeats the hit that set it off,
   through less armor, and adds a flat amount against champions. The game data
   has the armor share and the flat amount; that the hit is a basic attack or a
   Parrrley, and that the explosion makes Trial by Fire ready again, is what the
   model adds. Cannon Barrage is given per wave, with its shop upgrades only in
   the tooltip's prose. */
export default champion('Gangplank', {
  reviewed: '16.20.1',
  vars: {
    byShot: 'parrrleyKeg && rank.q > 0',
    // the explosion deals the damage of the hit that destroyed the keg, crit included
    kegStrike: 'if(byShot, GangplankQWrapper.ShotDamage, ad)',
    kegCrit: 'if(byShot, GangplankQWrapper.ShotCrit, ad * critDamage)',
  },
  options: {
    parrrleyKeg: { label: 'Powder Keg set off by Parrrley', default: false },
    fireAtWill: { label: 'Cannon Barrage upgrade: Fire at Will', default: false },
    deathsDaughter: { label: "Cannon Barrage upgrade: Death's Daughter", default: false },
  },
  // the time Trial by Fire is ready again
  counters: { fireBack: {} },
  p: {
    rules: [{
      id: 'burn', on: 'attack', when: 'time >= fireBack', type: 'true', amount: 'TotalDamage',
      over: 'DoTDuration',
      then: 'fireBack = time + Cooldown',
      note: 'The whole burn of Trial by Fire is counted. It is ready for the first attack, then returns on its cooldown or as soon as a Powder Keg explodes.',
    }],
  },
  q: {
    // a shot that applies on-hit effects, but not Trial by Fire, which is an attack rule
    hits: [{ id: 'shot', type: 'physical', amount: 'ShotDamage', crit: 'ShotCrit', appliesOnHit: true }],
  },
  // Remove Scurvy only heals and cleanses
  w: {},
  e: {
    hits: [
      {
        id: 'blast', label: 'Keg explosion', type: 'physical', amount: 'kegStrike', crit: 'kegCrit',
        then: 'fireBack = 0',
      },
      { id: 'champion', label: 'Keg bonus against champions', type: 'physical', amount: 'BonusDamageToChampions' },
    ],
    // only the explosion ignores armor; the data value is in percent points
    resists: [{ stat: 'armor', kind: 'penPct', value: 'BarrelArmorPenetration / 100', when: 'cast.e' }],
    notes: [
      'One keg explosion is counted, set off by a basic attack. That attack hits the keg, not the target, so do not add it to the combo.',
      'With "Powder Keg set off by Parrrley" the explosion deals Parrrley\'s damage instead; that Parrrley also hits the keg, so do not add a Q for it.',
    ],
  },
  r: {
    hits: [
      // the tooltip states six more waves for Fire at Will; the game data has no value for it
      // fire at will's extra waves land within the same duration: it fires faster, not longer
      { id: 'waves', type: 'magic', amount: 'OneWaveDamage', count: 'TotalWavesTooltip + if(fireAtWill, 6, 0)', over: 'ZoneDuration' },
      { id: 'daughter', label: "Death's Daughter", type: 'true', amount: 'DeathsDaughterDamage', when: 'deathsDaughter' },
    ],
    notes: [
      'Every wave of Cannon Barrage is counted, as if the target stays in the area for its whole duration.',
      'The Fire at Will and Death\'s Daughter upgrades are off unless they are set.',
    ],
  },
});

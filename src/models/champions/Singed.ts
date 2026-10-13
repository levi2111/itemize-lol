import { champion } from '../dsl.ts';

/* Poison Trail is a toggle. The game data has its damage per second and how often
   it ticks, but how long an enemy stays poisoned depends on how the chase goes, so
   that is an option. */
export default champion('Singed', {
  reviewed: '16.20.1',
  options: {
    // default: standing in one cloud for its whole life, plus the poison that lingers after it
    trailSeconds: { label: 'Seconds the target is poisoned by Poison Trail', kind: 'int', default: 'PoisonTrail.CloudDuration + PoisonTrail.PoisonDuration', min: 1 },
    potion: { label: 'Insanity Potion active', default: false },
  },
  // Noxious Slipstream only grants move speed
  p: {},
  q: {
    // damage is given per second and dealt in TicksPerSecond ticks
    hits: [{
      id: 'poison', type: 'magic', amount: 'DamagePerSecond / TicksPerSecond', count: 'trailSeconds * TicksPerSecond',
      over: 'trailSeconds',
      note: 'Poison Trail is a toggle: it is counted for the number of seconds set in "Seconds the target is poisoned by Poison Trail".',
    }],
  },
  // Mega Adhesive only slows and grounds
  w: {},
  e: {
    // MaxHPDamage is in percent points of the target's maximum health
    hits: [{ id: 'fling', type: 'magic', amount: 'BaseDamage + MaxHPDamage / 100 * target.maxHp' }],
  },
  r: {
    // the armor, magic resist, move speed and regeneration it also grants do not change damage
    statMods: [{ stat: 'ap', value: 'StatAmount', when: 'potion' }],
    notes: ['The ability power is off unless "Insanity Potion active" is set.'],
  },
});

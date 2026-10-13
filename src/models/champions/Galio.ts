import { champion } from '../dsl.ts';

/* Colossal Smash is a basic attack on a cooldown that Galio's own abilities cut
   short; the game data has the cooldown and the cut, the model keeps the clock.
   Winds of War's tornado is given as a share of maximum health for all of its
   ticks, and Shield of Durand as a range between an instant and a full charge. */
export default champion('Galio', {
  reviewed: '16.20.1',
  options: {
    wCharged: { label: 'Shield of Durand fully charged', default: true },
  },
  // abilities that have hit since the last Colossal Smash
  counters: { landed: {} },
  p: {
    rules: [
      // TotalDamage is the whole empowered attack; the engine already counts the attack itself
      {
        id: 'smash', on: 'attack', type: 'magic', amount: 'TotalDamage - ad',
        cooldown: 'PassiveCooldownModified - ChargeRatePerHit * landed', then: 'landed = 0',
        note: 'Colossal Smash is ready for the first attack and then comes back on its cooldown, sooner for each ability cast in between.',
      },
      { id: 'hasten', on: 'spell', type: 'magic', amount: 0, then: 'landed += 1' },
    ],
    notes: ['The attack under Colossal Smash is still counted as physical damage; in the game the whole hit is magic.'],
  },
  q: {
    hits: [
      // the two windblasts take separate paths to the same spot; an enemy is damaged by one of them
      { id: 'gust', label: 'Windblast', type: 'magic', amount: 'QMissileDamage', note: 'One windblast is counted: the two do not both damage the same enemy.' },
      // PercentSuperQDamageTT is the whole tornado in percent points of maximum health
      {
        id: 'tornado', label: 'Tornado', type: 'magic', count: 'TornadoTicks',
        amount: 'PercentSuperQDamageTT / TornadoTicks / 100 * target.maxHp',
        over: 'SuperQDuration',
        note: 'Every tick of the tornado is counted, as if the target stays in it for its full duration.',
      },
    ],
  },
  w: {
    hits: [{
      id: 'release', type: 'magic', amount: 'if(wCharged, MaxTotalDamage, MinTotalDamage)',
      note: 'Shield of Durand is counted at full charge unless "Shield of Durand fully charged" is turned off, which counts an instant release.',
    }],
  },
  e: {
    hits: [{ id: 'punch', type: 'magic', amount: 'TotalDamage' }],
  },
  r: {
    hits: [{ id: 'landing', type: 'magic', amount: 'TotalDamage' }],
  },
});

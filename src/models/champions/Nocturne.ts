import { champion } from '../dsl.ts';

/* Umbra Blades turns an attack into a stronger one, so the model adds only the
   difference, and its cooldown is one the attacks themselves shorten. Dusk
   Trail's attack damage and Shroud of Darkness's attack speed are stat changes;
   the rest of the kit is one hit per cast. */
export default champion('Nocturne', {
  reviewed: '16.20.1',
  options: {
    duskTrail: { label: 'Standing on the Dusk Trail', default: false },
    shroudBlocked: { label: 'Shroud of Darkness blocked an ability', default: false },
  },
  // attacks since Umbra Blades last struck, that one included
  counters: { swings: {} },
  p: {
    rules: [
      { id: 'swing', on: 'attack', type: 'physical', amount: 0, then: 'swings += 1' },
      // the empowered attack replaces the basic attack the engine already dealt; a crit has its own, lower ratio.
      // every attack after the empowered one takes time off the cooldown, checked before the attack that would use it
      {
        id: 'umbra', on: 'attack', type: 'physical',
        amount: 'TotalDamageNoCrit - ad', crit: '(TotalDamageCrit - ad) * critDamage',
        cooldown: 'Cooldown - AAChampMonsterCDR * (swings - 1)', then: 'swings = 0',
        note: 'Umbra Blades is ready for the first attack; after that its cooldown runs down with time and with every attack on the champion.',
      },
    ],
  },
  q: {
    // the blade is thrown before there is a trail to stand on, so its own damage leaves the trail's attack damage out
    hits: [{
      id: 'blade', type: 'physical',
      amount: 'if(duskTrail, BaseDamage + (TotalDamage - BaseDamage) * (1 - BonusTrailAD / bonusAd), TotalDamage)',
    }],
    statMods: [{ stat: 'ad', value: 'BonusTrailAD', when: 'duskTrail' }],
    notes: ['With "Standing on the Dusk Trail" set, its attack damage counts for attacks and Paranoia, not for Duskbringer itself.'],
  },
  w: {
    // ActiveAS is in percent points; blocking an ability doubles it for a few seconds
    statMods: [{ stat: 'attackSpeed', value: 'ActiveAS / 100 * (1 + shroudBlocked)' }],
  },
  e: {
    hits: [{ id: 'tether', type: 'magic', amount: 'TotalDamage', over: 'LeashDuration', note: 'The full duration of the Unspeakable Horror tether is counted.' }],
  },
  r: {
    hits: [{ id: 'dash', type: 'physical', amount: 'Damage' }],
  },
});

import { champion } from '../dsl.ts';

/* Two of Fiddlesticks' abilities read the target's health, in opposite directions:
   Terrify takes a share of what is left (with a floor), Bountiful Harvest ends on a
   share of what is missing. Terrify also doubles against a target Fiddlesticks has
   feared recently, which usually means an ability from out of sight landed first.
   A combo without timings cannot know that, so it is an option. */
export default champion('Fiddlesticks', {
  reviewed: '16.20.1',
  options: {
    feared: { label: 'Target was recently Feared by Fiddlesticks', default: false },
  },
  // A Harmless Scarecrow is effigies and vision
  p: {},
  q: {
    // the passive half only fears; the doubled floor is written in the tooltip as MinimumDamage*2
    hits: [
      { id: 'crow', type: 'magic', amount: 'max(TotalPercentHealthDamage * target.hp, MinimumDamage)', when: '!feared' },
      {
        id: 'crowFeared', label: 'Terrify on a recently Feared target', type: 'magic',
        amount: 'max(TotalPercentHealthDamageFeared * target.hp, MinimumDamage * 2)', when: 'feared',
      },
    ],
    notes: ['Terrify deals its normal damage unless "Target was recently Feared by Fiddlesticks" is set, also for a second Terrify in the same combo.'],
  },
  w: {
    hits: [
      // damage is given per second and dealt in TicksPerSecond ticks; the last tick carries the missing-health part
      // the ticks counted here are all but the last, so they take one tick less than the channel
      { id: 'drain', type: 'magic', amount: 'DrainDamageCalc / TicksPerSecond', count: 'DrainDuration * TicksPerSecond - 1', over: 'DrainDuration - 1 / TicksPerSecond' },
      {
        id: 'end', label: 'Final tick', type: 'magic',
        amount: 'DrainDamageCalc / TicksPerSecond + PercentMultiplier * target.missingHp',
        note: 'The full channel of Bountiful Harvest is counted, including the missing-health damage at its end.',
      },
    ],
  },
  e: {
    hits: [{ id: 'scythe', type: 'magic', amount: 'Damage' }],
  },
  r: {
    // the calculation is the total over the storm's duration
    hits: [{ id: 'crows', type: 'magic', amount: 'TotalDamage', over: 'Duration', note: 'The target is counted as staying in Crowstorm for its whole duration.' }],
  },
});

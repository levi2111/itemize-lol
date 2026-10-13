import { champion } from '../dsl.ts';

/* Outside Lamb's basic attacks, Kindred's damage is Wolf: he bites on his own
   inside Wolf's Frenzy, and pounces when Lamb's third attack lands on a target
   marked by Mounting Dread. The game's calculations read the Marks of the Kindred
   as buff stacks, which static data cannot know, so the marks are an option and
   every per-mark part is rebuilt from the data values. */
export default champion('Kindred', {
  reviewed: '16.20.1',
  vars: {
    // the game data has no attack speed for Wolf: Lamb's base attack speed plus a share of her bonus
    wolfAs: 'attackSpeed / (1 + bonusAs) * (1 + bonusAs * KindredW.LambToWolfAttackSpeedConversionPercent)',
  },
  options: {
    marks: { label: 'Marks of the Kindred', kind: 'int', default: 0, min: 0 },
    dance: { label: 'Dance of Arrows attack speed active', default: false },
    bites: { label: 'Wolf\'s Frenzy bites that land', kind: 'int', default: 'floor(KindredW.ZoneDuration * wolfAs)', min: 0 },
  },
  // dread: Mounting Dread stacks on the target; the cast applies the first
  counters: { dread: {} },
  // the marks deal nothing themselves: what they add is counted in Q, W and E
  p: {
    notes: ['Marks count as 0 unless "Marks of the Kindred" is set.'],
  },
  q: {
    // up to three arrows, one per enemy
    hits: [{ id: 'arrow', type: 'physical', amount: 'TotalDamage' }],
    statMods: [{ stat: 'attackSpeed', value: 'BaseBonusAS + marks * KindredPassiveManager.ASPerMark', when: 'dance' }],
    notes: ['The attack speed is off unless "Dance of Arrows attack speed active" is set.'],
  },
  w: {
    hits: [{
      id: 'bite', label: 'Wolf bites', type: 'magic', count: 'bites',
      // the bites at wolf's attack rate, never longer than the territory lasts
      over: 'min(bites / wolfAs, ZoneDuration)',
      amount: 'BaseWolfDamage + (CloneBasePercentDamage + marks * ClonePercentDamagePerBounty) * target.hp',
      note: 'Wolf is counted biting the target for the whole of Wolf\'s Frenzy, at Kindred\'s base attack speed plus a share of their bonus attack speed from items and levels. Set "Wolf\'s Frenzy bites that land" to change the number.',
    }],
  },
  e: {
    hits: [{ id: 'mark', type: 'physical', amount: 0, then: 'dread = 1' }],
    rules: [
      { id: 'stack', on: 'attack', when: 'dread > 0', type: 'physical', amount: 0, then: 'dread += 1' },
      // the attack that completes the stacks lands first, so the pounce sees the health it took.
      // EDamagePerMark is in percent points; the crit scaling is an average, not a crit of its own
      {
        id: 'pounce', label: 'Wolf pounce', on: 'after', when: 'dread >= StacksToProc', type: 'physical',
        amount: 'BaseBiteDamage + (BasePercentDamage + marks * KindredPassiveManager.EDamagePerMark / 100) * (1 + critChance * CritMod * (critDamage - 1)) * target.missingHp',
        then: 'dread = 0',
        note: 'Mounting Dread deals its damage on the third basic attack after E in the combo, and nothing without them.',
      },
    ],
  },
  // Lamb's Respite only prevents deaths and heals
  r: {},
});

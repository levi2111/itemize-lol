import { champion } from '../dsl.ts';

/* Zaahen's kit scales almost entirely with bonus attack damage, and his passive
   is a stacking attack damage multiplier. Stats are worked out once per fight, so
   Determination is an option rather than a counter: every hit of the fight then
   sees the same number of stacks. */
export default champion('Zaahen', {
  reviewed: '16.20.1',
  vars: {
    stacks: 'min(determination, ZaahenPassive.MaxStacks)',
  },
  options: {
    // ramped in a long fight, not at all in a short combo
    determination: { label: 'Determination stacks', kind: 'int', default: 'if(sustained, ZaahenPassive.MaxStacks, 0)', min: 0 },
    edge: { label: 'Aureate Rush hits with the edge of the slice', default: true },
    // the lab's timeline plays the first cast and the recast apart; it changes no damage
    qCast: { label: 'The Darkin Glaive cast counted (0 both, 1 the first, 2 the recast)', kind: 'int', default: 0, min: 0, max: 2, timeline: true },
  },
  p: {
    // percent of total attack damage per stack, doubled once the bar is full
    statMods: [{
      stat: 'ad', phase: 'percent',
      value: 'PercentBonusADCalc * stacks * if(stacks >= MaxStacks, MaxStacksMultiplier, 1)',
    }],
    notes: ['Determination is not built up during a combo: set "Determination stacks" to the stacks Zaahen fights with. Sustained damage assumes full stacks.'],
  },
  q: {
    // both casts empower an attack; the attacks themselves are the engine's
    hits: [
      { id: 'first', label: 'First attack bonus', type: 'physical', amount: 'InitialDamage', when: 'qCast != 2' },
      { id: 'recast', label: 'Recast attack bonus', type: 'physical', amount: 'SecondHitDamage', when: 'qCast != 1', note: 'One cast counts the bonus damage of both empowered attacks; add two auto attacks to the combo for the attacks themselves.' },
    ],
  },
  w: {
    hits: [
      { id: 'stab', label: 'Stab', type: 'physical', amount: 'InitialDamage' },
      { id: 'pull', label: 'Pull', type: 'physical', amount: 'SecondaryDamage', note: 'Both the stab and the pull of Dreaded Return are counted.' },
    ],
  },
  e: {
    hits: [
      { id: 'slice', type: 'physical', amount: 'BaseDamageCalc', when: '!edge' },
      { id: 'edge', label: 'Edge of the slice', type: 'physical', amount: 'BonusDamageCalc', when: 'edge' },
      { id: 'edgeHealth', label: 'Edge of the slice', type: 'magic', amount: 'PercentHPDamage * target.maxHp', when: 'edge' },
    ],
    notes: ['Aureate Rush is counted hitting with its edge unless "Aureate Rush hits with the edge of the slice" is turned off.'],
  },
  r: {
    hits: [{ id: 'stab', type: 'physical', amount: 'DamageEndCalc' }],
    // the passive half: armor penetration from the first rank on
    statMods: [{ stat: 'armorPenPct', value: 'ArmorPen' }],
  },
});

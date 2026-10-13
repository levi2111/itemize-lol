import { champion } from '../dsl.ts';

/* A Thousand Cuts is the kit: a share of the target's maximum health on every
   attack, and again on every snip of Snip Snip! that lands with its center and on
   every needle of Needlework. The game data gives the damage of one snip and one
   needle. How many of each land, and that each brings the passive along without
   being an attack, is the model. */
export default champion('Gwen', {
  reviewed: '16.20.1',
  vars: {
    thousandCuts: 'GwenP.PercentHealth1000Cuts * target.maxHp',
    // share of a snip dealt as true damage
    converted: 'center * GwenQ.TrueDamageConversion',
    // the game data has the needle counts of the recasts only as multipliers inside their damage totals
    needles: 'if(stitch == 0, 1, round(if(stitch == 1, GwenR.TotalDamage3, GwenR.TotalDamage5) / GwenR.TotalDamage))',
  },
  options: {
    center: { label: 'Snip Snip! hits with its center', default: true },
    skipSlash: { label: 'Skip \'n Slash active from the start', default: false },
  },
  // snips: Snip Snip! stacks, four at most by the tooltip; slashEnd: the time a cast Skip 'n Slash runs out;
  // stitch: casts of the current Needlework already made
  counters: { snips: { max: 4 }, slashEnd: {}, stitch: {} },
  p: {
    rules: [{ id: 'cuts', on: 'onhit', type: 'magic', amount: 'thousandCuts' }],
  },
  q: {
    rules: [{ id: 'stack', on: 'attack', type: 'magic', amount: 0, then: 'snips += 1' }],
    hits: [
      // one snip, one more per stack, then the final one; the center turns a share of each into true damage
      { id: 'snips', label: 'Snips', type: 'magic', count: '1 + snips', amount: 'MiniSwipeDamage * (1 - converted)' },
      { id: 'snipsTrue', label: 'Snips, true damage', type: 'true', when: 'center', count: '1 + snips', amount: 'MiniSwipeDamage * converted' },
      { id: 'final', label: 'Final snip', type: 'magic', amount: 'FinalSwipeDamage * (1 - converted)' },
      { id: 'finalTrue', label: 'Final snip, true damage', type: 'true', when: 'center', amount: 'FinalSwipeDamage * converted' },
      // the passive comes with every snip, but a snip is not an attack and sets off no other on-hit effect
      { id: 'cuts', label: 'A Thousand Cuts from Snip Snip!', type: 'magic', when: 'center', count: '2 + snips', amount: 'thousandCuts' },
      { id: 'spend', type: 'magic', amount: 0, then: 'snips = 0' },
    ],
    notes: [
      'Snip Snip! snips once more for each attack made before it in the combo, up to 4.',
      'Every snip is counted hitting with its center, part of it as true damage and with A Thousand Cuts, unless "Snip Snip! hits with its center" is turned off.',
    ],
  },
  // Hallowed Mist only makes Gwen untargetable from outside it and tougher inside
  w: {},
  e: {
    hits: [{ id: 'dash', type: 'magic', amount: 0, then: 'slashEnd = time + BuffDuration' }],
    rules: [{ id: 'slash', on: 'onhit', when: 'skipSlash || time < slashEnd', type: 'magic', amount: 'OnHitDamage' }],
    statMods: [{ stat: 'attackSpeed', value: 'BonusAttackSpeed', when: 'skipSlash' }],
    notes: ['Skip \'n Slash deals no damage of its own: attacks made after it in the combo deal its on-hit damage while it lasts. Its attack speed, and the on-hit damage from the first attack on, only count when "Skip \'n Slash active from the start" is set.'],
  },
  r: {
    hits: [
      { id: 'needles', type: 'magic', count: 'needles', amount: 'TotalDamage' },
      {
        id: 'cuts', label: 'A Thousand Cuts from Needlework', type: 'magic', count: 'needles', amount: 'thousandCuts',
        then: 'stitch = if(stitch >= 2, 0, stitch + 1)',
      },
    ],
    notes: ['Each Needlework in the combo is the next cast: one needle, then three, then five, every needle counted on the one target. Add it three times for the whole ultimate.'],
  },
});

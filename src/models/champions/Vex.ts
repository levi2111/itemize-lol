import { champion } from '../dsl.ts';

/* Gloom is a mark with two sources and three ways to spend it, none of which the
   game data connects: Looming Darkness puts it on whoever it hits, an enemy that
   dashes near Vex gets it too, and her next attack, Mistral Bolt or Personal Space
   on a marked enemy sets it off for the passive's damage. Doom, the other half of
   the passive, only fears. */
export default champion('Vex', {
  reviewed: '16.20.1',
  options: {
    dashed: { label: 'Target dashed or blinked near Vex (starts marked with Gloom)', default: false },
  },
  // gloom: 1 while Looming Darkness' mark is on the target. spent: 1 once the mark from the target's own dash is used up
  counters: { gloom: { max: 1 }, spent: { max: 1 } },
  vars: {
    marked: 'gloom || (dashed && !spent)',
  },
  p: {
    rules: [
      { id: 'gloom', label: 'Gloom', on: 'attack', when: 'marked', type: 'magic', amount: 'GloomProcCalc', then: ['gloom = 0', 'spent = 1'] },
      // Mistral Bolt and Personal Space consume the mark; Looming Darkness applies it and cannot set it off
      { id: 'gloomSpell', label: 'Gloom', on: 'spell', when: 'marked && (cast.q || cast.w)', type: 'magic', amount: 'GloomProcCalc', then: ['gloom = 0', 'spent = 1'] },
    ],
    notes: ['Gloom deals its damage on the first attack, Q or W after Looming Darkness hits, or once at the start if "Target dashed or blinked near Vex" is set.'],
  },
  q: {
    hits: [{ id: 'bolt', type: 'magic', amount: 'QDamageCalc' }],
  },
  w: {
    hits: [{ id: 'shockwave', type: 'magic', amount: 'WDamageCalc' }],
  },
  e: {
    hits: [{ id: 'shadow', type: 'magic', amount: 'EDamageCalc', then: 'gloom = 1' }],
  },
  r: {
    hits: [
      { id: 'surge', label: 'Shadow', type: 'magic', amount: 'RDamageCalc' },
      { id: 'recast', label: 'Recast dash', type: 'magic', amount: 'RecastDamageCalc', note: 'Both Shadow\'s hit and the recast dash of Shadow Surge are counted.' },
    ],
  },
});

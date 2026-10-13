import { champion } from '../dsl.ts';

/* Two things the game data leaves to prose:
   - Sigil of Malice's second half only lands when a later ability damages the
     marked target, so the mark is a counter and the order of the combo matters.
   - Mimic has five damage calculations and uses the ones of whichever ability
     was cast last. */
export default champion('Leblanc', {
  reviewed: '16.20.1',
  vars: {
    // the game falls back to Sigil of Malice when nothing was cast before Mimic
    mimicked: 'if(mimic, mimic, max(last, 1))',
    mimicQ: 'cast.r && mimicked == 1',
  },
  options: {
    mimic: { label: 'Ability Mimic copies (0 the last one cast before it, 1 Sigil of Malice, 2 Distortion, 3 Ethereal Chains)', kind: 'int', default: 0, min: 0, max: 3 },
  },
  counters: {
    sigil: { max: 1 },
    mimicSigil: { max: 1 },
    // last basic ability cast: 1 Q, 2 W, 3 E
    last: {},
    // chains on the target whose root has yet to land
    roots: {},
  },
  // Mirror Image only makes a harmless clone
  p: {},
  q: {
    hits: [{ id: 'sigil', type: 'magic', amount: 'Damage', then: ['sigil = 1', 'last = 1'] }],
    rules: [
      // a sigil does not set itself off; one thrown at a chained target is set off by the root that follows
      {
        id: 'mark', label: 'Sigil detonation', on: 'spell', when: 'sigil && (!cast.q || roots)', type: 'magic', amount: 'MarkDamage',
        then: ['sigil = 0', 'roots = roots - cast.q'],
      },
    ],
    notes: [
      'The sigil only detonates when another ability damages the target after it in the combo.',
      'A sigil applied after Ethereal Chains is detonated by the root, as when it lands while the chain still holds.',
    ],
  },
  w: {
    hits: [{ id: 'slam', type: 'magic', amount: 'TotalDamage', then: 'last = 2' }],
  },
  e: {
    hits: [
      { id: 'chain', type: 'magic', amount: 'InitialDamage' },
      { id: 'root', label: 'Root', type: 'magic', amount: 'DelayedDamage', then: ['last = 3', 'roots += 1'], note: 'The target is assumed to stay shackled, so the root damage is counted.' },
    ],
  },
  r: {
    hits: [
      { id: 'sigil', label: 'Mimicked Sigil of Malice', when: 'mimicked == 1', type: 'magic', amount: 'RQ1Damage', then: 'mimicSigil = 1' },
      { id: 'slam', label: 'Mimicked Distortion', when: 'mimicked == 2', type: 'magic', amount: 'RWDamage' },
      { id: 'chain', label: 'Mimicked Ethereal Chains', when: 'mimicked == 3', type: 'magic', amount: 'RE1Damage' },
      { id: 'root', label: 'Mimicked root', when: 'mimicked == 3', type: 'magic', amount: 'RE2Damage', then: 'roots += 1' },
    ],
    rules: [
      // the mimicked sigil is its own mark, detonated the same way; the two set each other off
      {
        id: 'mark', label: 'Mimicked sigil detonation', on: 'spell', when: 'mimicSigil && (!mimicQ || roots)', type: 'magic', amount: 'RQ2Damage',
        then: ['mimicSigil = 0', 'roots = roots - mimicQ'],
      },
    ],
    notes: [
      'Mimic copies the last of Q, W and E cast before it in the combo, or Sigil of Malice if none was. Set "Ability Mimic copies" to choose one yourself.',
      'A mimicked Sigil of Malice needs a later ability, or a chain already on the target, to detonate.',
    ],
  },
});

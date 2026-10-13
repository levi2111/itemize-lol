import { champion } from '../dsl.ts';

/* Ivern's own spells are one amount each. What the game data leaves open is
   Daisy: her attacks have a damage value but no attack speed, and her shockwave
   is tied to her third attack only in the tooltip's prose. The number of attacks
   she lands is a stepper, and every third one carries the shockwave. */
export default champion('Ivern', {
  reviewed: '16.20.1',
  options: {
    brush: { label: 'Attacking from brush', default: true },
    daisyAttacks: { label: 'Daisy\'s basic attacks on the target', kind: 'int', default: 3, min: 0 },
  },
  // Friend of the Forest only frees jungle camps
  p: {},
  q: {
    hits: [{ id: 'vine', type: 'magic', amount: 'TotalDamage' }],
  },
  w: {
    // growing brush deals nothing; the passive half adds to his attacks while he stands in it
    rules: [{ id: 'brush', label: 'Brushmaker', on: 'onhit', when: 'brush', type: 'magic', amount: 'TotalDamage' }],
    notes: ['Brushmaker\'s bonus on attacks is counted as if Ivern attacks from brush; turn off "Attacking from brush" for a fight in the open.'],
  },
  e: {
    hits: [{
      id: 'burst', type: 'magic', amount: 'TotalDamage',
      note: 'Triggerseed is counted as bursting next to the target, on Ivern himself or on Daisy; on another ally the damage is that ally\'s.',
    }],
  },
  r: {
    hits: [
      // the game data has no attack speed for Daisy, so the number of attacks is the user's
      {
        id: 'daisy', label: 'Daisy\'s attacks', type: 'physical', amount: 'TotalDaisyAD', count: 'daisyAttacks',
        note: 'Daisy is counted for "Daisy\'s basic attacks on the target", 3 unless changed, out of the many she can land while she is out.',
      },
      // the third consecutive attack on one champion launches the shockwave
      { id: 'slam', label: 'Daisy, Slam!', type: 'magic', amount: 'TotalShockwaveDamage', count: 'floor(daisyAttacks / 3)' },
    ],
    notes: ['Every third attack by Daisy launches her shockwave.'],
  },
});

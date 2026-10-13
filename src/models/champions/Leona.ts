import { champion } from '../dsl.ts';

/* Leona's own abilities are one hit each. What needs a decision is Sunlight:
   her abilities only place the mark, and it takes another champion to set it
   off, so alone it deals nothing. */
export default champion('Leona', {
  reviewed: '16.20.1',
  options: {
    ally: { label: 'An ally consumes each Sunlight mark', default: false },
  },
  p: {
    rules: [
      // every damaging ability marks the target; the mark refreshes rather than stacks, so an ally has to hit between casts
      {
        id: 'sunlight', on: 'spell', when: 'ally', type: 'magic', amount: 'TotalDamage',
        note: 'With the ally set, the mark from every damaging ability is counted as consumed before the next one lands, with Leona\'s own magic penetration.',
      },
    ],
    notes: ['Sunlight deals nothing unless "An ally consumes each Sunlight mark" is set: Leona cannot consume her own marks.'],
  },
  q: {
    // the tooltip amount is already only what is added to the attack; crits do not touch it
    hits: [{
      id: 'bash', type: 'magic', amount: 'TotalDamageTooltip',
      note: 'Shield of Daybreak counts only what it adds to the attack; put a basic attack after it in the combo.',
    }],
  },
  w: {
    // the armor and magic resist only make Leona tougher
    hits: [{
      id: 'detonation', type: 'magic', amount: 'TotalDamageTooltip',
      note: 'Eclipse detonates a few seconds after the cast; the target is assumed to still be next to Leona.',
    }],
  },
  e: {
    hits: [{ id: 'blade', type: 'magic', amount: 'TotalDamageTooltip' }],
  },
  r: {
    // the on-hit values in the game data belong to an effect the tooltip no longer has
    hits: [{ id: 'flare', type: 'magic', amount: 'ExplosionCalculatedDamage' }],
  },
});

import { champion } from '../dsl.ts';

/* Concussive Blows is the only part of the kit with structure: four stacks from
   attacks and Winter's Bite set off the stun damage, and for a few seconds after
   that the target takes no stacks and Braum's attacks deal a bonus instead. The
   window is timed, so sustained attacking cycles between the two. */
export default champion('Braum', {
  reviewed: '16.20.1',
  vars: {
    immune: 'time < immuneUntil',
  },
  // immuneUntil holds the moment the target can be stacked again
  counters: { blows: {}, immuneUntil: {} },
  p: {
    rules: [
      { id: 'stack', on: 'attack', when: '!immune', type: 'magic', amount: 0, then: 'blows += 1' },
      { id: 'bonus', label: 'Concussive Blows on-hit', on: 'attack', when: 'immune', type: 'magic', amount: 'OnHitDamage' },
      { id: 'stun', label: 'Concussive Blows stun', on: 'after', when: 'blows >= StackCap', type: 'magic', amount: 'TotalDamage', then: ['blows = 0', 'immuneUntil = time + StunCD'] },
    ],
    notes: ['Only Braum\'s own attacks and Winter\'s Bite add Concussive Blows stacks; stacks from allies\' attacks are not counted.'],
  },
  q: {
    // applies a stack unless the target is in the window after a stun
    hits: [{ id: 'ice', type: 'magic', amount: 'TotalDamage', then: 'blows += not(immune)' }],
  },
  // Stand Behind Me only grants armor and magic resist
  w: {},
  // Unbreakable only blocks and reduces incoming damage
  e: {},
  r: {
    hits: [{ id: 'fissure', type: 'magic', amount: 'TotalDamage' }],
  },
});

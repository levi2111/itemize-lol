import { champion } from '../dsl.ts';

/* Two things the game data leaves open. Nether Blade is an on-hit bonus that
   its active swaps for a larger one on a single attack. Riftwalk gives its
   damage and what one stack adds; how many stacks a cast has is the model. */
export default champion('Kassadin', {
  reviewed: '16.20.1',
  vars: {
    stacks: 'min(rift + riftwalk, RiftWalk.MaxStacks)',
  },
  options: {
    riftwalk: { label: 'Riftwalk stacks at the start', kind: 'int', default: 0, min: 0 },
  },
  // rift: Riftwalk casts made this fight
  counters: { rift: { max: 'RiftWalk.MaxStacks' } },
  // Void Stone only reduces the magic damage Kassadin takes
  p: {},
  q: {
    hits: [{ id: 'sphere', type: 'magic', amount: 'TotalDamage' }],
  },
  w: {
    hits: [{
      // the charged attack deals the active's damage in place of the passive's, which the attack itself brings
      id: 'blade', type: 'magic', amount: 'ActiveDamage - OnHitDamage',
      note: 'Nether Blade\'s active counts only what it adds to an attack that already has the passive\'s damage; add the auto attack to the combo.',
    }],
    rules: [
      { id: 'onhit', label: 'Nether Blade passive', on: 'onhit', type: 'magic', amount: 'OnHitDamage' },
    ],
  },
  e: {
    hits: [{ id: 'pulse', type: 'magic', amount: 'TotalDamage' }],
  },
  r: {
    hits: [{
      id: 'blink', type: 'magic', amount: 'BaseDamage + BonusDamage * stacks', then: 'rift += 1',
      note: 'Each Riftwalk in the combo is stronger than the last, as if every cast came before the stacks ran out. Set "Riftwalk stacks at the start" for a Kassadin who arrives with some.',
    }],
  },
});

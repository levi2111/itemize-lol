/* Renekton: Ruthless Predator is counted by the model as the whole attack it empowers, so W plays as that
   attack: the strike's own spell (RenektonExecute, or RenektonSuperExecute with Fury), at attack range, and it
   restarts the attack timer as an attack does instead of resetting it. Slice and Dice is a dash at its DashSpeed
   (the game file gives only BaseDashSpeed plus move speed as a calculation). Dominus's bonus health lasts
   BuffDuration, which the timeline keeps. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Renekton', {
  reviewed: '16.20.1',
  sources: ['Slice and Dice\'s dash length is RenektonSliceAndDice\'s 450 cast range in the game file; the data has no distance value.'],
  actions: {
    // the empowered attack itself: attack range (125, edge to edge, plus his 80 radius)
    w: {
      spell: 'RenektonExecute', range: 125 + 80, resetsAttack: false,
      variants: [{ when: 'enraged', spell: 'RenektonSuperExecute', range: 125 + 80, resetsAttack: false }],
    },
    // one cast is Slice and Dice together: drawn as the first dash, both hits landing at its end
    e: { dash: { speed: 'DashSpeed', distance: 450, direction: 'through' } },
  },
  windows: [{ option: 'dominus', after: 'r', for: 'BuffDuration' }],
  hooks: {
    // the empowered attack starts the attack timer like any attack; the period is learnt from his last attack
    onStart(c) {
      if (c.action === 'aa') c.state.aaAt = c.t;
      if (c.action === 'w' && c.state.period) c.setAttackReadyAt(Math.max(c.attackReadyAt(), c.t + c.state.period));
    },
    onLand(c) {
      if (c.action === 'aa' && c.state.aaAt !== undefined) c.state.period = c.attackReadyAt() - c.state.aaAt;
    },
  },
  notes: [
    'Ruthless Predator is played as the attack it empowers: it waits on nothing but its cooldown and restarts the attack timer. Before his first attack of the fight the timer is not known, so an attack may follow it at once.',
    'Slice and Dice is one dash here: the recast\'s damage lands with the first.',
  ],
});

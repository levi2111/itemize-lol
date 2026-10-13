import { champion } from '../dsl.ts';

/* Most of Katarina's damage is in what the game data leaves out:
   - Bouncing Blade and Preparation each leave a Dagger, and picking one up is
     Voracity's slash. The slash is counted with the cast that threw the Dagger.
   - Death Lotus gives the damage of one knife. The number of knives is its
     ticks per second times its duration, and each one applies on-hit effects
     at reduced strength. */
export default champion('Katarina', {
  reviewed: '16.20.1',
  options: {
    pickup: { label: 'Daggers are picked up', default: true },
  },
  // lotus: 1 while Death Lotus's knives are being played
  counters: { lotus: {} },
  p: {
    rules: [
      // after the cast rather than with it, so the slash can spend what that cast armed (Spellblade)
      {
        id: 'slash', label: 'Dagger slash', on: 'after', when: 'pickup && (cast.q || cast.w)', type: 'magic',
        amount: 'TotalDamage', appliesOnHit: true,
        note: 'Every Bouncing Blade and Preparation is counted with its Dagger picked up: one Voracity slash each, applying on-hit effects. Turn off "Daggers are picked up" to leave the slashes out.',
      },
    ],
  },
  q: {
    // the bounces go to other enemies
    hits: [{ id: 'throw', type: 'magic', amount: 'TotalDamage' }],
  },
  // Preparation itself only gives move speed; its Dagger is Voracity's
  w: {},
  e: {
    hits: [{ id: 'strike', type: 'magic', amount: 'TotalDamage', appliesOnHit: true }],
  },
  r: {
    hits: [
      { id: 'channel', type: 'magic', amount: 0, then: 'lotus = 1' },
      {
        id: 'knives', label: 'Knives (magic)', type: 'magic', amount: 'DamageCalc', count: 'round(TicksPerSecond * Duration)', then: 'lotus = 0',
        over: 'Duration',
        note: 'Every knife of a full Death Lotus channel is counted on the one target, each applying on-hit effects at reduced strength.',
      },
      { id: 'knivesPhysical', label: 'Knives (physical)', type: 'physical', amount: 'ADDamageCalc', count: 'round(TicksPerSecond * Duration)', over: 'Duration' },
    ],
    // a rule's own on-hit goes off once however many knives it has, so each magic knife sets it off here instead.
    // the engine takes on-hit strength as a plain number: these are OnHitRatio's three ranks
    rules: [
      { id: 'onhit1', on: 'damage', when: 'lotus && rank == 1', type: 'magic', amount: 0, appliesOnHit: 0.25 },
      { id: 'onhit2', on: 'damage', when: 'lotus && rank == 2', type: 'magic', amount: 0, appliesOnHit: 0.3 },
      { id: 'onhit3', on: 'damage', when: 'lotus && rank >= 3', type: 'magic', amount: 0, appliesOnHit: 0.35 },
    ],
  },
});

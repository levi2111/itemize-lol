/* What Aphelios' Q does, and how his attacks fly, depends on the gun in his main hand (the model's
   qWeapon and attackWeapon). Each weapon ability is a spell object of its own; Onslaught holds him firing
   for its Duration. His attack spell has no missile in the file, so each gun's comes from its own attack
   spell object, typed here because attack variants take numbers only. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Aphelios', {
  reviewed: '16.20.1',
  sources: [
    'Attack missile speeds: ApheliosCalibrumAttack 3000, ApheliosSeverumAttackMis (instant), ApheliosGravitumAttack 1500, ApheliosInfernumAttack 1700, ApheliosCrescendumAttackMisOut 5000, in the game file.',
    'Onslaught\'s reach of 620 is ApheliosSeverumQ\'s cast range in the game file.',
    'Moonlight Vigil\'s speed of 2050 is ApheliosRMis\'s missile speed in the game file.',
  ],
  attack: {
    variants: [
      { when: 'attackWeapon == 1', missileSpeed: 3000 },
      { when: 'attackWeapon == 2', missileSpeed: 0 },
      { when: 'attackWeapon == 3', missileSpeed: 1500 },
      { when: 'attackWeapon == 4', missileSpeed: 1700 },
      { when: 'attackWeapon == 5', missileSpeed: 5000 },
    ],
  },
  actions: {
    q: {
      variants: [
        { when: 'qWeapon == 1', spell: 'ApheliosCalibrumQ' },
        { when: 'qWeapon == 2', spell: 'ApheliosSeverumQ', range: 620, channel: 'Duration' },
        { when: 'qWeapon == 4', spell: 'ApheliosInfernumQ' },
        { when: 'qWeapon == 5', spell: 'ApheliosCrescendumQ' },
      ],
      notes: ['Binding Eclipse (Gravitum) keeps the weapon abilities\' shared timing. Every weapon ability uses the shared cooldown, not its own.'],
    },
    // Phase has no cast time in the game file, and swaps the guns wherever the target is
    w: { lock: 0, range: 25000 },
    // the E key only shows the next weapon: it is pressed once at most, and takes no time
    e: { lock: 0, range: 25000 },
    r: { speed: 2050 },
  },
  hooks: {
    canStart(c) { return c.action !== 'e' || !c.state.queueShown; },
    onStart(c) { if (c.action === 'e') c.state.queueShown = 1; },
  },
  notes: ['Seconds mode uses Phase whenever it is ready, swapping the guns back and forth; leave W out to keep one main-hand gun.'],
});

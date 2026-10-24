/* Graves: his abilities' projectiles are spell objects the slot spells do not name (GravesQLineMis,
   GravesSmokeGrenadeBoom, GravesChargeShotShot), and Quickdraw is a dash whose distance is DashMaxDistance;
   it reloads a shell, which resets his attack. Every pellet that hits takes CooldownPerHit off its cooldown. */
import { behaviour } from '../behaviour.ts';

/** GravesMove.CooldownPerHit, and the pellets of one shell that the model counts on the target. */
const PER_PELLET = 0.5, PELLETS = 4;

export default behaviour('Graves', {
  reviewed: '16.20.1',
  sources: [
    'Missile speeds from the game file: GravesQLineMis 3000, GravesSmokeGrenadeBoom 1500, GravesChargeShotShot 2100.',
  ],
  actions: {
    q: { speed: 3000 },
    w: { speed: 1500 },
    e: { dash: { speed: 'DashSpeed', distance: 'DashMaxDistance', direction: 'toward' }, resetsAttack: true },
    r: { speed: 2100 },
  },
  hooks: {
    onLand(c) { if (c.action === 'aa') c.setReadyAt('e', Math.max(c.t, c.readyAt('e') - PER_PELLET * PELLETS)); },
  },
  notes: [
    'Each attack takes 2 seconds off Quickdraw\'s cooldown: its 4 pellets, as the model counts them, even on a critical strike.',
    'End of the Line\'s detonation is counted when the round hits.',
    'Collateral Damage\'s recoil, which pushes Graves back, is not drawn.',
    'Graves\' reload after two shells is not timed.',
  ],
});

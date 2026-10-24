/* Illaoi: Harsh Lesson is an instant attack reset whose next attack leaps at the target from up to its
   350 range: drawn as a leap at her move speed plus DashSpeedBonus, with the attack after it in the combo.
   Test of Spirit flies as IllaoiEMis, which the slot spell does not name. During Leap of Faith Harsh
   Lesson's cooldown is CooldownDuringR, which a hook applies. */
import { behaviour } from '../behaviour.ts';

/** IllaoiR.Duration and IllaoiW.CooldownDuringR. */
const LEAP_LASTS = 8, W_DURING_R = 2;

export default behaviour('Illaoi', {
  reviewed: '16.20.1',
  sources: [
    'Test of Spirit\'s tentacle flies at 1900 (IllaoiEMis in the game file).',
    'Harsh Lesson\'s 350 leap is its cast range in the game file. It is taken as instant, an attack modifier: the file\'s 0.25 second cast is left out.',
  ],
  actions: {
    w: { lock: 0, dash: { speed: 'moveSpeed + DashSpeedBonus', distance: 350, direction: 'toward' } },
    e: { speed: 1900 },
  },
  hooks: {
    onStart(c) {
      if (c.action === 'w') c.state.wAt = c.t;
      if (c.action === 'r') c.state.rAt = c.t;
    },
    onLand(c) {
      if (c.action !== 'w' || c.state.rAt === undefined || c.t > c.state.rAt + LEAP_LASTS) return;
      c.setReadyAt('w', Math.min(c.readyAt('w'), c.state.wAt! + W_DURING_R));
    },
  },
  notes: ['Harsh Lesson\'s damage lands as she reaches the target; the empowered attack is the next attack in the combo.'],
});

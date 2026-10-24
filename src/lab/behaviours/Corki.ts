/* Corki: Valkyrie is a dash whose speed is a calculation (DashSpeedBase plus his move speed), so the game
   file's defaults miss it. Gatling Gun is an instant self-cast that fires while he keeps attacking. Missile
   Barrage holds charges that come back one at a time, with a short cooldown between missiles. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Corki', {
  reviewed: '16.20.1',
  sources: [
    'Missile Barrage\'s 20 second recharge is its mAmmoRechargeTime and the 2 seconds between missiles its cooldownTime in the game file; neither is a value a formula can read.',
  ],
  actions: {
    w: { dash: { speed: 'DashSpeed', distance: 'MaximumRange', direction: 'through' } },
    e: { lock: 0 },
    r: { charges: { count: 'MaxAmmoTOOLTIP', recharge: 20 } },
  },
  hooks: {
    // with charges the timeline keeps no cooldown of its own; the one between missiles is set here
    onStart(c) { if (c.action === 'r') c.setReadyAt('r', c.t + 2); },
  },
  notes: [
    'Missile Barrage starts the fight with all its charges. Attacks shortening the recharge is not counted.',
    'Valkyrie flies its full range through the target, which is taken to stand in the fire for its whole duration.',
  ],
});

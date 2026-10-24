/* Jhin: his gun holds MaxAmmo shots and reloads for ReloadTime after the fourth, which a hook adds to the
   attack timer (the model's shot counter says which attack is the fourth). Deadly Flourish's game file range
   is a placeholder. Captive Audience holds two traps, its 2 second cooldown between them, each coming back
   AmmoRechargeRateTooltip apart; a trap thrown on the target arms in TrapArmTime and bursts
   TrapDetonationTime after it is set off. Curtain Call sets up for its cast time, then fires its four shots
   at least MInimumDelayBetweenShots apart. */
import { behaviour } from '../behaviour.ts';

/** JhinPassive.MaxAmmo and ReloadTime; JhinE's cooldown in the game data (the time between two traps). */
const AMMO = 4, RELOAD = 2.5, TRAP_GAP = 2;

export default behaviour('Jhin', {
  reviewed: '16.20.1',
  sources: [
    'Deadly Flourish\'s 2520 range is from the League wiki; the game file has 10000.',
    'Captive Audience\'s two charges are in its tooltip.',
    'Curtain Call\'s shots reach 3500 and fly at 5000 (JhinRShot, JhinRShotMis in the game file); JhinR\'s own range is a placeholder.',
  ],
  actions: {
    w: { range: 2520 },
    e: { charges: { count: 2, recharge: 'AmmoRechargeRateTooltip' }, delay: 'TrapArmTime + TrapDetonationTime' },
    r: { range: 3500, speed: 5000, channel: '3 * MInimumDelayBetweenShots' },
  },
  hooks: {
    onStart(c) {
      if (c.action === 'e') c.setReadyAt('e', c.t + TRAP_GAP);
    },
    onLand(c) {
      // the model counts this attack after the hook: three before it means it is the fourth
      if (c.action === 'aa' && c.counter('shots') >= AMMO - 1) {
        c.setAttackReadyAt(Math.max(c.attackReadyAt(), c.t + RELOAD));
        c.note('After his fourth shot Jhin reloads for 2.5 seconds before he can attack again.');
      }
    },
  },
  notes: [
    'The reload is counted from when the fourth shot lands.',
    'Curtain Call\'s shots are spread as the model spreads them; the channel holds Jhin while they are fired.',
  ],
});

/* Gangplank: Parrrley's bullet is the spell object GangplankQProceed, which the slot's GangplankQWrapper does
   not name. Powder Keg holds charges (MaxBarrels of them, mAmmoRechargeTime apart) and the model counts the keg
   exploding under a basic attack: that takes the keg decaying from three hits to one, two decay ticks after it
   is placed, and Gangplank standing in reach of both keg and target. Cannon Barrage is global and its first
   wave comes CannonDelay after the cast. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Gangplank', {
  reviewed: '16.20.1',
  sources: [
    'Parrrley\'s bullet flies at 2600 units a second, GangplankQProceed\'s missile speed in the game file.',
    'Powder Keg recharges in 17/16/15/14/13 seconds by rank (mAmmoRechargeTime in the game file).',
    'A keg is reached when it is within Gangplank\'s 125 attack range plus both radii (65 each) and the target within its 325 blast radius (castRadius).',
  ],
  actions: {
    q: { speed: 2600 },
    e: {
      charges: { count: 'MaxBarrels', recharge: '18 - rank' },
      delay: '2 * BarrelDecayTime',
      range: 125 + 65 + 65 + 325,
    },
    r: { delay: 'CannonDelay', range: 20000 },
  },
  hooks: {
    onStart(c) {
      if (c.action !== 'e') return;
      // GangplankE.CooldownBetweenBarrels: kegs are placed at least half a second apart
      c.setReadyAt('e', c.t + 0.5);
      c.state.kegs = (c.state.kegs ?? 0) + 1;
    },
    onLand(c) { if (c.action === 'e') c.state.kegs!--; },
    // chained kegs do not hit the same target twice, so a second keg waits for the first to go off
    canStart(c) {
      if (c.action !== 'e' || !c.state.kegs) return true;
      c.note('A Powder Keg waits for the one before it to explode: kegs chained together hit the same target once.');
      return false;
    },
  },
  notes: [
    'Each Powder Keg explodes two of its decay ticks after it is placed, set off by an attack that is not drawn and does not take Gangplank\'s attack timer.',
    'Every keg starts the fight charged.',
  ],
});

/* Gragas: Barrel Roll left to ferment (the model's option) explodes BarrelCookMaxTime after it lands. Drunken
   Rage is a 0.75 second drink (mChannelDuration in the game file, per rank, which the timing reader does not
   take) after which his next attack is empowered. Body Slam is a charge with a DashSpeed but no distance; it
   cuts its own cooldown when it hits. Explosive Cask's cask is a fixed-time missile (GragasRBoom, 0.5 s). */
import { behaviour } from '../behaviour.ts';

/** GragasE.CooldownRefund */
const REFUND = 0.4;

export default behaviour('Gragas', {
  reviewed: '16.20.1',
  sources: [
    'Drunken Rage\'s 0.75 second drink is its mChannelDuration in the game file.',
    'Body Slam charges up to its 600 range (castRange in the game file).',
    'Explosive Cask lands 0.5 seconds after its cast: GragasRBoom\'s fixed travel time in the game file.',
  ],
  actions: {
    q: { variants: [{ when: 'fermented', speed: 0, delay: 'BarrelCookMaxTime' }] },
    // a buff on the next attack: drink in attack range (125, edge to edge, plus his 80 radius)
    w: { lock: 0.75, resetsAttack: true, range: 125 + 80 },
    e: { dash: { speed: 'DashSpeed', distance: 600, direction: 'toward' } },
    r: { speed: 0, delay: 0.5 },
  },
  hooks: {
    onStart(c) { if (c.action === 'e') c.state.eAt = c.t; },
    onLand(c) {
      if (c.action === 'e') c.setReadyAt('e', c.state.eAt! + (c.readyAt('e') - c.state.eAt!) * (1 - REFUND));
    },
  },
  notes: [
    'A fermented Barrel Roll explodes BarrelCookMaxTime after the cast; the cask\'s roll before it lands is not added.',
    'Body Slam is counted as hitting the target, so its cooldown is always cut.',
    'Gragas stands still while he drinks here; in the game he can walk.',
  ],
});

/* Katarina: Preparation's Dagger lands where she stood after KatarinaWDaggerArc's flight, and the model counts
   its Voracity slash with the cast, so W lands then. Shunpo is a blink onto the target (KatarinaE, which
   carries the attack reset the slot's wrapper lacks). Picking up a Dagger takes most of Shunpo's cooldown
   off: a hook gives each Dagger that refund, when it is picked up with Shunpo on cooldown, or by the next
   Shunpo within DaggerDuration. Death Lotus channels for Duration. */
import { behaviour, type HookContext } from '../behaviour.ts';

/** Shunpo's DaggerCooldownReduction share at levels 11 to 15 (78%, +6% at levels 6, 11 and 16); KatarinaPassive.DaggerDuration. */
const PICKUP = 0.9, DAGGER_LASTS = 4;

const refund = (c: HookContext) => {
  if (!c.state.eCd || c.readyAt('e') <= c.t) return false;
  c.setReadyAt('e', Math.max(c.t, c.readyAt('e') - PICKUP * c.state.eCd));
  return true;
};

export default behaviour('Katarina', {
  reviewed: '16.20.1',
  sources: [
    'Preparation\'s Dagger lands 1.25 seconds after it is tossed (KatarinaWDaggerArc\'s missileTime in the game file).',
    'Shunpo is drawn at the 5000 units a second of KatarinaETrail, over its 725 range (game file).',
  ],
  actions: {
    w: { delay: 1.25 },
    e: { spell: 'KatarinaE', dash: { speed: 5000, distance: 725, direction: 'toward' } },
    r: { channel: 'Duration' },
  },
  hooks: {
    onStart(c) {
      if (c.action === 'e') c.state.eAt = c.t;
    },
    onLand(c) {
      if (c.action === 'e') c.state.eCd = c.readyAt('e') - c.state.eAt!;
      if (!c.option('pickup')) return;
      if (c.action === 'q' || c.action === 'w') {
        if (!refund(c)) { c.state.daggers = (c.state.daggers ?? 0) + 1; c.state.daggerUntil = c.t + DAGGER_LASTS; }
      } else if (c.action === 'e' && c.state.daggers && c.t <= c.state.daggerUntil!) {
        c.state.daggers--;
        refund(c);
      }
    },
  },
  notes: [
    'Shunpo\'s refund for a Dagger is counted at 90% of its cooldown, its share at levels 11 to 15.',
    'Bouncing Blade\'s Dagger is counted as ready to pick up when the blade hits; in the game it lands about a second later behind the target.',
  ],
});

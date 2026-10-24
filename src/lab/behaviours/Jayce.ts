/* Jayce: each key is a hammer ability or a cannon ability, as the model's form (`inCannon`, flipped by each
   R) says. To the Skies! is a leap onto the target; Shock Blast is the cannon's Q, its orb flying as
   JayceShockBlastMis, or faster as JayceShockBlastWallMis through Acceleration Gate (the model's option).
   Hyper Charge is the cannon's W: the model counts its three attacks in the cast, so the cast holds him for
   the two attack periods after the first shot, at the attack speed cap. Acceleration Gate is the cannon's E.
   The cannon's attacks fly; its range is not drawn. Each form keeps its own cooldowns, so switching form
   brings back the other form's: a hook keeps them. */
import { behaviour, type HookContext } from '../behaviour.ts';

const cannon = (c: HookContext) => (c.option('cannon') ? 1 : 0) !== (c.counter('shifted') ? 1 : 0);
const SLOTS = ['q', 'w', 'e'] as const;

/** League of Legends' attack speed cap, which Hyper Charge's attacks reach ("maximum Attack Speed", tooltip). */
const AS_CAP = 2.5;
/** Lightning Field's cooldown (League wiki): the slot spell has none in the game data. */
const W_CD = 10;

export default behaviour('Jayce', {
  reviewed: '16.20.1',
  sources: [
    'To the Skies! has no leap speed in the game data: 1500 units a second over its 600 cast range is an assumption.',
    'Shock Blast\'s orb flies at 1450, or 2350 through the gate (JayceShockBlastMis, JayceShockBlastWallMis); the cannon\'s attacks at 2000 (JayceRangedAttack): game file.',
    'Hyper Charge\'s attacks reach the cannon\'s range: 125 plus RangedFormRangeIncrease, from Jayce\'s 65 radius.',
  ],
  attack: { variants: [{ when: 'inCannon', missileSpeed: 2000 }] },
  actions: {
    q: {
      dash: { speed: 1500, distance: 600, direction: 'toward' },
      variants: [
        { when: 'inCannon && gate', spell: 'JayceShockBlast', dash: null, speed: 2350 },
        { when: 'inCannon', spell: 'JayceShockBlast', dash: null, speed: 1450 },
      ],
    },
    w: {
      variants: [{
        when: 'inCannon', spell: 'JayceHyperCharge',
        range: '125 + JayceStanceHtG.RangedFormRangeIncrease + 65', channel: `(NumAttacks - 1) / ${AS_CAP}`,
      }],
    },
    // the gate deals nothing and goes up in front of him: it can be cast from anywhere
    e: { variants: [{ when: 'inCannon', spell: 'JayceAccelerationGate', range: 20000 }] },
  },
  hooks: {
    onStart(c) {
      if (c.action === 'w') c.state.wAt = c.t;
    },
    onLand(c) {
      if (c.action === 'w' && c.readyAt('w') <= c.state.wAt! + 1e-6) c.setReadyAt('w', c.state.wAt! + W_CD);
      if (c.action !== 'r') return;
      // the form changes as this lands: keep this form's cooldowns and bring back the other's
      const from = cannon(c) ? 'c' : 'h', to = from === 'c' ? 'h' : 'c';
      for (const slot of SLOTS) {
        c.state[from + slot] = c.readyAt(slot);
        c.setReadyAt(slot, c.state[to + slot] ?? 0);
      }
    },
  },
  notes: [
    'In Mercury Cannon form his attacks keep the hammer\'s attack range here; only their projectile changes.',
    'Hyper Charge\'s three shots land when it is cast; the cast then holds him while they would be fired.',
    'Each form keeps its own cooldowns, but the cannon\'s abilities take the hammer\'s cooldown lengths (the slot spells\'); Lightning Field and Hyper Charge have none in the game data, so both take Lightning Field\'s 10 seconds, with no ability haste.',
  ],
});

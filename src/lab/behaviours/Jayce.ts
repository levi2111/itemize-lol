/* Jayce: each key is a hammer ability or a cannon ability, as the model's form (`inCannon`, flipped by each
   R) says. To the Skies! is a leap onto the target; Shock Blast is the cannon's Q, its orb flying as
   JayceShockBlastMis, or faster as JayceShockBlastWallMis through Acceleration Gate (the model's option).
   Hyper Charge is the cannon's W: the model counts its three attacks in the cast, so the cast holds him for
   the two attack periods after the first shot, at the attack speed cap. Acceleration Gate is the cannon's E.
   The cannon's attacks fly and reach further. Each form keeps its own cooldowns, so switching form brings
   back the other form's: a hook keeps them; the cannon's are its own spells' lengths. */
import { behaviour, type HookContext } from '../behaviour.ts';

const cannon = (c: HookContext) => (c.option('cannon') ? 1 : 0) !== (c.counter('shifted') ? 1 : 0);
const SLOTS = ['q', 'w', 'e'] as const;

/** League of Legends' attack speed cap, which Hyper Charge's attacks reach ("maximum Attack Speed", tooltip). */
const AS_CAP = 2.5;
/** a cooldown of `base` seconds, shortened by ability haste */
const hasted = (base: string | number) => `(${base}) * 100 / (100 + abilityHaste)`;

export default behaviour('Jayce', {
  reviewed: '16.20.1',
  sources: [
    'To the Skies! has no leap speed in the game data: 1500 units a second over its 600 cast range is an assumption.',
    'Shock Blast\'s orb flies at 1450, or 2350 through the gate (JayceShockBlastMis, JayceShockBlastWallMis); the cannon\'s attacks at 2000 (JayceRangedAttack): game file.',
    'The cannon\'s attack range is 500: his 125 plus JayceStanceHtG.RangedFormRangeIncrease (375), typed because an attack form\'s range is a number. Hyper Charge\'s attacks reach the same, from Jayce\'s 65 radius.',
    'The cannon\'s cooldowns are its spells\' in the game file: Shock Blast 8 seconds, Hyper Charge 13 down to 5 (1.6 less each rank), Acceleration Gate 16.',
  ],
  attack: { variants: [{ when: 'inCannon', missileSpeed: 2000, range: 500 }] },
  actions: {
    q: {
      dash: { speed: 1500, distance: 600, direction: 'toward' },
      variants: [
        { when: 'inCannon && gate', spell: 'JayceShockBlast', dash: null, speed: 2350, cooldown: hasted(8) },
        { when: 'inCannon', spell: 'JayceShockBlast', dash: null, speed: 1450, cooldown: hasted(8) },
      ],
    },
    w: {
      variants: [{
        when: 'inCannon', spell: 'JayceHyperCharge',
        range: '125 + JayceStanceHtG.RangedFormRangeIncrease + 65', channel: `(NumAttacks - 1) / ${AS_CAP}`,
        cooldown: hasted('14.6 - 1.6 * rank'),
      }],
    },
    // the gate deals nothing and goes up in front of him: it can be cast from anywhere
    e: { variants: [{ when: 'inCannon', spell: 'JayceAccelerationGate', range: 20000, cooldown: hasted(16) }] },
  },
  hooks: {
    onLand(c) {
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
    'Hyper Charge\'s three shots land when it is cast; the cast then holds him while they would be fired.',
    'Each form keeps its own cooldowns.',
  ],
});

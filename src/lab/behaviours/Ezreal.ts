/* Ezreal: Arcane Shift blinks, then fires a bolt at the nearest enemy within its MissileRange, so it reaches
   that far from wherever he blinks; Trueshot Barrage has no range in the game file because it is global.
   Rising Spell Force is an option of the model (stats are worked out per fight); here each ability hit adds a
   stack to it, up to the cap, and they all fall off when none lands for the stacks' duration. A Mystic Shot
   that hits takes time off all his cooldowns. */
import { behaviour } from '../behaviour.ts';

/** EzrealPassive.MaxStacks and EzrealPassive.StackDuration; EzrealQ.CDRefund. */
const MAX = 5, LASTS = 6, REFUND = 1.5;
const SLOTS = ['q', 'w', 'e', 'r'] as const;

export default behaviour('Ezreal', {
  reviewed: '16.20.1',
  actions: {
    e: { range: 'MissileRange' },
    r: { range: 20000 },
  },
  hooks: {
    onLand(c) {
      if (c.action === 'aa') return;
      const stacks = c.t - (c.state.lastHit ?? -Infinity) > LASTS && c.state.lastHit !== undefined ? 0 : c.option('spellForce');
      c.state.lastHit = c.t;
      c.setOption('spellForce', Math.min(MAX, stacks + 1));
      if (c.action === 'q') for (const slot of SLOTS) c.setReadyAt(slot, Math.max(c.t, c.readyAt(slot) - REFUND));
    },
  },
  notes: [
    'Each ability hit adds a Rising Spell Force stack on top of "Rising Spell Force stacks"; they fall off only when the next hit comes more than 6 seconds after the last.',
    'Arcane Shift is cast where Ezreal stands; its blink is not drawn.',
    'Each Mystic Shot that lands takes 1.5 seconds off all of Ezreal\'s cooldowns, its own included.',
  ],
});

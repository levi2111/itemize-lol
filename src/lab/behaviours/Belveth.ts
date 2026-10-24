/* Void Surge is a dash (BaseDashSpeed over DashDistance) in four directions, each on its own cooldown
   (PerSideCooldown, shortened by attack speed as the tooltip says): four charges. Royal Maelstrom is a
   channel of TotalDuration. Death in Lavender's attack speed lasts SheenDuration after each ability, and
   Endless Banquet's true form SteroidDuration: both are the model's options, kept by the timeline. Endless
   Banquet's active consumes a Void Coral, which a takedown leaves: one from before the fight at most. */
import { behaviour } from '../behaviour.ts';

const after = (a: 'q' | 'w' | 'e' | 'r') => ({ option: 'afterAbility', after: a, for: 'BelvethPassive.SheenDuration' });

export default behaviour('Belveth', {
  reviewed: '16.20.1',
  sources: ['Four directions, each with its own cooldown: Void Surge\'s tooltip.'],
  actions: {
    q: {
      // the game file has no cast time for either: the dash and the channel start at once
      lock: 0,
      dash: { speed: 'BaseDashSpeed', distance: 'DashDistance', direction: 'through' },
      charges: { count: 4, recharge: 'PerSideCooldown * 100 / (100 + abilityHaste + bonusAs * 100 * PerSideCDAttackSpeedMultiplier)' },
      notes: ['The short cooldown between two Void Surges is not held, and the directions come back one after another rather than each on its own clock.'],
    },
    e: { lock: 0, channel: 'TotalDuration' },
  },
  windows: [after('q'), after('w'), after('e'), after('r'), { option: 'trueForm', after: 'r', for: 'SteroidDuration' }],
  hooks: {
    canStart(c) { return c.action !== 'r' || !c.state.coralEaten; },
    onStart(c) {
      if (c.action === 'r') c.state.coralEaten = 1;
      // the option is on by default for the plain calculation; in a fight it needs an ability first
      if (!c.state.started) { c.state.started = 1; if (c.action === 'aa') c.setOption('afterAbility', 0); }
    },
  },
  notes: ['Endless Banquet\'s active is used once, on a Void Coral taken to be there already.'],
});

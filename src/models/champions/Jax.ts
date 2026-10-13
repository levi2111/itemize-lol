import { champion } from '../dsl.ts';

/* Jax's formulas are one calculation per ability; the structure is in the attacks.
   Relentless Assault is attack speed per attack landed, and stats are worked out
   once per fight, so its stacks are an option rather than a counter. Grandmaster-
   at-Arms counts attacks: every third one carries the bonus, every second one for
   a while after the lantern slam. */
export default champion('Jax', {
  reviewed: '16.20.1',
  vars: {
    stacks: 'min(relentless, JaxPassive.MaxStacks)',
    dodges: 'min(dodged, JaxE.MaxDodgesForDamageIncrease)',
    lit: 'grandmaster || time < litUntil',
    // the tooltip states "every third" and "every second"; the game data has no value for either
    every: 'if(lit, 2, 3)',
  },
  options: {
    // kept up in a long fight, not there yet at the start of a short one
    relentless: { label: 'Relentless Assault stacks', kind: 'int', default: 'if(sustained, JaxPassive.MaxStacks, 0)', min: 0 },
    dodged: { label: 'Attacks dodged during Counter Strike', kind: 'int', default: 0, min: 0 },
    grandmaster: { label: 'Grandmaster-at-Arms active', default: false },
  },
  // arms: attacks counted toward the empowered one; litUntil: when this fight's lantern slam runs out
  counters: { arms: {}, litUntil: {} },
  p: {
    statMods: [{ stat: 'attackSpeed', value: 'AttackSpeedPerStack * stacks' }],
    notes: ['Relentless Assault is not built up during a combo: set "Relentless Assault stacks" to the stacks Jax fights with. Sustained damage assumes full stacks.'],
  },
  q: {
    hits: [{ id: 'leap', type: 'physical', amount: 'TotalDamage' }],
  },
  w: {
    // the bonus on top of the next attack or Leap Strike only; the attack itself is an aa in the combo
    hits: [{ id: 'empower', type: 'magic', amount: 'TotalDamage', note: 'Empower counts only the bonus damage it adds to the next attack or Leap Strike; add that attack or Q to the combo.' }],
  },
  e: {
    hits: [{
      // PercentHealthDamage is in percent points; each dodge raises both parts
      id: 'strike', type: 'magic',
      amount: '(TotalDamage + PercentHealthDamage / 100 * target.maxHp) * (1 + PercentIncreasedPerDodge * dodges)',
      note: 'Counter Strike is counted with no attacks dodged unless "Attacks dodged during Counter Strike" is set.',
    }],
  },
  r: {
    hits: [{ id: 'slam', type: 'magic', amount: 'SwingDamageTotal', then: 'litUntil = time + Duration' }],
    rules: [
      { id: 'count', on: 'attack', type: 'magic', amount: 0, then: 'arms += 1' },
      { id: 'third', label: 'Grandmaster-at-Arms empowered attack', on: 'attack', when: 'arms >= every', type: 'magic', amount: 'OnHitDamage', then: 'arms = 0' },
    ],
    notes: [
      'Every third attack carries the bonus damage, counted from the first attack of the combo.',
      'After R is cast in the combo it is every second attack for the duration; set "Grandmaster-at-Arms active" to have that from the start, as in sustained damage.',
    ],
  },
});

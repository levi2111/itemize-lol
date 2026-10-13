import { champion } from '../dsl.ts';

/* Z-Drive Resonance is the structure here: every third attack or damaging
   ability on the target sets it off, and then the target cannot be marked again
   for a while. The stacks are a counter and the lockout a point in time, so the
   order and the length of the combo decide how often it lands. */
export default champion('Ekko', {
  reviewed: '16.20.1',
  vars: {
    // the target takes no new stacks while the lockout from the last proc runs
    open: 'time >= lockedUntil',
  },
  counters: { resonance: {}, lockedUntil: {} },
  p: {
    rules: [
      { id: 'stack', on: 'attack', when: 'open', type: 'magic', amount: 0, then: 'resonance += 1' },
      // on an attack the proc lands before Parallel Convergence's passive reads the target's health
      { id: 'resonance', on: 'attack', when: 'resonance >= 3', type: 'magic', amount: 'ThreeHitDamage', then: ['resonance = 0', 'lockedUntil = time + LockoutTime'] },
      // Timewinder and Chronobreak add their stacks themselves; Phase Dive's bonus rides on an attack and adds none
      { id: 'resonanceSpell', on: 'after', when: 'resonance >= 3', type: 'magic', amount: 'ThreeHitDamage', then: ['resonance = 0', 'lockedUntil = time + LockoutTime'] },
    ],
    notes: ['Z-Drive Resonance lands on every third attack or ability hit, and hits during its lockout on the same target build no stacks.'],
  },
  q: {
    hits: [
      { id: 'out', label: 'Timewinder going out', type: 'magic', amount: 'InitialDamage', then: 'resonance += open' },
      { id: 'back', label: 'Timewinder coming back', type: 'magic', amount: 'RecallDamage', then: 'resonance += open', note: 'Both passes of Timewinder are counted.' },
    ],
  },
  w: {
    // the active only slows, stuns and shields
    rules: [{
      id: 'execute', on: 'onhit', when: 'hasTarget && target.hpPct < BelowHealthThreshold', type: 'magic',
      amount: 'MissingHealthPercent * target.missingHp',
      note: 'Parallel Convergence adds damage to attacks only once the target is below the health threshold, so it needs a target and shows up late in a combo.',
    }],
  },
  e: {
    // the bonus on top of the next attack only; the attack itself is an aa in the combo
    hits: [{ id: 'dive', type: 'magic', amount: 'TotalDamage', note: 'Phase Dive counts only the bonus damage of the empowered attack; add the auto attack to the combo.' }],
  },
  r: {
    hits: [{ id: 'blast', type: 'magic', amount: 'TotalDamage', then: 'resonance += open' }],
  },
});

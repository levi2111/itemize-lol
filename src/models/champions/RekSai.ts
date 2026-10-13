import { champion } from '../dsl.ts';

/* Two kits on one set of keys, and the key that switches between them is itself a
   damaging ability in one direction only: W deals damage coming out of the ground
   and nothing going in. A combo is a fight above ground, so W here is always the
   Un-burrow and nothing sends her back down. "Starts the fight Burrowed" puts her
   underground until the first W or R, so `q, w, q, aa, aa, aa, e, r` is Prey
   Seeker, Un-burrow, Queen's Wrath on three attacks, Furious Bite, Void Rush.

   Queen's Wrath's game data is the bonus on one attack; that it rides the next
   three is only in the tooltip's prose. */
export default champion('RekSai', {
  reviewed: '16.20.1',
  vars: {
    inBurrow: 'burrowed && !surfaced',
  },
  options: {
    burrowed: { label: 'Starts the fight Burrowed', default: false },
    // the game data has no value for the Fury cap, so Fury is a switch rather than a counter
    maxFury: { label: 'Furious Bite at max Fury', default: true },
    wrathSpeed: { label: 'Queen\'s Wrath attack speed active', default: false },
  },
  // surfaced: W or R has brought her up this fight; wrath: empowered attacks left
  counters: { surfaced: { max: 1 }, wrath: {} },
  // Fury only heals while Burrowed; what max Fury does to Furious Bite is the option on E
  p: {},
  q: {
    hits: [
      { id: 'seeker', label: 'Prey Seeker', when: 'inBurrow', type: 'magic', amount: 'BurrowDamageTooltip' },
      // the tooltip states "next 3 Attacks"; the game data has no named value for the count
      { id: 'arm', label: 'Queen\'s Wrath', when: '!inBurrow', type: 'physical', amount: 0, then: 'wrath = 3' },
    ],
    rules: [
      // the bonus on top of the attack only; the attack itself is an aa in the combo
      {
        id: 'wrath', label: 'Queen\'s Wrath', on: 'attack', when: 'wrath > 0', type: 'physical',
        amount: 'TotalDamageTooltip', crit: 'TotalDamageTooltip * critDamage', then: 'wrath = wrath - 1',
      },
    ],
    statMods: [{ stat: 'attackSpeed', value: 'AttackSpeed', when: 'wrathSpeed' }],
    notes: [
      'Queen\'s Wrath counts only the bonus damage on the next 3 attacks; put those attacks after Q in the combo. Its attack speed needs "Queen\'s Wrath attack speed active".',
      'With "Starts the fight Burrowed" set, Q is Prey Seeker until W or R has been cast.',
    ],
  },
  w: {
    hits: [{ id: 'unburrow', label: 'Un-burrow', type: 'magic', amount: 'UnburrowDamage', then: 'surfaced = 1' }],
    notes: ['W is counted as Un-burrow, as if Rek\'Sai were underground when it is cast. Burrowing deals no damage.'],
  },
  e: {
    hits: [
      { id: 'bite', label: 'Furious Bite', when: '!inBurrow && !maxFury', type: 'physical', amount: 'BaseDamageCalculation' },
      {
        id: 'fury', label: 'Furious Bite at max Fury', when: '!inBurrow && maxFury', type: 'true', amount: 'EmpoweredDamageCalculation',
        note: 'Furious Bite is counted at max Fury, as true damage; turn "Furious Bite at max Fury" off for the plain bite.',
      },
    ],
    notes: ['Tunnel deals no damage: with "Starts the fight Burrowed" set, E adds nothing until W or R has been cast.'],
  },
  r: {
    // PercentHealthDamage is in percent points. cast while Burrowed, it leaves her above ground
    hits: [{ id: 'rush', type: 'physical', amount: 'RBaseDamageCalc + PercentHealthDamage / 100 * target.maxHp', then: 'surfaced = 1' }],
  },
});

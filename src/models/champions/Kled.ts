import { champion } from '../dsl.ts';

/* Kled fights in two states. Mounted he has the whole kit; once Skaarl runs he
   keeps only Violent Tendencies, Q becomes Pocket Pistol and his attacks are
   weaker against champions. "Dismounted" picks the state for the whole fight.

   Violent Tendencies is a passive on a cooldown: the attack that finds it ready
   is the first of four, the fourth carries the damage, and attacks in between
   two rounds shorten the wait. The model keeps that clock, so a long fight
   cycles through it. */
export default champion('Kled', {
  reviewed: '16.20.1',
  options: {
    dismounted: { label: 'Dismounted', default: false },
    fullCharge: { label: 'Chaaaaaaaarge!!! lands at full charge', default: true },
    violentSpeed: { label: 'Violent Tendencies attack speed active', default: false },
  },
  // swung: this action's basic attack has landed; violent: attacks made in the current round of four; wReadyAt: the moment Violent Tendencies is up again
  counters: { swung: {}, violent: {}, wReadyAt: {} },
  p: {
    rules: [
      // the penalty is on the attack itself, not on what the attack sets off, so everything after the attack's own damage is marked
      { id: 'swung', on: 'damage', type: 'physical', amount: 0, then: 'swung = 1' },
      { id: 'next', on: 'after', type: 'physical', amount: 0, then: 'swung = 0' },
    ],
    amps: [{ value: '-DismountedAttackPenalty', when: 'dismounted && !swung && !cast.q && !cast.w && !cast.e && !cast.r', types: ['physical'] }],
    notes: ['With "Dismounted" set, Q is Pocket Pistol, Jousting and Chaaaaaaaarge!!! do nothing and basic attacks deal reduced damage.'],
  },
  q: {
    hits: [
      { id: 'trap', label: 'Bear Trap on a Rope', when: '!dismounted', type: 'physical', amount: 'TotalDamage' },
      {
        id: 'yank', label: 'Bear Trap yank', when: '!dismounted', type: 'physical', amount: 'TotalYankDamage',
        note: 'Bear Trap on a Rope is counted with the yank, as if Kled stays near the hooked target.',
      },
      // the tooltip only says pellets beyond the first deal less; five pellets is the spread, and the game data has no value for it
      {
        id: 'pistol', label: 'Pocket Pistol', when: 'dismounted', type: 'physical',
        amount: 'KledRiderQ.TotalDamage * (1 + 4 * KledRiderQ.FalloffPerMissile)',
        note: 'With "Dismounted" set, all 5 Pocket Pistol pellets are counted on the one target.',
      },
    ],
  },
  w: {
    rules: [
      // an attack that finds the ability up, or a round already going, is one of the four
      { id: 'count', on: 'attack', when: 'violent || time >= wReadyAt', type: 'physical', amount: 0, then: 'violent += 1' },
      // any other attack shortens the cooldown instead
      { id: 'refund', on: 'attack', when: '!violent', type: 'physical', amount: 0, then: 'wReadyAt = wReadyAt - ChampCooldownRefund' },
      // the tooltip states "the fourth hit"; the game data has no value for the count
      {
        id: 'fourth', label: 'Violent Tendencies fourth hit', on: 'attack', when: 'violent >= 4', type: 'physical',
        amount: 'BaseFlatDamage + PercentDamage * target.maxHp',
        then: ['violent = 0', 'wReadyAt = time + WCooldown / (1 + abilityHaste / 100)'],
      },
    ],
    statMods: [{ stat: 'attackSpeed', value: 'dv(\'AttackSpeed\')', when: 'violentSpeed' }],
    notes: [
      'Violent Tendencies is a passive and is up at the start of the fight: the fourth attack carries its damage, then it goes on cooldown, which each attack shortens.',
      'Its attack speed is off unless "Violent Tendencies attack speed active" is set, and then applies to every attack rather than only the four.',
    ],
  },
  e: {
    // the recast goes back through the same target; the tooltip states the two dashes, the game data has no value for the count
    hits: [{ id: 'dash', when: '!dismounted', type: 'physical', amount: 'TotalDamage', count: 2, note: 'Both dashes of Jousting are counted.' }],
  },
  r: {
    hits: [{
      id: 'ram', when: '!dismounted', type: 'magic',
      amount: 'if(fullCharge, MaximumChargeDamage, MinimumDamageTooltip) * target.maxHp',
      note: 'Chaaaaaaaarge!!! is counted at its maximum damage, after a full-length charge; with "Chaaaaaaaarge!!! lands at full charge" off it is the minimum.',
    }],
  },
});

import { champion } from '../dsl.ts';

/* Udyr has no ultimate: four stances that each empower his attacks, and one
   Awaken that recasts a stance with more on it. The game data gives every bonus
   as its own calculation; which attacks carry them is what the model adds:
   - a stance's two empowered attacks are lost when he enters another stance;
   - Wilding Claw's on-hit damage and attack speed run on a timer instead, so it
     is a state rather than a hit, like its lightning, which outlives the stance;
   - no key stands for Awaken, so each stance that deals damage has an option
     that makes its casts the Awakened ones. */
export default champion('Udyr', {
  reviewed: '16.20.1',
  vars: {
    claw: 'clawStance || time < clawUntil',
  },
  options: {
    clawStance: { label: 'Wilding Claw active', default: false },
    awakenQ: { label: 'Wilding Claw is Awakened', default: false },
    awakenR: { label: 'Wingborne Storm is Awakened', default: false },
    monkTraining: { label: 'Monk Training attack speed active', default: false },
  },
  // clawUntil: when this fight's Claw Stance on-hit damage runs out; clawHits, stormHits: empowered attacks the stance has left; bolts: attacks that still call lightning
  counters: { clawUntil: {}, clawHits: {}, stormHits: {}, bolts: {} },
  p: {
    rules: [
      // entering any stance, the same one again included, replaces the empowered attacks of the last; the cast then arms its own
      { id: 'stance', on: 'ability', type: 'physical', amount: 0, then: ['clawHits = 0', 'stormHits = 0'] },
    ],
    statMods: [{ stat: 'attackSpeed', value: 'calc(\'AttackSpeed\')', when: 'monkTraining' }],
    notes: ['The attack speed of the two attacks after each ability is off unless "Monk Training attack speed active" is set.'],
  },
  q: {
    hits: [{
      // the tooltip states two attacks, for the stance and for the lightning; the game data has no value for the count
      id: 'enter', type: 'physical', amount: 0,
      then: ['clawUntil = time + if(awakenQ, AttackSpeedDurationEmpowered, AttackSpeedDurationBase)', 'clawHits = 2', 'bolts = if(awakenQ, 2, bolts)'],
      note: 'Casting Wilding Claw empowers the attacks that follow it in the combo: all of them on-hit until its duration runs out, and the first two with its max health damage unless another ability is cast before them.',
    }],
    rules: [
      {
        id: 'maul', label: 'Empowered attack', on: 'attack', when: 'clawHits > 0', type: 'physical',
        amount: 'if(awakenQ, Q2TotalOnHitHPDamage, MaxHPOnHit1) * target.maxHp', then: 'clawHits += -1',
      },
      // EmpoweredLightningBonusMax is all six strikes of one attack on an isolated target
      {
        id: 'lightning', label: 'Lightning', on: 'attack', when: 'bolts > 0', type: 'magic',
        amount: 'EmpoweredLightningBonusMax * target.maxHp', then: 'bolts += -1',
        note: 'With "Wilding Claw is Awakened" set, every Q in the combo is the Awakened cast, and all six lightning strikes of each of its two attacks are counted on the one target.',
      },
      {
        id: 'claw', label: 'Claw Stance on-hit', on: 'onhit', when: 'claw', type: 'physical', amount: 'OnHitDamage',
        note: 'For damage per second, set "Wilding Claw active": it adds the attack speed and the on-hit damage, but not the empowered attacks, which need a cast.',
      },
    ],
    statMods: [{ stat: 'attackSpeed', value: 'if(awakenQ, EmpoweredTotalAS, AttackSpeedBase)', when: 'clawStance' }],
  },
  // Iron Mantle only shields and heals; casting it still ends the empowered attacks of another stance
  w: {},
  // Blazing Stampede only gives move speed and a stun; casting it still ends the empowered attacks of another stance
  e: {},
  r: {
    hits: [
      // damage is given per second; the storm lasts BuffDuration seconds
      {
        id: 'storm', type: 'magic', amount: 'StormDamage', count: 'BuffDuration', over: 'BuffDuration', then: 'stormHits = 2',
        note: 'The target is counted as standing in Wingborne Storm for its whole duration. The first two attacks after the cast deal its bonus damage, unless another ability is cast before them.',
      },
      {
        id: 'blast', label: 'Awakened storm', when: 'awakenR', type: 'magic', amount: 'PercentHPBlast * target.maxHp / BuffDuration', count: 'BuffDuration', over: 'BuffDuration',
        note: 'With "Wingborne Storm is Awakened" set, every R in the combo is the Awakened storm with its max health damage over the full duration.',
      },
    ],
    rules: [
      { id: 'pulse', label: 'Empowered attack', on: 'attack', when: 'stormHits > 0', type: 'magic', amount: 'PulseDamage', then: 'stormHits += -1' },
    ],
  },
});

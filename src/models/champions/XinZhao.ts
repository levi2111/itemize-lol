import { champion } from '../dsl.ts';

/* Xin Zhao's damage rides on his attacks. Three Talon Strike's game data is the
   bonus on one attack; that it empowers the next three is only in the tooltip's
   prose. Determination counts attacks and both strikes of Wind Becomes Lightning
   toward every third, so the order of the combo decides which hit sets it off. */
export default champion('XinZhao', {
  reviewed: '16.20.1',
  options: {
    audacious: { label: 'Audacious Charge attack speed active', default: false },
  },
  // determination: attacks and W strikes toward the next third; talons: empowered attacks left
  counters: { determination: {}, talons: {} },
  p: {
    rules: [
      { id: 'stack', on: 'attack', type: 'physical', amount: 0, then: 'determination += 1' },
      // W can add two stacks in one cast, so the third spends three and keeps the rest
      { id: 'third', on: 'after', when: 'determination >= 3', type: 'physical', amount: 'TotalDamage', then: 'determination += -3' },
    ],
  },
  q: {
    // the tooltip states "next 3 Attacks"; the game data has no value for the count
    hits: [{ id: 'arm', type: 'physical', amount: 0, then: 'talons = 3' }],
    rules: [
      // the bonus on top of the attack only, and it crits along with the attack that carries it
      {
        id: 'talon', on: 'attack', when: 'talons > 0', type: 'physical',
        amount: 'BonusDamage', crit: 'BonusDamage * critDamage', then: 'talons += -1',
      },
    ],
    notes: ['Three Talon Strike counts only the bonus damage on the next 3 attacks; put those attacks after Q in the combo.'],
  },
  w: {
    hits: [
      { id: 'slash', label: 'Slash', type: 'physical', amount: 'SlashDamage', then: 'determination += 1' },
      // ThrustDamage already holds the increase from critical strike chance
      {
        id: 'thrust', label: 'Thrust', type: 'physical', amount: 'ThrustDamage', then: 'determination += 1',
        note: 'Both strikes of Wind Becomes Lightning are counted, and each counts toward Determination\'s every third hit.',
      },
    ],
  },
  e: {
    hits: [{ id: 'charge', type: 'magic', amount: 'ChargeDamage' }],
    // the tooltip's total is not in the game data; rebuilt from the per-rank value and the ability power ratio.
    // the ratio runs last so it reads ability power after percentage increases
    statMods: [
      { stat: 'attackSpeed', value: 'ASMod', when: 'audacious' },
      { stat: 'attackSpeed', value: 'ap * APToASRatio', when: 'audacious', phase: 'convert' },
    ],
    notes: ['The attack speed is off unless "Audacious Charge attack speed active" is set; the part that scales with Xin Zhao\'s own attack speed is not counted.'],
  },
  r: {
    // the passive only marks the target as Challenged
    hits: [{
      id: 'sweep', type: 'physical', amount: 'TotalDamage + PercentCurrentHealthDamage * target.hp',
      note: 'Crescent Guard takes its share of the health the target has left when R comes up in the combo.',
    }],
  },
});

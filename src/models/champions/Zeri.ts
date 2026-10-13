import { champion } from '../dsl.ts';

/* Zeri attacks with Burst Fire: the game treats it as her attack, and her real
   basic attack is a small magic zap she rarely uses. The engine has already dealt
   a normal attack for every "aa", so Burst Fire adds the difference between that
   and one burst, and every basic attack here is a Burst Fire.

   Burst Fire cannot fire faster than AttackSpeedCap; attack speed past it becomes
   attack damage. The engine's attack speed cannot be capped from a model, so
   sustained damage is scaled down to the capped rate instead. */
export default champion('Zeri', {
  reviewed: '16.20.1',
  vars: {
    overcharge: 'overcharged && rank.r > 0',
    // Overcharge raises the cap by the attack speed it gave. attackSpeed / (1 + bonusAs) is what 100% bonus
    // attack speed is worth to her, to within a few percent: her attack speed ratio itself is not readable here
    cap: 'ZeriQ.AttackSpeedCap + overcharge * ZeriR.BaseASPercent * attackSpeed / (1 + bonusAs)',
    rate: 'min(attackSpeed, cap)',
  },
  options: {
    chargedAttack: { label: 'Open with a fully charged attack (Living Battery)', default: false },
    throughTerrain: { label: 'Ultrashock Laser fired through terrain', default: false },
    overcharged: { label: 'Lightning Crash\'s Overcharge attack speed active', default: false },
  },
  counters: { zapped: {}, surge: {} },
  p: {
    rules: [
      // her real basic attack has no action of its own: one fully charged zap, once per combo
      {
        id: 'charged', label: 'Fully charged attack', on: 'after', when: 'chargedAttack && !sustained && !zapped', type: 'magic',
        amount: 'ZeriQ.PassiveMaxDamage + ZeriQ.PassiveMaxChargePercentHealth * target.maxHp', then: 'zapped = 1',
      },
    ],
    notes: [
      'Zeri\'s own basic attack is not counted, except for one fully charged attack at the start of a combo when "Open with a fully charged attack" is set. Its uncharged form and the execute are left out.',
    ],
  },
  q: {
    hits: [{
      id: 'burst', type: 'physical', amount: 'ActiveDamageThatCanCrit', crit: 'ActiveDamageThatCanCrit * CurrentCritDamage', appliesOnHit: true,
      note: 'Every basic attack in the combo and in sustained damage is already counted as a Burst Fire with all its rounds hitting. Add attacks for her shots rather than Q, which also sets off item effects meant for abilities.',
    }],
    rules: [
      // the engine's attack was ad, or ad * crit damage on a crit
      {
        id: 'attack', label: 'Burst Fire over a plain attack', on: 'attack', type: 'physical',
        amount: 'ActiveDamageThatCanCrit - ad', crit: '(ActiveDamageThatCanCrit - ad) * CurrentCritDamage',
      },
    ],
    // excess attack speed is read in hundredths of an attack per second
    statMods: [{ stat: 'ad', value: 'max(0, attackSpeed - cap) * 100 * ExcessAttackSpeedToADMult', phase: 'convert' }],
    amps: [{ value: 'rate / attackSpeed - 1', when: 'sustained' }],
    notes: ['Sustained damage is held to Burst Fire\'s attack speed cap, and attack speed above the cap is counted as attack damage.'],
  },
  w: {
    // through terrain the laser always crits, at reduced effectiveness
    hits: [{
      id: 'pulse', type: 'physical', amount: 'if(throughTerrain, WallDamage, TotalDamage)',
      note: 'The plain pulse is counted, unless "Ultrashock Laser fired through terrain" is set.',
    }],
  },
  e: {
    hits: [
      // deals nothing itself: arms as many Burst Fires as fit in the buff at her rate of fire
      { id: 'arm', type: 'magic', amount: 0, then: 'surge = ceil(BuffDuration * rate)' },
    ],
    rules: [
      // BonusDamageTotal already carries the crit chance scaling. the pierce only reaches other enemies
      { id: 'rounds', label: 'Lightning Rounds', on: 'onhit', when: 'surge > 0', type: 'magic', amount: 'BonusDamageTotal', then: 'surge = surge - 1' },
    ],
    notes: ['Spark Surge adds its magic damage to the Burst Fires after it in the combo, as many as fit in its duration. It is not active in sustained damage.'],
  },
  r: {
    // the chain lightning only reaches other enemies
    hits: [{ id: 'nova', type: 'magic', amount: 'TotalActiveDamage' }],
    statMods: [{ stat: 'attackSpeed', value: 'BaseASPercent', when: 'overcharged' }],
  },
});

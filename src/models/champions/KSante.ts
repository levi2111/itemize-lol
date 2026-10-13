import { champion } from '../dsl.ts';

/* All Out is a second state of the whole kit rather than a hit of its own: once
   it is on, every attack, every ability and the mark gain a share of the target's
   max health, and Path Maker repeats part of its damage as true damage. It is on
   for the whole fight with "All Out active", or from the moment R is cast in an
   exact sequence. The resistances he gives up still count for his scalings, so
   nothing is taken off them here. */
export default champion('KSante', {
  reviewed: '16.20.1',
  vars: {
    out: '(allOut || entered) && rank.r',
    allOutBonus: 'KSanteP.MaxHealthDamagePercent * target.maxHp',
  },
  options: {
    allOut: { label: 'All Out active', default: false },
    wall: { label: 'All Out knocks the target through a wall', default: false },
    charged: { label: 'Path Maker fully charged', default: true },
    // the engine's target has one armor number; the penetration only works on the bonus part
    targetBonusArmor: { label: 'Target\'s bonus armor (for All Out\'s armor penetration)', kind: 'int', default: 0, min: 0 },
  },
  // mark: Dauntless Instinct's mark on the target; entered: R was cast earlier in this combo
  counters: { mark: { max: 1 }, entered: { max: 1 } },
  p: {
    rules: [
      // while All Out the mark gets the max health bonus on top of the one the attack itself gets
      {
        id: 'mark', label: 'Dauntless Instinct mark', on: 'attack', when: 'mark', type: 'physical',
        amount: 'FlatDamage + (PercentHealthDamage + if(out, MaxHealthDamagePercent, 0)) * target.maxHp', then: 'mark = 0',
      },
      { id: 'allOutAttack', label: 'All Out bonus on attacks', on: 'attack', when: 'out', type: 'physical', amount: 'allOutBonus' },
      // R's own damage lands before he goes All Out
      { id: 'allOutAbility', label: 'All Out bonus on abilities', on: 'spell', when: 'out && !cast.r', type: 'physical', amount: 'allOutBonus' },
      { id: 'apply', on: 'spell', type: 'physical', amount: 0, then: 'mark = 1' },
    ],
    notes: [
      'Each damaging ability marks the target and the next basic attack spends the mark: put a basic attack after each ability to count it.',
      'The All Out bonus damage needs "All Out active", or R cast earlier in an exact sequence.',
    ],
  },
  // the shockwave at two stacks deals the same damage
  q: {
    hits: [{ id: 'slam', type: 'physical', amount: 'BaseDamage' }],
  },
  w: {
    hits: [
      { id: 'ram', type: 'physical', amount: 'BaseDamage + TotalMaxHealthDamage * target.maxHp' },
      {
        id: 'allOut', label: 'Path Maker All Out true damage', when: 'out', type: 'true',
        amount: '(BaseDamage + TotalMaxHealthDamage * target.maxHp) * if(charged, RDamageIncreaseMax, RDamageIncreaseMin)',
        note: 'While All Out, Path Maker\'s true damage is counted at full charge; with "Path Maker fully charged" off it is the minimum.',
      },
    ],
  },
  // Footwork only dashes and shields
  e: {},
  r: {
    hits: [
      { id: 'shatter', type: 'physical', amount: 'BaseDamage' },
      {
        id: 'slam', label: 'All Out strike through the wall', when: 'wall', type: 'physical', amount: 'TotalDamageSlamDown',
        note: 'The second strike only happens when the target is knocked through a wall: set "All Out knocks the target through a wall".',
      },
      // after both strikes, so neither is treated as dealt while All Out
      { id: 'enter', type: 'physical', amount: 0, then: 'entered = 1' },
    ],
    // stats are worked out once per fight, so the attack speed follows the option only
    statMods: [{ stat: 'attackSpeed', value: 'dv("AttackSpeed")', when: 'allOut' }],
    // half of the target's bonus armor, written as a share of all its armor
    resists: [{
      stat: 'armor', kind: 'penPct', when: 'out && hasTarget && targetBonusArmor',
      value: 'ArmorPenPercent * min(1, targetBonusArmor / max(1, target.armor))',
    }],
    notes: [
      'All Out\'s attack speed needs "All Out active".',
      'All Out\'s bonus armor penetration counts only against the amount set as the target\'s bonus armor; left at 0 it adds nothing.',
    ],
  },
});

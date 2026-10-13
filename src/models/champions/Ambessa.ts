import { champion } from '../dsl.ts';

/* Ambessa's abilities each bank a Drakehound's Step charge, and each basic attack
   spends one for bonus damage. The game data has the bonus and the cap; that the
   charges come one per cast, that Q is two casts on one cooldown, and that
   Lacerate strikes again after the dash are what the model adds. */
export default champion('Ambessa', {
  reviewed: '16.20.1',
  options: {
    everyAttack: { label: 'Drakehound\'s Step charge held for every attack', default: false },
    sweepEdge: { label: 'Cunning Sweep hits with the edge of the strike', default: true },
    braced: { label: 'Repudiation blocked damage from a champion', default: false },
    secondStrike: { label: 'Lacerate strikes again after the dash', default: true },
  },
  counters: { charges: { max: 'AmbessaPassive.Attack_Buff_Max_Stacks' } },
  p: {
    rules: [
      { id: 'charge', on: 'ability', type: 'physical', amount: 0, then: 'charges += 1' },
      // the bonus is part of the attack and crits with it
      {
        id: 'step', on: 'attack', when: 'everyAttack || charges > 0', type: 'physical',
        amount: 'Calc_OnHit_Damage_Flat', crit: 'Calc_OnHit_Damage_Flat * critDamage',
        then: 'charges = max(0, charges - 1)',
      },
    ],
    // a charge lasts one attack, so the attack speed only holds across a fight when casts keep coming
    statMods: [{ stat: 'attackSpeed', value: 'Attack_Speed', when: 'everyAttack' }],
    notes: [
      'Each ability cast gives one charge and the next basic attack spends it; put attacks after abilities in the combo.',
      'The attack speed from holding a charge counts only with "Drakehound\'s Step charge held for every attack" set, which also empowers every attack.',
    ],
  },
  q: {
    hits: [
      {
        id: 'sweep', label: 'Cunning Sweep', type: 'physical',
        amount: '(Calc_Damage_1_Max + Calc_Damage_1_Percent_Max * target.maxHp) * if(sweepEdge, 1, Damage_1_Min_Ratio)',
      },
      // a lone target is the first enemy hit; the slam is a cast of its own and banks its own charge
      {
        id: 'slam', label: 'Sundering Slam', type: 'physical',
        amount: 'Calc_Damage_2_Max + Calc_Damage_2_Percent_Max * target.maxHp',
        then: 'charges += 1',
        note: 'One cast counts both Cunning Sweep and Sundering Slam, the slam hitting the target first.',
      },
    ],
  },
  w: {
    hits: [{
      id: 'slam', type: 'physical', amount: 'if(braced, Calc_Damage_High, Calc_Damage_Low)',
      note: 'Repudiation deals its lower damage unless "Repudiation blocked damage from a champion" is set.',
    }],
  },
  e: {
    hits: [
      { id: 'strike', type: 'physical', amount: 'Calc_Damage_Flat' },
      {
        id: 'second', label: 'Lacerate after the dash', type: 'physical', amount: 'Calc_Damage_Flat', when: 'secondStrike',
        note: 'Both strikes of Lacerate are counted: Ambessa is assumed to dash out of it and land the second one.',
      },
    ],
  },
  r: {
    hits: [{ id: 'slam', type: 'physical', amount: 'Calc_Damage' }],
    // the passive half: armor penetration from the first rank on
    statMods: [{ stat: 'armorPenPct', value: 'Armor_Penetration' }],
  },
});

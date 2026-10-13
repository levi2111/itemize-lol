import { champion } from '../dsl.ts';

/* Sett's punches come in pairs: a left, then a right that hits harder. Knuckle
   Down restarts the pair and adds to both punches. Haymaker's damage grows with
   Grit, which is damage Sett has taken: nothing the engine can know, so it is an
   option. */
export default champion('Sett', {
  reviewed: '16.20.1',
  vars: {
    // MaxGrit is a share of Sett's own maximum health
    gritSpent: 'SettW.MaxGrit * grit / 100',
  },
  options: {
    grit: { label: 'Grit stored when Haymaker is cast (% of maximum)', kind: 'int', default: 0, min: 0, max: 100 },
    center: { label: 'Haymaker hits with its center', default: true },
  },
  // 1 when the next attack is the right punch
  counters: { rightNext: {} },
  p: {
    rules: [
      // every second attack is the right punch; the left one only sets it up
      { id: 'right', label: 'Right punch', on: 'attack', type: 'physical', amount: 'if(rightNext, RightPunchBonus, 0)', then: 'rightNext = 1 - rightNext' },
    ],
    notes: ['The right punch is timed like any other attack; in the game it follows the left punch faster, so damage per second is somewhat higher.'],
  },
  q: {
    hits: [{
      // the two empowered attacks are always a left and then a right punch
      id: 'punches', type: 'physical', amount: 'BaseDamage + MaxHealthDamageCalc * target.maxHp', count: 2, then: 'rightNext = 0',
      note: 'Knuckle Down counts only what it adds to the next two attacks; put two basic attacks after it in the combo.',
    }],
  },
  w: {
    hits: [
      { id: 'center', type: 'true', when: 'center', amount: 'DamageCalc + DamageConversion * gritSpent' },
      { id: 'edge', label: 'Haymaker outside the center', type: 'physical', when: '!center', amount: 'DamageCalc + DamageConversion * gritSpent' },
    ],
    notes: ['Haymaker spends no Grit unless "Grit stored when Haymaker is cast" is set; full Grit is half of Sett\'s maximum health.'],
  },
  e: {
    hits: [{ id: 'smash', type: 'physical', amount: 'DamageCalc' }],
  },
  r: {
    // on a lone target the grabbed champion is the one slammed, at the point of impact
    hits: [{
      id: 'slam', type: 'physical', amount: 'DamageCalc + MaxHealthDamage * target.bonusHp',
      note: 'The target is the grabbed champion and takes the full damage, including the share of its own bonus health.',
    }],
  },
});

import { champion } from '../dsl.ts';

/* Every basic ability has two versions, and which one a cast is depends on the
   Ferocity built by the casts before it. The game data gives both versions as
   calculations; the model keeps the Ferocity count and picks between them.
   Savagery and the leap out of Thrill of the Hunt are bonuses on a basic attack,
   which the engine counts on its own. */
export default champion('Rengar', {
  reviewed: '16.20.1',
  vars: {
    ferocity: 'startFerocity + gained',
    full: 'ferocity >= RengarPassive.MaxFerocity',
  },
  options: {
    startFerocity: { label: 'Ferocity at the start of the fight', kind: 'int', default: 0, min: 0 },
    savageryAs: { label: 'Empowered Savagery attack speed active', default: false },
  },
  // gained: Ferocity relative to the starting amount; emp: the cast being played is empowered;
  // leapt: the current Ferocity already includes the one from a leap; hunted: 1 once Thrill of the Hunt is cast, 2 once its attack has landed
  counters: { gained: {}, emp: {}, leapt: {}, hunted: {} },
  p: {
    rules: [
      // settled as the cast begins, so the cast's own hits can read `emp`: full Ferocity is spent, anything less gains one
      {
        id: 'ferocity', on: 'ability', when: '!cast.r', type: 'physical', amount: 0,
        then: ['emp = full', 'gained = if(emp, 0 - startFerocity, gained + 1)', 'leapt = if(emp, 0, leapt)'],
      },
    ],
    // Bonetooth Necklace's attack damage per trophy has no value in the game data
    notes: [
      'Each Q, W or E adds 1 Ferocity, and a cast at full Ferocity is the empowered version. Set the starting Ferocity to open with one.',
      'Attack damage from Bonetooth Necklace trophies is not counted.',
    ],
  },
  q: {
    hits: [
      { id: 'attack', when: '!emp', type: 'physical', amount: 'QBonusDamage' },
      // only the total of the empowered attack has a name; the engine already counts the attack itself
      { id: 'empowered', label: 'Empowered Savagery', when: 'emp', type: 'physical', amount: 'EmpoweredQTotalDamage - ad' },
    ],
    statMods: [{ stat: 'attackSpeed', value: 'EmpoweredQAS', when: 'savageryAs' }],
    notes: ['Savagery counts only what it adds to the attack; put a basic attack after it in the combo.'],
  },
  w: {
    hits: [
      { id: 'roar', when: '!emp', type: 'magic', amount: 'TotalDamage' },
      { id: 'empowered', label: 'Empowered Battle Roar', when: 'emp', type: 'magic', amount: 'TotalDamageEmpowered' },
    ],
  },
  e: {
    hits: [
      { id: 'bola', when: '!emp', type: 'physical', amount: 'TotalDamage' },
      { id: 'empowered', label: 'Empowered Bola Strike', when: 'emp', type: 'physical', amount: 'TotalEmpoweredDamage' },
    ],
  },
  r: {
    hits: [{
      id: 'leap', type: 'physical', amount: 'BonusDamage',
      // the leap gives Ferocity unless some of the current Ferocity already came from one
      then: ['gained += if(leapt || full, 0, RengarPassive.LeapFerocityGeneration)', 'leapt = 1', 'hunted = 1'],
      note: 'Thrill of the Hunt counts the bonus damage of the leap and its 1 Ferocity; put a basic attack after it in the combo. The armor shred starts after that attack and is kept for the rest of the combo.',
    }],
    rules: [
      // `after` fires on every action; only a basic attack has no cast in play
      { id: 'shred', on: 'after', when: 'hunted == 1 && !(cast.q || cast.w || cast.e || cast.r)', type: 'physical', amount: 0, then: 'hunted = 2' },
    ],
    resists: [{ stat: 'armor', kind: 'reduceFlat', value: 'ArmorShred', when: 'hunted >= 2' }],
  },
});

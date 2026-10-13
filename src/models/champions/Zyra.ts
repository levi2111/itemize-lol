import { champion } from '../dsl.ts';

/* Zyra's own casts are one calculation each. The rest of her damage is plants, and
   the game data has one number for them: the damage of one attack. What the model adds:
   - Deadly Spines and Grasping Roots grow the Seeds they reach into plants. Whether a
     Seed is there is the user's to say, and so is how often a plant gets to attack:
     the game data has no attack speed for them.
   - Several plants on one target do not add up in full.
   - Stranglethorns enrages the plants standing in it, whichever came first.

   Plants are counted under Garden of Thorns, where their damage is defined. */
export default champion('Zyra', {
  reviewed: '16.20.1',
  options: {
    seeds: { label: 'Seeds each Deadly Spines or Grasping Roots grows into a plant', kind: 'int', default: 1, min: 0 },
    plantAttacks: { label: 'Attacks each plant lands on the target', kind: 'int', default: 3, min: 0 },
  },
  // plants: grown this fight; calm: their attacks counted before Stranglethorns, in full attacks; thicket: Stranglethorns is down
  counters: { plants: {}, calm: {}, thicket: {} },
  vars: {
    // the first plant on a target deals full damage and every further one half. neither the tooltip nor a named data value has the falloff
    lead: 'if(plants < 1 && seeds > 0, 1, 0)',
    // one attack from each newly grown plant, in full attacks
    volley: 'lead + 50% * (seeds - lead)',
    enrage: 'ZyraR.PlantDamageBonus / 100',
    plantHit: 'ZyraP.PlantDamage * volley * (1 + thicket * enrage)',
  },
  p: {
    rules: [
      {
        id: 'spitter', label: 'Thorn Spitter attacks', on: 'ability', when: 'cast.q && seeds > 0', type: 'magic',
        // the counted attacks land somewhere in the plant's life: there is no attack interval to time them by
        amount: 'plantHit', count: 'plantAttacks', over: 'PlantDuration', then: ['calm += if(thicket, 0, volley * plantAttacks)', 'plants += seeds'],
      },
      {
        id: 'lasher', label: 'Vine Lasher attacks', on: 'ability', when: 'cast.e && seeds > 0', type: 'magic',
        amount: 'plantHit', count: 'plantAttacks', over: 'PlantDuration', then: ['calm += if(thicket, 0, volley * plantAttacks)', 'plants += seeds'],
      },
      // plants grown before Stranglethorns have already been counted without the bonus: it is added here
      {
        id: 'enraged', label: 'Enraged plants', on: 'ability', when: 'cast.r', type: 'magic',
        amount: 'PlantDamage * enrage * calm', then: ['calm = 0', 'thicket = 1'],
      },
    ],
    notes: [
      'Each Deadly Spines and Grasping Roots is counted as growing one Seed into a plant that attacks the target 3 times. Change "Seeds each Deadly Spines or Grasping Roots grows into a plant" and "Attacks each plant lands on the target" for more or fewer.',
      'When several plants attack the same target, the first is counted at full damage and each further one at half.',
      'Stranglethorns in the combo enrages every plant in it, grown before or after: all their counted attacks deal the bonus damage. The longer life it gives them is not added; raise "Attacks each plant lands on the target" for that.',
    ],
  },
  q: {
    hits: [{ id: 'spines', type: 'magic', amount: 'InitialDamage' }],
  },
  // Rampant Growth only plants a Seed
  w: {},
  e: {
    hits: [{ id: 'roots', type: 'magic', amount: 'TotalDamage' }],
  },
  r: {
    // one hit as the thicket grows; the knock-up deals nothing
    hits: [{ id: 'thicket', type: 'magic', amount: 'TotalDamage' }],
  },
});

import { champion } from '../dsl.ts';

/* Kennen's game data gives one bolt of Slicing Maelstrom and the bonus of one
   charged attack. What the model adds: how many bolts a target standing in the
   storm takes and how each grows on the last, and that the charged attack is
   every fifth one. */
export default champion('Kennen', {
  reviewed: '16.20.1',
  options: {
    surgeStacks: { label: 'Electrical Surge stacks at the start', kind: 'int', default: 0, min: 0, max: 4 },
    rush: { label: 'Lightning Rush attack speed active', default: false },
  },
  // surge: attacks since the last charged one; bolts: Slicing Maelstrom bolts the target has taken this cast
  counters: { surge: {}, bolts: {} },
  // Mark of the Storm only stuns and restores energy
  p: {},
  q: {
    hits: [{ id: 'shuriken', type: 'magic', amount: 'TotalDamage' }],
  },
  w: {
    hits: [{
      id: 'blast', type: 'magic', amount: 'TotalDamageActive',
      note: 'Electrical Surge only hits a target that carries a Mark of the Storm or stands in Slicing Maelstrom; the target is assumed to.',
    }],
    rules: [
      { id: 'charge', on: 'attack', type: 'magic', amount: 0, then: 'surge += 1' },
      // "every 5th attack" is only in the tooltip's prose; the stacks held at the start count once, toward the first one.
      // TotalDamagePassiveCrit, rebuilt: its "bonus crit damage" is the part from items, which the engine reads as the
      // whole crit damage. the bonus crits at 0.4 of a normal crit, a ratio the game data only has inside that calculation
      {
        id: 'fifth', label: 'Electrical Surge attack', on: 'attack', when: 'surge + surgeStacks >= 5', type: 'magic',
        amount: 'TotalDamagePassive', crit: 'TotalDamagePassive * (1 + 0.4 * (critDamage - 1))', then: 'surge = -surgeStacks',
        note: 'Every fifth attack of the combo carries the Electrical Surge bonus, sooner with "Electrical Surge stacks at the start".',
      },
    ],
  },
  e: {
    // one pass damages an enemy once
    hits: [{ id: 'rush', type: 'magic', amount: 'TotalDamage' }],
    statMods: [{ stat: 'attackSpeed', value: 'TotalAS', when: 'rush' }],
    notes: ['The attack speed after Lightning Rush is off unless "Lightning Rush attack speed active" is set.'],
  },
  r: {
    hits: [
      { id: 'storm', type: 'magic', amount: 0, then: 'bolts = 0' },
      {
        id: 'bolt', type: 'magic', amount: 'PerTickDamageCalculated * (1 + DamageAmp * bolts)', count: 'floor(KennenRDuration / KennenRTickRate)',
        over: 'KennenRDuration',
        note: 'The target is counted as standing in Slicing Maelstrom for its whole duration, each bolt stronger than the last.',
      },
    ],
    // each bolt counts after its own damage, so the first one lands at base damage
    rules: [{ id: 'struck', on: 'damage', when: 'cast.r', type: 'magic', amount: 0, then: 'bolts += 1' }],
  },
});

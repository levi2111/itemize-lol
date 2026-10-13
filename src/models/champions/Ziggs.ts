import { champion } from '../dsl.ts';

/* Ziggs is one explosion per cast, except for the minefield: the game data gives
   the damage of the first mine and of each one after it, and how many a lone
   target sets off is footwork, so that is an option. Short Fuse returns on the
   spell's own cooldown, which no calculation or data value holds, so the model
   cannot keep its clock: how many attacks carry it is an option too. */
export default champion('Ziggs', {
  reviewed: '16.20.1',
  options: {
    fuses: { label: 'Attacks empowered by Short Fuse', kind: 'int', default: 1, min: 0 },
    // the minefield is 11 mines; the game data has no value for the count
    mines: { label: 'Hexplosive Minefield mines the target sets off', kind: 'int', default: 3, min: 1, max: 11 },
    outerBlast: { label: 'Mega Inferno Bomb hits with its outer edge', default: false },
  },
  // attacks that have carried Short Fuse
  counters: { fused: {} },
  p: {
    rules: [
      // the bonus on top of the attack; the first attacks of the fight carry it, as many as the option says
      { id: 'fuse', on: 'attack', when: 'fused < fuses', type: 'magic', amount: 'TotalDamage', then: 'fused += 1' },
    ],
    notes: [
      'Short Fuse is counted on the first attack only, unless "Attacks empowered by Short Fuse" is raised. Its cooldown, and the time each ability takes off it, are not played.',
    ],
  },
  q: {
    hits: [{ id: 'bomb', type: 'magic', amount: 'TotalDamage' }],
  },
  w: {
    hits: [{ id: 'charge', type: 'magic', amount: 'TotalDamage' }],
  },
  e: {
    hits: [
      { id: 'mine', label: 'First mine', type: 'magic', amount: 'TotalDamage' },
      {
        id: 'more', label: 'Further mines', type: 'magic', amount: 'ReducedDamage', count: 'mines - 1',
        note: 'Three mines of Hexplosive Minefield are counted, as for a target it lands on, unless "Hexplosive Minefield mines the target sets off" is changed: 1 is a target that clips one mine, 11 is walking into every one.',
      },
    ],
  },
  r: {
    hits: [{
      id: 'blast', type: 'magic', amount: 'if(outerBlast, BlastDamage, EmpoweredDamage)',
      note: 'Mega Inferno Bomb is counted as hitting with its center unless "Mega Inferno Bomb hits with its outer edge" is set.',
    }],
  },
});

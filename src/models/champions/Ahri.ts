import { champion } from '../dsl.ts';

export default champion('Ahri', {
  reviewed: '16.20.1',
  // Essence Theft only heals
  p: {},
  q: {
    hits: [
      { id: 'out', label: 'Orb going out', type: 'magic', amount: 'TotalDamage' },
      { id: 'back', label: 'Orb coming back', type: 'true', amount: 'TotalDamage', note: 'Both passes of Orb of Deception are counted.' },
    ],
  },
  w: {
    hits: [
      { id: 'first', type: 'magic', amount: 'SingleFireDamage' },
      // the tooltip states three fox-fires; the game data has no value for the count
      { id: 'repeat', label: 'Further fox-fires', type: 'magic', amount: 'MultiFireDamage', count: 2, note: 'All three fox-fires are counted on the one target.' },
    ],
  },
  e: {
    hits: [{ id: 'charm', type: 'magic', amount: 'TotalDamage' }],
  },
  r: {
    // each dash sends its bolts at different enemies, so a lone target takes one
    hits: [{ id: 'bolt', type: 'magic', amount: 'RCalculatedDamage', note: 'One bolt per dash hits a single target; add R to the combo once per dash, up to three.' }],
  },
});

import { champion } from '../dsl.ts';

/* Mantra deals nothing by itself: it empowers the next Q, W or E, and only on
   Inner Flame does that become damage. R in the combo stands for what Mantra adds
   to Inner Flame, kept on R rather than tied to cast order because the default
   combo plays Q before R. */
export default champion('Karma', {
  reviewed: '16.20.1',
  // Gathering Fire only shortens Mantra's cooldown
  p: {},
  q: {
    hits: [{ id: 'blast', type: 'magic', amount: 'TotalDamage' }],
  },
  w: {
    // the game data has one calculation, the damage on cast; a tether that is not broken deals it a second time
    hits: [
      { id: 'bind', type: 'magic', amount: 'InitialDamage' },
      { id: 'hold', label: 'Tether holding', type: 'magic', amount: 'InitialDamage', note: 'The tether of Focused Resolve is counted as lasting its full duration, so it deals its damage twice.' },
    ],
  },
  // Inspire only shields and gives move speed, with Mantra as well
  e: {},
  r: {
    hits: [
      { id: 'impact', label: 'Mantra on Inner Flame', when: 'rank.q', type: 'magic', amount: 'RQImpactDamage' },
      // the circle left behind erupts after its slow; a target that walks out takes none of it
      { id: 'field', label: 'Circle of flame', when: 'rank.q', type: 'magic', amount: 'RQFieldDamage', note: 'The circle of flame Mantra leaves behind is counted as erupting on the target.' },
    ],
    notes: ['R in the combo is what Mantra adds to one Inner Flame; keep a Q in the combo with it. Mantra spent on Focused Resolve or Inspire adds no damage.'],
  },
});

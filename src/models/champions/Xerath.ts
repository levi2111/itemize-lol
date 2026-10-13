import { champion } from '../dsl.ts';

export default champion('Xerath', {
  reviewed: '16.20.1',
  options: {
    center: { label: 'Eye of Destruction hits with its center', default: false },
  },
  // Mana Surge only restores mana
  p: {},
  q: {
    // charging only lengthens the beam
    hits: [{ id: 'beam', type: 'magic', amount: 'TooltipTotalDamage' }],
  },
  w: {
    hits: [{
      id: 'blast', type: 'magic', amount: 'if(center, SweetSpotTotalDamage, TotalDamage)',
      note: 'Eye of Destruction is counted as hitting outside its center unless "Eye of Destruction hits with its center" is set.',
    }],
  },
  e: {
    hits: [{ id: 'orb', type: 'magic', amount: 'TooltipTotalDamage' }],
  },
  r: {
    // each shot that hit a champion adds RampDamageCalc to the ones after it, so shot k carries k - 1 of them;
    // the shots share one type, which makes the average shot times the count the exact total
    hits: [{
      id: 'shots', type: 'magic', count: 'NumberOfShots', over: 'Duration',
      amount: 'TooltipTotalDamage + RampDamageCalc * (NumberOfShots - 1) / 2',
      note: 'Every shot of Rite of the Arcane is counted as a hit, each one adding its bonus to the shots after it.',
    }],
  },
});

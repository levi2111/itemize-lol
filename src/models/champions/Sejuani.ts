import { champion } from '../dsl.ts';

/* The game data has every amount as a ready calculation. What it lacks is the
   order: Permafrost and Glacial Prison stun, and the stun arms Icebreaker for
   the next thing Sejuani lands. That mark is a counter, so the combo's order
   decides what sets it off. */
export default champion('Sejuani', {
  reviewed: '16.20.1',
  options: {
    shortBola: { label: 'Glacial Prison thrown from close range', default: false },
  },
  // 1 while the target is frozen by a stun and Icebreaker has not been spent
  counters: { frozen: {} },
  p: {
    rules: [
      { id: 'icebreaker', label: 'Icebreaker', on: 'attack', when: 'frozen', type: 'magic', amount: 'PercentHPDamage * target.maxHp', then: 'frozen = 0' },
      // an ability spends the mark before its own stun can set a new one
      { id: 'icebreakerSpell', label: 'Icebreaker', on: 'ability', when: 'frozen', type: 'magic', amount: 'PercentHPDamage * target.maxHp', then: 'frozen = 0' },
    ],
    notes: ['Icebreaker is counted on the first attack or ability after each stun from Permafrost or Glacial Prison.'],
  },
  q: {
    hits: [{ id: 'charge', type: 'magic', amount: 'TotalDamageTooltip' }],
  },
  w: {
    hits: [
      { id: 'swing', label: 'First swing', type: 'physical', amount: 'FirstHitDamageTooltip' },
      { id: 'lash', label: 'Second swing', type: 'physical', amount: 'SecondHitDamageTooltip', note: 'Both swings of Winter\'s Wrath are counted.' },
    ],
  },
  e: {
    // castable only on a target with full stacks, which allies help build; the model does not track them
    hits: [{
      id: 'shatter', type: 'magic', amount: 'TotalDamage', then: 'frozen = 1',
      note: 'Permafrost assumes the target already has its 4 stacks.',
    }],
  },
  r: {
    // the champion the bola hits takes its damage at once and is left out of the storm
    hits: [{
      id: 'bola', type: 'magic', amount: 'if(shortBola, MinorDamageTooltip, TotalDamageTooltip)', then: 'frozen = 1',
      note: 'Glacial Prison is counted once, on the champion the bola hits, at its empowered damage unless "Glacial Prison thrown from close range" is set.',
    }],
  },
});

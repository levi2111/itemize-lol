import { champion } from '../dsl.ts';

export default champion('Lulu', {
  reviewed: '16.20.1',
  options: {
    whimsy: { label: 'Whimsy cast on herself (attack speed)', default: false },
  },
  p: {
    rules: [
      // pix fires when she attacks, not on hit: abilities that apply on-hit effects do not set him off
      { id: 'pix', label: 'Pix bolts', on: 'attack', type: 'magic', amount: 'TotalDamage', count: 'NumberOfBolts', note: 'All of Pix\'s bolts are counted on every basic attack; another enemy in the way can block them.' },
    ],
  },
  q: {
    hits: [
      { id: 'bolt', type: 'magic', amount: 'TotalDamage' },
      // lulu and pix each fire one; the second to arrive deals the reduced amount
      { id: 'second', label: 'Second bolt', type: 'magic', amount: 'BonusMissileDamage', note: 'Both Glitterlance bolts are counted, the second at its reduced damage.' },
    ],
  },
  w: {
    // on an enemy it only polymorphs; on herself it is an attack speed steroid
    statMods: [{ stat: 'attackSpeed', value: 'ASBonus', when: 'whimsy' }],
    notes: ['Whimsy deals no damage. Set "Whimsy cast on herself" to count its attack speed.'],
  },
  e: {
    hits: [{ id: 'pix', type: 'magic', amount: 'TotalDamage', note: 'Help, Pix! is counted as cast on the enemy.' }],
  },
  // Wild Growth knocks up, slows and grants health
  r: {},
});

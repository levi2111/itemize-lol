import { champion } from '../dsl.ts';

/* Barrel Roll's game data gives the two ends of its damage: the cask as it lands
   and the cask after fermenting. Which one a fight gets is the player's choice,
   so it is an option. Drunken Rage is an empowered attack: only what it adds to
   the attack is counted here. */
export default champion('Gragas', {
  reviewed: '16.20.1',
  options: {
    fermented: { label: 'Barrel Roll left to ferment fully', default: false },
  },
  // Happy Hour only heals
  p: {},
  q: {
    hits: [{
      id: 'cask', type: 'magic', amount: 'if(fermented, MaxDamage, MinDamage)',
      note: 'Barrel Roll is counted as detonated on arrival unless "Barrel Roll left to ferment fully" is set.',
    }],
  },
  w: {
    // the damage reduction is defensive; MaxHPPercentDamage is in percent points
    hits: [{
      id: 'slam', type: 'magic', amount: 'TotalDamage + MaxHPPercentDamage / 100 * target.maxHp',
      note: 'Drunken Rage counts only what it adds to the attack; put a basic attack after it in the combo.',
    }],
  },
  e: {
    hits: [{ id: 'slam', type: 'magic', amount: 'TotalDamage' }],
  },
  r: {
    hits: [{ id: 'cask', type: 'magic', amount: 'DamageDone' }],
  },
});

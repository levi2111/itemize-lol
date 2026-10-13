import { champion } from '../dsl.ts';

/* Shen's only damage is Twilight Assault's bonus on his next attacks and Shadow
   Dash. The game data gives the bonus for one attack in two sizes: a plain one,
   and a larger one when the Spirit Blade passed through an enemy champion on its
   way back. Which of the two a cast gets is where the blade was lying, so it is
   an option. */
export default champion('Shen', {
  reviewed: '16.20.1',
  options: {
    bladeHit: { label: 'Spirit Blade is pulled through the target', default: true },
    twilightSpeed: { label: 'Twilight Assault attack speed active', default: false },
  },
  // Ki Barrier only shields
  p: {},
  q: {
    hits: [{
      // the bonus on top of the attacks only; the attacks themselves are aa in the combo.
      // both health calculations are already fractions of the target's maximum health
      id: 'attacks', type: 'magic', count: 'NumEnhancedAttacks',
      amount: 'BaseFlatDamage + if(bladeHit, EmpPercentHealth, BasePercentHealth) * target.maxHp',
      note: 'Twilight Assault counts only what it adds to the next 3 attacks; put three basic attacks after it in the combo.',
    }],
    // the attack speed only comes with the larger bonus, and only for those attacks
    statMods: [{ stat: 'attackSpeed', value: 'SteroidAS / 100', when: 'twilightSpeed && bladeHit' }],
    notes: [
      'The Spirit Blade is assumed to pass through the target, which raises the bonus; turn "Spirit Blade is pulled through the target" off for the smaller one.',
      'The attack speed lasts for the three empowered attacks only and needs "Twilight Assault attack speed active".',
    ],
  },
  // Spirit's Refuge only blocks attacks
  w: {},
  e: {
    hits: [{ id: 'dash', type: 'physical', amount: 'TauntDamage' }],
  },
  // Stand United only shields an ally and teleports Shen
  r: {},
});

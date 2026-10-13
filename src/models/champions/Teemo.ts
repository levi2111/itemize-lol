import { champion } from '../dsl.ts';

/* Teemo's damage is two poisons. The game data gives each one's total over its
   duration; that a new application starts the duration over instead of adding a
   second poison is the model.

   A poison is counted where it is applied: a fresh one brings its whole damage,
   and a refresh is paid for the time the old one ran, which is exactly what the
   refresh adds. */
export default champion('Teemo', {
  reviewed: '16.20.1',
  options: {
    ambush: { label: 'Guerrilla Warfare attack speed active (just left invisibility)', default: false },
  },
  // toxic, shroomed: the target carries that poison; toxicAt, shroomedAt: when it was last applied
  counters: { toxic: { max: 1 }, toxicAt: {}, shroomed: { max: 1 }, shroomedAt: {} },
  p: {
    // the invisibility itself deals nothing; leaving it grants attack speed for a few seconds
    statMods: [{ stat: 'attackSpeed', value: 'BonusAttackSpeed', when: 'ambush' }],
    notes: ['The attack speed from leaving invisibility is off unless "Guerrilla Warfare attack speed active" is set.'],
  },
  q: {
    hits: [{ id: 'dart', type: 'magic', amount: 'CalculatedDamage' }],
  },
  // Move Quick only grants move speed
  w: {},
  e: {
    rules: [
      { id: 'impact', label: 'Toxic Shot', on: 'onhit', type: 'magic', amount: 'ImpactCalculatedDamage' },
      // sustained attacking has no last hit to poison on after, so there only the time that ran is counted
      {
        id: 'poison', label: 'Toxic Shot poison', on: 'onhit', type: 'magic',
        amount: 'TotalDotDamage * if(toxic, clamp((time - toxicAt) / PoisonDuration, 0, 1), not(sustained))',
        // the seconds this firing pays for: the whole poison when fresh, the time the old one ran on a refresh
        over: 'if(toxic, clamp(time - toxicAt, 0, PoisonDuration), PoisonDuration)',
        then: ['toxic = 1', 'toxicAt = time'],
        note: 'Toxic Shot\'s poison runs for as long as the combo takes and then for its full duration after the last attack; further attacks refresh it rather than stack it.',
      },
    ],
  },
  r: {
    hits: [{
      id: 'trap', type: 'magic',
      amount: 'TotalDamage * if(shroomed, clamp((time - shroomedAt) / DebuffDuration, 0, 1), 1)',
      // a second mushroom pays for the time the first one's poison ran, over that same time
      over: 'if(shroomed, clamp(time - shroomedAt, 0, DebuffDuration), DebuffDuration)',
      then: ['shroomed = 1', 'shroomedAt = time'],
      note: 'Noxious Trap is counted as the target stepping on the mushroom and taking its poison for the full duration. A second mushroom while the poison runs only refreshes it.',
    }],
  },
});

import { champion } from '../dsl.ts';

/* Fizz's damage hangs on Seastone Trident, which is three things: a bleed every
   attack refreshes, a bonus on the next attack, and an on-hit bonus for a few
   seconds after that attack. Urchin Strike applies on-hit effects, so it carries
   all three. The game data gives each amount; when each applies is the model. */
export default champion('Fizz', {
  reviewed: '16.20.1',
  options: {
    shark: { label: 'Chum the Waters shark size (1 small, 2 medium, 3 large)', kind: 'int', default: 3, min: 1, max: 3 },
    // a combo starts the bonus itself by casting W; attacking for long keeps it up through recasts
    tridentBuff: { label: 'Seastone Trident\'s on-hit bonus active from the start', default: 'sustained' },
  },
  // bleeding: the target has the bleed; bledAt: when it was last applied
  // trident: 1 once W is cast, 2 once its empowered attack has landed; tridentAt: when it landed
  counters: { bleeding: { max: 1 }, bledAt: {}, trident: {}, tridentAt: {} },
  // Nimble Fighter only reduces the damage Fizz takes
  p: {},
  q: {
    hits: [
      { id: 'strike', type: 'physical', amount: 'TotalDamage', appliesOnHit: true },
      { id: 'urchin', label: 'Urchin Strike, magic damage', type: 'magic', amount: 'QDamage' },
    ],
  },
  w: {
    hits: [{
      // the bonus on top of the next attack only; the attack itself is an aa (or Urchin Strike) in the combo
      id: 'trident', type: 'magic', amount: 'ActiveDamage', then: 'trident = 1',
      note: 'Seastone Trident counts only the bonus damage of the empowered attack; put an auto attack or Urchin Strike after it in the combo.',
    }],
    rules: [
      // a fresh bleed brings its whole damage; a refresh pays for the time the old one ran.
      // sustained attacking has no last hit to bleed out after, so there only the time that ran is counted
      {
        id: 'bleed', label: 'Seastone Trident bleed', on: 'onhit', type: 'magic',
        amount: 'DoTDamage * if(bleeding, clamp((time - bledAt) / BleedDuration, 0, 1), not(sustained))',
        // the seconds this firing pays for: the whole bleed when fresh, the time the old one ran on a refresh
        over: 'if(bleeding, clamp(time - bledAt, 0, BleedDuration), BleedDuration)',
        then: ['bleeding = 1', 'bledAt = time'],
        note: 'The bleed runs for as long as the combo takes and then for its full duration after the last hit.',
      },
      {
        id: 'buff', label: 'Seastone Trident on-hit bonus', on: 'onhit', type: 'magic', amount: 'OnHitBuffDamage',
        when: 'tridentBuff || (trident == 2 && time - tridentAt < OnHitBuffDuration)',
        note: 'After Seastone Trident is cast, the first attack or Urchin Strike is the empowered one and those after it deal the on-hit bonus while it lasts. Damage per second counts the on-hit bonus as always active.',
      },
      // checked after the bonus, so the empowered attack does not get the bonus it starts
      { id: 'spend', on: 'onhit', when: 'trident == 1', type: 'magic', amount: 0, then: ['trident = 2', 'tridentAt = time'] },
    ],
  },
  e: {
    // Playful and the Trickster recast land the same damage, once
    hits: [{ id: 'splash', type: 'magic', amount: 'EDamage' }],
  },
  r: {
    // the middle size has no named calculation; all three are the small shark times a multiplier
    hits: [{
      id: 'shark', type: 'magic',
      amount: 'SmallSharkDamage * if(shark >= 3, LargeDamageMulti, if(shark == 2, MidDamageMulti, 1))',
      note: 'Chum the Waters is counted as the largest shark, thrown from long range, unless "Chum the Waters shark size" is lowered.',
    }],
  },
});

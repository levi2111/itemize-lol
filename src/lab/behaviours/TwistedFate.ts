/* Twisted Fate: Wild Cards fly as SealFateMissile, as far as it goes. Pick a Card is played as the card attack it
   locks in (GoldCardAttack; the three card attacks are timed alike): it waits for the attack timer and starts it
   again, as his next attack does. Stacked Deck has no active. */
import { behaviour } from '../behaviour.ts';

export default behaviour('TwistedFate', {
  reviewed: '16.20.1',
  sources: ['The cards fly 1450 at 1000 units a second: SealFateMissile in the game file.'],
  actions: {
    q: { range: 1450, speed: 1000 },
    // an attack: in attack range (525, edge to edge, plus his 65 radius)
    w: { spell: 'GoldCardAttack', range: 525 + 65, asAttack: true },
    e: { requires: 0 },
  },
  notes: [
    'The shuffle before a card is locked in is not timed: the card is thrown as soon as the attack timer allows.',
    'Stacked Deck is never cast: it is on every fourth attack.',
  ],
});

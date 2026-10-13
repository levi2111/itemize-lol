import { champion } from '../dsl.ts';

/* Pick a Card turns the next basic attack into one magic damage strike: the game
   data's card calculations are that attack's whole damage, attack damage and the
   crit chance scaling included. Which card is locked in is the player's choice,
   and that Stacked Deck's bonus rides on every fourth attack is only counted by
   the model. */
export default champion('TwistedFate', {
  reviewed: '16.20.1',
  vars: {
    // the deck holds one stack less than the attack that spends them
    held: 'min(stackedDeck, CardmasterStack.e4 - 1)',
  },
  options: {
    card: { label: 'Pick a Card (1 Blue, 2 Red, 3 Gold)', kind: 'int', default: 3, min: 1, max: 3 },
    stackedDeck: { label: 'Stacked Deck stacks at the start', kind: 'int', default: 0, min: 0 },
  },
  // attacks since the last Stacked Deck bonus
  counters: { deck: {} },
  // Loaded Dice only gives gold
  p: {},
  q: {
    // an enemy is damaged by one of the three cards
    hits: [{ id: 'card', type: 'magic', amount: 'TotalDamage' }],
  },
  w: {
    // the attack's whole damage becomes the card's magic damage, so it is a strike of its own rather than a bonus on top
    // of an auto attack. it cannot crit; the calculations already grow with crit chance
    hits: [
      { id: 'blue', label: 'Blue Card', when: 'card == 1', type: 'magic', amount: 'BlueDamage', appliesOnHit: true },
      { id: 'red', label: 'Red Card', when: 'card == 2', type: 'magic', amount: 'RedDamage', appliesOnHit: true },
      { id: 'gold', label: 'Gold Card', when: 'card == 3', type: 'magic', amount: 'GoldDamage', appliesOnHit: true },
    ],
    notes: [
      'Pick a Card is the whole empowered attack, on-hit effects included: do not add an auto attack for it.',
      'The Gold Card is counted unless "Pick a Card" is set to another one.',
    ],
  },
  e: {
    rules: [
      // the card attack counts toward the fourth attack too, hence onhit
      { id: 'stack', on: 'onhit', type: 'magic', amount: 0, then: 'deck += 1' },
      // the stacks held at the start count once, toward the first bonus
      {
        id: 'fourth', label: 'Stacked Deck attack', on: 'onhit', when: 'deck + held >= e4', type: 'magic',
        amount: 'BonusDamage', then: 'deck = -held',
        note: 'Every fourth attack of the combo carries the Stacked Deck bonus, sooner with "Stacked Deck stacks at the start".',
      },
    ],
    // in percent points
    statMods: [{ stat: 'attackSpeed', value: 'AttackSpeedBonus / 100' }],
  },
  // Destiny only reveals and teleports
  r: {},
});

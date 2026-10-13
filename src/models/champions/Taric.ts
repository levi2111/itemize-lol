import { champion } from '../dsl.ts';

/* Taric's damage is Bravado: every ability, damaging or not, empowers his next two
   basic attacks. The game data has the bonus per attack; that it is two attacks,
   that they come at doubled attack speed, and that Bastion's armor feeds his own
   bonus-armor scalings are what the model adds. */
export default champion('Taric', {
  reviewed: '16.20.1',
  options: {
    // Starlight's Touch is always ready again after two Bravado attacks, so a long fight is ability, two attacks, repeat
    keptUp: { label: 'Bravado kept up on every attack (an ability before every two attacks)', default: 'sustained' },
  },
  counters: { bravado: {} },
  p: {
    rules: [
      // the tooltip states two attacks; the game data has no value for the count. a new cast refreshes, it does not add
      { id: 'arm', on: 'ability', type: 'magic', amount: 0, then: 'bravado = 2' },
      {
        id: 'bravado', on: 'attack', when: 'keptUp || bravado > 0', type: 'magic', amount: 'TotalDamage',
        then: 'bravado = max(0, bravado - 1)',
      },
    ],
    // "100% Attack Speed" is of his total attack speed; base attack speed and attack speed ratio are equal, so that is 1 + bonus.
    // stats are worked out once per fight, so it only counts when every attack is a Bravado attack
    statMods: [{ stat: 'attackSpeed', value: '1 + bonusAs', phase: 'convert', when: 'keptUp' }],
    notes: [
      'Each ability cast empowers the next 2 basic attacks; put attacks after abilities in the combo.',
      'Sustained damage counts Bravado and its doubled attack speed on every attack, as when an ability is cast before every two attacks; turn off "Bravado kept up on every attack" to leave it out.',
    ],
  },
  // Starlight's Touch only heals; casting it still arms Bravado
  q: {},
  w: {
    // the shield does no damage, but the passive armor is bonus armor, which Bravado and Dazzle scale with
    statMods: [{ stat: 'armor', value: 'ArmorBonusPercentage', phase: 'percent' }],
  },
  e: {
    // also cast from the Bastion ally, but the two beams do not stack on one target
    hits: [{ id: 'beam', type: 'magic', amount: 'TotalDamage' }],
  },
  // Cosmic Radiance only makes allies invulnerable; casting it still arms Bravado
  r: {},
});

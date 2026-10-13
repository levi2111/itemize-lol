import { champion } from '../dsl.ts';

/* Two kits on one set of keys. The Mercury Cannon abilities are spells of their
   own with no slot, so each is read from the slot that shares its key and scales
   with that slot's rank. "Mercury Cannon form" picks the form a fight starts in,
   and in an exact sequence every R switches it, so `q, w, r, q, aa, e` is Shock
   Blast, Hyper Charge, To the Skies!, the empowered hammer attack, Thundering Blow.

   Transforming also loads the next attack: into the hammer it adds magic damage,
   into the cannon it removes a share of the target's armor and magic resist. */
export default champion('Jayce', {
  reviewed: '16.20.1',
  vars: {
    inCannon: 'cannon != shifted',
  },
  options: {
    cannon: { label: 'Mercury Cannon form', default: false },
    gate: { label: 'Shock Blast fired through Acceleration Gate', default: true },
  },
  // primed: the attack loaded by this fight's last transform is still unspent; shredUntil: when the cannon's shred runs out
  counters: { shifted: {}, primed: {}, shredUntil: {} },
  // Hextech Capacitor is move speed on transforming
  p: {},
  q: {
    hits: [
      { id: 'leap', label: 'To the Skies!', when: '!inCannon', type: 'physical', amount: 'Damage' },
      {
        id: 'blast', label: 'Shock Blast', when: 'inCannon', type: 'physical',
        amount: 'if(gate, JayceShockBlast.EmpoweredDamage, JayceShockBlast.Damage)',
        note: 'Shock Blast is counted as fired through Acceleration Gate; turn "Shock Blast fired through Acceleration Gate" off for the plain orb.',
      },
    ],
    notes: ['To the Skies! unless "Mercury Cannon form" is set, then Shock Blast.'],
  },
  w: {
    hits: [
      {
        id: 'field', label: 'Lightning Field', when: '!inCannon', type: 'magic', amount: 'Damage', over: 'Duration',
        note: 'Lightning Field is counted for its full duration, with the target inside it throughout.',
      },
      // the charged attacks deal this instead of an attack's usual damage, below it at early ranks, so each
      // is a strike of its own rather than a bonus on top of an auto attack. the game data holds the count
      // as NumAttacks; a strike needs its own entry to apply on-hit effects
      {
        id: 'charge1', label: 'First Hyper Charge attack', when: 'inCannon', type: 'physical',
        amount: 'JayceHyperCharge.ActualDamage', crit: 'JayceHyperCharge.ActualDamage * critDamage', appliesOnHit: true,
        note: 'Hyper Charge is its three attacks themselves, on-hit effects included: do not add auto attacks for them.',
      },
      {
        id: 'charge2', label: 'Second Hyper Charge attack', when: 'inCannon && JayceHyperCharge.NumAttacks >= 2', type: 'physical',
        amount: 'JayceHyperCharge.ActualDamage', crit: 'JayceHyperCharge.ActualDamage * critDamage', appliesOnHit: true,
      },
      {
        id: 'charge3', label: 'Third Hyper Charge attack', when: 'inCannon && JayceHyperCharge.NumAttacks >= 3', type: 'physical',
        amount: 'JayceHyperCharge.ActualDamage', crit: 'JayceHyperCharge.ActualDamage * critDamage', appliesOnHit: true,
      },
    ],
    notes: ['Lightning Field unless "Mercury Cannon form" is set, then Hyper Charge.'],
  },
  e: {
    hits: [{ id: 'blow', label: 'Thundering Blow', when: '!inCannon', type: 'magic', amount: 'FlatDamage + PercHPDamage * target.maxHp' }],
    notes: ['Thundering Blow unless "Mercury Cannon form" is set. Acceleration Gate deals no damage; what it adds to Shock Blast is the option on Q.'],
  },
  r: {
    hits: [{ id: 'swap', type: 'magic', amount: 0, then: ['shifted = 1 - shifted', 'primed = 1'] }],
    rules: [
      { id: 'hammer', label: 'Mercury Hammer empowered attack', on: 'attack', when: 'primed && !inCannon', type: 'magic', amount: 'Damage', then: 'primed = 0' },
      // the shred lands with the attack, so it helps from the next damage on. Hyper Charge's attacks apply it too
      { id: 'shred', on: 'onhit', when: 'primed && inCannon', type: 'physical', amount: 0, then: ['primed = 0', 'shredUntil = time + ShredDuration'] },
    ],
    resists: [
      { stat: 'armor', kind: 'reducePct', value: 'RangedFormShred', when: 'time < shredUntil' },
      { stat: 'mr', kind: 'reducePct', value: 'RangedFormShred', when: 'time < shredUntil' },
    ],
    notes: [
      'R in the combo switches form for what follows it and loads the next attack: bonus magic damage with the hammer, armor and magic resist reduction with the cannon.',
      'The cannon\'s reduction applies to the damage after the attack that lands it, for as long as it lasts. A fight starts without a loaded attack.',
    ],
  },
});

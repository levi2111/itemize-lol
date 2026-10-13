import { champion } from '../dsl.ts';

/* Dirty Fighting is two things: a second shot after every attack, and a mark
   that every hit from an attack or an ability adds to, set off by each third.
   The marks are a counter, so the order of the combo decides which hit pays out.
   Heroic Swing has no fixed length: how many shots land is the user's to say. */
export default champion('Akshan', {
  reviewed: '16.20.1',
  options: {
    swingShots: { label: 'Heroic Swing shots that hit the target', kind: 'int', default: 4, min: 1, max: 20 },
  },
  // marks: Dirty Fighting stacks on the target; swinging: 1 while Heroic Swing's shots are being played
  counters: { marks: {}, swinging: {} },
  p: {
    rules: [
      // the second shot is an attack of its own: it crits and applies on-hit effects
      {
        id: 'second', label: 'Second shot', on: 'attack', type: 'physical',
        amount: 'SecondAutoDamage', crit: 'SecondAutoDamage * (1 + SecondAutoCritRatio * (critDamage - 1))', appliesOnHit: true,
        note: 'The second shot of Dirty Fighting is counted after every basic attack.',
      },
      // attacks, second shots and Heroic Swing shots mark through on-hit; Avengerang and Comeuppance add theirs themselves
      { id: 'mark', on: 'onhit', type: 'magic', amount: 0, then: 'marks += 1' },
      // one cast can land several hits, so it can complete more than one set
      {
        id: 'proc', label: 'Dirty Fighting', on: 'after', when: 'marks >= MaxStacks', type: 'magic',
        amount: 'PassiveProcDamage', count: 'floor(marks / MaxStacks)', then: 'marks = marks - MaxStacks * floor(marks / MaxStacks)',
      },
    ],
  },
  q: {
    hits: [{
      id: 'boomerang', type: 'physical', amount: 'FinalDamage', count: 2, then: 'marks += 2',
      note: 'Both passes of Avengerang are counted.',
    }],
  },
  // Going Rogue only camouflages Akshan and revives allies
  w: {},
  e: {
    hits: [
      { id: 'hook', type: 'physical', amount: 0, then: 'swinging = 1' },
      {
        id: 'shots', type: 'physical', amount: 'DamageToDeal', crit: 'CriticalCalc', count: 'swingShots', then: 'swinging = 0',
        // AttackFrequency is the seconds between two shots
        over: 'swingShots * AttackFrequency',
        note: 'Heroic Swing has no fixed length: it counts the number of shots set in "Heroic Swing shots that hit the target", each applying on-hit effects at reduced strength.',
      },
    ],
    // a rule's own on-hit goes off once however many shots it has, so each shot sets it off here instead
    rules: [{ id: 'onhit', on: 'damage', when: 'swinging', type: 'physical', amount: 0, appliesOnHit: 0.25 }],
  },
  r: {
    // crit chance is already inside the bullet's calculation; each bullet sees the health the last one left
    hits: [{
      id: 'bullets', type: 'physical', amount: 'DamagePerBulletWithCrit * (1 + (MaxIncrease - 1) * target.missingHpPct)',
      count: 'NumberOfBullets', then: 'marks += NumberOfBullets',
      note: 'Comeuppance counts every bullet of a full channel, each growing evenly with the health the target has lost.',
    }],
  },
});

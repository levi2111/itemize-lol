import { champion } from '../dsl.ts';

/* Siphoning Strike's calculations read its stacks from a buff the static data
   cannot see, so the bonus is rebuilt from the data values with the stacks as an
   option. Spirit Fire and Fury of the Sands are areas: how long the target stays
   in them is what the model adds. */
export default champion('Nasus', {
  reviewed: '16.20.1',
  options: {
    siphon: { label: 'Siphoning Strike stacks', kind: 'int', default: 0, min: 0 },
    inFire: { label: 'Target stands in Spirit Fire (armor loss)', default: false },
    stormSeconds: { label: 'Seconds the target stays in the sandstorm', kind: 'int', default: 'NasusR.Duration', min: 0 },
    fury: { label: 'Fury of the Sands active (bonus health)', default: false },
  },
  // fireUntil: when the Spirit Fire on the ground burns out
  counters: { fireUntil: {} },
  // Soul Eater only grants life steal
  p: {},
  q: {
    // TotalDamage is the whole empowered attack with the stacks read as 0; the engine already counts the attack itself.
    // only the base damage is multiplied on a crit, the stacks are added after
    hits: [{
      id: 'strike', type: 'physical', amount: 'BonusDamage + siphon', crit: 'critDamage * BonusDamage + siphon',
      note: 'Siphoning Strike counts only what it adds to the attack; put a basic attack after it in the combo. Set "Siphoning Strike stacks" to the stacks Nasus has farmed.',
    }],
  },
  // Wither only slows the target's movement and attacks
  w: {},
  e: {
    hits: [
      { id: 'ignite', type: 'magic', amount: 'InitialDamage', then: 'fireUntil = time + Duration' },
      // TotalDotDamage is one tick a second over Duration
      {
        id: 'burn', label: 'Spirit Fire burning', type: 'magic', amount: 'TotalDotDamage / Duration', count: 'Duration',
        over: 'Duration',
        note: 'The target is counted as standing in Spirit Fire for its whole duration: every tick, and the armor loss on what follows in the combo.',
      },
    ],
    // ArmorShredPercent is stored negative
    resists: [{ stat: 'armor', kind: 'reducePct', value: 'abs(ArmorShredPercent)', when: 'inFire || time < fireUntil' }],
  },
  r: {
    // DamageCalc is the share of maximum health per second, dealt every TickRate seconds; the cap is per second too
    hits: [{
      id: 'storm', type: 'magic', amount: 'min(DamageCalc * target.maxHp, MaxDamageCap) * TickRate', count: 'min(stormSeconds, Duration) / TickRate',
      over: 'min(stormSeconds, Duration)',
      note: 'One cast counts the target staying in the sandstorm for its whole duration; lower "Seconds the target stays in the sandstorm" for a shorter fight.',
    }],
    // the health matters to items that scale with it; the resistances are only defensive
    statMods: [{ stat: 'hp', value: 'BonusHealth', when: 'fury' }],
  },
});

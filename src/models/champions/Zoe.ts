import { champion } from '../dsl.ts';

/* Zoe's formulas are one line each; the order of the combo is what the game data
   does not have:
   - More Sparkles! is armed by every ability cast and spent by the next basic
     attack, or by a Spell Thief bolt.
   - Sleepy Trouble Bubble puts the target to sleep. The hit that wakes it lands on
     reduced magic resistance and is dealt again as true damage, up to a cap. How
     much that is depends on the waking hit after resistances, so it is measured
     from the health the hit took. */
export default champion('Zoe', {
  reviewed: '16.20.1',
  vars: {
    star: 'if(longStar, ZoeQ.MaxDamageTooltip, ZoeQ.TotalDamageTooltip)',
    // without a target the waking hit cannot be measured, so it is read from what is being played: a cast's own hit, else a basic attack
    waking: 'if(hasTarget, seen - target.hp, if(cast.q, star, if(cast.w, ZoeW.MissileDamageTooltip, if(cast.e, ZoeE.TotalDamageTooltip, ad * (1 + critChance * (critDamage - 1))))))',
  },
  options: {
    longStar: { label: 'Paddle Star! lands at maximum distance', default: true },
    sleepy: { label: 'Target falls asleep before the next hit after Sleepy Trouble Bubble', default: true },
  },
  // sparkles: the next attack is empowered; asleep: the target sleeps; seen: its health when it fell asleep; brittle: when the lingering magic resistance reduction ends
  counters: { sparkles: { max: 1 }, asleep: { max: 1 }, seen: {}, brittle: {} },
  p: {
    rules: [
      { id: 'arm', on: 'ability', type: 'magic', amount: 0, then: 'sparkles = 1' },
      { id: 'sparkle', label: 'More Sparkles!', on: 'attack', when: 'sparkles', type: 'magic', amount: 'PassiveDamage', then: 'sparkles = 0' },
      // casting Spell Thief arms it too, and one of that cast's bolts spends it
      { id: 'bolt', label: 'More Sparkles! on a Spell Thief bolt', on: 'spell', when: 'cast.w && sparkles', type: 'magic', amount: 'PassiveDamage', then: 'sparkles = 0' },
    ],
    notes: ['Each ability cast empowers the next basic attack; put an attack after each ability in the combo. A Spell Thief cast spends it on one of its own bolts.'],
  },
  q: {
    hits: [{
      id: 'star', type: 'magic', amount: 'star',
      note: 'Paddle Star! is counted at its maximum-distance damage; with "Paddle Star! lands at maximum distance" off it is the minimum.',
    }],
  },
  w: {
    // the tooltip states three missiles; the game data has no value for the count
    hits: [{
      id: 'bolts', type: 'magic', amount: 'MissileDamageTooltip', count: 3,
      note: 'Spell Thief counts the three bolts of one cast, all on the one target. It needs a spell shard to cast; what the stolen spell itself does is not counted.',
    }],
  },
  e: {
    hits: [{ id: 'bubble', type: 'magic', amount: 'TotalDamageTooltip' }],
    rules: [
      // the target is only drowsy at first: what the cast itself sets off still lands on a waking target
      { id: 'sleep', on: 'after', when: 'cast.e && sleepy', type: 'true', amount: 0, then: ['asleep = 1', 'seen = if(hasTarget, target.hp, 0)'] },
      {
        id: 'wake', label: 'Waking the sleeping target', on: 'damage', when: 'asleep', type: 'true',
        amount: 'min(BreakDamageTooltip, waking)', then: ['asleep = 0', 'brittle = time + BrittleLinger'],
        note: 'After Sleepy Trouble Bubble the target is counted as asleep: the next hit in the combo lands on reduced magic resistance and is dealt again as true damage, up to the cap. Turn off "Target falls asleep before the next hit after Sleepy Trouble Bubble" for a combo that does not wait.',
      },
    ],
    // the reduction outlasts the waking hit by BrittleLinger
    resists: [{ stat: 'mr', kind: 'reducePct', value: 'PercentPen', when: 'asleep || time < brittle' }],
  },
  // Portal Jump is a blink there and back; it still arms More Sparkles!
  r: {},
});

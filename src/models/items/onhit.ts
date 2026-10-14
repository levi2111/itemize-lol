/* On-hit and on-attack items: effects that ride on basic attacks. Names on the right of each
   formula are the item's own data values and calculations: `npm run data:report -- --item <id>`
   lists them. docs/models.md says how an item's settings (options, procs, uses) work. */
import { item } from '../dsl.ts';

const P = '16.20.1';
// counts the tooltips spell out in words; the game data has no value for them
const SEETHING_EVERY = 3, SKIPPER_EVERY = 5;

export default [
  item(6672, 'Kraken Slayer', {
    reviewed: P,
    options: { attacks: { label: 'Attacks toward Bring It Down when the combo starts', default: 0, max: 'AttackCount - 1' } },
    counters: { hits: { start: 'attacks' } },
    rules: [
      { id: 'count', on: 'onhit', type: 'physical', amount: 0, then: 'hits += 1' },
      {
        id: 'proc', label: 'Bring It Down', on: 'onhit', when: 'hits >= AttackCount', type: 'physical',
        amount: 'DamageAmount * (1 + (MaxAmpNumber - 1) * target.missingHpPct)', then: 'hits = 0', procs: true,
      },
    ],
    notes: ['Bring It Down is taken to grow evenly with the target\'s missing health, reaching its maximum at 0.'],
  }),
  item(3124, "Guinsoo's Rageblade", {
    reviewed: P,
    options: { stacks: { label: 'Seething Strike stacks when the combo starts', default: 0, max: 'MaxStacks' } },
    counters: { seething: { max: 'MaxStacks', start: 'if(sustained, MaxStacks, stacks)' }, swings: {} },
    statMods: [{ stat: 'attackSpeed', value: 'if(sustained, MaxAttackSpeedCalc, AttackSpeedPerStack * stacks)' }],
    rules: [
      { id: 'wrath', label: 'Wrath', on: 'onhit', type: 'magic', amount: 'OnHitDamage' },
      // attacks made while fully stacked count toward the third; each attack then adds its own stack
      { id: 'count', on: 'attack', when: 'seething >= MaxStacks', type: 'magic', amount: 0, then: 'swings += 1' },
      { id: 'phantom', label: 'Seething Strike', on: 'attack', when: `swings >= ${SEETHING_EVERY}`, type: 'magic', amount: 0, appliesOnHit: true, then: 'swings = 0', procs: true },
      { id: 'stack', on: 'attack', type: 'magic', amount: 0, then: 'seething += 1' },
    ],
    notes: [
      'Sustained damage counts Seething Strike as fully stacked from the first attack.',
      'In the combo, attack speed is counted at the stacks the combo starts with; stacks gained during the combo only bring the double on-hit closer.',
      'Only attacks made while fully stacked count toward the third attack that applies on-hit effects twice.',
    ],
  }),
  item(3115, "Nashor's Tooth", {
    reviewed: P,
    rules: [{ id: 'bite', label: 'Icathian Bite', on: 'onhit', type: 'magic', amount: 'TotalOnHitDamage' }],
  }),
  item(3153, 'Blade of The Ruined King', {
    reviewed: P,
    rules: [{ id: 'edge', label: "Mist's Edge", on: 'onhit', when: 'hasTarget', type: 'physical', amount: 'target.hp * if(ranged, RangedValue, MeleeValue)' }],
    notes: ["Mist's Edge is a share of the target's current health, so it needs a target and shrinks as the fight goes on."],
  }),
  item(3091, "Wit's End", {
    reviewed: P,
    rules: [{ id: 'fray', label: 'Fray', on: 'onhit', type: 'magic', amount: 'OnHitDamage' }],
  }),
  item(3302, 'Terminus', {
    reviewed: P,
    options: { attacks: { label: 'Juxtaposition attacks landed when the combo starts', default: 0 } },
    counters: { swings: { start: 'attacks' }, landed: { start: 'attacks' } },
    rules: [
      { id: 'shadow', label: 'Shadow', on: 'onhit', type: 'magic', amount: 'OnHitDamage' },
      { id: 'count', on: 'attack', type: 'magic', amount: 0, then: 'swings += 1' },
      // a Dark attack's penetration starts after it, its own on-hit damage included
      { id: 'settle', on: 'after', type: 'magic', amount: 0, then: 'landed = swings' },
    ],
    resists: [
      { stat: 'armor', kind: 'penPct', value: 'min(PenMax, PenPerHit * floor(landed / 2))' },
      { stat: 'mr', kind: 'penPct', value: 'min(PenMax, PenPerHit * floor(landed / 2))' },
    ],
    notes: ['Juxtaposition: attacks alternate Light then Dark, starting with Light, and each Dark attack adds penetration from the next hit on, up to the cap.'],
  }),
  item(1043, 'Recurve Bow', {
    reviewed: P,
    rules: [{ id: 'sting', label: 'Sting', on: 'onhit', type: 'physical', amount: 'OnHitDamage' }],
  }),
  item(3181, 'Hullbreaker', {
    reviewed: P,
    options: { stacks: { label: 'Skipper stacks when the combo starts', default: 0, max: SKIPPER_EVERY - 1 } },
    counters: { hits: { start: 'stacks' } },
    rules: [
      { id: 'count', on: 'attack', type: 'physical', amount: 0, then: 'hits += 1' },
      { id: 'proc', label: 'Skipper', on: 'attack', when: `hits >= ${SKIPPER_EVERY}`, type: 'physical', amount: 'MaxStackDamage', then: 'hits = 0', procs: true },
    ],
  }),
];

/* Item passives that change damage. Stats come straight from game data and need no
   model; an item only appears here when its passive does something the numbers
   alone do not say. Names on the right of each formula are the item's own data
   values and calculations: `npm run data:report -- --item <id>` lists them. */
import { item } from '../dsl.ts';

const P = '16.20.1';

export default [
  // ---------- on-hit ----------
  item(6672, 'Kraken Slayer', {
    reviewed: P,
    counters: { hits: {} },
    rules: [
      { id: 'count', on: 'onhit', type: 'physical', amount: 0, then: 'hits += 1' },
      {
        id: 'proc', label: 'Bring It Down', on: 'onhit', when: 'hits >= AttackCount', type: 'physical',
        amount: 'DamageAmount * (1 + (MaxAmpNumber - 1) * target.missingHpPct)', then: 'hits = 0',
      },
    ],
    notes: ['Bring It Down is taken to grow evenly with the target\'s missing health, reaching its maximum at 0.'],
  }),
  item(3124, "Guinsoo's Rageblade", {
    reviewed: P,
    counters: { swings: {} },
    statMods: [{ stat: 'attackSpeed', value: 'MaxAttackSpeedCalc', when: 'sustained' }],
    rules: [
      { id: 'wrath', label: 'Wrath', on: 'onhit', type: 'magic', amount: 'OnHitDamage' },
      { id: 'count', on: 'attack', when: 'sustained', type: 'magic', amount: 0, then: 'swings += 1' },
      { id: 'phantom', label: 'Seething Strike', on: 'attack', when: 'sustained && swings >= 3', type: 'magic', amount: 0, appliesOnHit: true, then: 'swings = 0' },
    ],
    notes: ['Sustained damage counts Seething Strike as fully stacked from the first attack. The combo counts no stacks.'],
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
    counters: { swings: {} },
    rules: [
      { id: 'shadow', label: 'Shadow', on: 'onhit', type: 'magic', amount: 'OnHitDamage' },
      { id: 'count', on: 'attack', type: 'magic', amount: 0, then: 'swings += 1' },
    ],
    resists: [
      { stat: 'armor', kind: 'penPct', value: 'min(PenMax, PenPerHit * floor(swings / 2))' },
      { stat: 'mr', kind: 'penPct', value: 'min(PenMax, PenPerHit * floor(swings / 2))' },
    ],
    notes: ['Juxtaposition: attacks alternate Light then Dark, and each Dark attack adds penetration up to the cap.'],
  }),

  // ---------- crit and lethality ----------
  item(3036, "Lord Dominik's Regards", {
    reviewed: P,
    amps: [{ value: 'MaxBonusDamagePercent * min(1, target.bonusHp / MaxBonusHealth)', when: 'hasTarget' }],
    notes: ['Giant Slayer scales with the target\'s bonus health, which is 0 for a dummy and for a champion without items.'],
  }),
  item(6676, 'The Collector', {
    reviewed: P,
    rules: [{ id: 'death', label: 'Death', on: 'after', when: 'hasTarget && target.hp > 0 && target.hpPct < ExecuteThreshold', type: 'true', amount: 'target.hp' }],
  }),
  item(3071, 'Black Cleaver', {
    reviewed: P,
    counters: { carve: { max: 'MaxStacks' } },
    rules: [{ id: 'carve', on: 'damage', when: 'hit.physical', type: 'physical', amount: 0, then: 'carve += 1' }],
    resists: [{ stat: 'armor', kind: 'reducePct', value: 'carve * ShredPerStack' }],
    notes: ['Carve gains a stack per instance of physical damage and applies from the next hit on.'],
  }),
  item(3085, "Runaan's Hurricane", {
    reviewed: P,
    notes: ["Wind's Fury bolts only hit other enemies, so they add nothing against a single target."],
  }),

  // ---------- ability power ----------
  item(3089, "Rabadon's Deathcap", {
    reviewed: P,
    statMods: [{ stat: 'ap', phase: 'percent', value: 'APAmp' }],
  }),
  item(6655, "Luden's Echo", {
    reviewed: P,
    rules: [{ id: 'echo', label: 'Echo', on: 'spell', type: 'magic', amount: 'SingleTargetMax', cooldown: 'Cooldown' }],
    notes: ['Echo is counted against a lone target: every Echo lands on the same enemy.'],
  }),
  item(4645, 'Shadowflame', {
    reviewed: P,
    amps: [{ value: 'SpellItemDamageAmp', when: 'hasTarget && target.hpPct < HealthThreshold', types: ['magic', 'true'] }],
  }),
  item(3100, 'Lich Bane', {
    reviewed: P,
    counters: { blade: { max: 1 } },
    rules: [
      { id: 'arm', on: 'ability', type: 'magic', amount: 0, then: 'blade = 1' },
      { id: 'spellblade', label: 'Spellblade', on: 'onhit', when: 'blade', type: 'magic', amount: 'SpellbladeDamage', cooldown: 'Cooldown', then: 'blade = 0' },
    ],
  }),
  item(6653, "Liandry's Torment", {
    reviewed: P,
    rules: [{
      id: 'torment', label: 'Torment', on: 'spell', when: 'hasTarget', type: 'magic',
      amount: 'BurnPercentHealthDamage * TickFrequency * target.maxHp', count: 'BurnDuration / TickFrequency', over: 'BurnDuration', cooldown: 'BurnDuration',
    }],
    amps: [{ value: 'min(DamageIncreaseMax, DamageIncreasePerSecond * floor(time))' }],
    notes: ['Torment is counted as one full burn each time it is applied or refreshed after running out.'],
  }),
];

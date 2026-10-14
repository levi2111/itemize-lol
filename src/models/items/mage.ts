/* Mage items that hit hard and once: amplifiers, echoes, procs on ability damage. Names on the
   right of each formula are the item's own data values and calculations: `npm run data:report --
   --item <id>` lists them. docs/models.md says how an item's settings (options, procs, uses) work.

   Void Staff, Cryptbloom, Morellonomicon, Zhonya's Hourglass, Banshee's Veil, Rylai's Crystal
   Scepter, Cosmic Drive and Spellslinger's Shoes need no model: their stats count, and the rest of
   what they do heals, cuts healing, stops time, blocks, slows or gives move speed. */
import { item } from '../dsl.ts';

const P = '16.20.1';

export default [
  item(3089, "Rabadon's Deathcap", {
    reviewed: P,
    statMods: [{ stat: 'ap', phase: 'percent', value: 'APAmp' }],
  }),
  item(6655, "Luden's Echo", {
    reviewed: P,
    rules: [{ id: 'echo', label: 'Echo', on: 'spell', type: 'magic', amount: 'SingleTargetMax', cooldown: 'Cooldown', procs: true }],
    notes: ['Echo is counted against a lone target: every Echo lands on the same enemy.'],
  }),
  item(4645, 'Shadowflame', {
    reviewed: P,
    amps: [{ value: 'SpellItemDamageAmp', when: 'hasTarget && target.hpPct < HealthThreshold', types: ['magic', 'true'] }],
  }),
  item(4646, 'Stormsurge', {
    reviewed: P,
    // a window starts with the first action after the last one ran out; windowMissing and lastMissing are the
    // target's missing health when it started and after the last action
    counters: { windowAt: {}, windowMissing: {}, lastMissing: {} },
    rules: [
      { id: 'window', on: 'after', when: 'time - windowAt >= WindowDuration', type: 'magic', amount: 0, then: ['windowAt = time', 'windowMissing = lastMissing'] },
      {
        id: 'squall', label: 'Squall', on: 'after', when: 'hasTarget && target.hp > 0 && target.missingHpPct - windowMissing >= DamageThreshold',
        type: 'magic', amount: 'SquallDamage', cooldown: 'Cooldown', procs: true,
      },
      { id: 'mark', on: 'after', when: 'hasTarget', type: 'magic', amount: 0, then: 'lastMissing = target.missingHpPct' },
    ],
    notes: [
      'Stormraider counts the damage dealt in back-to-back windows of its length, each starting with the first attack or cast after the last one ran out.',
      'Squall is counted as soon as it is applied, not after its delay.',
    ],
  }),
  item(4628, 'Horizon Focus', {
    reviewed: P,
    options: { revealed: { label: 'The target is revealed by Hypershot when the combo starts', default: false } },
    amps: [{ value: 'DamageAmp', when: 'revealed' }],
  }),
  item(8020, 'Abyssal Mask', {
    reviewed: P,
    options: { nearby: { label: 'The target is near you', default: true } },
    amps: [{ value: 'DamageAmp', when: 'nearby', types: ['magic'] }],
  }),
  item(3118, 'Malignance', {
    reviewed: P,
    statMods: [{ stat: 'ultHaste', value: 'UltimateHaste' }],
    counters: { fogged: { max: 1 }, foggedAt: {} },
    rules: [
      // the fog is laid before it burns, so the burn sees its own Magic Resist reduction
      { id: 'fog', on: 'spell', when: 'cast.r', type: 'magic', amount: 0, then: ['fogged = 1', 'foggedAt = time'] },
      {
        id: 'hatefog', label: 'Hatefog', on: 'spell', when: 'cast.r', type: 'magic',
        amount: 'GroundBurnDamagePerTickTooltipOnly', count: 'GroundDuration', over: 'GroundDuration', cooldown: 'GroundDuration', procs: true,
      },
    ],
    resists: [{ stat: 'mr', kind: 'reduceFlat', value: 'MagicResistanceShred', when: 'fogged && time - foggedAt < GroundDuration' }],
    notes: [
      'Hatefog is counted as one full burn each time your ultimate damages the target after the last burn ran out, as if the target stayed in the fog.',
      "Hatefog's Magic Resist reduction counts against its own burn and everything that lands while the fog lasts.",
    ],
  }),
  item(8010, "Bloodletter's Curse", {
    reviewed: P,
    options: { stacks: { label: 'Vile Decay stacks on the target when the combo starts', default: 0, max: 'MaxStacks' } },
    // ready: this action has not added a stack yet
    counters: { decay: { max: 'MaxStacks', start: 'stacks' }, ready: { max: 1, start: 1 } },
    rules: [
      { id: 'stack', on: 'damage', when: 'hit.magic && ready', type: 'magic', amount: 0, then: ['decay += 1', 'ready = 0'] },
      { id: 'rearm', on: 'after', type: 'magic', amount: 0, then: 'ready = 1' },
    ],
    resists: [{ stat: 'mr', kind: 'reducePct', value: 'decay * ShredPerStack' }],
    notes: ['Vile Decay gains a stack from the first magic damage of each attack or cast in the combo, item damage included, and applies from the next hit on.'],
  }),
];

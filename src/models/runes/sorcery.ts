/* Sorcery (8200). Names on the right of each formula are the rune's own named values and calculations
   (`runes.json`, or `npm run data:report -- --rune <id>`). docs/models.md says how settings (options,
   procs) work: a rune's are set per build as `runeOptions`, like an item's.

   Adaptive damage (`type: 'adaptive'`) and Adaptive Force follow whichever of bonus attack damage and
   ability power the build has more of; `adaptivePhysical` says which. */
import { rune, type StatModSrc } from '../dsl.ts';

const P = '16.20.1';

/** Attack damage one point of Adaptive Force is worth (it is worth one ability power). The runes give
    Adaptive Force as ability power only; Absolute Focus and Gathering Storm state the attack damage in
    their descriptions (18 AD or 30 AP), and the Adaptive Force shard's values have the same ratio. */
const AD_PER_FORCE = 0.6;
/** Minutes into the game, when the user does not say: a rough solo-lane pace for the build's level
    (level 9 at 12 minutes, level 13 at 20, level 18 at 30). */
const MINUTES = 'max(0, 2 * level - 6)';

const adaptive = (force: string, when?: string): StatModSrc[] => [
  { stat: 'ad', value: `(${force}) * ${AD_PER_FORCE}`, when: when ? `(${when}) && adaptivePhysical` : 'adaptivePhysical' },
  { stat: 'ap', value: force, when: when ? `(${when}) && not(adaptivePhysical)` : 'not(adaptivePhysical)' },
];

/* Aery's round trip has no number in the game data: it depends on how far away the target is.
   Taken as about a second in melee range and two at range; the user can change it. */
const AERY_TRIP = 'if(ranged, 2, 1)';

/* Deathfire Touch: one damaging cast sets the target on fire, or keeps it burning, until `BURN_END`.
   A re-application pays only for the seconds it adds; the seconds past TimeToAmp of continuous
   burning are worth 1 + DamageMultiplier. */
const BURN_LEN = 'if(area, AoEDuration, Duration)';
const BURN_END = `(time + ${BURN_LEN})`;

export default [
  // ---------- keystones ----------
  rune(8214, 'Summon Aery', {
    reviewed: P,
    options: { trip: { label: 'Seconds Aery takes to come back to you', default: AERY_TRIP, max: 5 } },
    // sent: this action's attack or ability damaged the target; backAt: when Aery is back to be sent again
    counters: { sent: { max: 1 }, backAt: {} },
    rules: [
      { id: 'sendAttack', on: 'attack', type: 'adaptive', amount: 0, then: 'sent = 1' },
      { id: 'sendSpell', on: 'spell', type: 'adaptive', amount: 0, then: 'sent = 1' },
      { id: 'aery', label: 'Aery', on: 'after', when: 'sent && time >= backAt', type: 'adaptive', amount: 'DamageCalc', then: 'backAt = time + trip', procs: true },
      { id: 'land', on: 'after', type: 'adaptive', amount: 0, then: 'sent = 0' },
    ],
    notes: [
      'Aery is sent by the first attack or damaging ability of the combo, and again by the first one after she is back. Her round trip is a setting: about a second in melee range and two at range by default.',
      'Her shield on allies is not counted.',
    ],
  }),
  rune(8229, 'Arcane Comet', {
    reviewed: P,
    options: {
      distance: { label: 'Distance to the target when the comet is hurled', default: 'if(ranged, MaxRange, MaxRange / 2)', max: 'MaxRange' },
    },
    rules: [{
      id: 'comet', label: 'Arcane Comet', on: 'spell', type: 'adaptive',
      amount: 'DamageCalc * (1 + MaxDamageAmp * min(distance, MaxRange) / MaxRange)', cooldown: 'CooldownCalc', procs: true,
    }],
    notes: [
      'The comet is counted as hitting. Its bonus for distance is taken to grow evenly from none at 0 range to the full bonus at 750 range; the distance is a setting, by default 750 for ranged champions and half that for melee.',
      'The game data still holds cooldown refunds for ability hits, which the description no longer mentions; they are not counted.',
    ],
  }),
  rune(8230, "Stormraider's Surge", {
    reviewed: P,
    notes: ["Stormraider's Surge only grants move speed and slow resistance; it does not change damage."],
  }),
  rune(8992, 'Deathfire Touch', {
    reviewed: P,
    options: { area: { label: 'Your abilities hit an area (shorter burn)', default: false } },
    // the burn the target is under: when it started burning without a break, and when it goes out
    counters: { burnStart: {}, burnEnd: {} },
    rules: [
      { id: 'ignite', on: 'spell', when: 'time >= burnEnd', type: 'magic', amount: 0, then: ['burnStart = time', 'burnEnd = time'] },
      {
        id: 'burn', label: 'Deathfire', on: 'spell', type: 'magic',
        amount: `DamageCalc * ((${BURN_END} - burnEnd) + DamageMultiplier * (max(0, ${BURN_END} - burnStart - TimeToAmp) - max(0, burnEnd - burnStart - TimeToAmp)))`,
        over: `${BURN_END} - burnEnd`, then: `burnEnd = ${BURN_END}`,
      },
    ],
    notes: [
      'Each ability that damages the target sets it on fire or keeps it burning: the burn runs from the first damaging ability to the last and then for its full duration, with the bonus from the third second of burning on.',
      'Abilities count as single-target and burn for 4 seconds, or all as area abilities (2 seconds) with the setting; damage-over-time abilities, which burn for 1 second in the game, are not told apart.',
    ],
  }),

  // ---------- row 1 ----------
  rune(8224, 'Axiom Arcanist', {
    reviewed: P,
    options: { area: { label: 'Your ultimate hits an area (smaller bonus)', default: false } },
    amps: [{ value: 'if(area, AOEAmp, DamageAmp)', when: 'cast.r', from: ['ability'] }],
    notes: [
      'Counts the damage of your ultimate\'s cast; damage it deals later through attacks or marks is not amplified. Its bonus is the single-target one unless "Your ultimate hits an area" is set.',
      'The cooldown refund on takedowns is not counted.',
    ],
  }),
  rune(8226, 'Manaflow Band', {
    reviewed: P,
    options: {
      stacks: { label: 'Times Manaflow Band has grown your mana', default: 'MaxManaIncrease / ManaIncrease', max: 'MaxManaIncrease / ManaIncrease' },
    },
    statMods: [{ stat: 'mana', value: 'stacks * ManaIncrease' }],
    notes: ['Its bonus mana counts toward damage that scales with mana, at the full 250 by default; mana gained during the combo and the mana it restores are not counted.'],
  }),
  rune(8275, 'Nimbus Cloak', {
    reviewed: P,
    notes: ['Nimbus Cloak only grants move speed after a summoner spell; it does not change damage.'],
  }),

  // ---------- row 2 ----------
  rune(8210, 'Transcendence', {
    reviewed: P,
    // the game's values are fractions: 0.05 is 5 ability haste
    statMods: [{
      stat: 'abilityHaste',
      value: 'if(level >= LevelToTurnOn, HasteBonus1 * 100, 0) + if(level >= LevelToTurnOn2, HasteBonus2 * 100, 0)',
    }],
    notes: ['The cooldown refund on takedowns from level 11 is not counted.'],
  }),
  rune(8234, 'Celerity', {
    reviewed: P,
    notes: ['Celerity only adds move speed; it does not change damage.'],
  }),
  rune(8233, 'Absolute Focus', {
    reviewed: P,
    options: { healthy: { label: 'You are above 70% health', default: true } },
    statMods: adaptive('AdaptiveForceCalc', 'healthy'),
    notes: ['Absolute Focus counts while "You are above 70% health" is set, which it is by default: the combo takes you to be at full health.'],
  }),

  // ---------- row 3 ----------
  rune(8237, 'Scorch', {
    reviewed: P,
    rules: [{ id: 'scorch', label: 'Scorch', on: 'spell', type: 'magic', amount: 'DamageCalc', cooldown: 'BurnlockoutDuration', procs: true }],
    notes: ['Scorch is counted when it is applied, not a second later when it burns.'],
  }),
  rune(8232, 'Waterwalking', {
    reviewed: P,
    options: { river: { label: 'You are in the river', default: false } },
    statMods: adaptive('AdaptiveForceCalc', 'river'),
    notes: ['Waterwalking\'s Adaptive Force counts only when "You are in the river" is set.'],
  }),
  rune(8236, 'Gathering Storm', {
    reviewed: P,
    options: { minutes: { label: 'Minutes into the game', default: MINUTES } },
    // every UpdateAfterMinutes the step grows by AdaptiveAP: 8, 24, 48, 80 ... ability power
    statMods: adaptive('AdaptiveAP * floor(minutes / UpdateAfterMinutes) * (floor(minutes / UpdateAfterMinutes) + 1) / 2'),
    notes: [
      'Minutes into the game default to a rough solo-lane pace for the level (20 minutes at level 13); set them to the game you have in mind.',
      'As attack damage it is counted at 0.6 per ability power, as the description lists it, without its rounding.',
    ],
  }),
];

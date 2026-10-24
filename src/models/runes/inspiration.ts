/* Inspiration (8300). Names on the right of each formula are the rune's own named values and
   calculations (`runes.json`, or `npm run data:report -- --rune <id>`). docs/models.md says how
   settings (options, procs) work: a rune's are set per build as `runeOptions`, like an item's.

   Most of this tree is gold, summoner spells, potions and move speed, which change nothing against
   one enemy. */
import { rune, type StatModSrc } from '../dsl.ts';

const P = '16.20.1';

/** Attack damage one point of Adaptive Force is worth (it is worth one ability power): the Adaptive Force
    shard's own values have this ratio, and Absolute Focus and Gathering Storm state it in their descriptions. */
const AD_PER_FORCE = 0.6;
/** Minutes into the game, when the user does not say: a rough solo-lane pace for the build's level
    (level 9 at 12 minutes, level 13 at 20, level 18 at 30). */
const MINUTES = 'max(0, 2 * level - 6)';

const adaptive = (force: string, when?: string): StatModSrc[] => [
  { stat: 'ad', value: `(${force}) * ${AD_PER_FORCE}`, when: when ? `(${when}) && adaptivePhysical` : 'adaptivePhysical' },
  { stat: 'ap', value: force, when: when ? `(${when}) && not(adaptivePhysical)` : 'not(adaptivePhysical)' },
];

/** Adaptive Force of the Elixir of Force that Triple Tonic hands out. It is the elixir's number (item 2152,
    "Grants 25 Adaptive Force for 60 seconds"), not part of the rune's own data. */
const ELIXIR_OF_FORCE = 25;

/** Jack of All Trades: the stack counts at which its two Adaptive Force bonuses start. The description
    states them; the game data has only the bonuses ({1b48f5ea} and {55d14eea}). */
const JACK_FIRST = 5, JACK_SECOND = 10;
/** Its default stack count: how many of the stats the calculator tracks the build's items give.
    Options are settled on item stats alone, so these read the items only. */
const JACK_STATS = ['ap', 'bonusAd', 'bonusHp', 'bonusMana', 'bonusArmor', 'bonusMr', 'abilityHaste', 'critChance', 'lethality', 'lifeSteal', 'omnivamp', 'bonusMs']
  .map(s => `(${s} > 0)`).join(' + ');

export default [
  // ---------- keystones ----------
  rune(8351, 'Glacial Augment', {
    reviewed: P,
    notes: ['Glacial Augment only slows and lowers the damage enemies deal to your allies; it does not change your damage.'],
  }),
  rune(8360, 'Unsealed Spellbook', {
    reviewed: P,
    notes: ['Unsealed Spellbook only swaps summoner spells, which are not part of the combo; it does not change damage.'],
  }),
  rune(8369, 'First Strike', {
    reviewed: P,
    options: { opened: { label: 'The combo opens the fight (you were out of champion combat)', default: true } },
    amps: [{ value: 'DamageAmp', when: 'opened && time < Duration' }],
    notes: [
      'First Strike is counted as set off by the combo\'s first hit: it amplifies all damage dealt in its first 3 seconds, that hit included. Damage over time is dealt when it is applied, so a burn that starts in time is amplified whole.',
      'Its gold is not counted.',
    ],
  }),

  // ---------- row 1 ----------
  rune(8306, 'Hextech Flashtraption', {
    reviewed: P,
    notes: ['Hexflash only moves you; it does not change damage.'],
  }),
  rune(8304, 'Magical Footwear', {
    reviewed: P,
    notes: ['Magical Footwear only gives boots and move speed; it does not change damage.'],
  }),
  rune(8321, 'Cash Back', {
    reviewed: P,
    notes: ['Cash Back only refunds gold; it does not change damage.'],
  }),

  // ---------- row 2 ----------
  rune(8313, 'Triple Tonic', {
    reviewed: P,
    options: { force: { label: 'Elixir of Force is active', default: false } },
    statMods: adaptive(String(ELIXIR_OF_FORCE), 'force && level >= SecondElixirLevel'),
    notes: [
      'The Elixir of Force (from level 6) lasts 60 seconds once drunk; its Adaptive Force counts only when "Elixir of Force is active" is set.',
      'The Elixir of Avarice only damages minions, and the skill point of the Elixir of Skill is already in the ranks you set.',
    ],
  }),
  rune(8352, 'Time Warp Tonic', {
    reviewed: P,
    notes: ['Time Warp Tonic only speeds up potion healing; it does not change damage.'],
  }),
  rune(8345, 'Biscuit Delivery', {
    reviewed: P,
    options: {
      biscuits: {
        label: 'Biscuits eaten', default: `floor(min(SwapOverMinute, ${MINUTES}) / BiscuitMinuteInterval)`,
        max: 'SwapOverMinute / BiscuitMinuteInterval',
      },
    },
    statMods: [{ stat: 'hp', value: 'biscuits * PermanentHP' }],
    notes: [
      'The max health from eaten biscuits counts toward damage that scales with health; by default every biscuit delivered by the build\'s level (on a rough solo-lane pace) is eaten.',
      'Their healing is not counted.',
    ],
  }),

  // ---------- row 3 ----------
  rune(8347, 'Cosmic Insight', {
    reviewed: P,
    notes: ['Summoner spell and item haste do not change damage here: item actives are used as many times as their setting says.'],
  }),
  rune(8410, 'Approach Velocity', {
    reviewed: P,
    notes: ['Approach Velocity only adds move speed; it does not change damage.'],
  }),
  rune(8316, 'Jack Of All Trades', {
    reviewed: P,
    options: { stacks: { label: 'Different stats your items give', default: JACK_STATS } },
    statMods: [
      { stat: 'abilityHaste', value: 'stacks * HastePerStack' },
      ...adaptive(`if(stacks >= ${JACK_SECOND}, dv('{55d14eea}'), if(stacks >= ${JACK_FIRST}, dv('{1b48f5ea}'), 0))`),
    ],
    notes: [
      'Its stacks default to the stats your items give among those the calculator tracks; attack speed, regeneration, penetration other than lethality, heal and shield power and tenacity are not seen, so add them by hand.',
      'The Adaptive Force is taken as 8 from 5 stacks and 20 in all from 10, not 28.',
    ],
  }),
];

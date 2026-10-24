/* Domination (style 8100). Names on the right of each formula are the rune's own named values and
   calculations (`runes.json`). docs/models.md says how settings (options, procs) work. */
import { rune } from '../dsl.ts';

const P = '16.20.1';
// counts the descriptions spell out in words; the game data has no value for them
const ELECTROCUTE_HITS = 3, BOUNTY_HUNTER_STACKS = 5;
// a value "based on level" that the game data gives as its level 1 and level 18 ends, taken to grow evenly between them
const byLevel = (min: string, max: string) => `(${min} + (${max} - ${min}) * (level - 1) / 17)`;
// a hit opens a new window when it comes more than the window's length after the hit that opened the last one
const countHit = ['hits = if(time - firstAt > WindowDuration, 0, hits) + 1', 'firstAt = if(hits == 1, time, firstAt)'];

export default [
  rune(8112, 'Electrocute', {
    reviewed: P,
    counters: { hits: {}, firstAt: {}, readyAt: {} },
    rules: [
      { id: 'byAttack', on: 'attack', when: 'time >= readyAt', type: 'adaptive', amount: 0, then: countHit },
      { id: 'byAbility', on: 'spell', when: 'time >= readyAt', type: 'adaptive', amount: 0, then: countHit },
      {
        id: 'strike', label: 'Electrocute', on: 'after', when: `hits >= ${ELECTROCUTE_HITS}`, type: 'adaptive',
        amount: 'TotalDamage', then: ['hits = 0', 'readyAt = time + Cooldown'], procs: true,
      },
    ],
    notes: ['Electrocute counts each basic attack and each ability cast that deals damage as one hit, and strikes after the third within its window. Hits made while it cools down do not count.'],
  }),
  rune(8128, 'Dark Harvest', {
    reviewed: P,
    options: { souls: { label: 'Souls harvested so far this game', default: 0 } },
    counters: { soul: { start: 'souls' } },
    rules: [{
      id: 'harvest', label: 'Dark Harvest', on: 'damage', when: 'hasTarget && target.hp > 0 && target.hpPct < HarvestThreshold', type: 'adaptive',
      amount: 'TotalDamage + DamagePerSoulEssence * soul', cooldown: 'Cooldown', then: 'soul += 1', procs: true,
    }],
    notes: ['Dark Harvest strikes on the first damage that leaves the target below its health threshold, and the soul it takes counts from its next strike on. Its cooldown reset on takedowns does not matter against one target.'],
  }),
  rune(9923, 'Hail of Blades', {
    reviewed: P,
    // blades: empowered attacks left; the cooldown starts when the first one lands
    counters: { blades: {}, lastAt: {}, readyAt: {} },
    rules: [
      { id: 'expire', on: 'attack', when: 'blades > 0 && time - lastAt > Duration', type: 'true', amount: 0, then: 'blades = 0' },
      { id: 'start', on: 'attack', when: 'blades == 0 && time >= readyAt', type: 'true', amount: 0, then: ['blades = NumHits', 'readyAt = time + Cooldown'] },
      // the game's BonusDamage interpolates between BonusDamageMin and BonusDamageMax in a way the compiler cannot read: it is spelled out here
      {
        id: 'blade', label: 'Hail of Blades', on: 'attack', when: 'blades > 0', type: 'true',
        amount: `${byLevel('BonusDamageMin', 'BonusDamageMax')} + BonusADRatio * bonusAd + APRatio * ap`,
        then: ['blades = blades - 1', 'lastAt = time'], procs: true,
      },
    ],
    notes: [
      'Hail of Blades empowers the first basic attacks of the fight, and again once its cooldown has run from the first of them; its damage grows evenly with level.',
      'Its attack speed is not counted: stats hold for the whole fight, and in a combo it only makes the attacks come sooner. Sustained damage counts its true damage but not the faster attacks.',
      'Attack resets do not add attacks to it, and an empowered attack the champion\'s model writes as an ability does not use it.',
    ],
  }),

  rune(8126, 'Cheap Shot', {
    reviewed: P,
    options: { impaired: { label: 'The target is slowed, stunned or otherwise impaired during the combo', default: false } },
    rules: [{ id: 'shot', label: 'Cheap Shot', on: 'damage', when: 'impaired', type: 'true', amount: 'DamageCalc', cooldown: 'Cooldown', procs: true }],
    notes: ['Which abilities impair is not known to the engine: with its setting on, Cheap Shot fires on any damage, on its cooldown, for the whole combo. Leave it off and count it by hand when only part of the combo lands on an impaired target.'],
  }),
  rune(8139, 'Taste of Blood', { reviewed: P, notes: ['Taste of Blood heals; it deals no damage.'] }),
  rune(8143, 'Sudden Impact', {
    reviewed: P,
    options: { dashed: { label: 'The combo opens with a dash, leap, blink or leaving stealth', default: false } },
    counters: { armed: { max: 1, start: 'dashed' } },
    rules: [{
      id: 'impact', label: 'Sudden Impact', on: 'damage', when: 'armed && time < ArmedDuration', type: 'true', amount: 'BaseDamage',
      then: 'armed = 0', procs: true,
    }],
    notes: ['Which abilities dash or blink is not known to the engine: with its setting on, Sudden Impact fires on the first damage of the combo within its window. Dashes later in the combo are not tracked; count those by hand.'],
  }),

  rune(8137, 'Sixth Sense', { reviewed: P, notes: ['Sixth Sense finds wards; it deals no damage.'] }),
  rune(8140, 'Grisly Mementos', { reviewed: P, notes: ['Grisly Mementos gives trinket or summoner spell haste; it deals no damage.'] }),
  rune(8141, 'Deep Ward', { reviewed: P, notes: ['Deep Ward makes wards last longer; it deals no damage.'] }),

  rune(8135, 'Treasure Hunter', { reviewed: P, notes: ['Treasure Hunter gives gold; it deals no damage.'] }),
  rune(8105, 'Relentless Hunter', { reviewed: P, notes: ['Relentless Hunter gives move speed out of combat; it deals no damage.'] }),
  rune(8106, 'Ultimate Hunter', {
    reviewed: P,
    options: { stacks: { label: 'Bounty Hunter stacks: enemy champions you have taken down', default: 0, max: BOUNTY_HUNTER_STACKS } },
    statMods: [{ stat: 'ultHaste', value: 'StartingUltAH + AdditionalUltAH * stacks' }],
    notes: ['Ultimate Hunter only shortens the cooldown of your ultimate shown; it does not change the combo.'],
  }),
];

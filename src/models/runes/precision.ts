/* Precision (style 8000). Names on the right of each formula are the rune's own named values and
   calculations (`runes.json`). docs/models.md says how settings (options, procs) work.

   Stats are worked out once per fight, so a rune whose stats grow during it (Conqueror, Lethal Tempo)
   counts them at the stacks its setting says the combo starts with, and at full stacks in sustained damage. */
import { rune } from '../dsl.ts';

const P = '16.20.1';
// Adaptive Force is worth 0.6 Attack Damage per point (the Adaptive Force shard: 9 AP or 5.4 AD); a rune's own data has no value for it
const AD_PER_ADAPTIVE = 0.6;
// a value "based on level" that the game data gives as its level 1 and level 18 ends, taken to grow evenly between them
const byLevel = (min: string, max: string) => `(${min} + (${max} - ${min}) * (level - 1) / 17)`;

export default [
  rune(8005, 'Press the Attack', {
    reviewed: P,
    // exposed: the burst has landed and your damage is amplified for the rest of the fight
    counters: { hits: {}, lastAt: {}, exposed: { max: 1 } },
    rules: [
      { id: 'count', on: 'attack', when: 'not(exposed)', type: 'adaptive', amount: 0, then: ['hits = if(time - lastAt > TimeBetweenHits, 0, hits) + 1', 'lastAt = time'] },
      {
        id: 'burst', label: 'Press the Attack', on: 'attack', when: 'hits >= HitsRequired', type: 'adaptive',
        amount: byLevel('MinDamage', 'MaxDamage'), then: ['hits = 0', 'exposed = 1'], procs: true,
      },
    ],
    amps: [{ value: 'BonusPercentDamage', when: 'exposed' }],
    notes: [
      'Press the Attack counts basic attacks only; an empowered attack the champion\'s model writes as an ability does not count toward the three.',
      'Its damage grows evenly with level. It lands once a fight; the damage amplification starts after it and lasts the rest of the combo, as you stay in combat.',
    ],
  }),
  rune(8008, 'Lethal Tempo', {
    reviewed: P,
    options: { stacks: { label: 'Lethal Tempo stacks when the combo starts', default: 0, max: 'MaxStacks' } },
    counters: { tempo: { max: 'MaxStacks', start: 'if(sustained, MaxStacks, stacks)' }, lastAt: {} },
    statMods: [{ stat: 'attackSpeed', value: 'ASPerStack * if(sustained, MaxStacks, stacks)' }],
    rules: [
      { id: 'stack', on: 'attack', type: 'adaptive', amount: 0, then: ['tempo = if(time - lastAt > Duration, 0, tempo) + 1', 'lastAt = time'] },
      // the game's NoteDamage is multiplied by 1 + bonus attack speed, which the compiled calculation leaves out;
      // the attack speed of the stacks not counted in the stats is added back
      {
        id: 'note', label: 'Lethal Tempo', on: 'attack', when: 'tempo >= MaxStacks', type: 'adaptive',
        amount: 'NoteDamage * (1 + bonusAs + ASPerStack * (MaxStacks - if(sustained, MaxStacks, stacks)))',
      },
    ],
    notes: [
      'Each basic attack adds a stack; the attack that reaches full stacks deals the bonus damage too. The stacks fall off when an attack comes more than their duration after the last.',
      'Attack speed is counted at the stacks the combo starts with (full stacks in sustained damage); stacks gained during the combo still count toward the bonus damage, and at full stacks its scaling with bonus attack speed counts all of them.',
      'Ranged numbers follow the game\'s own calculations (4.8% attack speed per stack, 6 - 20 damage), which differ from the 4% and 6 - 24 in the rune\'s description.',
    ],
  }),
  rune(8021, 'Fleet Footwork', { reviewed: P, notes: ['Fleet Footwork heals and gives move speed; it deals no damage.'] }),
  rune(8010, 'Conqueror', {
    reviewed: P,
    options: { stacks: { label: 'Conqueror stacks for the whole combo', default: 0, max: 'MaxStacks' } },
    statMods: [
      { stat: 'ad', value: `${AD_PER_ADAPTIVE} * ${byLevel('MinAdaptivePerStack', 'MaxAdaptivePerStack')} * if(sustained, MaxStacks, stacks)`, when: 'adaptivePhysical' },
      { stat: 'ap', value: `${byLevel('MinAdaptivePerStack', 'MaxAdaptivePerStack')} * if(sustained, MaxStacks, stacks)`, when: 'not(adaptivePhysical)' },
    ],
    notes: [
      'Conqueror\'s Adaptive Force is counted at the stacks its setting gives, for the whole combo, and at full stacks in sustained damage: stats hold for a whole fight, so stacks gained during the combo are not counted. Set it to the stacks you expect to fight at.',
      'Adaptive Force per stack grows evenly with level; a point is worth 0.6 Attack Damage or 1 Ability Power. The healing at full stacks is not counted.',
    ],
  }),

  rune(9101, 'Absorb Life', { reviewed: P, notes: ['Absorb Life heals on kills; it deals no damage.'] }),
  rune(9111, 'Triumph', { reviewed: P, notes: ['Triumph heals and gives gold on takedowns; it deals no damage.'] }),
  rune(8009, 'Presence of Mind', { reviewed: P, notes: ['Presence of Mind restores mana or energy; it deals no damage.'] }),

  rune(9104, 'Legend: Alacrity', {
    reviewed: P,
    options: { stacks: { label: 'Legend stacks, all of them by default', default: 'MaxLegendStacks', max: 'MaxLegendStacks' } },
    statMods: [{ stat: 'attackSpeed', value: 'AttackSpeedBase + AttackSpeedPerStack * stacks' }],
  }),
  rune(9105, 'Legend: Haste', {
    reviewed: P,
    options: { stacks: { label: 'Legend stacks, all of them by default', default: 'MaxLegendStacks', max: 'MaxLegendStacks' } },
    statMods: [{ stat: 'basicHaste', value: 'HasteBase + HastePerStack * stacks' }],
    notes: ['Legend: Haste only shortens the cooldowns of Q, W and E shown; it does not change the combo.'],
  }),
  rune(9103, 'Legend: Bloodline', {
    reviewed: P,
    options: { stacks: { label: 'Legend stacks, all of them by default', default: 'MaxLegendStacks', max: 'MaxLegendStacks' } },
    // the game's life steal is in percent points
    statMods: [
      { stat: 'lifeSteal', value: '(LifeStealBase + LifeStealPerStack * stacks) / 100' },
      { stat: 'hp', value: 'BonusHealth', when: 'stacks >= MaxLegendStacks' },
    ],
    notes: ['Legend: Bloodline\'s life steal heals and does not add damage; its bonus health at full stacks counts for abilities that scale with health.'],
  }),

  rune(8014, 'Coup de Grace', {
    reviewed: P,
    amps: [{ value: 'BonusPercentDamage', when: 'hasTarget && target.hpPct < EnemyHealthPercentageThreshold' }],
  }),
  rune(8017, 'Cut Down', {
    reviewed: P,
    amps: [{ value: 'BonusPercentDamage', when: 'hasTarget && target.hpPct > EnemyHealthPercentageThreshold' }],
  }),
  rune(8299, 'Last Stand', {
    reviewed: P,
    options: { missing: { label: 'Percent of your health missing during the combo', default: 0, max: 100 } },
    amps: [{
      value: 'MinBonusDamagePercent + (MaxBonusDamagePercent - MinBonusDamagePercent) * clamp((HealthThresholdStart - (1 - missing / 100)) / (HealthThresholdStart - HealthThresholdEnd), 0, 1)',
      when: '1 - missing / 100 < HealthThresholdStart',
    }],
    notes: ['The engine takes you to be at full health, so Last Stand counts only the missing health its setting gives. Its bonus is taken to grow evenly from the start threshold down to the health where it peaks.'],
  }),
];

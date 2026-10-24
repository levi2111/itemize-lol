/* Resolve (8400). Names on the right of each formula are the rune's own named values and calculations
   (`runes.json`, or `npm run data:report -- --rune <id>`). docs/models.md says how settings (options,
   procs) work: a rune's are set per build as `runeOptions`, like an item's.

   Most of this tree heals, shields or toughens you. Health, armor and magic resist it grants are
   still counted as stats, since some damage scales with them. */
import { rune } from '../dsl.ts';

const P = '16.20.1';

/** Minutes into the game, when the user does not say: a rough solo-lane pace for the build's level
    (level 9 at 12 minutes, level 13 at 20, level 18 at 30). */
const MINUTES = 'max(0, 2 * level - 6)';

export default [
  // ---------- keystones ----------
  rune(8437, 'Grasp of the Undying', {
    reviewed: P,
    options: {
      charged: { label: 'Grasp is charged when the combo starts', default: true },
      gained: { label: 'Max health already gained from Grasp', default: 0 },
    },
    // readyAt: when the next attack is empowered; it charges again TriggerTime after each one
    counters: { readyAt: { start: 'if(charged, 0, TriggerTime)' } },
    statMods: [{ stat: 'hp', value: 'gained' }],
    rules: [{
      id: 'grasp', label: 'Grasp of the Undying', on: 'attack', when: 'time >= readyAt', type: 'magic', amount: 'DamageCalc',
      then: 'readyAt = time + TriggerTime', procs: true,
    }],
    notes: [
      'Grasp is counted as charged for the first attack of the combo (unless that setting is off) and again 4 seconds of combat after each proc.',
      'The max health Grasp grants during the combo is not counted; set what earlier procs gave in "Max health already gained from Grasp".',
    ],
  }),
  rune(8439, 'Aftershock', {
    reviewed: P,
    options: {
      immobilize: { label: 'Your combo immobilizes the target', default: true },
      braced: { label: "Aftershock's armor and magic resist are up for the whole combo", default: false },
    },
    // the shockwave follows an immobilize: it is set off by the first ability of the combo, after that cast's own hits
    rules: [{
      id: 'aftershock', label: 'Aftershock', on: 'after', when: 'immobilize && (cast.q || cast.w || cast.e || cast.r)',
      type: 'magic', amount: 'DamageCalc', cooldown: 'Cooldown', procs: true,
    }],
    statMods: [
      { stat: 'armor', value: 'min(ArmorBuff, MaxResistCalc)', when: 'braced' },
      { stat: 'mr', value: 'min(MagicResistBuff, MaxResistCalc)', when: 'braced' },
    ],
    notes: [
      'Aftershock is counted as set off by the first ability of the combo, and again after its cooldown; turn off "Your combo immobilizes the target" if it does not, or count it by hand.',
      'The shockwave is counted when the immobilize lands, not 2.5 seconds later.',
      'Its armor and magic resist only last 2.5 seconds, so they count for damage that scales with them only when you set them up for the whole combo.',
    ],
  }),
  rune(8465, 'Guardian', {
    reviewed: P,
    notes: ['Guardian only shields you and an ally; it does not change damage.'],
  }),

  // ---------- row 1 ----------
  rune(8446, 'Demolish', {
    reviewed: P,
    notes: ['Demolish only damages towers; it adds nothing against a champion.'],
  }),
  rune(8463, 'Font of Life', {
    reviewed: P,
    notes: ['Font of Life only heals; it does not change damage.'],
  }),
  rune(8401, 'Shield Bash', {
    reviewed: P,
    options: {
      shielded: { label: 'You gained a new shield just before the combo', default: false },
      shield: { label: 'How big that shield was', default: 0 },
    },
    counters: { armed: { max: 1, start: 'shielded' } },
    rules: [{
      id: 'bash', label: 'Shield Bash', on: 'attack', when: 'armed', type: 'adaptive',
      // the game's ratios are in percent points
      amount: 'ProcBaseMin + (ProcBaseMax - ProcBaseMin) * (level - 1) / 17 + BonusHealthRatio / 100 * bonusHp + ShieldRatio / 100 * shield',
      then: 'armed = 0', procs: true,
    }],
    notes: [
      'Shield Bash is counted on the first attack when "You gained a new shield just before the combo" is set; the combo does not know when your abilities or items shield you, so count further bashes by hand.',
      'Its base damage is taken to grow evenly from level 1 to level 18.',
    ],
  }),

  // ---------- row 2 ----------
  rune(8429, 'Conditioning', {
    reviewed: P,
    options: { minutes: { label: 'Minutes into the game', default: MINUTES } },
    statMods: [
      { stat: 'armor', value: 'ArmorBase', when: 'minutes >= MinutesRequired' },
      { stat: 'mr', value: 'MRBase', when: 'minutes >= MinutesRequired' },
      { stat: 'armor', phase: 'percent', value: 'ExtraResist', when: 'minutes >= MinutesRequired' },
      { stat: 'mr', phase: 'percent', value: 'ExtraResist', when: 'minutes >= MinutesRequired' },
    ],
    notes: [
      'Its armor and magic resist count toward damage that scales with them once the game is past 12 minutes.',
      'Minutes into the game default to a rough solo-lane pace for the level (20 minutes at level 13).',
    ],
  }),
  rune(8444, 'Second Wind', {
    reviewed: P,
    notes: ['Second Wind only heals; it does not change damage.'],
  }),
  rune(8473, 'Bone Plating', {
    reviewed: P,
    notes: ['Bone Plating only reduces the damage you take; it does not change damage dealt.'],
  }),

  // ---------- row 3 ----------
  rune(8451, 'Overgrowth', {
    reviewed: P,
    options: { units: { label: 'Minions and monsters absorbed by Overgrowth', default: 'ThresholdUnits' } },
    statMods: [
      { stat: 'hp', value: 'floor(units / UnitsPerTier) * FlatHealthPerTier' },
      { stat: 'hp', phase: 'percent', value: 'ThresholdMaxHealthRatio', when: 'units >= ThresholdUnits' },
    ],
    notes: ['Its max health counts toward damage that scales with health; by default Overgrowth has absorbed the 120 units that complete it.'],
  }),
  rune(8453, 'Revitalize', {
    reviewed: P,
    notes: ['Revitalize only strengthens heals and shields; it does not change damage.'],
  }),
  rune(8242, 'Unflinching', {
    reviewed: P,
    notes: ['Unflinching\'s armor and magic resist only last while you are crowd controlled, so they are not counted.'],
  }),
];

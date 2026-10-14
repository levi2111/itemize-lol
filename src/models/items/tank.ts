/* Tank items that deal damage: health-stacking items whose passives burn, drain or hit with the
   wearer's health. Names on the right of each formula are the item's own data values and
   calculations: `npm run data:report -- --item <id>` lists them. docs/models.md says how an item's
   settings (options, procs, uses) work.

   Every Immolate is written the same way. Taking or dealing damage keeps it burning, so it burns
   while the fight runs: the first action brings its whole duration, and each action after that pays
   for the seconds since the one before, which is what keeping it alive adds. */
import { item } from '../dsl.ts';

const P = '16.20.1';

// the seconds one firing of Immolate pays for; sustained attacking pays each attack for the time until the next
const BURN = 'if(sustained, 1 / attackSpeed, if(burning, clamp(time - burnedAt, 0, AuraDuration), AuraDuration))';
const IMMOLATE_NOTE = 'Immolate is counted as burning from the first action of the combo to the last and then for its full duration after it, with the target staying in range. '
  + 'Two Immolate items in one build both burn here, though in the game the effect does not stack.';

export default [
  item(3068, 'Sunfire Aegis', {
    reviewed: P,
    counters: { burning: { max: 1 }, burnedAt: {} },
    rules: [{ id: 'immolate', label: 'Immolate', on: 'after', type: 'magic', amount: `DPS * ${BURN}`, over: BURN, then: ['burning = 1', 'burnedAt = time'] }],
    notes: [IMMOLATE_NOTE],
  }),
  item(6664, 'Hollow Radiance', {
    reviewed: P,
    counters: { burning: { max: 1 }, burnedAt: {} },
    rules: [{ id: 'immolate', label: 'Immolate', on: 'after', type: 'magic', amount: `DPS * ${BURN}`, over: BURN, then: ['burning = 1', 'burnedAt = time'] }],
    notes: [IMMOLATE_NOTE, 'Desolate deals its damage around an enemy that dies, so it adds nothing against a single target.'],
  }),
  item(6660, "Bami's Cinder", {
    reviewed: P,
    counters: { burning: { max: 1 }, burnedAt: {} },
    rules: [{ id: 'immolate', label: 'Immolate', on: 'after', type: 'magic', amount: `DPS * ${BURN}`, over: BURN, then: ['burning = 1', 'burnedAt = time'] }],
    notes: [IMMOLATE_NOTE],
  }),
  item(2502, 'Unending Despair', {
    reviewed: P,
    rules: [{ id: 'anguish', label: 'Anguish', on: 'after', type: 'magic', amount: 'DrainCalc', cooldown: 'Cooldown', procs: true }],
    notes: ['Anguish is counted as firing when the combo starts and again each time its cooldown is up.'],
  }),
  item(3084, 'Heartsteel', {
    reviewed: P,
    options: { gained: { label: 'Max health already gained from Colossal Consumption', default: 0 } },
    statMods: [{ stat: 'hp', value: 'gained' }],
    rules: [{ id: 'consume', label: 'Colossal Consumption', on: 'attack', type: 'physical', amount: 'DamageCalc', cooldown: 'Cooldown', procs: true }],
    notes: [
      'Colossal Consumption is counted as charged when the combo starts: it fires on the first attack and again each time its cooldown is up.',
      'The max health Colossal Consumption grants during the combo is not counted; set what earlier procs gave in "Max health already gained from Colossal Consumption".',
    ],
  }),
  item(3742, "Dead Man's Plate", {
    reviewed: P,
    options: { momentum: { label: 'Momentum stacks built up when the combo starts', default: 'MaxStacks', max: 'MaxStacks' } },
    counters: { spent: { max: 1 } },
    rules: [{
      id: 'shipwrecker', label: 'Shipwrecker', on: 'attack', when: '!spent', type: 'physical',
      amount: 'MaxDamageCalc * momentum / MaxStacks', then: 'spent = 1', procs: true,
    }],
    notes: ['Shipwrecker discharges on the first attack with the momentum set for the start of the combo, its damage growing evenly with momentum; momentum built by moving during the combo is not counted.'],
  }),
  item(3075, 'Thornmail', {
    reviewed: P,
    notes: ['Thorns only damages enemies that attack you, so it adds nothing to the damage you deal.'],
  }),
];

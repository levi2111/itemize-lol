import { champion } from '../dsl.ts';

/* What the formulas alone do not say about Vladimir:
   - Crimson Pact turns bonus health into ability power and ability power into
     health, and neither gift feeds the other.
   - Transfusion is empowered on every third cast.
   - Hemoplague makes the target take more damage until it bursts, its own burst
     included. */
export default champion('Vladimir', {
  reviewed: '16.20.1',
  vars: {
    // Crimson Rush: a stack per Transfusion, two to begin with when the option says it is full
    surging: 'rush + 2 * crimsonRush >= 2',
  },
  options: {
    crimsonRush: { label: 'First Transfusion is empowered (Crimson Rush full)', default: false },
    plagued: { label: 'Hemoplague on the target for the whole combo', default: false },
  },
  counters: { rush: {}, plague: {} },
  p: {
    statMods: [
      // added before percentage ability power, which multiplies it like any other
      { stat: 'ap', value: 'bonusHp / HPforAP' },
      // reads the finished ability power less the share the passive itself gave
      { stat: 'hp', value: 'APRatioBonusHP * (ap - bonusHp / HPforAP)', phase: 'convert' },
    ],
    notes: ['Crimson Pact is included: bonus health from items gives ability power and ability power from items gives health.'],
  },
  q: {
    hits: [
      { id: 'drain', type: 'magic', when: '!surging', amount: 'BaseDamageTooltip' },
      { id: 'empowered', label: 'Empowered Transfusion', type: 'magic', when: 'surging', amount: 'EmpoweredDamageTooltip' },
      // decided after both, so one cast is never counted as both; the empowered cast spends the option's stacks too
      { id: 'rush', type: 'magic', amount: 0, then: 'rush = if(surging, -2 * crimsonRush, rush + 1)' },
    ],
    notes: ['Every third Transfusion in the combo is the empowered one, starting with the first when "First Transfusion is empowered" is set.'],
  },
  w: {
    // "for 2 seconds" is only in the tooltip's prose
    hits: [{ id: 'pool', type: 'magic', amount: 'TotalDamage', over: 2, note: 'The full 2 seconds in the pool are counted.' }],
  },
  e: {
    // a lone target is damaged by one missile only
    hits: [{ id: 'nova', type: 'magic', amount: 'MaxDamageTooltip', note: 'Tides of Blood is counted at full charge.' }],
  },
  r: {
    hits: [
      // the plague is on the target before its own burst, which it amplifies too
      { id: 'infect', type: 'magic', amount: 0, then: 'plague = 1' },
      { id: 'burst', type: 'magic', amount: 'Damage' },
    ],
    // true damage is left out: the plague does not increase it
    amps: [{ value: 'DamageAmp / 100', when: 'plague || plagued', types: ['physical', 'magic'] }],
    notes: ['Hemoplague increases its own burst and everything after it in the combo. Set "Hemoplague on the target for the whole combo" when it is cast first.'],
  },
});

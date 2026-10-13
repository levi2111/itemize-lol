import { champion } from '../dsl.ts';

/* Kog'Maw's damage is his basic attacks with Bio-Arcane Barrage running, so
   Barrage is a state rather than a hit: casting it in a combo turns it on for its
   duration, and an option does the same for damage per second, where nothing is
   cast. Living Artillery reads the target's health when each shot lands. */
export default champion('KogMaw', {
  reviewed: '16.20.1',
  vars: {
    barrage: 'bioArcane || time < barrageUntil',
    // share of its health the target has lost, without the Icathian Surprise the model has to play early
    lost: 'max(0, target.missingHpPct - blast / max(1, target.maxHp))',
  },
  options: {
    bioArcane: { label: 'Bio-Arcane Barrage active', default: false },
    surprise: { label: 'Icathian Surprise explodes on the target', default: false },
  },
  // corroded, barrageUntil: when this fight's Caustic Spittle shred and Bio-Arcane Barrage run out; blast: damage of an explosion already played
  counters: { corroded: {}, barrageUntil: {}, blast: {} },
  p: {
    rules: [
      // he explodes after dying, which no action in a combo stands for: it is played once, after the first action
      { id: 'explosion', on: 'after', when: 'surprise && !sustained && !blast', type: 'true', amount: 'PassiveDamage', then: 'blast = PassiveDamage' },
    ],
    notes: ['The explosion after Kog\'Maw dies is off unless "Icathian Surprise explodes on the target" is set. It is then added to the combo once, and never to damage per second.'],
  },
  q: {
    // the shred lands after the spittle's own damage
    hits: [{ id: 'spittle', type: 'magic', amount: 'TotalDamage', then: 'corroded = time + ShredDuration' }],
    // ShredAmount is in percent points
    resists: [
      { stat: 'armor', kind: 'reducePct', value: 'ShredAmount / 100', when: 'time < corroded' },
      { stat: 'mr', kind: 'reducePct', value: 'ShredAmount / 100', when: 'time < corroded' },
    ],
    // the passive half: attack speed for as long as the ability has a rank
    statMods: [{ stat: 'attackSpeed', value: 'dv(\'AttackSpeed\')' }],
    notes: ['Caustic Spittle lowers the target\'s armor and magic resist for what follows it in the combo, until its duration runs out. Its own damage is dealt before the reduction.'],
  },
  w: {
    hits: [{
      id: 'activate', type: 'magic', amount: 0, then: 'barrageUntil = time + Duration',
      note: 'Casting Bio-Arcane Barrage empowers the attacks that follow it in the combo, until its duration runs out. For damage per second, set "Bio-Arcane Barrage active".',
    }],
    rules: [
      { id: 'barrage', on: 'onhit', when: 'barrage', type: 'magic', amount: 'TotalHealthDamage * target.maxHp' },
    ],
  },
  e: {
    // the ooze left behind only slows
    hits: [{ id: 'bile', type: 'magic', amount: 'TotalDamage' }],
  },
  r: {
    hits: [{
      // the tooltip states the 40% health mark in prose; the game data has no value for it
      id: 'shot', type: 'magic',
      amount: 'if(hasTarget && 1 - lost < 40%, MaxDamageCalc, BaseDamageCalc * (1 + lost * TooltipMissingHealthDamageAmp))',
      note: 'Living Artillery scales with the health the target has lost by the time each shot lands; add R to the combo once per shot.',
    }],
  },
});

import { champion } from '../dsl.ts';

/* Decimating Smash and Unstoppable Onslaught are ranges in the game data: a
   minimum and a maximum, with the charge in between left to the player. The
   model counts both at their maximum and has a switch for the minimum. What it
   adds beyond that: Soul Furnace's damage is the detonation, Roar of the
   Slayer's armor shred holds for what follows it, and the reanimated Sion of
   Glory in Death is a state the user turns on. */
export default champion('Sion', {
  reviewed: '16.20.1',
  options: {
    reanimated: { label: 'Reanimated by Glory in Death', default: false },
    qCharged: { label: 'Decimating Smash fully charged', default: true },
    rFull: { label: 'Unstoppable Onslaught at full charge distance', default: true },
    // kept between fights, and two kinds of kill give different amounts, so it is asked for as health
    furnaceHp: { label: 'Max health gained from Soul Furnace kills', kind: 'int', default: 0, min: 0 },
  },
  // roared: Roar of the Slayer has hit the target this fight
  counters: { roared: { max: 1 } },
  p: {
    rules: [
      { id: 'frenzy', label: 'Glory in Death', on: 'attack', when: 'reanimated', type: 'physical', amount: 'PercentMaxHP * target.maxHp' },
    ],
    notes: ['With "Reanimated by Glory in Death" set, each basic attack deals the bonus max health damage. Sion has no abilities while reanimated, so use a combo of basic attacks only; his fixed reanimated attack speed is not applied.'],
  },
  q: {
    hits: [{
      id: 'smash', type: 'physical', amount: 'if(qCharged, MaxDamageTotal, MinDamageTotal)',
      note: 'Decimating Smash is counted at full charge unless "Decimating Smash fully charged" is turned off, which counts an instant release.',
    }],
  },
  w: {
    // the first cast only shields; the damage is the recast. MaxHPDamageRatio is in percent points
    hits: [{
      id: 'detonation', type: 'magic', amount: 'TotalDamage + MaxHPDamageRatio / 100 * target.maxHp',
      note: 'Soul Furnace counts the detonation, which needs the shield to hold until it is recast.',
    }],
    statMods: [{ stat: 'hp', value: 'furnaceHp' }],
  },
  e: {
    hits: [{
      id: 'roar', type: 'magic', amount: 'TotalDamage', then: 'roared = 1',
      note: 'The armor shred from Roar of the Slayer is kept for the rest of the combo.',
    }],
    // ArmorShred is in percent points
    resists: [{ stat: 'armor', kind: 'reducePct', value: 'ArmorShred / 100', when: 'roared' }],
  },
  r: {
    hits: [{
      id: 'slam', type: 'physical', amount: 'if(rFull, MaxDamageTotal, MinDamageTotal)',
      note: 'Unstoppable Onslaught is counted at full charge distance unless "Unstoppable Onslaught at full charge distance" is turned off, which counts the shortest charge.',
    }],
  },
});

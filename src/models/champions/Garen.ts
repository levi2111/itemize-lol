import { champion } from '../dsl.ts';

/* Judgment's game data gives the damage of one strike and a base number of
   strikes. That attack speed adds strikes, that a lone target is always the
   nearest enemy, and that the armor shred arrives partway through the spin
   are what the model adds. */
export default champion('Garen', {
  reviewed: '16.20.1',
  vars: {
    // one more strike per ASPerTick of attack speed from items and levels
    spins: 'GarenE.NumberOfStrikes + floor(bonusAs / GarenE.ASPerTick)',
    // strikes of one spin that land before the target has taken enough to lose armor
    unshredded: 'min(spins, max(0, GarenE.StacksToShred - struck))',
  },
  // struck: Judgment strikes the target has taken this fight; early: how many of the current spin came before the shred
  counters: { struck: {}, early: {} },
  // Perseverance only regenerates health
  p: {},
  q: {
    // TotalDamage is the whole empowered attack; the engine already counts the attack itself
    hits: [{
      id: 'strike', type: 'physical', amount: 'TotalDamage - ad',
      note: 'Decisive Strike counts only what it adds to the attack; put a basic attack after it in the combo.',
    }],
  },
  // Courage only makes Garen tougher: resistances, damage reduction, a shield and tenacity
  w: {},
  e: {
    hits: [
      {
        id: 'spin', type: 'physical', count: 'unshredded',
        amount: 'TotalDamage * (1 + NearestEnemyBonus)', crit: 'CriticalDamage * (1 + NearestEnemyBonus)',
        // both halves are the one spin: each is given its whole duration, so their rates add up to the spin's
        over: 'Duration',
        then: ['early = unshredded', 'struck += early'],
        note: 'Every strike of the full Judgment spin is counted, each with the bonus against the nearest enemy.',
      },
      // the shred is applied by the strike that completes it, so it helps from the next one on
      {
        id: 'shredded', label: 'Judgment after the armor shred', type: 'physical', count: 'spins - early',
        amount: 'TotalDamage * (1 + NearestEnemyBonus)', crit: 'CriticalDamage * (1 + NearestEnemyBonus)',
        over: 'Duration',
        then: 'struck += spins - early',
        note: 'The armor shred from Judgment is kept for the rest of the combo.',
      },
    ],
    resists: [{ stat: 'armor', kind: 'reducePct', value: 'ShredAmount', when: 'struck >= StacksToShred' }],
  },
  r: {
    hits: [{
      id: 'execute', type: 'true', amount: 'BaseDamage + ExecuteDamage * target.missingHp',
      note: 'Demacian Justice scales with the health the target has lost by the time it is cast.',
    }],
  },
});

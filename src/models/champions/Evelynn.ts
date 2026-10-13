import { champion } from '../dsl.ts';

/* Hate Spike's game data gives the damage of one lash and of one marked hit. That
   the dart is followed by recast spikes, and that those spikes are what spends the
   mark, is the structure the model adds. Allure deals nothing to a champion, but
   its magic resist reduction sits under everything that follows it. */
export default champion('Evelynn', {
  reviewed: '16.20.1',
  options: {
    shade: { label: 'Opening from Demon Shade (first Whiplash is empowered)', default: true },
    charmed: { label: 'Allure\'s magic resist reduction already on the target', default: false },
  },
  // allure: the charm has landed this fight; whipped: the empowered Whiplash has been used
  counters: { allure: {}, whipped: {} },
  // Demon Shade only heals and camouflages; what it does to Whiplash is on E
  p: {},
  q: {
    hits: [
      { id: 'dart', type: 'magic', amount: 'MissileDamage' },
      { id: 'spikes', label: 'Hate Spike recasts', type: 'magic', amount: 'MissileDamage', count: 'QStackCount', note: 'The dart and all three recast spikes of Hate Spike are counted.' },
      // "next 3 attacks or abilities" is only in the tooltip's prose. the recast spikes are what spends them,
      // so they are paid with the cast and attacks and other abilities add no more
      { id: 'mark', label: 'Hate Spike mark', type: 'magic', amount: 'TotalBonusDamage', count: 3, note: 'The bonus damage of all three marked hits is counted with Hate Spike itself.' },
    ],
  },
  w: {
    // against a champion Allure deals no damage; the charm needs the mark to have lasted 2.5 seconds
    hits: [{ id: 'charm', type: 'magic', amount: 0, then: 'allure = 1' }],
    resists: [{ stat: 'mr', kind: 'reducePct', value: 'MRShred', when: 'allure || charmed' }],
    notes: [
      'Allure is counted as fully formed: its magic resist reduction applies to everything after it in the combo and is kept for the rest of it.',
      'Set "Allure\'s magic resist reduction already on the target" to have it under the whole combo.',
    ],
  },
  e: {
    hits: [
      { id: 'whip', type: 'magic', when: 'whipped || !shade', amount: 'BaseDamage + PercentHealthBaseTOOLTIP * target.maxHp', appliesOnHit: true },
      // entering Demon Shade empowers one cast; checked after the plain whip so setting the counter cannot fire both
      {
        id: 'empowered', label: 'Empowered Whiplash', type: 'magic', when: 'shade && !whipped',
        amount: 'EmpoweredDamage + PercentHealthEmpoweredTOOLTIP * target.maxHp', appliesOnHit: true, then: 'whipped = 1',
        note: 'The first Whiplash of a combo is the empowered one unless "Opening from Demon Shade" is turned off.',
      },
    ],
  },
  r: {
    // one rule, so the damage of the hit cannot itself bring the target under the threshold and be paid twice
    hits: [{
      id: 'caress', type: 'magic', amount: 'if(hasTarget && target.hpPct < CritTreshold, CritDamage, Damage)',
      note: 'Last Caress deals its increased damage when the target is below the health threshold at the moment it is cast in the combo.',
    }],
  },
});

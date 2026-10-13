import { champion } from '../dsl.ts';

/* Denting Blows ties the kit together: attacks and Vault Breaker each leave a
   stack on the target, and the third sets off damage from its maximum health
   and takes a share of its armor. The stacks are a counter, so the order of the
   combo decides which hit sets them off and what lands on the dented armor. */
export default champion('Vi', {
  reviewed: '16.20.1',
  options: {
    charged: { label: 'Vault Breaker fully charged', default: true },
  },
  // dents: Denting Blows stacks on the target; dented: its armor has been reduced this fight
  counters: { dents: {}, dented: { max: 1 } },
  // Blast Shield only shields
  p: {},
  q: {
    hits: [{
      id: 'punch', type: 'physical', amount: 'if(charged, MaxDamageTooltip, TotalDamage)',
      note: 'Vault Breaker is counted at full charge unless "Vault Breaker fully charged" is turned off, which counts an instant release.',
    }],
  },
  w: {
    rules: [
      { id: 'stack', on: 'onhit', type: 'physical', amount: 0, then: 'dents += 1' },
      // Vault Breaker adds a stack too; Relentless Force rides on an attack and adds none of its own
      { id: 'stackVault', on: 'spell', when: 'cast.q', type: 'physical', amount: 0, then: 'dents += 1' },
      // the armor goes after the damage of the hit that sets it off, so it helps from the next hit on
      {
        id: 'dent', on: 'after', when: 'dents > StacksBeforeEffect', type: 'physical',
        amount: 'TotalDamageTooltip * target.maxHp', then: ['dents = 0', 'dented = 1'],
        note: 'The armor reduction from Denting Blows is kept for the rest of the combo.',
      },
    ],
    // ShredAmount and AttackSpeed are in percent points
    resists: [{ stat: 'armor', kind: 'reducePct', value: 'ShredAmount / 100', when: 'dented' }],
    statMods: [{ stat: 'attackSpeed', value: 'AttackSpeed / 100', when: 'sustained' }],
    notes: ['The attack speed from Denting Blows counts in sustained damage only, and there from the first attack.'],
  },
  e: {
    // TotalDamageTooltip is the whole empowered attack and the engine already counts the attack itself;
    // its crit adds what a basic attack's crit adds, which the attack's own average already holds
    hits: [{
      id: 'blast', type: 'physical', amount: 'TotalDamageTooltip - ad',
      note: 'Relentless Force counts only what it adds to the attack; put a basic attack after it in the combo.',
    }],
  },
  r: {
    hits: [{ id: 'slam', type: 'physical', amount: 'Damage' }],
  },
});

import { champion } from '../dsl.ts';

/* Curse is the structure here: a Cursed target takes a share of all magic damage
   again as true damage, worked out before magic resistance. A rule cannot read the
   size of the hit it reacts to, so the passive repeats each of Amumu's own magic
   amounts instead. Magic damage from items is not reached that way.

   Despair is a toggle. The game data has its damage per second and nothing for
   how long it stays on, so that is an option. */
export default champion('Amumu', {
  reviewed: '16.20.1',
  vars: {
    // HealthDamage is in percent points of the target's maximum health
    despairPerSecond: 'AuraofDespair.BaseDamage + AuraofDespair.TotalHealthDamage / 100 * target.maxHp',
  },
  options: {
    despairSeconds: { label: 'Seconds the target stands in Despair', kind: 'int', default: 3, min: 1 },
  },
  // set by a basic attack or the ultimate; Despair keeps refreshing it, so it is not timed out
  counters: { cursed: { max: 1 } },
  p: {
    rules: [
      { id: 'apply', on: 'attack', type: 'true', amount: 0, then: 'cursed = 1' },
      { id: 'curseQ', label: 'Curse on Bandage Toss', on: 'spell', when: 'cursed && cast.q', type: 'true', amount: 'DamageAmp * BandageToss.TotalDamage' },
      { id: 'curseW', label: 'Curse on Despair', on: 'spell', when: 'cursed && cast.w', type: 'true', amount: 'DamageAmp * despairPerSecond', count: 'despairSeconds', over: 'despairSeconds' },
      { id: 'curseE', label: 'Curse on Tantrum', on: 'spell', when: 'cursed && cast.e', type: 'true', amount: 'DamageAmp * Tantrum.TantrumDamage' },
      { id: 'curseR', label: 'Curse on Curse of the Sad Mummy', on: 'spell', when: 'cursed && cast.r', type: 'true', amount: 'DamageAmp * CurseoftheSadMummy.RCalculatedDamage' },
    ],
    notes: [
      'Curse starts with the first basic attack or the ultimate in the combo and is counted on everything after it; the ultimate does not amplify itself.',
      'Curse\'s true damage is counted on Amumu\'s own abilities, not on magic damage from items.',
    ],
  },
  q: {
    hits: [{ id: 'bandage', type: 'magic', amount: 'TotalDamage' }],
  },
  w: {
    // the game ticks twice a second for half of this each; the total is the same
    hits: [{
      id: 'tears', type: 'magic', amount: 'despairPerSecond', count: 'despairSeconds', over: 'despairSeconds',
      note: 'Despair is a toggle: it is counted for the number of seconds set in "Seconds the target stands in Despair".',
    }],
  },
  e: {
    // the passive half only reduces physical damage Amumu takes
    hits: [{ id: 'tantrum', type: 'magic', amount: 'TantrumDamage' }],
  },
  r: {
    hits: [{ id: 'bandages', type: 'magic', amount: 'RCalculatedDamage' }],
    // Curse lands after the damage, so the ultimate only amplifies itself on a target Cursed before it
    rules: [{ id: 'apply', on: 'after', when: 'cast.r', type: 'true', amount: 0, then: 'cursed = 1' }],
  },
});

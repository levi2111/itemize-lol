import { champion } from '../dsl.ts';

/* Explosive Charge is the structure here. The game data has the bomb's damage
   with no stacks (ActiveDamage) and with all of them (ActiveMaxDamage); what it
   deals depends on how many attacks and abilities land while it is attached.
   Since every stack adds the same share of ActiveDamage, the bomb is counted as
   it builds: the unstacked damage on cast, then one share per stack. The sum is
   what the detonation deals, at any stack count. */
export default champion('Tristana', {
  reviewed: '16.20.1',
  vars: {
    // the bomb is attached, has not run out and can still take a stack
    charging: 'time < fuse && charge < TristanaE.ActiveMaxStacks',
  },
  options: {
    rapidFire: { label: 'Rapid Fire attack speed active', default: false },
  },
  // fuse holds the moment the bomb goes off by itself
  counters: { charge: {}, fuse: {} },
  // Draw a Bead only adds range
  p: {},
  q: {
    statMods: [{ stat: 'attackSpeed', value: 'AttackSpeedMod', when: 'rapidFire' }],
  },
  w: {
    hits: [{ id: 'landing', type: 'magic', amount: 'LandingDamage' }],
  },
  e: {
    hits: [{
      id: 'bomb', type: 'physical', amount: 'ActiveDamage', then: ['charge = 0', 'fuse = time + ActiveDuration'],
      note: 'Explosive Charge is counted as it builds: its unstacked damage when cast, then the bonus of each stack as an attack or ability adds it. Only what comes after it in the combo, and fits in the time before it goes off by itself, adds a stack.',
    }],
    rules: [
      { id: 'stack', label: 'Explosive Charge stack', on: 'attack', when: 'charging', type: 'physical', amount: 'ActiveDamage * ActivePerStackAmp', then: 'charge += 1' },
      { id: 'stackSpell', label: 'Explosive Charge stack', on: 'spell', when: 'charging && !cast.e', type: 'physical', amount: 'ActiveDamage * ActivePerStackAmp', then: 'charge += 1' },
    ],
    // the passive explosion goes off when an attack kills, around the unit that died: a lone target never takes it
  },
  r: {
    hits: [{ id: 'shot', type: 'magic', amount: 'DamageCalc' }],
  },
});

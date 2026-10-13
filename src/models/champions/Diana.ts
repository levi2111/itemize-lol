import { champion } from '../dsl.ts';

/* Moonsilver Blade is the part the game data cannot say on its own: the cleave
   rides on every third attack, so it is a counter, and the attack speed is
   tripled for a few seconds after any ability, which in a fight is nearly always. */
export default champion('Diana', {
  reviewed: '16.20.1',
  options: {
    afterAbility: { label: 'Moonsilver Blade attack speed tripled (after an ability)', default: true },
    pulled: { label: 'Other enemy champions pulled in by Moonfall', kind: 'int', default: 0, min: 0 },
  },
  counters: { blade: {} },
  p: {
    rules: [
      { id: 'stack', on: 'attack', type: 'magic', amount: 0, then: 'blade += 1' },
      { id: 'cleave', label: 'Moonsilver Blade cleave', on: 'attack', when: 'blade >= AttackCount', type: 'magic', amount: 'CleaveDamage', then: 'blade = 0' },
    ],
    statMods: [{ stat: 'attackSpeed', value: 'if(afterAbility, EmpoweredAS, BonusAS)' }],
    notes: ['The attack speed counts as tripled, as it is for a few seconds after every ability; turn off "attack speed tripled" for the plain bonus.'],
  },
  q: {
    hits: [{ id: 'arc', type: 'magic', amount: 'TotalDamage' }],
  },
  w: {
    // the tooltip states three spheres; the game data only has the count inside TotalMaxDamage
    hits: [{ id: 'spheres', type: 'magic', amount: 'TotalDamage', count: 3, note: 'All three spheres of Pale Cascade are counted on the one target.' }],
  },
  e: {
    hits: [{ id: 'dash', type: 'magic', amount: 'TotalDamage', note: 'Lunar Rush resets when the target has Moonlight from Crescent Strike; add E to the combo a second time for that.' }],
  },
  r: {
    // the bonus is per champion beyond the first, so a lone target takes none of it
    hits: [{
      id: 'moonfall', type: 'magic', amount: 'RExplosionDamage + min(RMultiHitAmplification * pulled, MaxDamage)',
      note: 'Moonfall counts no other champions pulled in unless "Other enemy champions pulled in" is set.',
    }],
  },
});

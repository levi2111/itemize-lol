import { champion } from '../dsl.ts';

/* Ionian Fervor is two things on one stack count: attack speed per stack, and
   bonus damage on attacks once the stacks are full. Stats are worked out once per
   fight, so the attack speed reads an option (the stacks she walks in with), while
   the on-hit damage also counts the stacks her abilities add during the combo. */
export default champion('Irelia', {
  reviewed: '16.20.1',
  vars: {
    startStacks: 'min(fervor, IreliaPassive.MaxStacks)',
    stacks: 'min(startStacks + gained, IreliaPassive.MaxStacks)',
  },
  options: {
    // kept up in a long fight, usually built on the wave before a short one
    fervor: { label: 'Ionian Fervor stacks at the start', kind: 'int', default: 'if(sustained, IreliaPassive.MaxStacks, 0)', min: 0 },
    wCharged: { label: 'Defiant Dance fully charged', default: true },
    wall: { label: 'Target crosses the Vanguard\'s Edge blades', default: false },
  },
  counters: { gained: { max: 'IreliaPassive.MaxStacks' } },
  p: {
    rules: [
      // Bladesurge applies on-hit effects, so it carries this too
      { id: 'fervor', on: 'onhit', when: 'stacks >= MaxStacks', type: 'magic', amount: 'OnHitBonus' },
      // one stack per ability that hit; fires after the cast's own damage
      { id: 'stack', on: 'spell', type: 'magic', amount: 0, then: 'gained += 1' },
    ],
    // SingleStackAS is in percent points
    statMods: [{ stat: 'attackSpeed', value: 'SingleStackAS / 100 * startStacks' }],
    notes: [
      'Each ability that hits adds an Ionian Fervor stack, and attacks deal the bonus damage once the stacks are full. The ability that brings the last stack does not get the bonus itself.',
      'The attack speed counts only the stacks set with "Ionian Fervor stacks at the start", not the ones gained during the combo. Sustained damage assumes full stacks.',
    ],
  },
  q: {
    hits: [{ id: 'dash', type: 'physical', amount: 'ChampionDamage', appliesOnHit: true }],
  },
  w: {
    hits: [{
      id: 'release', type: 'physical', amount: 'if(wCharged, MaxDamageCalc, MinDamageCalc)',
      note: 'Defiant Dance is counted at full charge unless "Defiant Dance fully charged" is turned off, which counts an instant release.',
    }],
  },
  e: {
    hits: [{ id: 'blades', type: 'magic', amount: 'TotalDamage' }],
  },
  r: {
    hits: [
      { id: 'barrage', type: 'magic', amount: 'MissileDamage' },
      // the cage forms around the target, who only takes this by walking through it
      { id: 'cage', label: 'Blade cage', type: 'magic', amount: 'ZoneDamage', when: 'wall' },
    ],
    notes: ['The blade cage damages only a target that walks through it: set "Target crosses the Vanguard\'s Edge blades" to count it.'],
  },
});

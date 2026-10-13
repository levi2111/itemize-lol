import { champion } from '../dsl.ts';

/* One kit, three states: base Kayn, and the two permanent forms he picks between.
   The Darkin Slayer swaps Reaping Slash and Umbral Trespass to max health damage;
   the Shadow Assassin changes no ability's damage and instead adds a share of
   everything he deals as magic damage for the first seconds of a fight.
   Reaping Slash's tooltip gives the damage of one of its two hits. */
export default champion('Kayn', {
  reviewed: '16.20.1',
  vars: {
    slayer: 'darkin',
    shadow: 'assassin && !darkin',
  },
  options: {
    darkin: { label: 'Darkin Slayer form (Rhaast)', default: false },
    assassin: { label: 'Shadow Assassin form', default: false },
  },
  // the fight time at which the Shadow Assassin's bonus last started
  counters: { entered: {} },
  p: {
    // the bonus is a share of the damage that got through, dealt as magic damage: the model language has no
    // "damage just dealt", so it amplifies the hit itself, scaled by what the target's magic resistance lets through
    amps: [{
      value: 'KaynAssBonusDamage * if(hasTarget, 100 / (100 + max(0, target.mr)), 1)',
      when: 'shadow && time < entered + PAmpDurationAss',
      types: ['physical', 'magic'],
    }],
    notes: [
      'Base Kayn unless a form is set. The Darkin Slayer\'s passive only heals.',
      'Shadow Assassin: the bonus magic damage covers the first seconds of the fight and is shown as part of the damage it adds to.',
    ],
  },
  q: {
    hits: [
      { id: 'slash', when: '!slayer', type: 'physical', amount: 'TotalDamage', count: 2, note: 'Both hits of Reaping Slash, the dash and the spin, are counted.' },
      { id: 'slayer', label: 'Reaping Slash (Darkin Slayer)', when: 'slayer', type: 'physical', amount: 'DarkinFlatDamage + DarkinPercentDamage * target.maxHp', count: 2 },
    ],
  },
  w: {
    hits: [{ id: 'swipe', type: 'physical', amount: 'TotalDamage' }],
  },
  // Shadow Step is move speed and a heal
  e: {},
  r: {
    hits: [
      { id: 'burst', when: '!slayer', type: 'physical', amount: 'Damage' },
      { id: 'slayer', label: 'Umbral Trespass (Darkin Slayer)', when: 'slayer', type: 'physical', amount: 'SlayerDamage * target.maxHp' },
    ],
    // Umbral Trespass refreshes the Shadow Assassin's bonus, and its own damage is the first to benefit
    rules: [{ id: 'refresh', on: 'ability', when: 'cast.r && shadow', type: 'magic', amount: 0, then: 'entered = time' }],
    notes: ['Shadow Assassin: Umbral Trespass restarts the passive\'s bonus damage.'],
  },
});

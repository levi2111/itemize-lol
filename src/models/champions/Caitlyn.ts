import { champion } from '../dsl.ts';

/* Headshot is bonus damage on a basic attack, and it reaches the target two ways:
   charged by her own attacks, and handed out by a sprung trap or a landed net.
   The charged one is a counter on her attacks. The granted ones do not spend the
   charge, so they are counted on the W and E casts as the bonus alone; the attack
   that carries them is an aa in the combo. */
export default champion('Caitlyn', {
  reviewed: '16.20.1',
  options: {
    blocked: { label: 'Piltover Peacemaker passes through another enemy first', default: false },
  },
  counters: { shots: {} },
  p: {
    rules: [
      { id: 'chamber', on: 'attack', type: 'physical', amount: 0, then: 'shots += 1' },
      // the attacks that charge it are not Headshots themselves: the one after them is
      {
        id: 'headshot', label: 'Headshot', on: 'attack', when: 'shots > AttacksPerHeadshot', type: 'physical',
        amount: 'HeadShotBonusDamage', then: 'shots = 0',
        note: 'Headshot is charged by attacks and fired by the one after them. Attacks from brush are not counted double.',
      },
    ],
  },
  q: {
    // the wider, weaker shot is for enemies behind the first one hit
    hits: [{ id: 'shot', type: 'physical', amount: 'if(blocked, SecondaryDamage, InitialDamage)' }],
  },
  w: {
    // the trap's own damage only exists as an addition to the Headshot it grants
    hits: [{
      id: 'headshot', label: 'Headshot on a trapped target', type: 'physical',
      amount: 'CaitlynPassive.HeadShotBonusDamage + HeadShotBonusDamage',
      note: 'Yordle Snap Trap counts the bonus damage of the Headshot it grants; add the auto attack to the combo.',
    }],
  },
  e: {
    hits: [
      { id: 'net', type: 'magic', amount: 'NetDamage' },
      {
        id: 'headshot', label: 'Headshot on a netted target', type: 'physical', amount: 'CaitlynPassive.HeadShotBonusDamage',
        note: '90 Caliber Net counts the bonus damage of the Headshot it grants; add the auto attack to the combo.',
      },
    ],
  },
  r: {
    // the calculation already carries the crit chance scaling, so it is not a crit of its own
    hits: [{ id: 'shot', type: 'physical', amount: 'RTotalDamage' }],
  },
});

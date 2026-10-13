import { champion } from '../dsl.ts';

/* Lillia's abilities are one amount each, twice over: Blooming Blows adds true
   damage at its outer edge and Watch Out! Eep! hits harder in its centre, and
   which part lands is the player's aim, so both are options. Under all of them
   runs Dream Dust, a burn for a share of the target's maximum health that every
   ability hit starts over rather than stacks.

   The burn is counted where it is applied: a fresh one brings its whole damage,
   and a refresh pays for the time the old one ran, which is what it adds. */
export default champion('Lillia', {
  reviewed: '16.20.1',
  options: {
    outerEdge: { label: 'Blooming Blows hits with its outer edge', default: true },
    centre: { label: 'Watch Out! Eep! hits with its centre', default: false },
  },
  // dusted: the target has Dream Dust; dustedAt: when it was last applied
  counters: { dusted: { max: 1 }, dustedAt: {} },
  p: {
    rules: [
      // DotPercentTooltip is the whole burn as a fraction of maximum health
      {
        id: 'dust', label: 'Dream Dust', on: 'spell', type: 'magic',
        amount: 'DotPercentTooltip * target.maxHp * if(dusted, clamp((time - dustedAt) / Duration, 0, 1), 1)',
        // the seconds this firing pays for: the whole burn when fresh, the time the old one ran on a refresh
        over: 'if(dusted, clamp(time - dustedAt, 0, Duration), Duration)',
        then: ['dusted = 1', 'dustedAt = time'],
        note: 'Dream Dust burns for as long as the combo takes and then for its full duration after the last ability.',
      },
    ],
  },
  q: {
    // the passive half only gives move speed
    hits: [
      { id: 'whirl', type: 'magic', amount: 'TotalDamage' },
      {
        id: 'edge', label: 'Blooming Blows, outer edge', type: 'true', amount: 'BonusTrueDamage', when: 'outerEdge',
        note: 'Blooming Blows includes the true damage of its outer edge unless "Blooming Blows hits with its outer edge" is turned off.',
      },
    ],
  },
  w: {
    hits: [{
      id: 'strike', type: 'magic', amount: 'if(centre, FlatDamageSweetSpot, FlatDamage)',
      note: 'Watch Out! Eep! is counted as hitting outside its centre unless "Watch Out! Eep! hits with its centre" is set.',
    }],
  },
  e: {
    hits: [{ id: 'seed', type: 'magic', amount: 'ImpactDamageTotal' }],
  },
  r: {
    // the cast itself only puts the target to sleep; the damage comes when something wakes it
    hits: [{
      id: 'wake', type: 'magic', amount: 'TotalDamage',
      note: 'Lilting Lullaby\'s damage is dealt when the sleeping target is woken by damage; it is counted when Lilting Lullaby is cast.',
    }],
  },
});

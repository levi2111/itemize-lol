import { champion } from '../dsl.ts';

/* Milio's only damage of his own is Ultra Mega Fire Kick. Fired Up! is damage an
   enchanted champion deals, with that champion's attack damage, so what an ally
   does with it is outside a one-champion calculation. What can be counted is the
   enchantment on Milio himself: Breath of Life always touches him, Cozy Campfire
   and Warm Hugs only when he uses them on himself. */
export default champion('Milio', {
  reviewed: '16.20.1',
  options: {
    selfCast: { label: 'Cozy Campfire and Warm Hugs used on Milio himself', default: false },
  },
  // the enchantment does not stack; the hearth's two counters are fight times
  counters: { firedUp: { max: 1 }, hearthNext: {}, hearthUntil: {} },
  vars: {
    // the hearth re-applies the enchantment on its interval for as long as it lasts
    hearthDue: 'time < hearthUntil && time >= hearthNext',
    enchanted: 'firedUp || hearthDue',
  },
  p: {
    rules: [
      // spent by the next attack or ability hit: a burst from attack damage plus the whole burn
      {
        id: 'firedUp', label: 'Fired Up!', on: 'attack', when: 'enchanted', type: 'magic',
        amount: 'ADBurstRatio * ad + BurnDamage',
        then: ['hearthNext += if(hearthDue, MilioW.HealFrequencySeconds, 0)', 'firedUp = 0'],
        note: 'The whole burn of Fired Up! is counted.',
      },
      // Ultra Mega Fire Kick is his only ability that hits an enemy
      {
        id: 'firedUpSpell', label: 'Fired Up!', on: 'spell', when: 'cast.q && enchanted', type: 'magic',
        amount: 'ADBurstRatio * ad + BurnDamage',
        then: ['hearthNext += if(hearthDue, MilioW.HealFrequencySeconds, 0)', 'firedUp = 0'],
      },
    ],
    notes: [
      'Fired Up! is counted on Milio himself only: Breath of Life always gives it to him, Cozy Campfire and Warm Hugs only when set as used on himself. Cast one before the attack or Ultra Mega Fire Kick that should spend it.',
      'Damage that allies deal with Fired Up! is not counted.',
    ],
  },
  q: {
    hits: [{ id: 'explosion', type: 'magic', amount: 'Damage' }],
  },
  // heals and attack range; on Milio it also enchants him, when cast and again each time its interval passes
  w: {
    hits: [{
      id: 'hearth', when: 'selfCast', type: 'magic', amount: 0,
      then: ['firedUp = 1', 'hearthNext = time + HealFrequencySeconds', 'hearthUntil = time + ZoneDuration'],
    }],
    notes: ['With the hearth on Milio, it applies Fired Up! when cast and again each time its interval passes while it lasts.'],
  },
  // a shield and move speed; on Milio it also enchants him
  e: {
    hits: [{ id: 'hug', when: 'selfCast', type: 'magic', amount: 0, then: 'firedUp = 1' }],
  },
  // a heal and cleanse around Milio, which always touches him
  r: {
    hits: [{ id: 'breath', type: 'magic', amount: 0, then: 'firedUp = 1' }],
  },
});

import { champion } from '../dsl.ts';

/* Three spells on each of Q, W and E. The slot's own spell only holds tooltip
   copies of the numbers, so the formulas read the spells that are actually cast
   (HweiQQ, HweiQW, HweiQE, …), which follow the slot's rank.
   - Q: the player picks one of three damage spells per cast: an option.
   - W: only Stirring Lights changes damage, so a W cast is that spell.
   - E: the three spells deal the same damage. */
export default champion('Hwei', {
  reviewed: '16.20.1',
  options: {
    disaster: { label: 'Subject: Disaster spell (1 Devastating Fire, 2 Severing Bolt, 3 Molten Fissure)', kind: 'int', default: 1, min: 1, max: 3 },
    isolated: { label: 'Severing Bolt hits an isolated or immobilized target', default: false },
  },
  counters: { mark: { max: 1 }, lights: {} },
  p: {
    rules: [
      // one damaging ability marks, the next one detonates; the detonating cast does not mark again
      { id: 'explosion', on: 'spell', when: '!cast.w', type: 'magic', amount: 'if(mark, TotalDamage, 0)', then: 'mark = 1 - mark' },
      // an attack carrying a Stirring Light marks and detonates like an ability; runs before W spends the light
      { id: 'explosionAttack', on: 'attack', when: 'lights > 0', type: 'magic', amount: 'if(mark, TotalDamage, 0)', then: 'mark = 1 - mark' },
    ],
    notes: ['Every second damaging ability on the target sets off the explosion: the mark is assumed not to run out in between, and the delayed explosion to land.'],
  },
  q: {
    hits: [
      // BonusDamage is in percent points of the target's maximum health
      { id: 'fire', label: 'Devastating Fire', when: 'disaster == 1', type: 'magic', amount: 'HweiQQ.Damage + HweiQQ.BonusDamage / 100 * target.maxHp' },
      {
        id: 'bolt', label: 'Severing Bolt', when: 'disaster == 2', type: 'magic',
        amount: 'HweiQW.Damage * (1 + if(hasTarget && isolated, (HweiQW.BonusDamageMult - 1) * target.missingHpPct, 0))',
        note: 'Severing Bolt gains its bonus only with "Severing Bolt hits an isolated or immobilized target" set; the bonus is assumed to grow evenly with missing health, reaching its maximum at zero health.',
      },
      // the eruptions travel along the path, so each enemy is struck by them once
      { id: 'eruption', label: 'Molten Fissure', when: 'disaster == 3', type: 'magic', amount: 'HweiQE.Damage' },
      {
        id: 'lava', label: 'Molten Fissure lava', when: 'disaster == 3', type: 'magic', amount: 'HweiQE.DamagePerSecond', count: 'HweiQE.Duration',
        over: 'HweiQE.Duration',
        note: 'Molten Fissure counts one eruption and the target standing in one lava pool for its full duration.',
      },
    ],
    notes: ['Q is Devastating Fire unless the "Subject: Disaster spell" option picks another.'],
  },
  w: {
    // the tooltip states three lights; the game data only has the count inside TotalOnHitDamage
    hits: [{ id: 'paint', type: 'magic', amount: 0, then: 'lights = 3' }],
    rules: [
      { id: 'lightAttack', label: 'Stirring Lights', on: 'attack', when: 'lights > 0', type: 'magic', amount: 'HweiWE.OnHitDamage', then: 'lights += -1' },
      { id: 'lightSpell', label: 'Stirring Lights', on: 'spell', when: 'lights > 0 && !cast.w', type: 'magic', amount: 'HweiWE.OnHitDamage', then: 'lights += -1' },
    ],
    notes: [
      'W is counted as Stirring Lights: cast it before the three attacks or abilities it should empower. The other two Serenity spells deal no damage.',
      'An ability spends one light, however many times it hits.',
    ],
  },
  e: {
    // Grim Visage, Gaze of the Abyss and Crushing Maw all deal the same damage
    hits: [{ id: 'torment', type: 'magic', amount: 'HweiEQ.Damage' }],
  },
  r: {
    hits: [
      { id: 'despair', type: 'magic', amount: 'DamageOverTime', count: 'Duration', over: 'Duration' },
      { id: 'shatter', label: 'Spiraling Despair shattering', type: 'magic', amount: 'Damage', note: 'All 3 seconds of Spiraling Despair and its final burst are counted.' },
    ],
  },
});

import { champion } from '../dsl.ts';

/* Janna's own damage hangs on her move speed: Tailwind turns bonus move speed into
   magic damage on every attack and on Zephyr, and Zephyr's passive is itself move
   speed that grows with ability power. So the passive half of W is a stat change
   here, and boots show up in the numbers. */
export default champion('Janna', {
  reviewed: '16.20.1',
  options: {
    galeCharge: { label: 'Seconds Howling Gale grows before it is released', kind: 'int', default: 0, min: 0 },
    selfShield: { label: 'Eye of the Storm is on Janna herself', default: false },
  },
  p: {
    rules: [{ id: 'tailwind', label: 'Tailwind', on: 'onhit', type: 'magic', amount: 'BonusDamage' }],
  },
  q: {
    // the tornado gains damage per whole second it grew, up to MaxDuration; at the cap this is MaxDamage
    hits: [{
      id: 'gale', type: 'magic',
      amount: 'MinimumDamage + ExtraDamagePerSecondCharged * min(galeCharge, MaxDuration)',
      note: 'Howling Gale is counted as released at once; set the seconds it grows for a charged tornado.',
    }],
  },
  w: {
    hits: [{ id: 'zephyr', type: 'magic', amount: 'TotalDamage + TailwindSelf.BonusDamage' }],
    // a share of total move speed that scales with ability power: applied last so it reads the finished AP
    statMods: [{ stat: 'movePct', value: 'TotalMS', phase: 'convert' }],
  },
  e: {
    // the shield gives its holder attack damage; it only matters here when Janna shields herself
    statMods: [{ stat: 'ad', value: 'TotalAD', phase: 'convert', when: 'selfShield' }],
    notes: ['Eye of the Storm\'s attack damage is only counted with "Eye of the Storm is on Janna herself" set, and then for the whole fight.'],
  },
  // Monsoon knocks back and heals
  r: {},
});

import { champion } from '../dsl.ts';

/* Two things the formulas alone do not say about Syndra:
   - Splinters of Wrath are a count the static data cannot see, and three of the
     upgrades they unlock change damage: true damage on Force of Will, an execute
     on Unleashed Power, and ability power at the cap.
   - Unleashed Power's calculation is one sphere. How many she launches depends
     on the Dark Spheres lying around, which the combo itself puts there. */
export default champion('Syndra', {
  reviewed: '16.20.1',
  vars: {
    // dark spheres from this combo that have not run out yet; older ones are taken to last as long as the newest
    conjured: 'if(time < sphereUntil, fresh, 0)',
    launched: 'min(SyndraR.MaxSpheresToUse, SyndraR.MinSpheresToUse + conjured + spheres)',
  },
  options: {
    // every ability point after the first gives splinters, so a level implies a floor
    splinters: { label: 'Splinters of Wrath', kind: 'int', default: '(level - 1) * SyndraPassive.PassiveStacksPerLevel', min: 0 },
    spheres: { label: 'Dark Spheres already on the ground', kind: 'int', default: 0, min: 0 },
  },
  // fresh: dark spheres conjured in this combo; sphereUntil: when the last of them runs out
  counters: { fresh: {}, sphereUntil: {} },
  p: {
    statMods: [{ stat: 'ap', value: 'CapstoneAPPerc', phase: 'percent', when: 'splinters >= MaxStackAmount' }],
    notes: ['Splinters of Wrath default to the ones the ability points spent by this level give. Set "Splinters of Wrath" to add those collected from enemies; none are gained during the combo.'],
  },
  q: {
    hits: [{ id: 'sphere', type: 'magic', amount: 'TotalDamage', then: ['fresh = conjured + 1', 'sphereUntil = time + SphereDuration'] }],
  },
  w: {
    hits: [
      { id: 'throw', type: 'magic', amount: 'ThrowDamage' },
      { id: 'bonus', label: 'Force of Will (Splinters of Wrath)', type: 'true', when: 'splinters >= SyndraPassive.WUpgradeThreshold', amount: 'PassiveBonusDamage' },
    ],
  },
  e: {
    // the wave and a pushed sphere deal the same, and a target takes it once per cast
    hits: [{ id: 'wave', type: 'magic', amount: 'TotalDamage' }],
  },
  // the passive part only gives Dark Sphere ability haste
  r: {
    hits: [
      {
        id: 'spheres', type: 'magic', amount: 'DamageCalc', count: 'launched',
        note: 'Unleashed Power launches the spheres orbiting Syndra plus every Dark Sphere cast earlier in the combo that is still on the ground. Set "Dark Spheres already on the ground" for any others.',
      },
      // after the spheres, so it sees the health they left
      {
        id: 'execute', label: 'Unleashed Power execute', type: 'true', amount: 'target.hp',
        when: 'hasTarget && splinters >= SyndraPassive.RUpgradeThreshold && target.hp > 0 && target.hpPct < UpgradeExecuteThreshold',
        note: 'With enough Splinters of Wrath, Unleashed Power kills a target its spheres leave below the execute threshold, counted as true damage equal to the health the target has left.',
      },
    ],
  },
});

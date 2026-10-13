import { champion } from '../dsl.ts';

/* Zed's formulas are one calculation per ability. What they leave out is the
   shadows and the mark:
   - A shadow copies Razor Shuriken and Shadow Slash. Every shuriken damages the
     target; a second or third slash does not.
   - Death Mark repeats a share of everything dealt while it is on the target. The
     model language has no "damage dealt so far", so the share is added to each
     hit as it lands, which comes to the same total. */
export default champion('Zed', {
  reviewed: '16.20.1',
  vars: {
    // Living Shadow's and Death Mark's shadow, each for as long as it stands; the game data has no value for the two
    shadows: 'min(2, placed + (time < wShadow) + (time < rShadow))',
    // a mark lasts seconds, so the option is for a combo and not for sustained attacking
    marked: '(deathMark && !sustained) || time < markUntil',
  },
  options: {
    placed: { label: 'Shadows already in place before the combo', kind: 'int', default: 0, min: 0, max: 2 },
    deathMark: { label: 'Death Mark on the target for the whole combo', default: false },
  },
  // the fight times at which this combo's shadows and mark run out
  counters: { wShadow: {}, rShadow: {}, markUntil: {} },
  p: {
    rules: [
      // judged on the health the attack itself leaves
      {
        id: 'contempt', on: 'attack', when: 'target.hpPct < CurrentHealthThreshold', type: 'magic', amount: 'TotalDamage', cooldown: 'PerUnitCD',
        note: 'Contempt for the Weak is counted on the first attack that finds the target below half health, and again each time its per-target cooldown has passed.',
      },
    ],
  },
  q: {
    hits: [{
      id: 'shuriken', type: 'physical', amount: 'TotalDamage', count: '1 + shadows',
      note: 'Each shadow standing when Q is cast throws a shuriken too, and all of them are counted as hitting the target: cast W or R before Q in the combo, or set "Shadows already in place before the combo".',
    }],
  },
  w: {
    // the shadow deals nothing itself; the passive only restores energy
    hits: [{ id: 'shadow', type: 'physical', amount: 0, then: 'wShadow = time + ShadowDuration' }],
  },
  e: {
    // slashes from the shadows add a slow and no damage
    hits: [{ id: 'slash', type: 'physical', amount: 'TotalDamage' }],
  },
  r: {
    // the detonation's own part is dealt on cast; what it repeats is the amp below
    hits: [{
      id: 'mark', type: 'physical', amount: 'RCalculatedDamage',
      then: ['markUntil = time + RDeathMarkDuration', 'rShadow = time + RShadowDurationDisplayed'],
    }],
    // true damage is left out: the mark does not store it. repeated magic damage really lands as physical
    amps: [{ value: 'RDamageAmp', when: 'marked && !cast.r', types: ['physical', 'magic'] }],
    notes: [
      'Death Mark repeats a share of the damage dealt after it in the combo, for as long as the mark lasts; that share is shown as part of the damage it repeats.',
      'Set "Death Mark on the target for the whole combo" when R is cast first, and keep R in the combo for the detonation\'s own damage.',
    ],
  },
});

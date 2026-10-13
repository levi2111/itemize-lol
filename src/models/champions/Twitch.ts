import { champion } from '../dsl.ts';

/* Twitch is Deadly Venom. The game data gives what one stack deals per second and
   for how long; that every attack and every second of Venom Cask adds a stack and
   starts the duration over, and that Contaminate reads the stacks, is the model.

   The venom is counted where it is applied: a new stack brings its whole duration,
   and stacks already on the target are paid for the time they have been running
   since the last application, which is exactly what that refresh adds. */
export default champion('Twitch', {
  reviewed: '16.20.1',
  vars: {
    // what one stack deals over its whole duration
    perStack: 'TwitchDeadlyVenomMarker.DamagePerSecond * TwitchDeadlyVenomMarker.Duration',
    // what the stacks on the target dealt since the last application
    elapsed: 'perStack * venom * clamp((time - refreshed) / TwitchDeadlyVenomMarker.Duration, 0, 1)',
  },
  options: {
    ambush: { label: 'Ambush attack speed active (just left Camouflage)', default: false },
    sprayAndPray: { label: 'Spray and Pray active', default: false },
  },
  // venom: Deadly Venom stacks on the target; refreshed: when they were last applied
  counters: { venom: { max: 'TwitchDeadlyVenomMarker.MaxStacks' }, refreshed: {} },
  p: {
    rules: [
      // sustained attacking has no last hit to poison on after, so there only the time that ran is counted
      {
        id: 'venom', label: 'Deadly Venom', on: 'onhit', type: 'true',
        amount: 'elapsed + if(sustained, 0, perStack * (min(MaxStacks, venom + 1) - venom))',
        // the first stack starts the venom's duration; every later attack adds the time that ran since the last application
        over: 'if(venom, clamp(time - refreshed, 0, TwitchDeadlyVenomMarker.Duration), TwitchDeadlyVenomMarker.Duration)',
        then: ['refreshed = time', 'venom += 1'],
        note: 'Deadly Venom runs for as long as the combo takes and then for its full duration after the last stack is applied.',
      },
    ],
  },
  q: {
    // the camouflage itself deals nothing; leaving it grants attack speed for a few seconds
    statMods: [{ stat: 'attackSpeed', value: 'AttackSpeedMod', when: 'ambush' }],
    notes: ['The attack speed is off unless "Ambush attack speed active" is set.'],
  },
  w: {
    rules: [
      // the cask deals no damage of its own, so its venom lands after the cast rather than as a hit that would set off spell effects;
      // one stack on impact and one per second of the cloud
      {
        id: 'venom', label: 'Deadly Venom from Venom Cask', on: 'after', when: 'cast.w', type: 'true',
        amount: 'elapsed + perStack * (min(TwitchDeadlyVenomMarker.MaxStacks, venom + 1 + Duration) - venom)',
        // the stacks the cask adds run their whole duration from the cast; at full stacks it only pays for the time that ran
        over: 'if(venom < TwitchDeadlyVenomMarker.MaxStacks, TwitchDeadlyVenomMarker.Duration, clamp(time - refreshed, 0, TwitchDeadlyVenomMarker.Duration))',
        then: ['refreshed = time', 'venom += 1 + Duration'],
        note: 'The target is counted as staying in Venom Cask\'s cloud for its whole duration, and every stack it adds is counted as applied on cast.',
      },
    ],
  },
  e: {
    // it can only be cast on a target that carries venom, and it leaves the stacks where they are
    hits: [
      { id: 'toxin', type: 'physical', when: 'venom > 0', amount: 'BaseDamage + PhysicalDamagePerStack * venom' },
      {
        id: 'toxinMagic', type: 'magic', when: 'venom > 0', amount: 'MagicDamagePerStack * venom',
        note: 'Contaminate counts the Deadly Venom stacks applied earlier in the combo. With none it deals nothing.',
      },
    ],
  },
  r: {
    // the bolts are his basic attacks, and a lone target is the first one hit, at full damage
    statMods: [{ stat: 'ad', value: 'BonusAD', when: 'sprayAndPray' }],
    notes: ['The attack damage is off unless "Spray and Pray active" is set.'],
  },
});

import { champion } from '../dsl.ts';

/* Darius is Hemorrhage. The game data gives what one stack bleeds over its whole
   duration; that every attack and damaging ability adds a stack and starts the
   duration over, and that Noxian Guillotine reads the stacks, is the model.

   The bleed is counted where it is applied: a new stack brings its whole bleed,
   and stacks already on the target are paid for the time they have been bleeding
   since the last hit, which is exactly what that hit's refresh adds. */
export default champion('Darius', {
  reviewed: '16.20.1',
  vars: {
    // stacks the target carries once this hit has landed; Noxian Might applies all of them at once
    next: 'min(DariusHemoMarker.MaxStacks, hemo + if(might, DariusHemoMarker.MaxStacks, 1))',
    // share of the duration that ran since the last application
    ran: 'clamp((time - refreshed) / DariusHemoMarker.BleedDuration, 0, 1)',
    // sustained attacking has no last hit to bleed out after, so there only the time that ran is counted
    bleed: 'DariusHemoMarker.BleedDamagePerStack * (hemo * ran + if(sustained, 0, next - hemo))',
    // Noxian Might on a lone target means that target is at full stacks
    onTarget: 'if(might, DariusHemoMarker.MaxStacks, hemo)',
  },
  options: {
    might: { label: 'Noxian Might active (target at full Hemorrhage)', default: false },
  },
  // hemo: Hemorrhage stacks on the target; refreshed: when the bleed was last applied
  counters: { hemo: { max: 'DariusHemoMarker.MaxStacks' }, refreshed: {} },
  p: {
    rules: [
      {
        id: 'bleed', label: 'Hemorrhage', on: 'onhit', type: 'physical', amount: 'bleed',
        // what this hit adds to the bleed's run: its whole duration when fresh, else the seconds since the last hit.
        // they add up to the time the bleed ran, so the rate shown is its average over the stacks it went through
        over: 'if(hemo, ran * BleedDuration, BleedDuration)',
        then: ['refreshed = time', 'hemo += if(might, MaxStacks, 1)'],
        note: 'Hemorrhage bleeds for as long as the combo takes and then for its full duration after the last hit.',
      },
      // Crippling Strike is the attack that follows it, which adds the stack itself
      {
        id: 'bleedSpell', label: 'Hemorrhage', on: 'spell', when: '!cast.w', type: 'physical', amount: 'bleed',
        over: 'if(hemo, ran * BleedDuration, BleedDuration)',
        then: ['refreshed = time', 'hemo += if(might, MaxStacks, 1)'],
      },
    ],
    // the attack damage is a stat, and stats are settled before the fight, so it cannot switch on at the fifth stack
    statMods: [{ stat: 'ad', value: 'NoxianMightBonusAD', when: 'might' }],
    notes: ['Noxian Might\'s attack damage is not gained during the combo: it counts from the first hit when "Noxian Might active" is set, and not at all otherwise.'],
  },
  q: {
    // the handle is the swing landing badly: reduced damage and no stack
    hits: [{ id: 'blade', type: 'physical', amount: 'BladeDamage', note: 'Decimate is counted as hitting with the blade.' }],
  },
  w: {
    // EmpoweredAttackDamage is the whole attack; the engine already counts the attack itself
    hits: [{
      id: 'strike', type: 'physical', amount: 'EmpoweredAttackDamage - ad', crit: '(EmpoweredAttackDamage - ad) * critDamage',
      note: 'Crippling Strike counts only what it adds to the attack; put a basic attack after it in the combo.',
    }],
  },
  e: {
    // the pull deals no damage; PassivePercentArmorPen is in percent points
    statMods: [{ stat: 'armorPenPct', value: 'PassivePercentArmorPen / 100' }],
  },
  r: {
    // its own stack is applied after the damage, by the passive
    hits: [{
      id: 'execute', type: 'true', amount: 'min(MaximumDamage, Damage * (1 + RDamagePercentPerHemoStack * onTarget))',
      note: 'Noxian Guillotine counts the Hemorrhage stacks applied earlier in the combo.',
    }],
  },
});

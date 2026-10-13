import { champion } from '../dsl.ts';

/* The game data has every amount as a calculation. What the model adds is the
   weapon's enchantment: Terrashape gathers one, Elemental Wrath spends it, and
   while it is held attacks deal Terrashape's bonus. Royal Privilege lands once
   per target, and gathering an enchantment makes it ready again. */
export default champion('Qiyana', {
  reviewed: '16.20.1',
  vars: {
    held: 'gathered || (enchanted && rank.w > 0 && !spent)',
  },
  options: {
    enchanted: { label: 'Weapon starts enchanted', default: true },
    rock: { label: 'Rock enchantment on Elemental Wrath', default: true },
  },
  // gathered: Terrashape was cast and its enchantment not yet spent; spent: the starting enchantment is gone;
  // privileged: Royal Privilege is on its per-target cooldown
  counters: { gathered: {}, spent: {}, privileged: {} },
  p: {
    rules: [
      // the cooldown is far longer than a fight, so it only comes back through Terrashape
      { id: 'privilege', on: 'attack', when: '!privileged', type: 'physical', amount: 'FinalDamage', then: 'privileged = 1' },
      { id: 'privilegeSpell', label: 'Royal Privilege', on: 'spell', when: '!privileged && !cast.r', type: 'physical', amount: 'FinalDamage', then: 'privileged = 1' },
    ],
    notes: [
      'Royal Privilege is counted on the first attack, Q or E, and again after each Terrashape; its per-target cooldown does not otherwise return during a fight.',
      'Supreme Display of Talent is assumed not to set off Royal Privilege.',
    ],
  },
  q: {
    hits: [
      // listed first so the health check sees the target before this cast's own damage
      {
        id: 'rock', label: 'Rock enchantment', type: 'physical', amount: 'TremorDamage',
        when: 'held && rock && hasTarget && target.hpPct < CritThreshold',
        note: 'With "Rock enchantment on Elemental Wrath" every enchanted cast is the Rock version: its bonus applies when the target is below half health before the cast lands.',
      },
      { id: 'blast', type: 'physical', amount: 'if(held, EnchantedDamage, VanillaDamage)', then: ['gathered = 0', 'spent = 1'] },
    ],
  },
  w: {
    // the dash deals no damage; it enchants the weapon and makes Royal Privilege ready again
    hits: [{ id: 'gather', type: 'magic', amount: 0, then: ['gathered = 1', 'privileged = 0'] }],
    rules: [
      { id: 'enchanted', label: 'Enchanted weapon', on: 'onhit', when: 'held', type: 'magic', amount: 'OnHitDamage' },
    ],
    // stats are settled before the fight starts, so the attack speed follows the starting enchantment only
    statMods: [{ stat: 'attackSpeed', value: 'AttackSpeed', when: 'enchanted' }],
    notes: [
      'The weapon is enchanted from the start unless "Weapon starts enchanted" is off, and from each Terrashape until the next Elemental Wrath spends it.',
      'Terrashape\'s attack speed is counted for the whole fight when the weapon starts enchanted, and not at all otherwise.',
      'Each Terrashape is assumed to gather a different element than the last, which resets Royal Privilege.',
    ],
  },
  e: {
    hits: [{ id: 'dash', type: 'physical', amount: 'Damage' }],
  },
  r: {
    hits: [{
      id: 'explosion', type: 'physical', amount: 'Damage + MissingHealthDamageRock * target.maxHp',
      note: 'One explosion of Supreme Display of Talent is counted; the target has to be knocked into terrain, river or brush to take it.',
    }],
  },
});

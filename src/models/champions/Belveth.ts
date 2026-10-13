import { champion } from '../dsl.ts';

/* Bel'Veth is attack speed and on-hit effects. What the game data leaves to the model:
   - Endless Banquet's true damage grows by a stack with every hit that applies
     on-hit effects, so the order of the combo decides what each hit adds.
   - Royal Maelstrom gives the damage of one strike; attack speed adds strikes,
     and each one grows with the health the target has lost by then.
   - Lavender stacks are kept between fights and stats are worked out once per
     fight, so the stacks and both attack speed buffs are options. */
export default champion('Belveth', {
  reviewed: '16.20.1',
  vars: {
    // percent points per stack. the game's AttackSpeedPerStack reads a data value the spell does not have,
    // so its steps are added up here: the rate changes at levels 6 and 11, as the data values' names say
    lavenderAs: 'BelvethPassive.ASPerStackLevel1Value + BelvethPassive.ASPerStackInitialBonusPerLevel * (min(level, 5) - 1)'
      + ' + BelvethPassive.ASPerStackLevel6BonusPerLevel * clamp(level - 5, 0, 5)'
      + ' + BelvethPassive.ASPerStackLevel11BonusPerLevel * max(0, level - 10)',
    // missing health raises a Royal Maelstrom strike and the strength of its on-hit effects alike
    frenzy: '1 + target.missingHpPct * BelvethE.MissingHealthMult',
  },
  options: {
    lavender: { label: 'Lavender stacks', kind: 'int', default: 0, min: 0 },
    afterAbility: { label: 'Death in Lavender attack speed active (after an ability)', default: true },
    trueForm: { label: 'True form active', default: false },
  },
  // banquet: Endless Banquet stacks on the target; maelstrom: 1 while Royal Maelstrom's strikes are being played
  counters: { banquet: {}, maelstrom: {} },
  p: {
    statMods: [
      { stat: 'attackSpeed', value: 'lavenderAs / 100 * lavender' },
      { stat: 'attackSpeed', value: 'SheenSpeedPerStack', when: 'afterAbility' },
    ],
    notes: [
      'Lavender stacks are kept between fights: set "Lavender stacks" to the number Bel\'Veth has.',
      'The attack speed Bel\'Veth gains after using an ability is counted as kept up for the whole fight; turn off "Death in Lavender attack speed active" to leave it out.',
    ],
  },
  q: {
    // a strike on the first enemy it passes through: it applies on-hit effects in full and can crit
    hits: [{ id: 'dash', type: 'physical', amount: 'BaseDamage', crit: 'BaseDamage * critDamage', appliesOnHit: true }],
  },
  w: {
    hits: [{ id: 'slam', type: 'magic', amount: 'Damage' }],
  },
  e: {
    hits: [
      { id: 'stance', type: 'physical', amount: 0, then: 'maelstrom = 1' },
      {
        id: 'strikes', type: 'physical', amount: 'DamagePerStrike * frenzy', count: 'floor(TotalStrikes)', over: 'TotalDuration', then: 'maelstrom = 0',
        note: 'Every strike of the full Royal Maelstrom channel is counted on the one target, each against the health the last one left.',
      },
    ],
    // a rule's own on-hit goes off once however many strikes it has, so each strike sets it off here instead.
    // the engine takes on-hit strength as a plain number: this is OnHitRatio, the strength against a full-health target
    rules: [{ id: 'onhit', on: 'damage', when: 'maelstrom', type: 'physical', amount: 0, appliesOnHit: 0.12 }],
    notes: ['Item on-hit effects on Royal Maelstrom strikes are counted at their full-health strength; they do not grow with missing health here.'],
  },
  r: {
    hits: [{
      id: 'explosion', type: 'true', amount: 'TotalExplosionDamage + MissingHealthDamage * target.missingHp',
      note: 'The explosion needs a Void Coral to consume next to the target. Its missing health damage is worked out from the health lost before it lands.',
    }],
    rules: [
      // the hit that adds a stack already deals that stack's damage; Royal Maelstrom's strikes scale it like any other on-hit effect
      {
        id: 'banquet', label: 'Endless Banquet on-hit', on: 'onhit', type: 'true',
        amount: 'FinalOnHitDamage * (banquet + 1) * if(maelstrom && hasTarget, frenzy, 1)', then: 'banquet += 1',
        note: 'Endless Banquet starts the fight without stacks; every basic attack, Void Surge and Royal Maelstrom strike adds one.',
      },
    ],
    // a share of total attack speed; her base attack speed and attack speed ratio are equal, so that is the same share of 1 + bonus
    statMods: [{ stat: 'attackSpeed', value: 'TotalASMod * (1 + bonusAs)', phase: 'convert', when: 'trueForm' }],
    notes: ['True form\'s attack speed is off unless "True form active" is set; casting Endless Banquet in the combo does not turn it on.'],
  },
});

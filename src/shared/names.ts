/* Names a model formula can use besides the game's own calculations and data values.
   Shared by the build-time resolver (which rejects anything else) and the engine. */
import type { StatId, StatKind } from './types.ts';

export const STAT_ALIASES: Record<string, { stat: StatId; kind: StatKind }> = {
  ad: { stat: 'ad', kind: 'total' }, baseAd: { stat: 'ad', kind: 'base' }, bonusAd: { stat: 'ad', kind: 'bonus' },
  ap: { stat: 'ap', kind: 'total' },
  maxHp: { stat: 'maxHealth', kind: 'total' }, baseHp: { stat: 'maxHealth', kind: 'base' }, bonusHp: { stat: 'maxHealth', kind: 'bonus' },
  mana: { stat: 'mana', kind: 'total' }, bonusMana: { stat: 'mana', kind: 'bonus' },
  armor: { stat: 'armor', kind: 'total' }, bonusArmor: { stat: 'armor', kind: 'bonus' },
  mr: { stat: 'mr', kind: 'total' }, bonusMr: { stat: 'mr', kind: 'bonus' },
  /** attacks per second */
  attackSpeed: { stat: 'attackSpeed', kind: 'total' },
  /** bonus attack speed as a fraction: 1 = +100% */
  bonusAs: { stat: 'attackSpeed', kind: 'bonus' },
  critChance: { stat: 'critChance', kind: 'total' },
  critDamage: { stat: 'critDamage', kind: 'total' },
  lethality: { stat: 'lethality', kind: 'total' },
  abilityHaste: { stat: 'abilityHaste', kind: 'total' },
  moveSpeed: { stat: 'moveSpeed', kind: 'total' }, bonusMs: { stat: 'moveSpeed', kind: 'bonus' },
  lifeSteal: { stat: 'lifeSteal', kind: 'total' },
  omnivamp: { stat: 'omnivamp', kind: 'total' },
};

/** `target.<name>`: the enemy as it stands at that point of the combo. Max health, armor and magic resist split into
    base and bonus as the attacker's do; armor and magic resist are the target's own, before shred and penetration. */
export const TARGET_VARS = [
  'maxHp', 'baseHp', 'bonusHp', 'hp', 'missingHp', 'hpPct', 'missingHpPct',
  'armor', 'baseArmor', 'bonusArmor', 'mr', 'baseMr', 'bonusMr',
] as const;

/** `hit.<type>`: 1 when the damage instance a `damage` rule is reacting to has that type. */
export const HIT_VARS = ['physical', 'magic', 'true'] as const;

/** `cast.<slot>`: 1 while that ability's cast is being played, so a rule can tell which ability set it off. */
export const CAST_VARS = ['q', 'w', 'e', 'r'] as const;

/** Bare names the engine always provides. */
export const BUILTIN_VARS = [
  'level',
  /** rank of the ability the rule belongs to */
  'rank',
  'ranged', 'melee',
  /** seconds since the combo started */
  'time',
  /** attack damage gained from levels alone, for the few effects that count it */
  'adFromLevels',
  /** true while the engine is simulating sustained auto attacks rather than the combo */
  'sustained',
  /** false in raw output; guard target.* with it to keep an effect quiet when there is nobody to hit */
  'hasTarget',
] as const;

export const RANK_VARS = ['q', 'w', 'e', 'r'] as const;

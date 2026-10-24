/* Stage 2c: how long things take. From each champion's game record and spell objects:
   the basic attack's windup and projectile speed, the champion's size, and for every spell
   its cast time, full animation time, range, projectile speed and width, channel time and the
   tags the game itself puts on it (an attack reset, a dash, a channel).

   The windup is the share of an attack's period before its damage leaves. The game writes it
   two ways: as an offset from the default 30% (mAttackDelayCastOffsetPercent), or as a cast
   time and total time of an attack at the champion's base attack speed. Fifteen champions'
   windups also do not shrink fully with attack speed: their modifier says how much does. */
import type { ChampionTiming, SpellTiming } from '../shared/types.ts';
import { clean } from './calc.ts';

type Raw = Record<string, any>;
const lower = (s: string) => s.toLowerCase();

/** The default windup share. */
export const DEFAULT_WINDUP = 0.3;
/** A champion's gameplay radius when the record does not override it. */
export const DEFAULT_RADIUS = 65;
/** Ranges at or above this mean the script, not the spell's range, decides where it lands. */
const UNLIMITED = 20000;
/** Tags kept: the ones the timeline reads, and the ones a reader needs to understand a spell's shape. */
const TAGS = new Set([
  'Trait_AttackReset', 'PositiveEffect_EmpowerAttack', 'Trait_AttackBuff_Duration', 'Trait_ChannelSpell', 'Trait_DoT', 'Trait_AoE',
  'Trait_PlayerSelectedDashDirection', 'PositiveEffect_MoveBlock', 'PositiveEffect_Teleport', 'Trait_Ammo', 'Trait_RecastOrReplaceSpell',
  'Trait_FreeRecast', 'Trait_Ranged_StopsFirstHit', 'Trait_Ranged_Piercing', 'Trait_Ranged_Zone', 'Trait_Strike', 'Trait_Pet',
  'Trait_Melee_SmallWindup', 'Trait_Melee_BigWindup', 'Trait_Transformation', 'Trait_Untargetable', 'Trait_ImmobilizingCCSpell',
]);

function rankArray(v: unknown): number[] | undefined {
  return Array.isArray(v) && v.every(x => typeof x === 'number') ? v.map(clean) : undefined;
}

export function compileSpellTiming(s: Raw): SpellTiming {
  const out: SpellTiming = {};
  const cast = s.mCastTime ?? s.spellCastTime;
  if (typeof cast === 'number') out.castTime = clean(cast);
  if (typeof s.spellTotalTime === 'number') out.totalTime = clean(s.spellTotalTime);
  const range = rankArray(s.castRange), display = rankArray(s.castRangeDisplayOverride);
  if (range && range.some(r => r > 0 && r < UNLIMITED)) out.range = range;
  else if (display) out.range = display;
  const radius = rankArray(s.castRadius);
  if (radius && radius.some(r => r > 0)) out.radius = radius;
  const move: Raw | undefined = s.mMissileSpec?.movementComponent;
  const speed = move?.mSpeed ?? (move?.mInitialSpeed) ?? (s.mMissileSpec ? s.missileSpeed : undefined);
  if (typeof speed === 'number' && speed > 0) out.missileSpeed = clean(speed);
  if (typeof move?.mTravelTime === 'number') out.missileTime = clean(move.mTravelTime);
  const width = s.mLineWidth ?? s.mMissileSpec?.mMissileWidth;
  if (typeof width === 'number' && width > 0) out.width = clean(width);
  if (typeof s.mChannelDuration === 'number') out.channel = clean(s.mChannelDuration);
  if (s.mCooldownNotAffectedByCDR) out.fixedCooldown = true;
  if (s.mCanMoveWhileChanneling) out.canMoveWhileChanneling = true;
  if (s.mUseAutoattackCastTimeData) out.usesAttackTiming = true;
  if (typeof s.mTargetingTypeData?.__type === 'string') out.targeting = s.mTargetingTypeData.__type;
  const ammo = rankArray(s.mAmmoRechargeTime);
  if (ammo) out.ammoRecharge = ammo;
  const tags = (s.mSpellTags ?? []).filter((t: unknown) => typeof t === 'string' && TAGS.has(t));
  if (tags.length) out.tags = tags;
  return out;
}

/** The timing of one champion, from its game file. `ranged` decides whether its attack has a projectile. */
export function compileTiming(id: string, bin: Raw, ranged: boolean): ChampionTiming {
  const records = Object.entries(bin).filter(([, v]) => v?.__type === 'CharacterRecord');
  const rec: Raw = (records.find(([k]) => lower(k) === `characters/${lower(id)}/characterrecords/root`) ?? records[0])?.[1] ?? {};
  const prefix = lower(`Characters/${id}/Spells/`);
  const spells: Record<string, SpellTiming> = {};
  for (const [path, v] of Object.entries(bin)) {
    if (v?.__type !== 'SpellObject' || !lower(path).startsWith(prefix)) continue;
    const t = compileSpellTiming(v.mSpell ?? {});
    if (Object.keys(t).length) spells[path.split('/').pop()!] = t;
  }

  const ba: Raw = rec.basicAttack ?? {};
  let windup = DEFAULT_WINDUP + (typeof ba.mAttackDelayCastOffsetPercent === 'number' ? ba.mAttackDelayCastOffsetPercent : 0);
  if (typeof ba.mAttackCastTime === 'number' && typeof ba.mAttackTotalTime === 'number' && ba.mAttackTotalTime > 0) windup = ba.mAttackCastTime / ba.mAttackTotalTime;
  const modifier = typeof ba.mAttackDelayCastOffsetPercentAttackSpeedRatio === 'number' ? ba.mAttackDelayCastOffsetPercentAttackSpeedRatio : 1;
  const attackName: string = ba.mAttackName ?? `${id}BasicAttack`;
  const attackSpell = Object.entries(bin).find(([k, v]) => v?.__type === 'SpellObject' && lower(k.split('/').pop()!) === lower(attackName))?.[1]?.mSpell;
  const attackMove = attackSpell?.mMissileSpec?.movementComponent;
  const missile = attackMove?.mSpeed ?? attackSpell?.missileSpeed;
  return {
    radius: clean(typeof rec.overrideGameplayCollisionRadius === 'number' ? rec.overrideGameplayCollisionRadius : DEFAULT_RADIUS),
    attack: {
      windup: clean(windup),
      windupModifier: clean(modifier),
      missileSpeed: ranged && typeof missile === 'number' && missile > 0 ? clean(missile) : 0,
    },
    spells,
  };
}

/** Seconds from the start of an attack to its damage leaving the champion, at attack speed `as`.
    `baseAs` is the champion's level 1 attack speed. With a modifier below 1 only that share of
    the windup shrinks as attack speed grows. */
export function windupSeconds(t: ChampionTiming['attack'], baseAs: number, as: number): number {
  const base = t.windup / baseAs;
  return base + (t.windup / as - base) * t.windupModifier;
}

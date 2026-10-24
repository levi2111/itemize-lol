/* Compiles the game's calculation objects into our formula AST.

   The format is undocumented. Everything here was derived from the data itself and is
   guarded by the canaries in anchors.ts, which fail the build if a patch changes it. */
import { walk } from '../shared/expr.ts';
import type { CalcData, DamageType, Expr, StatId, StatKind } from '../shared/types.ts';

type Raw = Record<string, any>;

/** The game stores 32-bit floats; 0.3 arrives as 0.30000001192092896. */
export const clean = (n: number): number => Number.isFinite(n) ? +n.toPrecision(6) : 0;
const num = (v: number): Expr => ({ k: 'num', v: clean(v) });

/* mStat codes as of 16.20, each identified from a formula whose meaning is not in doubt
   (see anchors.ts). Community documentation of this enum is out of date: three codes were
   inserted since it was written, shifting everything after attack damage. */
export const STAT_CODES: Record<number, StatId> = {
  0: 'ap',
  1: 'armor',
  2: 'ad',
  4: 'attackSpeed',
  6: 'mr',
  7: 'moveSpeed',
  8: 'critChance',
  9: 'critDamage',
  10: 'cdr',
  11: 'abilityHaste',
  12: 'maxHealth',
  13: 'currentHealth',
  14: 'healthPct',
  15: 'missingHealth',
  16: 'missingHealthPct',
  18: 'lifeSteal',
  20: 'omnivamp',
  21: 'physicalVamp',
  29: 'lethality',
  30: 'tenacity',
  31: 'attackRange',
  34: 'healShieldPower',
};
const STAT_KINDS: Record<number, StatKind> = { 0: 'total', 1: 'base', 2: 'bonus' };
const DAMAGE_TYPES: Record<number, DamageType> = { 0: 'physical', 1: 'magic', 2: 'true' };

/* Field and type names the hash list has not resolved yet, named after what they hold. */
const H = {
  targetStat: '{a8cb9c14}',           // the stat is read from the target instead of the caster
  calcRef: '{f3cbe7b2}',              // part: value of another calculation
  rangedCalc: '{e9a3c91d}',           // calculation with a multiplier for ranged users
  breaksByDataValue: '{4ce08984}',    // level breakpoints whose numbers are data values
  breakByDataValue: '{0333530c}',
  linearByDataValue: '{b22609db}',    // level-1 value plus a per-level step, both data values
  lerpByDataValue: '{ee18a47b}',      // interpolate between two data values over levels
  lerpStart: '{0589a59c}',            // its start and end data values, where the file has them unnamed (runes)
  lerpEnd: '{0b65bc23}',
  foreignDataValue: '{9e9e2e5c}',     // data value of another spell
  hashedDataValue: '{2b25a73a}',
  level1: '{91d404a5}',
  perLevel: '{bbd778a2}',
  perLevelLinear: '{b2cd0eb0}',
  breakpoints: '{9823b29a}',
  bpAdd: '{ae9b464d}',
  bpPerLevel: '{b0d8b2ac}',
} as const;

export interface CompileLog {
  unknownParts: Map<string, number>;
  unknownStats: Map<number, number>;
}
export const newLog = (): CompileLog => ({ unknownParts: new Map(), unknownStats: new Map() });
const bump = <K>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1);

function stat(p: Raw, log: CompileLog): Expr {
  const code = p.mStat ?? 0;
  const id = STAT_CODES[code];
  if (!id) { bump(log.unknownStats, code); return { k: 'unknown', what: `stat code ${code}` }; }
  const e: Expr = { k: 'stat', stat: id, kind: STAT_KINDS[p.mStatFormula ?? 0] ?? 'total' };
  if (p[H.targetStat]) e.of = 'target';
  return e;
}

const lastSegment = (path: string) => path.split('/').pop() ?? path;

function part(p: Raw | undefined | null, log: CompileLog): Expr {
  if (!p) return num(0);
  const sub = (x: Raw | undefined) => part(x, log);
  switch (p.__type) {
    case 'NumberCalculationPart': return num(p.mNumber ?? 0);
    case 'NamedDataValueCalculationPart': return { k: 'dv', name: p.mDataValue };
    case 'EffectValueCalculationPart': return { k: 'eff', index: p.mEffectIndex ?? 0 };
    case 'StatByCoefficientCalculationPart': return { k: 'mul', parts: [stat(p, log), num(p.mCoefficient ?? 0)] };
    case 'StatByNamedDataValueCalculationPart': return { k: 'mul', parts: [stat(p, log), { k: 'dv', name: p.mDataValue }] };
    case 'StatBySubPartCalculationPart': return { k: 'mul', parts: [stat(p, log), sub(p.mSubpart)] };
    case 'AbilityResourceByCoefficientCalculationPart':
      return { k: 'mul', parts: [{ k: 'stat', stat: 'mana', kind: STAT_KINDS[p.mStatFormula ?? 0] ?? 'total' }, num(p.mCoefficient ?? 0)] };
    case 'SumOfSubPartsCalculationPart': return { k: 'sum', parts: (p.mSubparts ?? []).map(sub) };
    case 'ProductOfSubPartsCalculationPart': return { k: 'mul', parts: [sub(p.mPart1), sub(p.mPart2)] };
    case 'ClampSubPartsCalculationPart': {
      const e: Expr = { k: 'clamp', x: { k: 'sum', parts: (p.mSubparts ?? []).map(sub) } };
      if (typeof p.mFloor === 'number') e.floor = clean(p.mFloor);
      if (typeof p.mCeiling === 'number') e.ceil = clean(p.mCeiling);
      return e;
    }
    case 'ByCharLevelInterpolationCalculationPart':
      return { k: 'lerp', start: num(p.mStartValue ?? 0), end: num(p.mEndValue ?? 0), curve: p.mScaleByStatProgressionMultiplier ? 'growth' : 'linear' };
    case H.lerpByDataValue:
      return { k: 'lerp', start: { k: 'dv', name: p.StartDataValue ?? p[H.lerpStart] }, end: { k: 'dv', name: p.EndDataValue ?? p[H.lerpEnd] }, curve: 'linear' };
    case 'ByCharLevelBreakpointsCalculationPart':
      return {
        k: 'breaks', level1: num(p.mLevel1Value ?? 0), perLevel: num(p.mInitialBonusPerLevel ?? 0),
        breakpoints: (p.mBreakpoints ?? []).map((b: Raw) => ({
          level: b.mLevel ?? 1,
          ...(b.mAdditionalBonusAtThisLevel !== undefined && { add: num(b.mAdditionalBonusAtThisLevel) }),
          ...(b.mBonusPerLevelAtAndAfter !== undefined && { perLevel: num(b.mBonusPerLevelAtAndAfter) }),
        })),
      };
    case H.breaksByDataValue: {
      const dv = (name: string | undefined): Expr => name ? { k: 'dv', name } : num(0);
      return {
        k: 'breaks', level1: dv(p[H.level1]), perLevel: dv(p[H.perLevel]),
        breakpoints: (p[H.breakpoints] ?? []).map((b: Raw) => ({
          level: b.level ?? 1,
          ...(b[H.bpAdd] && { add: dv(b[H.bpAdd]) }),
          ...(b[H.bpPerLevel] && { perLevel: dv(b[H.bpPerLevel]) }),
        })),
      };
    }
    case H.linearByDataValue:
      return { k: 'breaks', level1: { k: 'dv', name: p[H.level1] }, perLevel: { k: 'dv', name: p[H.perLevelLinear] }, breakpoints: [] };
    case 'ByCharLevelFormulaCalculationPart': return { k: 'table', values: (p.values ?? []).map(clean) };
    case 'BuffCounterByCoefficientCalculationPart': return { k: 'mul', parts: [{ k: 'stacks', buff: p.mBuffName }, num(p.mCoefficient ?? 0)] };
    case 'BuffCounterByNamedDataValueCalculationPart': return { k: 'mul', parts: [{ k: 'stacks', buff: p.mBuffName }, { k: 'dv', name: p.mDataValue }] };
    case 'CooldownMultiplierCalculationPart': return { k: 'cdMul' };
    case 'ByItemEpicnessCountCalculationPart': return { k: 'mul', parts: [{ k: 'itemCount', epicness: p.epicness ?? 0 }, num(p.Coefficient ?? 1)] };
    case H.calcRef: return { k: 'calc', name: p.mSpellCalculationKey };
    case H.foreignDataValue: return { k: 'dv', name: p.DataValue, spell: lastSegment(p.SourceObject ?? '') };
    case H.hashedDataValue: return { k: 'dv', name: p.DataValue };
    default:
      bump(log.unknownParts, String(p.__type));
      return { k: 'unknown', what: String(p.__type) };
  }
}

const sumOf = (parts: Raw[] | undefined, log: CompileLog): Expr => {
  const xs = (parts ?? []).map(p => part(p, log));
  return xs.length === 1 ? xs[0]! : { k: 'sum', parts: xs };
};
const times = (e: Expr, m: Raw | undefined, log: CompileLog): Expr => m ? { k: 'mul', parts: [e, part(m, log)] } : e;

export function compileCalc(c: Raw, log: CompileLog): CalcData {
  let expr: Expr;
  switch (c.__type) {
    case 'GameCalculation':
      expr = times(sumOf(c.mFormulaParts, log), c.mMultiplier, log);
      break;
    case H.rangedCalc:
      expr = times({ k: 'mul', parts: [sumOf(c.mFormulaParts, log), { k: 'ifRanged', ranged: part(c.mRangedMultiplier, log), melee: num(1) }] }, c.mMultiplier, log);
      break;
    case 'GameCalculationModified':
      expr = times({ k: 'calc', name: c.mModifiedGameCalculation }, c.mMultiplier, log);
      break;
    case 'GameCalculationConditional': {
      const then: Expr = { k: 'calc', name: c.mConditionalGameCalculation };
      const otherwise: Expr = c.mDefaultGameCalculation ? { k: 'calc', name: c.mDefaultGameCalculation } : num(0);
      // Ranged-or-melee is the one condition static data can answer. Everything else
      // (has a buff, target below a threshold…) falls back to the default branch;
      // a model that cares picks the branch explicitly.
      expr = c.mConditionalCalculationRequirements?.__type === 'IsRangedCastRequirement'
        ? { k: 'ifRanged', ranged: then, melee: otherwise }
        : otherwise;
      break;
    }
    default:
      bump(log.unknownParts, `calc ${c.__type}`);
      expr = { k: 'unknown', what: `calc ${c.__type}` };
  }
  const out: CalcData = { expr };
  if (typeof c.DamageType === 'number' && DAMAGE_TYPES[c.DamageType]) out.damageType = DAMAGE_TYPES[c.DamageType];
  if (c.mDisplayAsPercent) out.percent = true;
  return out;
}

export function compileCalcs(raw: Record<string, Raw> | undefined, log: CompileLog): Record<string, CalcData> {
  const out: Record<string, CalcData> = {};
  for (const [name, c] of Object.entries(raw ?? {})) out[name] = compileCalc(c, log);
  return out;
}

interface NamePools { calcs: Record<string, unknown>; dataValues: Record<string, unknown> }

/* The game looks names up by hash, without regard to case, so a formula may say
   rAPCoefficient where the value is declared RAPCoefficient. Everything downstream
   compares names exactly: this respells each reference the way its target is declared.
   `pools` returns the names of another spell, or of the formulas' own when given nothing. */
export function matchNameCase(calcs: Record<string, CalcData>, pools: (spell?: string) => NamePools | undefined): void {
  for (const c of Object.values(calcs)) {
    for (const n of walk(c.expr)) {
      if (n.k !== 'dv' && n.k !== 'calc') continue;
      const pool = pools(n.spell)?.[n.k === 'dv' ? 'dataValues' : 'calcs'];
      if (!pool || pool[n.name] !== undefined) continue;
      // a reference may also be the hash the game files keep instead of the name: {d62bdfef} is AbilityDamageRangeMod
      const hashed = /^\{[0-9a-f]{8}\}$/.test(n.name);
      const declared = Object.keys(pool).find(k => hashed ? `{${nameHash(k)}}` === n.name : k.toLowerCase() === n.name.toLowerCase());
      if (declared) n.name = declared;
    }
  }
}

/** The 32-bit FNV-1a hash of a name in lower case, as the game files write names they do not spell out. */
export function nameHash(name: string): string {
  let h = 0x811c9dc5;
  for (const ch of name.toLowerCase()) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/* Evaluating and printing formula ASTs. No Node APIs: this runs anywhere. */
import type { CalcData, Expr, StatId, StatKind } from './types.ts';

/** Where unqualified data values, effects and calculations are looked up: a spell at some rank, or an item. */
export interface Scope {
  id: string;
  dv(name: string): number | undefined;
  eff(index: number): number | undefined;
  calc(name: string): CalcData | undefined;
}

export interface EvalEnv {
  level: number;
  ranged: boolean;
  stat(stat: StatId, kind: StatKind, of?: 'target'): number;
  /** another spell of the same champion, at its own rank */
  scope(spell: string): Scope | undefined;
  /** options, counters, helper vars and builtins such as target.maxHp */
  variable(name: string): number | undefined;
  stacks(buff: string): number;
  itemCount(epicness: number): number;
  /** called when a formula touches something we cannot evaluate */
  unknown(what: string): void;
}

/** Stat growth from levelling: the multiplier applied to a per-level stat at `level`. */
export const growth = (level: number) => (level - 1) * (0.7025 + 0.0175 * (level - 1));
/** growth(18) */
const GROWTH_MAX = 17;

const num = (v: number): Expr => ({ k: 'num', v });

export function evaluate(e: Expr, env: EvalEnv, scope: Scope, depth = 0): number {
  if (depth > 40) { env.unknown(`formula recursion in ${scope.id}`); return 0; }
  const ev = (x: Expr) => evaluate(x, env, scope, depth + 1);
  const other = (spell: string | undefined): Scope | undefined => spell === undefined ? scope : env.scope(spell);
  switch (e.k) {
    case 'num': return e.v;
    case 'dv': {
      const v = other(e.spell)?.dv(e.name);
      if (v === undefined) { env.unknown(`data value ${e.spell ?? scope.id}.${e.name}`); return 0; }
      return v;
    }
    case 'eff': {
      const v = other(e.spell)?.eff(e.index);
      if (v === undefined) { env.unknown(`effect ${e.spell ?? scope.id}.e${e.index}`); return 0; }
      return v;
    }
    case 'stat': return env.stat(e.stat, e.kind, e.of);
    case 'sum': return e.parts.reduce((s, p) => s + ev(p), 0);
    case 'mul': return e.parts.reduce((s, p) => s * ev(p), 1);
    case 'lerp': {
      const t = e.curve === 'growth' ? growth(env.level) / GROWTH_MAX : (env.level - 1) / 17;
      const a = ev(e.start);
      return a + (ev(e.end) - a) * t;
    }
    case 'breaks': {
      let value = ev(e.level1), per = ev(e.perLevel);
      for (let l = 2; l <= env.level; l++) {
        const bp = e.breakpoints.find(b => b.level === l);
        if (bp?.perLevel) per = ev(bp.perLevel);
        value += per;
        if (bp?.add) value += ev(bp.add);
      }
      return value;
    }
    case 'table': return e.values[Math.min(env.level, e.values.length - 1)] ?? 0;
    case 'calc': {
      const s = other(e.spell);
      const c = s?.calc(e.name);
      if (!s || !c) { env.unknown(`calculation ${e.spell ?? scope.id}.${e.name}`); return 0; }
      return evaluate(c.expr, env, s, depth + 1);
    }
    case 'clamp': {
      let v = ev(e.x);
      if (e.floor !== undefined) v = Math.max(e.floor, v);
      if (e.ceil !== undefined) v = Math.min(e.ceil, v);
      return v;
    }
    case 'stacks': return env.stacks(e.buff);
    case 'cdMul': return 100 / (100 + env.stat('abilityHaste', 'total'));
    case 'itemCount': return env.itemCount(e.epicness);
    case 'ifRanged': return ev(env.ranged ? e.ranged : e.melee);
    case 'unknown': env.unknown(e.what); return 0;
    case 'var': {
      const v = env.variable(e.name);
      if (v === undefined) { env.unknown(`variable ${e.name}`); return 0; }
      return v;
    }
    case 'op': {
      const a = ev(e.a);
      // short-circuit so a guard can protect its right-hand side
      if (e.op === '&&') return a ? (ev(e.b) ? 1 : 0) : 0;
      if (e.op === '||') return a ? 1 : (ev(e.b) ? 1 : 0);
      const b = ev(e.b);
      switch (e.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return b === 0 ? 0 : a / b;
        case '<': return a < b ? 1 : 0;
        case '<=': return a <= b ? 1 : 0;
        case '>': return a > b ? 1 : 0;
        case '>=': return a >= b ? 1 : 0;
        case '==': return a === b ? 1 : 0;
        case '!=': return a !== b ? 1 : 0;
      }
      return 0;
    }
    case 'fn': {
      if (e.fn === 'if') return ev(e.args[0] ?? num(0)) ? ev(e.args[1] ?? num(0)) : ev(e.args[2] ?? num(0));
      const a = e.args.map(ev);
      switch (e.fn) {
        case 'min': return Math.min(...a);
        case 'max': return Math.max(...a);
        case 'floor': return Math.floor(a[0] ?? 0);
        case 'ceil': return Math.ceil(a[0] ?? 0);
        case 'round': return Math.round(a[0] ?? 0);
        case 'abs': return Math.abs(a[0] ?? 0);
        case 'not': return a[0] ? 0 : 1;
        case 'clamp': return Math.min(Math.max(a[0] ?? 0, a[1] ?? -Infinity), a[2] ?? Infinity);
      }
      return 0;
    }
  }
}

const STAT_LABEL: Record<StatId, string> = {
  ap: 'AP', ad: 'AD', armor: 'armor', mr: 'MR', attackSpeed: 'AS', moveSpeed: 'MS', critChance: 'crit chance', critDamage: 'crit damage',
  cdr: 'CDR', abilityHaste: 'haste', maxHealth: 'max HP', currentHealth: 'current HP', healthPct: 'HP%', missingHealth: 'missing HP',
  missingHealthPct: 'missing HP%', mana: 'mana', lifeSteal: 'life steal', omnivamp: 'omnivamp', physicalVamp: 'physical vamp',
  lethality: 'lethality', armorPenPct: 'armor pen%', magicPenFlat: 'magic pen', magicPenPct: 'magic pen%', tenacity: 'tenacity',
  attackRange: 'range', healShieldPower: 'heal/shield power',
};
const round = (v: number) => String(+v.toFixed(4));

/** One-line rendering for reports and reviewers. */
export function formatExpr(e: Expr): string {
  const f = formatExpr;
  const paren = (x: Expr) => (x.k === 'sum' || x.k === 'op') ? `(${f(x)})` : f(x);
  switch (e.k) {
    case 'num': return round(e.v);
    case 'dv': return e.spell ? `${e.spell}.${e.name}` : e.name;
    case 'eff': return `${e.spell ? e.spell + '.' : ''}e${e.index}`;
    case 'stat': return `${e.of === 'target' ? "target's " : ''}${e.kind === 'total' ? '' : e.kind + ' '}${STAT_LABEL[e.stat]}`;
    case 'sum': return e.parts.map(f).join(' + ') || '0';
    case 'mul': return e.parts.map(paren).join(' × ') || '1';
    case 'lerp': return `[${f(e.start)} → ${f(e.end)} by level${e.curve === 'growth' ? ', growth curve' : ''}]`;
    case 'breaks': {
      const bps = e.breakpoints.map(b => `L${b.level}${b.add ? ` +${f(b.add)}` : ''}${b.perLevel ? ` then +${f(b.perLevel)}/lvl` : ''}`).join(', ');
      const per = e.perLevel.k === 'num' && e.perLevel.v === 0 ? '' : ` +${f(e.perLevel)}/lvl`;
      return `[${f(e.level1)}${per}${bps ? '; ' + bps : ''}]`;
    }
    case 'table': return `[by level: ${round(e.values[1] ?? 0)} … ${round(e.values[18] ?? e.values.at(-1) ?? 0)}]`;
    case 'calc': return `${e.spell ? e.spell + '.' : ''}${e.name}`;
    case 'clamp': return `clamp(${f(e.x)}, ${e.floor ?? '-∞'}, ${e.ceil ?? '∞'})`;
    case 'stacks': return `stacks(${e.buff})`;
    case 'cdMul': return 'cooldown multiplier';
    case 'itemCount': return `items of tier ${e.epicness}+`;
    case 'ifRanged': return `(ranged ? ${f(e.ranged)} : ${f(e.melee)})`;
    case 'unknown': return `?${e.what}?`;
    case 'var': return e.name;
    case 'op': return `${paren(e.a)} ${e.op} ${paren(e.b)}`;
    case 'fn': return `${e.fn}(${e.args.map(f).join(', ')})`;
  }
}

/** Every node of a formula, depth first. */
export function* walk(e: Expr): Generator<Expr> {
  yield e;
  switch (e.k) {
    case 'sum': case 'mul': for (const p of e.parts) yield* walk(p); break;
    case 'lerp': yield* walk(e.start); yield* walk(e.end); break;
    case 'breaks':
      yield* walk(e.level1); yield* walk(e.perLevel);
      for (const b of e.breakpoints) { if (b.add) yield* walk(b.add); if (b.perLevel) yield* walk(b.perLevel); }
      break;
    case 'clamp': yield* walk(e.x); break;
    case 'ifRanged': yield* walk(e.ranged); yield* walk(e.melee); break;
    case 'op': yield* walk(e.a); yield* walk(e.b); break;
    case 'fn': for (const a of e.args) yield* walk(a); break;
    default: break;
  }
}

/* Parser for the small formula language hand-written models use:

     TotalIndividualMissileDamage * (1 + (missiles - 1) * ExtraHitReduction)
     if(target.hpPct < 25%, ExecuteDamage, 0)

   Names are resolved while parsing, so a model that mentions a calculation the
   current patch no longer has fails the build instead of silently reading 0. */
import type { BinaryOp, Expr, FnName } from '../shared/types.ts';

export type Resolve = (path: string[]) => Expr;
/** calc('…'), dv('…') and stacks('…') reach names that are not valid identifiers, such as unresolved hashes. */
export type ResolveQuoted = (fn: 'calc' | 'dv' | 'stacks', name: string) => Expr;

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'str'; v: string } | { t: 'op'; v: string };

const FNS = new Set<FnName>(['min', 'max', 'floor', 'ceil', 'round', 'abs', 'if', 'not', 'clamp']);
const QUOTED = new Set(['calc', 'dv', 'stacks']);
const BINARY: Record<string, number> = { '||': 1, '&&': 2, '<': 3, '<=': 3, '>': 3, '>=': 3, '==': 3, '!=': 3, '+': 4, '-': 4, '*': 5, '/': 5 };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  const re = /\s*(?:(\d+\.?\d*|\.\d+)(%?)|([A-Za-z_][A-Za-z0-9_]*)|'([^']*)'|"([^"]*)"|(\|\||&&|<=|>=|==|!=|[-+*/<>!(),.]))/y;
  let i = 0;
  while (i < src.length) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) {
      if (/^\s*$/.test(src.slice(i))) break;
      throw new Error(`unexpected "${src.slice(i, i + 12)}" in formula "${src}"`);
    }
    i = re.lastIndex;
    if (m[1] !== undefined) out.push({ t: 'num', v: m[2] ? Number(m[1]) / 100 : Number(m[1]) });
    else if (m[3] !== undefined) out.push({ t: 'id', v: m[3] });
    else if (m[4] !== undefined || m[5] !== undefined) out.push({ t: 'str', v: (m[4] ?? m[5])! });
    else out.push({ t: 'op', v: m[6]! });
  }
  return out;
}

export function parseExpr(src: string, resolve: Resolve, quoted: ResolveQuoted): Expr {
  const toks = tokenize(src);
  let pos = 0;
  const peek = () => toks[pos];
  const isOp = (v: string) => { const t = toks[pos]; return t?.t === 'op' && t.v === v; };
  const expect = (v: string) => { if (!isOp(v)) throw new Error(`expected "${v}" in formula "${src}"`); pos++; };

  const primary = (): Expr => {
    const t = toks[pos++];
    if (!t) throw new Error(`formula "${src}" ends early`);
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'op' && t.v === '(') { const e = binary(0); expect(')'); return e; }
    if (t.t === 'op' && t.v === '-') return { k: 'op', op: '*', a: { k: 'num', v: -1 }, b: unary() };
    if (t.t === 'op' && t.v === '!') return { k: 'fn', fn: 'not', args: [unary()] };
    if (t.t !== 'id') throw new Error(`unexpected "${t.v}" in formula "${src}"`);
    if (isOp('(')) {
      pos++;
      if (QUOTED.has(t.v)) {
        const s = toks[pos++];
        if (s?.t !== 'str') throw new Error(`${t.v}() takes a quoted name in formula "${src}"`);
        expect(')');
        return quoted(t.v as 'calc' | 'dv' | 'stacks', s.v);
      }
      if (!FNS.has(t.v as FnName)) throw new Error(`unknown function ${t.v}() in formula "${src}"`);
      const args: Expr[] = [];
      if (!isOp(')')) { do args.push(binary(0)); while (isOp(',') && ++pos); }
      expect(')');
      return { k: 'fn', fn: t.v as FnName, args };
    }
    const path = [t.v];
    while (isOp('.')) {
      pos++;
      const next = toks[pos++];
      if (next?.t !== 'id') throw new Error(`expected a name after "." in formula "${src}"`);
      path.push(next.v);
    }
    return resolve(path);
  };
  const unary = primary;
  const binary = (minPrec: number): Expr => {
    let left = unary();
    for (;;) {
      const t = peek();
      const prec = t?.t === 'op' ? BINARY[t.v] : undefined;
      if (prec === undefined || prec < minPrec) return left;
      pos++;
      left = { k: 'op', op: t!.v as BinaryOp, a: left, b: binary(prec + 1) };
    }
  };

  const e = binary(0);
  if (pos < toks.length) throw new Error(`unexpected "${toks[pos]!.v}" in formula "${src}"`);
  return e;
}

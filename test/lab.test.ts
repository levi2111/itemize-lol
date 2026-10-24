/* The lab's timeline: when actions start and land. Damage itself is Fight's and tested in engine.test.ts. */
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { calculate, championAsTarget } from '../src/engine/calc.ts';
import type { Action } from '../src/engine/types.ts';
import { compileFormula } from '../src/lab/behaviour.ts';
import { BEHAVIOURS } from '../src/lab/behaviours/index.ts';
import { play, TICK, type Scenario } from '../src/lab/timeline.ts';
import { windupSeconds } from '../src/pipeline/timing.ts';
import { ROOT } from '../src/pipeline/paths.ts';
import { Dataset } from '../src/server/dataset.ts';
import { CAST_SLOTS } from '../src/shared/types.ts';

const data = new Dataset();
const ranks = { q: 5, w: 1, e: 3, r: 2 };
const near = (a: number, b: number, eps = TICK + 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} should be within ${eps} of ${b}`);
const script = (actions: Action[], more: Partial<Extract<Scenario['mode'], { kind: 'script' }>> = {}): Scenario['mode'] =>
  ({ kind: 'script', script: actions, keepAttacking: false, fillWithAutos: false, ...more });
const scenario = (over: Partial<Scenario>, champion = 'Samira'): Scenario => ({
  champ: data.champion(champion)!, items: [], build: { champion, level: 13, ranks, items: [] },
  target: { champ: data.champion('Ornn')!, level: 13 }, distance: 400, behaviour: 'stand', mode: script([]), ...over,
});

test('lab: every behaviour file is in the index and every formula in it binds', () => {
  const files = readdirSync(join(ROOT, 'src', 'lab', 'behaviours')).filter(f => f.endsWith('.ts') && f !== 'index.ts').map(f => f.replace(/\.ts$/, ''));
  assert.deepEqual(Object.keys(BEHAVIOURS).sort(), files.sort(), 'run npm run lab:index');
  for (const [id, src] of Object.entries(BEHAVIOURS)) {
    const champ = data.champion(id);
    assert.ok(champ, `${id} is not a champion`);
    // playing every action once compiles every formula; a name that does not exist throws
    play(scenario({ mode: script(['aa', ...CAST_SLOTS]), build: { champion: id, level: 18, ranks: { q: 5, w: 5, e: 5, r: 3 }, items: [] } }, id));
    for (const [slot, a] of Object.entries(src.actions ?? {})) {
      for (const v of a?.variants ?? []) for (const f of [v.within, v.beyond, v.when]) if (f !== undefined) compileFormula(f, champ, v.spell ?? a?.spell ?? champ.slots[slot as 'q'].spell);
    }
  }
});

test('lab: a cooldown holds the second cast back', () => {
  const r = play(scenario({ mode: script(['q', 'q']) }));
  const [first, second] = r.started.filter(s => s.action === 'q');
  const cd = r.spans.find(s => s.lane === 'q' && s.kind === 'cooldown')!;
  assert.ok(first && second);
  near(second.t - first.t, cd.to - cd.from);
});

test('lab: attacks wait on the attack timer and land after the windup the game file gives', () => {
  const r = play(scenario({ mode: script(['aa', 'aa']), distance: 600 }));
  const champ = data.champion('Samira')!;
  const as = calculate(data, { build: { champion: 'Samira', level: 13, ranks, items: [] }, target: null, combo: {} }).stats.attackSpeed.total;
  const [a1, a2] = r.started;
  near(a2!.t - a1!.t, 1 / as);
  const windup = r.spans.find(s => s.kind === 'windup')!;
  near(windup.to - windup.from, windupSeconds(champ.timing!.attack, champ.stats.attackSpeed, as));
  assert.equal(r.timings.aa.lock.from, 'data');
});

test('lab: out of range, the champion walks first; a target walking away at the same speed is never reached', () => {
  const walk = play(scenario({ mode: script(['aa']), distance: 1200 }));
  assert.ok(walk.started[0]!.t > 0);
  const chase = play(scenario({ mode: script(['aa']), distance: 1200, behaviour: 'away', horizon: 5 }));
  assert.equal(chase.events.filter(e => e.action === 'aa').length, 0);
});

test('lab: against a standing target the timeline deals what the plain calculation deals', () => {
  // Garen has no behaviour file: this is the game files' timing alone
  const seq: Action[] = ['aa', 'q', 'aa', 'e'];
  const r = play(scenario({ mode: script(seq), distance: 300, build: { champion: 'Garen', level: 13, ranks, items: [] } }, 'Garen'));
  const calc = calculate(data, { build: { champion: 'Garen', level: 13, ranks, items: [] }, target: championAsTarget(data.champion('Ornn')!, 13), combo: { sequence: seq } });
  near(r.dealt, calc.combo.total.dealt, 1);
});

test('lab: Samira weaves Q into E as the buffered sword slash, without ending the dash', () => {
  const r = play(scenario({ mode: script(['e', 'q']), distance: 700 }));
  const e = r.started.find(s => s.action === 'e')!, q = r.started.find(s => s.action === 'q')!;
  assert.equal(q.woven, true);
  assert.equal(r.timings.q.variants[q.variant]!.timing.spell, 'SamiraQBufferedSword');
  const dash = r.spans.find(s => s.lane === 'e' && s.kind === 'dash')!;
  assert.ok(q.t < dash.to, 'Q starts before the dash ends');
  assert.ok(q.t >= e.t);
});

test('lab: Inferno Trigger waits for six Style grades, then lands its shots over two seconds', () => {
  const early = play(scenario({ mode: script(['r']), horizon: 3 }));
  assert.equal(early.started.filter(s => s.action === 'r').length, 0);
  const combo: Action[] = ['aa', 'e', 'q', 'aa', 'w', 'q', 'r'];
  const r = play(scenario({ mode: script(combo), distance: 450, horizon: 12, build: { champion: 'Samira', level: 13, ranks: { q: 5, w: 1, e: 3, r: 2 }, items: [3031, 6672, 3036] }, target: { champ: data.champion('Malphite')!, level: 18 } }));
  const shots = r.events.filter(e => e.action === 'r');
  assert.ok(shots.length >= 5, `R fired ${shots.length} shots`);
  assert.ok(shots.at(-1)!.t - shots[0]!.t > 1, 'the shots are spread out');
});

test('lab: an attack reset lets the next attack start right after the cast', () => {
  // Samira's E carries the game's attack reset tag
  const r = play(scenario({ mode: script(['aa', 'e', 'aa']), distance: 500 }));
  const [a1, e, a2] = r.started;
  assert.equal(r.timings.e.resetsAttack, true);
  const eEnd = r.spans.find(s => s.lane === 'e' && s.kind === 'dash')!.to;
  assert.ok(a2!.t < a1!.t + 1 / 0.9, 'the second attack does not wait a full attack period');
  near(a2!.t, Math.max(eEnd, e!.t), 2 * TICK);
});

test('lab: seconds mode uses the allowed abilities on cooldown and counts damage inside the window only', () => {
  const r = play(scenario({ mode: { kind: 'seconds', seconds: 6, abilities: ['q', 'w'] }, distance: 450 }));
  assert.ok(r.end <= 6 + 1e-9);
  assert.ok(r.started.filter(s => s.action === 'q').length >= 2);
  assert.equal(r.started.filter(s => s.action === 'e' || s.action === 'r').length, 0);
  assert.ok(r.events.every(e => e.t <= 6 + 1e-9));
  const autosOnly = play(scenario({ mode: { kind: 'seconds', seconds: 6, abilities: [] }, distance: 450 }));
  assert.ok(r.dealt > autosOnly.dealt);
});

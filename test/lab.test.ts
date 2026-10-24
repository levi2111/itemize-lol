/* The lab's timeline: when actions start and land. Damage itself is Fight's and tested in engine.test.ts. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculate, championAsTarget } from '../src/engine/calc.ts';
import { play, timingsFor, type Scenario } from '../src/lab/timeline.ts';
import { Dataset } from '../src/server/dataset.ts';

const data = new Dataset();
const ranks = { q: 5, w: 1, e: 3, r: 2 };
const scenario = (over: Partial<Scenario>): Scenario => {
  const champ = data.champion('Samira')!;
  return {
    champ, items: [], build: { champion: 'Samira', level: 13, ranks, items: [] },
    target: { champ: data.champion('Ornn')!, level: 13 }, distance: 400, behaviour: 'stand',
    script: [], keepAttacking: false, fillWithAutos: false, timings: timingsFor(champ, ranks), ...over,
  };
};

test('lab: a cooldown holds the second cast back', () => {
  const r = play(scenario({ script: ['q', 'q'] }));
  const [first, second] = r.started.filter(s => s.action === 'q');
  const cd = r.spans.find(s => s.lane === 'q' && s.kind === 'cooldown')!;
  assert.ok(first && second);
  assert.ok(Math.abs(second.t - first.t - (cd.to - cd.from)) < 1 / 30 + 1e-9, 'the second Q starts when the first one\'s cooldown ends');
});

test('lab: attacks wait on the attack timer and land after their windup and flight', () => {
  const r = play(scenario({ script: ['aa', 'aa'] }));
  const starts = r.started.map(s => s.t), lands = r.events.filter(e => e.action === 'aa').map(e => e.t);
  const period = 1 / calculate(data, { build: { champion: 'Samira', level: 13, ranks, items: [] }, target: null, combo: {} }).stats.attackSpeed.total;
  assert.ok(Math.abs(starts[1]! - starts[0]! - period) < 1 / 30 + 1e-9);
  assert.ok(lands[0]! > starts[0]! + 0.2 * period - 1e-9, 'damage lands after the windup');
});

test('lab: out of range, the champion walks first; a target walking away at the same speed is never reached', () => {
  const walk = play(scenario({ script: ['aa'], distance: 1200 }));
  assert.ok(walk.started[0]!.t > 0);
  const chase = play(scenario({ script: ['aa'], distance: 1200, behaviour: 'away', horizon: 5 }));
  assert.equal(chase.events.filter(e => e.action === 'aa').length, 0);
});

test('lab: the same script deals what the plain calculation deals against a standing target', () => {
  const script = ['aa', 'q', 'aa', 'w'] as const;
  const r = play(scenario({ script: [...script] }));
  const calc = calculate(data, { build: { champion: 'Samira', level: 13, ranks, items: [] }, target: championAsTarget(data.champion('Ornn')!, 13), combo: { sequence: [...script] } });
  const dealt = r.events.reduce((s, e) => s + e.dealt, 0);
  assert.ok(Math.abs(dealt - calc.combo.total.dealt) < 1, `${dealt} vs ${calc.combo.total.dealt}`);
});

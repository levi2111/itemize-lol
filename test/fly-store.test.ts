import { test } from 'node:test';
import assert from 'node:assert/strict';
import { biology as b } from '../src/fly/biology.ts';
import { defaultFlyState, fed, hungerNow, medianReaction, parseFlyState, recordOutcome, sizeLimits } from '../src/fly/store.ts';

void test('the fly\'s saved state parses leniently and keeps what is valid', () => {
  const now = 1_000_000;
  assert.deepEqual(parseFlyState(undefined, now), defaultFlyState(now));
  assert.deepEqual(parseFlyState({ size: 'big', hunger: 7, generation: -2, stats: { escapes: 'many', reactions: 'no' } }, now), { ...defaultFlyState(now), hunger: 1 });
  const kept = parseFlyState({ size: 2.5, hunger: 0.4, hungerAt: now - 10, generation: 4, stats: { escapes: 3, squashes: 1, short: 2, long: 1, reactions: [{ ms: 120, mode: 'short' }, { ms: -1, mode: 'long' }, { ms: 300, mode: 'sideways' }, { ms: 250, mode: 'long' }] } }, now);
  assert.deepEqual(kept, { size: 2.5, hunger: 0.4, hungerAt: now - 10, generation: 4, stats: { escapes: 3, squashes: 1, short: 2, long: 1, reactions: [{ ms: 120, mode: 'short' }, { ms: 250, mode: 'long' }] } });
  // The size stays within real size and 4×; a time in the future is taken as now.
  assert.equal(parseFlyState({ size: 9 }, now).size, sizeLimits.max);
  assert.equal(parseFlyState({ size: 0.2 }, now).size, sizeLimits.min);
  assert.equal(parseFlyState({ hungerAt: now + 5000 }, now).hungerAt, now);
});

void test('hunger rises in real time and feeding lowers it', () => {
  const state = { ...defaultFlyState(0), hunger: 0 };
  const hour = 3_600_000;
  assert.equal(hungerNow(state, 0), 0);
  assert.ok(Math.abs(hungerNow(state, hour) - 1 / b.hungerRise.value) < 1e-9);
  assert.equal(hungerNow(state, 100 * hour), 1);
  const hungry = { ...state, hunger: 1, hungerAt: 0 };
  assert.ok(Math.abs(hungerNow(fed(hungry, b.meal.value * 500, 0), 0) - 0.5) < 1e-9);
  assert.equal(hungerNow(fed(hungry, b.meal.value * 5000, 0), 0), 0);
});

void test('escapes, squashes and reaction times are recorded, and the middle reaction time is read from them', () => {
  let state = defaultFlyState(0);
  state = recordOutcome(state, { kind: 'escape', mode: 'short', reaction: 42.4, duration: 4.3, withoutGiantFibre: false });
  state = recordOutcome(state, { kind: 'escape', mode: 'long', reaction: 190, duration: 12, withoutGiantFibre: false });
  state = recordOutcome(state, { kind: 'escape', mode: 'long', reaction: null, duration: 12, withoutGiantFibre: true });
  state = recordOutcome(state, { kind: 'escape', mode: 'voluntary', reaction: null, duration: 11, withoutGiantFibre: true });
  state = recordOutcome(state, { kind: 'squash', reaction: null });
  assert.deepEqual(state.stats, { escapes: 3, squashes: 1, short: 1, long: 2, reactions: [{ ms: 42, mode: 'short' }, { ms: 190, mode: 'long' }] });
  assert.equal(medianReaction([]), null);
  assert.equal(medianReaction(state.stats.reactions), 116);
  assert.equal(medianReaction([...state.stats.reactions, { ms: 5000, mode: 'long' }]), 190);
});

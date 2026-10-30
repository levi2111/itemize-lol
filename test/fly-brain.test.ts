import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Brain, loadCircuit, random, scrambled, shiuModel, stabilisation, type Circuit } from '../src/fly/brain.ts';
import type { CircuitFile, CircuitGroup } from '../src/fly/circuit.ts';

const file = JSON.parse(readFileSync(new URL('../src/fly/circuit.json', import.meta.url), 'utf8')) as CircuitFile;
const fly = loadCircuit(file);

// A hand-made circuit: neurons 0..n-1, edges as [pre, post, synapses].
function tiny(n: number, edges: [number, number, number][], groups: CircuitGroup[] = []): Circuit {
  const sorted = [...edges].sort((a, b) => a[0] - b[0]);
  const start = Array.from({ length: n + 1 }, (_, i) => sorted.filter(e => e[0] < i).length);
  return loadCircuit({ start, post: sorted.map(e => e[1]), w: sorted.map(e => e[2]), groups });
}
const group = (id: string, neurons: number[]): CircuitGroup => ({ id, side: 'L', role: 'input', label: id, neurons });

// Mean rate of a group's neurons (Hz) and its first spike (ms), over ms of drive on the groups named.
function respond(circuit: Circuit, drive: string[], ms = 300, seed = 1) {
  const brain = new Brain(circuit, seed);
  for (const id of drive) brain.setGroupRate(id, shiuModel.rPoisson);
  const first = new Map<string, number>();
  brain.run(ms, (i, t) => { const k = circuit.groupOf[i]; if (k >= 0 && !first.has(circuit.groups[k].id)) first.set(circuit.groups[k].id, t); });
  const counts = brain.groupCounts();
  const rate = (id: string) => { const k = circuit.groupIndex.get(id)!; return counts[k] / circuit.groups[k].neurons.length / (ms / 1000); };
  return { rate, first: (id: string) => first.get(id) ?? Infinity };
}

void test('one synaptic event raises v as the exact solution of the model says', () => {
  // Neuron 0 is driven; its spike reaches neuron 1 after the delay with 10 synapses' weight.
  const circuit = tiny(2, [[0, 1, 10]], [group('A', [0])]);
  const brain = new Brain(circuit, 1, shiuModel, null);
  brain.stimulate(0, 60); // above threshold: it fires in the first step
  const trace: number[] = [];
  for (let s = 0; s < 400; s++) { brain.tick(); trace.push(brain.v[1]); }
  const { vRest, tauMembrane: tm, tauSynapse: ts, wSyn, delay, dt } = shiuModel;
  const g0 = 10 * wSyn;
  // The spike of step 0 arrives at the start of step delay/dt + 1 and is integrated from there.
  const arrive = Math.round(delay / dt) + 1;
  for (const s of [arrive + 10, arrive + 50, arrive + 150]) {
    const t = (s - arrive + 1) * dt;
    const expected = vRest + g0 * ts / (ts - tm) * (Math.exp(-t / ts) - Math.exp(-t / tm));
    assert.ok(Math.abs(trace[s] - expected) < 1e-4, `step ${s}: ${trace[s]} vs ${expected}`);
  }
  // Nothing before the delay.
  assert.equal(trace[arrive - 2], vRest);
});

void test('a driven neuron fires at its Poisson rate and an undriven one never fires', () => {
  const circuit = tiny(2, [], [group('A', [0])]);
  const brain = new Brain(circuit, 3, shiuModel, null);
  brain.setGroupRate('A', 150);
  brain.run(10_000);
  const counts = brain.groupCounts();
  // 1500 expected; a Poisson count of that size stays well within 6% of it.
  assert.ok(Math.abs(counts[0] - 1500) < 90, `driven neuron fired ${counts[0]} times in 10 s`);
  assert.equal(brain.counts[1], 0);
});

void test('the refractory period caps a neuron with overwhelming input', () => {
  // Neuron 0 drives neuron 1 through 2000 synapses; neuron 1 cannot fire faster than once per 2.2 ms (+ one step).
  const circuit = tiny(2, [[0, 1, 2000]], [group('A', [0]), group('B', [1])]);
  const brain = new Brain(circuit, 1, shiuModel, null);
  brain.setGroupRate('A', 1000);
  brain.run(1000);
  const counts = brain.groupCounts();
  assert.ok(counts[1] <= 1000 / (shiuModel.refractory + shiuModel.dt) + 1, `${counts[1]} spikes`);
  assert.ok(counts[1] > 200);
});

void test('the same seed gives the same spikes, another seed other ones', () => {
  const spikes = (seed: number) => { const brain = new Brain(fly, seed); brain.setGroupRate('LPLC2_L', 80); const out: number[] = []; brain.run(100, (i, t) => out.push(i, t)); return out.join(','); };
  assert.equal(spikes(5), spikes(5));
  assert.notEqual(spikes(5), spikes(6));
  const a = random(9), b = random(9);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

void test('a brain at rest skips its steps and ends in the same state as stepping through them', () => {
  // A burst of looming, quiet until everything has settled, then looming again: run() skips the quiet steps, tick() does not.
  const spikes = (skip: boolean) => {
    const brain = new Brain(fly, 3); const out: number[] = [];
    const run = (ms: number) => { if (skip) brain.run(ms, (i, t) => out.push(i, t)); else for (let s = 0; s < Math.round(ms / brain.model.dt); s++) { brain.tick(); for (const i of brain.lastSpikes()) out.push(i, (brain.step - 1) * brain.model.dt); } };
    brain.setGroupRate('LPLC2_L', 80); run(50); brain.setGroupRate('LPLC2_L', 0); run(2000); brain.setGroupRate('LPLC2_L', 80); run(50);
    return { spikes: out.join(','), step: brain.step, resting: brain.activeNeurons };
  };
  const skipped = spikes(true), stepped = spikes(false);
  assert.equal(skipped.step, stepped.step);
  assert.ok(skipped.spikes.length > 0);
  assert.equal(skipped.spikes, stepped.spikes);
});

void test('looming input on LC4 and LPLC2 makes the giant fibre fire', () => {
  const quiet = respond(fly, []);
  assert.equal(quiet.rate('DNp01_L'), 0);
  const left = respond(fly, ['LC4_L', 'LPLC2_L']);
  assert.ok(left.rate('DNp01_L') > 100, `DNp01_L ${left.rate('DNp01_L')} Hz`);
  assert.ok(left.first('DNp01_L') < 15, `first spike at ${left.first('DNp01_L')} ms`);
  // The wing-raise neurons answer too, and the steering neuron of the far side: a turn away.
  assert.ok(left.rate('DNp04_L') > 100);
  assert.ok(left.rate('DNa01_R') > left.rate('DNa01_L') + 20);
  // Each looming detector alone drives it as well.
  assert.ok(respond(fly, ['LPLC2_R']).rate('DNp01_R') > 50);
  assert.ok(respond(fly, ['LC4_R']).rate('DNp01_R') > 50);
});

void test('sugar input drives MN9, and bitter input holds it back', () => {
  const sugar = respond(fly, ['Sugar_L', 'Sugar_R']);
  assert.ok(sugar.rate('MN9_L') > 50 && sugar.rate('MN9_R') > 50, `MN9 ${sugar.rate('MN9_L')} and ${sugar.rate('MN9_R')} Hz`);
  const both = respond(fly, ['Sugar_L', 'Sugar_R', 'Bitter_L', 'Bitter_R']);
  assert.ok(both.rate('MN9_L') < sugar.rate('MN9_L') / 2);
  assert.equal(respond(fly, ['Bitter_L', 'Bitter_R']).rate('MN9_L'), 0);
  // Looming does not reach MN9, and sugar does not reach the giant fibre.
  assert.equal(respond(fly, ['LC4_L', 'LPLC2_L']).rate('MN9_L'), 0);
  assert.equal(sugar.rate('DNp01_L'), 0);
});

void test('the other senses reach their outputs: dust the grooming neurons, a small object the steering neurons', () => {
  assert.ok(respond(fly, ['JOCE_L', 'JOCE_R']).rate('DNg11_R') > 5);
  const object = respond(fly, ['LC10a_L']);
  assert.ok(object.rate('DNa02_L') > 100 && object.rate('DNa02_R') === 0);
  assert.ok(respond(fly, ['JO_L', 'JO_R']).rate('DNp01_R') > 20);
  assert.ok(respond(fly, ['DM1_L', 'VA2_L']).rate('PN-DM1_L') > 100);
});

void test('scrambled wiring that keeps every neuron\'s connection counts loses the responses', t => {
  // Every neuron keeps its outgoing synapses and the number of its incoming ones.
  const s = scrambled(fly, 1);
  const outdegree = (c: Circuit) => Array.from({ length: c.n }, (_, i) => c.start[i + 1] - c.start[i]);
  const indegree = (c: Circuit) => { const d = Array.from({ length: c.n }, () => 0); for (const j of c.post) d[j]++; return d; };
  assert.deepEqual(outdegree(s), outdegree(fly));
  assert.deepEqual(indegree(s), indegree(fly));
  assert.notDeepEqual(Array.from(s.post), Array.from(fly.post));

  const real = { loom: respond(fly, ['LC4_L', 'LPLC2_L']), sugar: respond(fly, ['Sugar_L', 'Sugar_R']) };
  const seeds = [1, 2, 3, 4, 5].map(seed => { const c = scrambled(fly, seed); return { loom: respond(c, ['LC4_L', 'LPLC2_L']), sugar: respond(c, ['Sugar_L', 'Sugar_R']) }; });
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const gf = (r: ReturnType<typeof respond>) => (r.rate('DNp01_L') + r.rate('DNp01_R')) / 2;
  const mn9 = (r: ReturnType<typeof respond>) => (r.rate('MN9_L') + r.rate('MN9_R')) / 2;
  t.diagnostic(`giant fibre to looming: real ${gf(real.loom).toFixed(0)} Hz, scrambled ${seeds.map(r => gf(r.loom).toFixed(0)).join(', ')} Hz`);
  t.diagnostic(`first giant fibre spike: real ${real.loom.first('DNp01_L').toFixed(1)} ms, scrambled ${seeds.map(r => Math.min(r.loom.first('DNp01_L'), r.loom.first('DNp01_R')).toFixed(1)).join(', ')} ms`);
  t.diagnostic(`MN9 to sugar: real ${mn9(real.sugar).toFixed(0)} Hz, scrambled ${seeds.map(r => mn9(r.sugar).toFixed(0)).join(', ')} Hz`);
  t.diagnostic(`MN9 to looming: real ${mn9(real.loom).toFixed(0)} Hz, scrambled ${seeds.map(r => mn9(r.loom).toFixed(0)).join(', ')} Hz`);
  // Sugar no longer reaches MN9: in most of them not at all, and on average at a fraction of the real rate.
  assert.ok(seeds.filter(r => mn9(r.sugar) < 5).length >= 3);
  assert.ok(mean(seeds.map(r => mn9(r.sugar))) < 0.25 * mn9(real.sugar));
  // The giant fibre is a hub of about 300 inputs, a degree-preserving shuffle keeps it one, and the looming neurons send a
  // quarter of all connections, so looming still reaches it; but more weakly, later, and no longer alone: looming now
  // drives MN9 too.
  assert.ok(mean(seeds.map(r => gf(r.loom))) < 0.6 * gf(real.loom));
  for (const r of seeds) assert.ok(Math.min(r.loom.first('DNp01_L'), r.loom.first('DNp01_R')) > real.loom.first('DNp01_L'));
  assert.equal(mn9(real.loom), 0);
  assert.ok(mean(seeds.map(r => mn9(r.loom))) > 5);
});

void test('without stabilisation smell input runs away; synaptic fatigue ends it and keeps the early responses', () => {
  const smell = ['DM1_L', 'VA2_L', 'DM1_R', 'VA2_R'];
  const after = (fatigue: typeof stabilisation | null) => {
    const brain = new Brain(fly, 2, shiuModel, fatigue);
    for (const id of smell) brain.setGroupRate(id, 150);
    brain.run(500);
    for (const id of smell) brain.setGroupRate(id, 0);
    brain.run(2500);
    let late = 0; brain.run(1000, () => { late++; });
    return late;
  };
  // Shiu et al.'s model alone: antennal lobe neurons keep each other firing with no input at all.
  assert.ok(after(null) > 10_000);
  assert.equal(after(stabilisation), 0);
  // The first 300 ms with and without it.
  const early = (fatigue: typeof stabilisation | null, drive: string[], id: string) => {
    const brain = new Brain(fly, 1, shiuModel, fatigue); for (const g of drive) brain.setGroupRate(g, 150); brain.run(300);
    return brain.groupCounts()[fly.groupIndex.get(id)!];
  };
  for (const [drive, id] of [[['LC4_L', 'LPLC2_L'], 'DNp01_L'], [['Sugar_L', 'Sugar_R'], 'MN9_L'], [['JOCE_L', 'JOCE_R'], 'DNg11_R']] as const) {
    const without = early(null, [...drive], id); const withIt = early(stabilisation, [...drive], id);
    assert.ok(withIt >= 0.75 * without, `${id}: ${withIt} spikes with fatigue, ${without} without`);
  }
});

void test('simulation speed, in milliseconds per simulated second', t => {
  const measure = (drive: string[]) => {
    const brain = new Brain(fly, 4); for (const id of drive) brain.setGroupRate(id, 150);
    brain.run(200); const started = performance.now(); brain.run(1000); return performance.now() - started;
  };
  const idle = measure([]); const looming = measure(['LC4_L', 'LPLC2_L', 'LC4_R', 'LPLC2_R']); const sugar = measure(['Sugar_L', 'Sugar_R']);
  t.diagnostic(`idle ${idle.toFixed(1)} ms, sugar ${sugar.toFixed(1)} ms, looming on both eyes ${looming.toFixed(1)} ms per simulated second`);
  // Real time is 1000 ms per simulated second; the bound only catches a large slowdown on a slow machine.
  assert.ok(looming < 3000);
});

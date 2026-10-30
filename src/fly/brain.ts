import type { CircuitFile } from './circuit.ts';

// The fly's brain (docs/fly.md): the leaky integrate-and-fire model of Shiu et al. 2024 on the circuit of
// src/fly/circuit.json. Pure and deterministic: a seeded random generator, weights in compressed rows, one fixed time step.
// It knows nothing of the window; src/fly/worker.ts runs it and src/fly/senses.ts says what drives it.

// model.py's default_params, github.com/philshiu/Drosophila_brain_model at commit 91bdd1e (2024-09-14), with the sources
// it names. model.py sets no time step, so Brian 2's default clock of 0.1 ms applies.
export const shiuModel = {
  vRest: -52, // mV, v_0 (Kakaria and de Bivort 2017)
  vReset: -52, // mV, v_rst
  vThreshold: -45, // mV, v_th
  tauMembrane: 20, // ms, t_mbr
  tauSynapse: 5, // ms, tau (Jürgensen et al. 2021)
  refractory: 2.2, // ms, t_rfc (Lazar et al. 2021)
  delay: 1.8, // ms, t_dly (Paul et al. 2015)
  wSyn: 0.275, // mV per synapse, w_syn (the model's one free parameter)
  rPoisson: 150, // Hz, r_poi: the rate of an activated neuron's Poisson input
  fPoisson: 250, // f_poi: a Poisson event adds w_syn × f_poi to v, enough for a spike
  dt: 0.1, // ms, Brian 2's defaultclock.dt
} as const;

// A circuit ready to run: neuron i's synapses go to post[start[i]..start[i+1]) with weight in mV.
export type Circuit = {
  n: number;
  start: Int32Array;
  post: Int32Array;
  weight: Float32Array;
  groups: CircuitFile['groups'];
  groupIndex: Map<string, number>;
  // The group each neuron belongs to, -1 for an interneuron.
  groupOf: Int16Array;
};

export function loadCircuit(file: Pick<CircuitFile, 'start' | 'post' | 'w' | 'groups'>): Circuit {
  const n = file.start.length - 1;
  const groupOf = new Int16Array(n).fill(-1);
  file.groups.forEach((g, k) => { for (const i of g.neurons) groupOf[i] = k; });
  return {
    n, start: Int32Array.from(file.start), post: Int32Array.from(file.post), weight: Float32Array.from(file.w, w => w * shiuModel.wSyn),
    groups: file.groups, groupIndex: new Map(file.groups.map((g, k) => [g.id, k])), groupOf,
  };
}

// mulberry32: small, fast and the same on every machine for a seed.
export function random(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// A fixed shuffle of a group's neurons for a seed.
function shuffled(neurons: number[], seed: number) {
  const next = random(seed); const out = [...neurons];
  for (let i = out.length - 1; i > 0; i--) { const k = Math.floor(next() * (i + 1)); [out[i], out[k]] = [out[k], out[i]]; }
  return out;
}

// The same circuit with its wiring scrambled: every neuron keeps its outgoing synapses (their number and weights) and
// every neuron keeps the number of incoming connections, but which neuron connects to which is shuffled. A shuffle of
// the targets of all edges keeps both degree sequences; self-connections it makes are swapped away where possible.
export function scrambled(circuit: Circuit, seed: number): Circuit {
  const next = random(seed); const post = Int32Array.from(circuit.post); const m = post.length;
  for (let e = m - 1; e > 0; e--) { const k = Math.floor(next() * (e + 1)); const t = post[e]; post[e] = post[k]; post[k] = t; }
  const preOf = new Int32Array(m);
  for (let i = 0; i < circuit.n; i++) for (let e = circuit.start[i]; e < circuit.start[i + 1]; e++) preOf[e] = i;
  for (let e = 0; e < m; e++) {
    if (post[e] !== preOf[e]) continue;
    for (let tries = 0; tries < 20; tries++) { const k = Math.floor(next() * m); if (post[k] !== preOf[e] && post[e] !== preOf[k]) { const t = post[e]; post[e] = post[k]; post[k] = t; break; } }
  }
  return { ...circuit, post };
}

// The state of every neuron and the spikes still on their way. Brian 2's schedule runs each step as integrate, threshold,
// deliver synaptic events and Poisson input, reset; here a step delivers the previous step's events and Poisson input
// first, then integrates, thresholds and resets, which is the same sequence with the step boundary moved. Events and input
// that reach a neuron in the step it fired are lost to its reset, as in Brian 2.
//
// The model has no activity of its own, so most neurons sit at rest most of the time. A step visits only the active ones:
// a neuron becomes active when an event or Poisson input reaches it, and rests again, set exactly to rest, once it is not
// refractory and both v - v0 and g are within 1e-3 mV of zero. The threshold is 7 mV away, so this changes no spike. Not
// less: v is a 32-bit float, and near -52 mV a step's decay of an offset under about 4e-4 mV is less than half its
// precision, so the offset rounds back to itself and would never decay further.
export const restEpsilon = 1e-3;
// Stabilisation, added because the circuit runs away (docs/fly.md, "The brain"): after vinegar input, about 90 antennal
// lobe neurons excite each other and keep firing near 350 Hz with no input at all. Shiu et al.'s model has no mechanism
// that ends such activity; this synaptic fatigue (short-term depression, as in Tsodyks and Markram 1997) ends it within
// about 2 s. Both numbers are assumed: the gentlest pair found that ends it, which keeps the first 300 ms of every response
// within about 15% of the model without it and lets sustained responses fade over seconds.
export const stabilisation = { use: 0.003, recovery: 10_000 };
export class Brain {
  readonly circuit: Circuit;
  readonly model: typeof shiuModel;
  readonly v: Float32Array;
  readonly g: Float32Array;
  // Poisson input rate per neuron, Hz; 0 for a neuron the senses do not drive.
  readonly rate: Float32Array;
  // Whether each neuron fired in the last step, and how often each has fired since the counts were last read.
  readonly spiked: Uint8Array;
  readonly counts: Uint16Array;
  step = 0;
  private readonly refractoryUntil: Int32Array;
  // Synaptic events on their way: slot s holds what arrives at the start of a step, and touched[s] which neurons it holds.
  private readonly ring: Float32Array;
  private readonly touched: Int32Array[];
  private readonly touchedCount: Int32Array;
  private readonly stamp: Int32Array;
  private readonly slots: number;
  private readonly delaySteps: number;
  private readonly refractorySteps: number;
  private readonly decayV: number;
  private readonly decayG: number;
  private readonly coupling: number;
  private readonly kick: number;
  private readonly next: () => number;
  private readonly firing: Int32Array;
  private fired = 0;
  private readonly active: Int32Array;
  private readonly isActive: Uint8Array;
  private activeCount = 0;
  // Neurons with Poisson input, kept as a list so a step only visits them.
  private driven: Int32Array = new Int32Array(0);

  // Synaptic fatigue: each neuron's synapses deliver weight × x, and every spike uses a fraction use of x, which recovers
  // towards 1 with time constant recovery (ms). See stabilisation below.
  private readonly fatigue: { use: number; recovery: number } | null;
  private readonly resource: Float32Array;
  private readonly lastSpike: Int32Array;

  constructor(circuit: Circuit, seed = 1, model = shiuModel, fatigue: { use: number; recovery: number } | null = stabilisation) {
    const { n } = circuit;
    this.fatigue = fatigue;
    this.resource = new Float32Array(n).fill(1);
    this.lastSpike = new Int32Array(n).fill(-1);
    this.circuit = circuit;
    this.model = model;
    this.v = new Float32Array(n).fill(model.vRest);
    this.g = new Float32Array(n);
    this.rate = new Float32Array(n);
    this.spiked = new Uint8Array(n);
    this.counts = new Uint16Array(n);
    this.refractoryUntil = new Int32Array(n).fill(-1);
    this.delaySteps = Math.round(model.delay / model.dt);
    // A spike of step k is written into slot k + delay and read at the start of step k + delay + 1, after that step has
    // cleared the slot it reads, so delay + 1 slots are enough.
    this.slots = this.delaySteps + 1;
    this.ring = new Float32Array(n * this.slots);
    this.touched = Array.from({ length: this.slots }, () => new Int32Array(n));
    this.touchedCount = new Int32Array(this.slots);
    this.stamp = new Int32Array(n).fill(-1);
    this.refractorySteps = Math.round(model.refractory / model.dt);
    // Exact integration of dv/dt = (v0 - v + g) / t_mbr, dg/dt = -g / tau over one step (Brian 2's 'linear' method).
    this.decayV = Math.exp(-model.dt / model.tauMembrane);
    this.decayG = Math.exp(-model.dt / model.tauSynapse);
    this.coupling = model.tauSynapse / (model.tauSynapse - model.tauMembrane) * (this.decayG - this.decayV);
    this.kick = model.wSyn * model.fPoisson;
    this.next = random(seed);
    this.firing = new Int32Array(n);
    this.active = new Int32Array(n);
    this.isActive = new Uint8Array(n);
  }

  private refreshDriven() {
    const list: number[] = []; for (let i = 0; i < this.rate.length; i++) if (this.rate[i] > 0) list.push(i);
    this.driven = Int32Array.from(list);
  }
  // Poisson input for some neurons; a driven neuron has no refractory period, as in model.py's poi().
  setRates(neurons: Iterable<number>, hz: number) {
    const r = Math.max(0, Math.min(1000, hz || 0)); let changed = false;
    for (const i of neurons) if (this.rate[i] !== r) { this.rate[i] = r; changed = true; }
    if (changed) this.refreshDriven();
  }
  // Poisson input for a group, to the first share of its neurons in a fixed order: a stimulus covering part of an eye drives
  // the part of a retinotopic population whose receptive fields it covers.
  setGroupRate(group: string, hz: number, share = 1) {
    const k = this.circuit.groupIndex.get(group);
    if (k === undefined) return;
    const order = this.orders[k] ??= shuffled(this.circuit.groups[k].neurons, k + 1);
    const active = hz > 0 ? Math.max(1, Math.min(order.length, Math.ceil(order.length * Math.max(0, Math.min(1, share))))) : 0;
    let changed = false;
    order.forEach((i, rank) => { const r = rank < active ? Math.max(0, Math.min(1000, hz || 0)) : 0; if (this.rate[i] !== r) { this.rate[i] = r; changed = true; } });
    if (changed) this.refreshDriven();
  }
  private readonly orders: number[][] = [];
  // Adds mV to a neuron's v now, as a Poisson event does; used by the tests.
  stimulate(neuron: number, mV: number) { this.v[neuron] += mV; this.wake(neuron); }
  // How many neurons the last step visited.
  get activeNeurons() { return this.activeCount; }

  private wake(i: number) { if (!this.isActive[i]) { this.isActive[i] = 1; this.active[this.activeCount++] = i; } }

  // One time step; returns how many neurons fired.
  tick() {
    const { v, g, ring, spiked, counts, refractoryUntil, rate, firing, driven, active, isActive } = this;
    const { vRest, vReset, vThreshold, dt } = this.model;
    const decayV = this.decayV, decayG = this.decayG, coupling = this.coupling, kick = this.kick;
    const n = this.circuit.n; const step = this.step; const slots = this.slots;
    // Poisson input of the previous step: an event with probability rate × dt, lost if the neuron fired then.
    const p = dt / 1000;
    for (let d = 0; d < driven.length; d++) { const i = driven[d]; if (this.next() < rate[i] * p && !spiked[i]) { v[i] += kick; this.wake(i); } }
    // Synaptic events that arrived in the previous step.
    const readSlot = (step + slots - 1) % slots; const read = readSlot * n; const arrivals = this.touched[readSlot];
    for (let k = 0, m = this.touchedCount[readSlot]; k < m; k++) {
      const i = arrivals[k]; const value = ring[read + i]; ring[read + i] = 0;
      if (!spiked[i] && value !== 0) { g[i] += value; this.wake(i); }
    }
    this.touchedCount[readSlot] = 0;
    for (let f = 0; f < this.fired; f++) spiked[firing[f]] = 0;
    let fired = 0; let kept = 0;
    const holdUntil = this.refractorySteps > 0 ? step + this.refractorySteps - 1 : step;
    for (let k = 0, m = this.activeCount; k < m; k++) {
      const i = active[k];
      // A refractory neuron holds its v and g, as Brian 2's "(unless refractory)" does, and cannot fire.
      if (refractoryUntil[i] >= step) { active[kept++] = i; continue; }
      const gi = g[i];
      const vi = vRest + (v[i] - vRest) * decayV + gi * coupling;
      const gNext = gi * decayG;
      if (vi > vThreshold) {
        spiked[i] = 1; firing[fired++] = i; if (counts[i] < 65535) counts[i]++;
        refractoryUntil[i] = rate[i] > 0 ? step : holdUntil;
        v[i] = vReset; g[i] = 0;
        active[kept++] = i;
      } else if (Math.abs(vi - vRest) < restEpsilon && Math.abs(gNext) < restEpsilon) { v[i] = vRest; g[i] = 0; isActive[i] = 0; }
      else { v[i] = vi; g[i] = gNext; active[kept++] = i; }
    }
    this.activeCount = kept;
    // This step's spikes arrive after the delay.
    const writeSlot = (step + this.delaySteps) % slots; const write = writeSlot * n; const list = this.touched[writeSlot];
    let count = this.touchedCount[writeSlot]; const stamp = this.stamp; const mark = step;
    const { start, post, weight } = this.circuit;
    const fatigue = this.fatigue; const resource = this.resource;
    for (let f = 0; f < fired; f++) {
      const i = firing[f];
      let scale = 1;
      if (fatigue) {
        const last = this.lastSpike[i];
        const x = last < 0 ? 1 : 1 - (1 - resource[i]) * Math.exp(-(step - last) * dt / fatigue.recovery);
        scale = x; resource[i] = x * (1 - fatigue.use); this.lastSpike[i] = step;
      }
      for (let e = start[i], end = start[i + 1]; e < end; e++) { const j = post[e]; ring[write + j] += weight[e] * scale; if (stamp[j] !== mark) { stamp[j] = mark; list[count++] = j; } }
    }
    this.touchedCount[writeSlot] = count;
    this.fired = fired;
    this.step = step + 1;
    return fired;
  }

  // The neurons that fired in the last step.
  lastSpikes() { return this.firing.subarray(0, this.fired); }

  // Whether every neuron is at rest with no input and no spike on its way: then a step changes nothing but the time.
  private resting() {
    if (this.activeCount || this.driven.length || this.fired) return false;
    for (let s = 0; s < this.slots; s++) if (this.touchedCount[s]) return false;
    return true;
  }

  // Runs ms of simulated time and calls back with each spike's neuron and time (ms since the brain started). A brain at
  // rest skips the remaining steps, which gives the same state as running them.
  run(ms: number, onSpike?: (neuron: number, t: number) => void) {
    const steps = Math.round(ms / this.model.dt);
    for (let s = 0; s < steps; s++) {
      if (this.resting()) { this.step += steps - s; return; }
      const fired = this.tick();
      if (onSpike && fired) for (let f = 0; f < fired; f++) onSpike(this.firing[f], (this.step - 1) * this.model.dt);
    }
  }

  // Simulated time, ms.
  get time() { return this.step * this.model.dt; }

  // Spike counts per group since the last call, and the counts cleared.
  groupCounts() {
    const out = new Uint32Array(this.circuit.groups.length);
    for (let i = 0; i < this.circuit.n; i++) { const k = this.circuit.groupOf[i]; if (k >= 0) out[k] += this.counts[i]; }
    this.counts.fill(0);
    return out;
  }
}

// One frame of the brain for the page: spike counts per group over dt simulated ms ending at t, and the output and relay
// groups' spikes with their times (the motor layer reads escape timing from them).
export type BrainFrame = { t: number; dt: number; counts: ArrayLike<number>; events: { group: number; t: number }[] };

export function advance(brain: Brain, ms: number): BrainFrame {
  const { circuit } = brain; const events: BrainFrame['events'] = [];
  const watched = circuit.groups.map(g => g.role !== 'input');
  const before = brain.time;
  brain.run(ms, (i, t) => {
    const k = circuit.groupOf[i];
    if (k >= 0 && watched[k]) events.push({ group: k, t });
  });
  return { t: brain.time, dt: brain.time - before, counts: brain.groupCounts(), events };
}

/* The fly's brain in its own thread (docs/fly.md): Shiu et al.'s model on the circuit, stepped in real time about 120 times a
   second while the page says to run, each frame's spikes posted back. A step catches up at most 50 ms, so a busy or suspended
   thread slows the brain down rather than racing it. The circuit is read from beside this module; nothing the page says before
   'ready' is heard, and the page says it again then. */
import { Brain, advance, loadCircuit, scrambled, type Circuit } from './brain.ts';
import type { CircuitFile } from './circuit.ts';
import type { FromBrain, ToBrain } from './protocol.ts';

// the worker's own scope, without the DOM's types in the build
const scope = globalThis as unknown as { onmessage: ((e: { data: ToBrain }) => void) | null; postMessage(m: FromBrain, transfer?: ArrayBuffer[]): void };

const response = await fetch(new URL('./circuit.json', import.meta.url));
if (!response.ok) throw new Error(`could not load the circuit (${response.status})`);
const data = await response.json() as CircuitFile;
const real = loadCircuit(data);
const seed = 1;
let circuit: Circuit = real;
let brain = new Brain(circuit, seed);
let drive: Extract<ToBrain, { type: 'drive' }> = { type: 'drive', rates: {}, shares: {} };
let timer: ReturnType<typeof setInterval> | undefined;
let last = 0;

const apply = () => { for (const g of circuit.groups) brain.setGroupRate(g.id, drive.rates[g.id] ?? 0, drive.shares[g.id] ?? 1); };

function tick() {
  const now = performance.now();
  const ms = Math.min(50, now - last); last = now;
  if (ms < brain.model.dt) return;
  const frame = advance(brain, ms);
  const events = new Float64Array(frame.events.length * 2);
  frame.events.forEach((e, k) => { events[2 * k] = e.group; events[2 * k + 1] = e.t; });
  const counts = Uint16Array.from(frame.counts as ArrayLike<number>, c => Math.min(65535, c));
  scope.postMessage({ type: 'frame', t: frame.t, dt: frame.dt, counts, events }, [counts.buffer, events.buffer]);
}

scope.onmessage = ({ data: message }) => {
  // New input is stepped at once rather than at the next tick, which on Windows can be 16 ms away.
  if (message.type === 'drive') { drive = message; apply(); if (timer) tick(); }
  else if (message.type === 'run') {
    if (message.on && !timer) { last = performance.now(); timer = setInterval(tick, 8); }
    else if (!message.on && timer) { clearInterval(timer); timer = undefined; }
  } else if (message.type === 'scramble') {
    circuit = message.on ? scrambled(real, 7) : real;
    brain = new Brain(circuit, seed); apply();
  }
};
scope.postMessage({ type: 'ready', groups: data.groups });

import type { CircuitGroup } from './circuit.ts';

// What the page and the brain's worker (src/fly/worker.ts) say to each other (docs/fly.md). Plain data only; the worker never
// touches the page.

export type ToBrain =
  // Poisson input per group (Hz) and the share of each group's neurons it reaches; groups left out get none.
  | { type: 'drive'; rates: Record<string, number>; shares: Record<string, number> }
  // Paused while the page is hidden.
  | { type: 'run'; on: boolean }
  | { type: 'scramble'; on: boolean };

// A frame: dt simulated ms ending at t; counts per group; output and relay spikes as [group, time] pairs.
export type BrainFrameMessage = { type: 'frame'; t: number; dt: number; counts: Uint16Array; events: Float64Array };
export type FromBrain =
  | { type: 'ready'; groups: CircuitGroup[] }
  | BrainFrameMessage;

// The fly's circuit (docs/fly.md): real FlyWire v783 neurons and their synapse counts. Only the brain's worker reads the file.

export type Side = 'L' | 'R' | 'C';
// Inputs are what the senses drive, outputs what the motor layer reads; relays are read by the motor layer too but sit one
// synapse in (the smell projection neurons).
export type Role = 'input' | 'output' | 'relay';
export type CircuitGroup = { id: string; side: Side; role: Role; label: string; neurons: number[] };
// src/fly/circuit.json. Neurons are numbered 0..n-1: the groups' neurons first, in the order of the groups, then the
// interneurons. Edges are compressed rows by presynaptic neuron: neuron i's synapses go to post[start[i]..start[i+1]) with
// signed counts w.
export type CircuitFile = {
  version: 1;
  source: Record<string, string>;
  groups: CircuitGroup[];
  start: number[];
  post: number[];
  w: number[];
};

import { Body, type Terrain } from './body.ts';
import type { BrainFrame, Circuit } from './brain.ts';
import { biology as b, pxToMm } from './biology.ts';
import { Motor, type Command, type TakeoffMode } from './motor.ts';
import { Senses, visualGroups, type Point, type Reading, type World } from './senses.ts';

// One fly's loop (docs/fly.md): the senses turn the window into input rates, the brain (in a worker, or in the tests
// in-process) answers with spikes, the motor layer turns them into a command and the body moves. The overlay runs it
// once a frame; the tests run the same loop against an in-process brain.

export type Outcome = { kind: 'escape'; mode: TakeoffMode; reaction: number | null; duration: number; withoutGiantFibre: boolean } | { kind: 'squash'; reaction: null };
export type Swat = Point & { start: number; radius: number };

export class FlyLoop {
  readonly senses = new Senses();
  readonly motor: Motor;
  body: Body;
  reading: Reading | null = null;
  command: Command | null = null;
  // Page time (ms) when the current looming began, for reaction times.
  private loomOnset: number | null = null;
  private lastOnset = -Infinity;
  // Recent readings, so the eyes' input reaches the brain after the visual delay.
  private history: { t: number; drive: Record<string, number>; share: Record<string, number> }[] = [];
  // How long ago the takeoff this frame's command carries happened, so the jump starts then.
  private lead = 0;
  // Input rates and shares sent to the brain this frame: the eyes' from the visual delay ago, the other senses' now.
  share: Record<string, number> = {};

  private readonly onOutcome: (outcome: Outcome) => void;

  constructor(circuit: Pick<Circuit, 'groups'>, body: Body, random: () => number, onOutcome: (outcome: Outcome) => void = () => {}) {
    this.onOutcome = onOutcome;
    this.motor = new Motor(circuit.groups, random);
    this.body = body;
  }

  // The senses at page time now; returns the input rates for the brain (and sets share), the eyes' delayed.
  sense(dtMs: number, now: number, world: World) {
    const pose = { x: this.body.x, y: this.body.y, heading: this.body.heading, altitude: this.body.altitude };
    const reading = this.reading = this.senses.update(dtMs, pose, world);
    if (reading.loom.onset) { this.loomOnset = now; this.lastOnset = now; }
    this.history.push({ t: now, drive: reading.drive, share: reading.share });
    const due = now - b.visualDelay.value;
    while (this.history.length > 1 && this.history[1].t <= due) this.history.shift();
    const seen = this.history[0].t <= due ? this.history[0] : null;
    const visual = (group: string) => visualGroups.includes(group.replace(/_[LR]$/, ''));
    const drive: Record<string, number> = {}; const share: Record<string, number> = {};
    for (const [group, rate] of Object.entries(reading.drive)) if (!visual(group)) drive[group] = rate;
    if (seen) for (const [group, rate] of Object.entries(seen.drive)) if (visual(group)) { drive[group] = rate; if (group in seen.share) share[group] = seen.share[group]; }
    this.share = share;
    return drive;
  }

  // A frame of the brain, received at page time now.
  think(frame: BrainFrame, now: number) {
    if (!this.reading) return null;
    const body = this.body;
    const command = this.motor.update(frame, this.reading, { airborne: body.airborne, dead: body.dead, heading: body.heading, position: { x: body.x, y: body.y } });
    // Several frames can arrive before the body moves; a takeoff not yet carried out stands, told once, and the motor
    // layer's view of a fly still on the ground does not take off again.
    if (this.command?.takeoff) return this.command;
    this.command = command;
    const takeoff = this.command.takeoff;
    if (takeoff && takeoff.mode !== 'voluntary') {
      this.senses.escaped();
      // The takeoff in page time: the frame ends at now, its spikes are earlier by (frame.t - takeoff.at).
      const at = now - (frame.t - takeoff.at);
      this.lead = Math.max(0, Math.min(100, now - at));
      const reaction = this.loomOnset !== null && at - this.lastOnset < 5000 ? at - this.loomOnset : null;
      this.onOutcome({ kind: 'escape', mode: takeoff.mode, reaction, duration: takeoff.duration, withoutGiantFibre: takeoff.withoutGiantFibre });
      this.loomOnset = null;
    }
    return this.command;
  }

  move(dtMs: number, now: number, terrain: Terrain) {
    if (this.command) this.body.step(dtMs, now, this.command, terrain, this.command.takeoff ? this.lead : 0);
    // A takeoff is told once.
    if (this.command?.takeoff) { this.command = { ...this.command, takeoff: null, flyTo: null }; this.lead = 0; }
  }

  // A swat in progress, checked once a frame after the body moved: the hand comes down over the descent time, and the
  // fly is squashed if it is within the swat's radius at the moment the hand reaches its height. That moment usually
  // falls between frames, so the body's position and height are interpolated from the last frame's.
  strike(swat: Swat, now: number) {
    const body = this.body; if (body.dead) return false;
    const last = this.sample && this.sample.t >= swat.start && this.sample.t < now ? this.sample : { t: Math.max(swat.start, now - 1), x: body.x, y: body.y, altitude: body.altitude };
    this.sample = { t: now, x: body.x, y: body.y, altitude: body.altitude };
    // gap(t) = hand height - fly height, linear in between: find where it reaches zero.
    const gap0 = handHeight(swat, last.t) - last.altitude; const gap1 = handHeight(swat, now) - body.altitude;
    if (gap1 > 0) return false;
    const f = gap0 > 0 ? gap0 / (gap0 - gap1) : 0;
    const x = last.x + (body.x - last.x) * f; const y = last.y + (body.y - last.y) * f;
    if (Math.hypot(x - swat.x, y - swat.y) > swat.radius) return false;
    body.squash(); body.x = x; body.y = y;
    this.onOutcome({ kind: 'squash', reaction: null });
    return true;
  }
  private sample: { t: number; x: number; y: number; altitude: number } | null = null;
}

// The hand's height during a swat: from hovering to the screen over the descent time, at a steady speed.
export function handHeight(swat: { start: number }, now: number) {
  return b.handHeight.value * Math.max(0, 1 - (now - swat.start) / b.swatDescent.value);
}

// The fly's hit radius in px: a press this close starts a swat. It grows with the size multiplier, as the body does.
export function hitRadius(size: number) {
  return Math.max(10, 1.5 * b.bodyLength.value * b.pxPerMm.value) * size;
}
// How far from the press a swat squashes: under the palm, and never less than the hit radius.
export function swatRadius(size: number) {
  return Math.max(b.palm.value * b.pxPerMm.value, hitRadius(size));
}

export const mmBetween = (a: Point, c: Point) => pxToMm(Math.hypot(a.x - c.x, a.y - c.y));

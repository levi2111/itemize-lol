import { biology as b, deg, mmToPx, pxToMm } from './biology.ts';
import type { Command } from './motor.ts';
import { wrap, type Point } from './senses.ts';

// The fly's body (docs/fly.md, "Behaviour and body"): where it is and how it moves, on the screen and in the air. The
// flight and the gait are written by hand from the measured numbers in biology.ts. Positions are CSS px, speeds mm/s at
// real size; size scales the body and its reach for walls, never the biology. Angles are screen angles (y down).

export type Rect = { left: number; top: number; right: number; bottom: number };
// The window (its size) and the panels the fly walks along and lands on. top is the window's top wall: below a title bar
// that drags the window, where a press never reaches the page, so a fly there could not be swatted.
export type Terrain = { width: number; height: number; panels: Rect[]; top?: number };
export type Mode = 'ground' | 'air' | 'dead';
// What the drawing needs.
export type BodyPose = Point & {
  heading: number; altitude: number; mode: Mode; wings: number; beating: boolean; gait: number; moving: boolean;
  proboscis: number; groom: 'front' | 'hind' | null; groomPhase: number; lean: number; leanToward: number; speed: number;
};

type Saccade = { from: number; to: number; start: number; duration: number };
type Air = { vx: number; vy: number; climb: number; climbUntil: number; until: number; fast: number; target: Point | null; saccade: Saccade | null; nextSaccade: number; tumbleUntil: number; arriving: boolean; landing: boolean };
const expDraw = (mean: number, random: () => number) => -Math.log(1 - random() * 0.999) * mean;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class Body {
  x: number;
  y: number;
  heading: number;
  altitude = 0;
  mode: Mode = 'ground';
  speed = 0; // mm/s, signed
  gait = 0;
  wings = 0;
  proboscis = 0;
  groom: 'front' | 'hind' | null = null;
  groomPhase = 0;
  lean = 0;
  leanToward = 0;
  private air: Air | null = null;
  private detachedUntil = 0;
  private now = 0;

  private readonly random: () => number;
  size: number;

  constructor(x: number, y: number, heading: number, random: () => number, size = 1) {
    this.x = x; this.y = y; this.heading = heading; this.random = random; this.size = size;
  }

  get airborne() { return this.mode === 'air'; }
  get dead() { return this.mode === 'dead'; }
  // Half the body length in px, at this size.
  get radius() { return mmToPx(b.bodyLength.value / 2) * this.size; }

  // A new fly flies in from an edge of the window to a landing place.
  static arrive(terrain: Terrain, random: () => number, size: number, now: number) {
    const side = Math.floor(random() * 4); const margin = 20;
    const along = (n: number) => n * (0.2 + 0.6 * random());
    const start = [{ x: along(terrain.width), y: -margin }, { x: terrain.width + margin, y: along(terrain.height) }, { x: along(terrain.width), y: terrain.height + margin }, { x: -margin, y: along(terrain.height) }][side];
    const body = new Body(start.x, start.y, 0, random, size);
    const target = body.landingPlace(terrain);
    body.heading = Math.atan2(target.y - start.y, target.x - start.x);
    body.mode = 'air'; body.altitude = b.flightHeight.value; body.wings = 1; body.now = now;
    const v = mmToPx(b.flightSpeed.value * 1000);
    body.air = { vx: v * Math.cos(body.heading), vy: v * Math.sin(body.heading), climb: 0, climbUntil: 0, until: now, fast: now, target, saccade: null, nextSaccade: Infinity, tumbleUntil: 0, arriving: true, landing: false };
    return body;
  }

  squash() { this.mode = 'dead'; this.air = null; this.altitude = 0; this.speed = 0; }

  // Scrolled content under a walking fly carries it.
  carry(dx: number, dy: number) { if (this.mode === 'ground') { this.x += dx; this.y += dy; } }

  pose(): BodyPose {
    return { x: this.x, y: this.y, heading: this.heading, altitude: this.altitude, mode: this.mode, wings: this.wings, beating: this.mode === 'air',
      gait: this.gait, moving: Math.abs(this.speed) > 0.5, proboscis: this.proboscis, groom: this.groom, groomPhase: this.groomPhase, lean: this.lean, leanToward: this.leanToward, speed: this.speed };
  }

  // A place to land: inside a panel, a few millimetres from its edges, or anywhere inside the window.
  landingPlace(terrain: Terrain): Point {
    const inset = mmToPx(6);
    const panels = terrain.panels.filter(p => p.right - p.left > 4 * inset && p.bottom - p.top > 4 * inset);
    const r = this.random;
    if (panels.length && r() < 0.85) {
      const p = panels[Math.floor(r() * panels.length)];
      // Near one of its edges, where a walking fly prefers to be.
      const nearEdge = r() < 0.6;
      const x = p.left + inset + (p.right - p.left - 2 * inset) * (nearEdge && r() < 0.5 ? (r() < 0.5 ? 0 : 1) : r());
      const y = p.top + inset + (p.bottom - p.top - 2 * inset) * (nearEdge ? (r() < 0.5 ? 0 : 1) : r());
      return { x, y };
    }
    const top = terrain.top ?? 0;
    return { x: terrain.width * (0.15 + 0.7 * r()), y: top + (terrain.height - top) * (0.15 + 0.7 * r()) };
  }

  // lead: how long ago a takeoff this command carries happened; the jump starts then and has flown that long by now.
  step(dtMs: number, now: number, command: Command, terrain: Terrain, lead = 0) {
    this.now = now;
    const dt = Math.min(dtMs, 100) / 1000;
    if (this.mode === 'dead') return;
    const ease = (from: number, to: number, ms: number) => from + (to - from) * Math.min(1, dtMs / ms);
    this.lean = ease(this.lean, command.lean, 80); this.leanToward = command.leanToward;
    this.proboscis = ease(this.proboscis, command.proboscis, 60);
    this.groom = command.groom; if (this.groom) this.groomPhase += dt * 2 * Math.PI * 6;
    if (command.takeoff && this.mode === 'ground') { this.takeoff(command, now - lead); this.fly(Math.min(lead, 100) / 1000, now, command, terrain); return; }
    if (this.mode === 'air') { this.fly(dt, now, command, terrain); return; }
    this.wings = ease(this.wings, command.wings, command.wings > this.wings ? b.wingRaise.value : 120);
    this.walk(dt, command, terrain);
  }

  private takeoff(command: Command, now: number) {
    const t = command.takeoff!;
    this.mode = 'air'; this.heading = t.mode === 'short' ? this.heading : t.direction; this.wings = 1;
    // The jump: up and away at the jump angle for its first 50 ms.
    const v = mmToPx(b.jumpSpeed.value * 1000) * Math.cos(deg(b.jumpAngle.value));
    this.air = { vx: v * Math.cos(t.direction), vy: v * Math.sin(t.direction), climb: b.jumpSpeed.value * 1000 * Math.sin(deg(b.jumpAngle.value)), climbUntil: now + 50, until: now + Math.max(800, expDraw(b.flightTime.value * 1000, this.random)), fast: now + 1000,
      target: command.flyTo, saccade: null, nextSaccade: now + expDraw(b.saccadeInterval.value * 1000, this.random), tumbleUntil: t.mode === 'short' ? now + b.tumble.value : 0, arriving: false, landing: false };
    if (t.mode === 'voluntary') this.air.fast = now;
  }

  private walk(dt: number, command: Command, terrain: Terrain) {
    // Speed eases to the command; legs step at speed / stride, no faster than the shortest step period.
    this.speed += (command.speed - this.speed) * Math.min(1, dt * 1000 / 80);
    const frequency = Math.min(1000 / b.stepPeriodMin.value, Math.abs(this.speed) / b.strideLength.value);
    this.gait += 2 * Math.PI * frequency * dt * Math.sign(this.speed || 1);
    let turn = command.turn;
    // Edges: walls of the window, and panel edges a walking fly follows (flies keep to an arena's boundary).
    const reach = mmToPx(b.edgeRange.value) + this.radius;
    const edge = this.now >= this.detachedUntil && Math.abs(this.speed) > 1 ? nearestEdge(this, terrain, reach) : null;
    if (edge) {
      if (this.random() < b.edgeLeave.value * dt) { this.detachedUntil = this.now + 2000; this.heading = wrap(this.heading + deg(40) * -edge.side); }
      else {
        // Align with the edge, the way the fly already faces, keeping about 1.5 mm from it.
        const along = Math.abs(wrap(edge.angle - this.heading)) < Math.PI / 2 ? edge.angle : edge.angle + Math.PI;
        const keep = mmToPx(1.5) + this.radius;
        const correction = clamp((edge.distance - keep) / keep, -1, 1) * edge.side * deg(25);
        turn = wrap(along + correction - this.heading) * 6 + command.turn * 0.3;
      }
    }
    turn = clamp(turn, -deg(b.turnRateMax.value), deg(b.turnRateMax.value));
    this.heading = wrap(this.heading + turn * dt);
    const step = mmToPx(this.speed) * dt;
    let x = this.x + Math.cos(this.heading) * step, y = this.y + Math.sin(this.heading) * step;
    // The window's sides are hard walls.
    const m = this.radius; const top = (terrain.top ?? 0) + m;
    if (x < m || x > terrain.width - m || y < top || y > terrain.height - m) {
      x = clamp(x, m, terrain.width - m); y = clamp(y, top, terrain.height - m);
      const wallAngle = x <= m || x >= terrain.width - m ? Math.PI / 2 : 0;
      this.heading = Math.abs(wrap(wallAngle - this.heading)) < Math.PI / 2 ? wallAngle : wrap(wallAngle + Math.PI);
    }
    this.x = x; this.y = y;
  }

  private fly(dt: number, now: number, command: Command, terrain: Terrain) {
    const air = this.air!;
    this.wings = 1; this.speed = 0;
    // Cruising speed after the first second of an escape; slow on the final approach.
    const cruise = mmToPx((now < air.fast ? b.escapeFlightSpeed.value : b.flightSpeed.value) * 1000) * (air.landing ? 0.35 : 1);
    const tumbling = now < air.tumbleUntil;
    if (tumbling) this.heading = wrap(this.heading + deg(b.tumbleRate.value) * dt);
    else {
      // Saccades: a fast turn of about 90° in about 70 ms, now and then, away from the window's edges, and away from a threat.
      // Not on the final approach to a landing place, which may lie near a wall.
      const margin = mmToPx(25);
      const approaching = air.target !== null && pxToMm(Math.hypot(air.target.x - this.x, air.target.y - this.y)) < 80;
      const nearWall = !air.arriving && !approaching && (this.x < margin && Math.cos(this.heading) < 0 || this.x > terrain.width - margin && Math.cos(this.heading) > 0 || this.y < (terrain.top ?? 0) + margin && Math.sin(this.heading) < 0 || this.y > terrain.height - margin && Math.sin(this.heading) > 0);
      if (!air.saccade && (command.evade !== null || nearWall || (!air.target && now >= air.nextSaccade))) {
        let to: number;
        if (command.evade !== null) to = this.heading + Math.sign(wrap(command.evade - this.heading) || 1) * deg(b.saccadeAngle.value);
        else if (nearWall) { const centre = Math.atan2(terrain.height / 2 - this.y, terrain.width / 2 - this.x); to = this.heading + Math.sign(wrap(centre - this.heading) || 1) * deg(b.saccadeAngle.value); }
        else to = this.heading + (this.random() < 0.5 ? -1 : 1) * deg(b.saccadeAngle.value) * (0.5 + this.random());
        air.saccade = { from: this.heading, to, start: now, duration: b.saccadeDuration.value };
        air.nextSaccade = now + expDraw(b.saccadeInterval.value * 1000, this.random);
      }
      if (air.saccade) {
        const t = Math.min(1, (now - air.saccade.start) / air.saccade.duration);
        const s = t * t * (3 - 2 * t);
        this.heading = wrap(air.saccade.from + (air.saccade.to - air.saccade.from) * s);
        if (t >= 1) air.saccade = null;
      } else if (air.target) {
        const want = Math.atan2(air.target.y - this.y, air.target.x - this.x);
        this.heading = wrap(this.heading + clamp(wrap(want - this.heading), -deg(360) * dt, deg(360) * dt));
      } else this.heading = wrap(this.heading + command.turn * 0.3 * dt);
    }
    // Velocity turns towards the heading (a fly flies forwards) within about 100 ms, once the jump is over.
    const k = now < air.climbUntil ? 0 : Math.min(1, dt * 1000 / (tumbling ? 400 : 100));
    air.vx += (Math.cos(this.heading) * cruise - air.vx) * k; air.vy += (Math.sin(this.heading) * cruise - air.vy) * k;
    this.x += air.vx * dt; this.y += air.vy * dt;
    const top = terrain.top ?? 0;
    if (air.arriving && this.x > 0 && this.y > top && this.x < terrain.width && this.y < terrain.height) air.arriving = false;
    if (!air.arriving) { this.x = clamp(this.x, 1, terrain.width - 1); this.y = clamp(this.y, top + 1, terrain.height - 1); }
    // Height: up to cruising height, down on landing. A flight that has not reached its landing place long after it should
    // have lands where it is.
    if (!air.target && now >= air.until) air.target = this.landingPlace(terrain);
    if (now >= air.until + 6000 && air.target) air.target = { x: this.x, y: this.y };
    const distance = air.target ? pxToMm(Math.hypot(air.target.x - this.x, air.target.y - this.y)) : Infinity;
    air.landing = distance < 25;
    const goal = air.landing ? 0 : b.flightHeight.value;
    this.altitude += now < air.climbUntil ? air.climb * dt : clamp(goal - this.altitude, -120 * dt, 150 * dt);
    if (air.landing && (this.altitude <= 0.5 || distance < 2)) {
      this.mode = 'ground'; this.altitude = 0; this.air = null; this.speed = 0; this.wings = 0;
    }
  }
}

// The nearest wall or panel edge within reach: its direction, the distance to it and which side of the fly it is on.
export function nearestEdge(fly: Point & { heading: number }, terrain: Terrain, reach: number) {
  const top = terrain.top ?? 0;
  const segments: [number, number, number, number][] = [[0, top, terrain.width, top], [terrain.width, top, terrain.width, terrain.height], [0, terrain.height, terrain.width, terrain.height], [0, top, 0, terrain.height]];
  for (const p of terrain.panels) segments.push([p.left, p.top, p.right, p.top], [p.right, p.top, p.right, p.bottom], [p.left, p.bottom, p.right, p.bottom], [p.left, p.top, p.left, p.bottom]);
  let best: { angle: number; distance: number; side: number } | null = null;
  for (const [x1, y1, x2, y2] of segments) {
    const dx = x2 - x1, dy = y2 - y1; const length = Math.hypot(dx, dy); if (length < 1) continue;
    const t = clamp(((fly.x - x1) * dx + (fly.y - y1) * dy) / (length * length), 0, 1);
    const px = x1 + t * dx, py = y1 + t * dy; const distance = Math.hypot(fly.x - px, fly.y - py);
    if (distance > reach || (best && distance >= best.distance)) continue;
    // Which side: positive when the edge is to the fly's right, so a positive correction turns towards it.
    const side = Math.sign(Math.sin(wrap(Math.atan2(py - fly.y, px - fly.x) - fly.heading))) || 1;
    best = { angle: Math.atan2(dy, dx), distance, side };
  }
  return best;
}

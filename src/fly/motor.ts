import { biology as b, deg } from './biology.ts';
import type { BrainFrame } from './brain.ts';
import { wrap, type Point, type Reading } from './senses.ts';

// The motor layer (docs/fly.md, "Behaviour"): what the output neurons' spikes do to the body. The connectome and the
// model are real; this translation is written by hand, and every number in it is in biology.ts. Times are the brain's
// simulated milliseconds, so the escape mode can be read from spike timing as von Reyn et al. 2014 describe it.

export type Behaviour = 'walk' | 'rest' | 'turn' | 'groom' | 'feed' | 'freeze' | 'adjust' | 'back' | 'takeoff' | 'fly' | 'land' | 'dead';
export type TakeoffMode = 'short' | 'long' | 'voluntary';
export type Takeoff = { mode: TakeoffMode; direction: number; at: number; duration: number; withoutGiantFibre: boolean };
// What the body is told each frame. Angles are screen angles (y down: positive turns clockwise, to the fly's right).
export type Command = {
  behaviour: Behaviour;
  speed: number; // mm/s along the heading; negative backs up
  turn: number; // rad/s
  lean: number; // 0..1, the postural adjustment away from the threat
  leanToward: number;
  wings: number; // 0 folded, 1 raised
  proboscis: number; // 0..1
  groom: 'front' | 'hind' | null;
  takeoff: Takeoff | null; // once, when the fly leaves the ground
  evade: number | null; // in flight: the direction to turn away to
  flyTo: Point | null; // where a voluntary flight lands
};
export type BodyState = { airborne: boolean; dead: boolean; heading: number; position: Point };

const wingGroups = ['DNp02_L', 'DNp02_R', 'DNp04_L', 'DNp04_R', 'DNp11_L', 'DNp11_R'];
const expDraw = (mean: number, random: () => number) => -Math.log(1 - random() * 0.999) * mean;

export class Motor {
  readonly rates: Record<string, number> = {};
  private readonly ids: string[];
  private readonly sizes: number[];
  private now = 0;
  // The wing raise in progress: when it started, its last wing-raise spike, and how long it has been held strongly.
  private wing = { active: false, start: 0, low: 0, held: 0 };
  private pending: Takeoff | null = null;
  private adjust = 0;
  private freezeUntil = 0;
  private feeding = { on: false, low: 0 };
  private groomUntil = 0;
  private groomKind: 'front' | 'hind' = 'front';
  private nextGroom = 0;
  private walking = { on: false, until: 0, speed: b.walkSpeed.value };
  private wander = 0;
  private lastFlight = -Infinity;
  private wasAirborne = false;
  private loomWasActive = false;
  private tookOff = false;

  private readonly random: () => number;

  constructor(groups: readonly { id: string; neurons: { length: number } }[], random: () => number) {
    this.random = random;
    this.ids = groups.map(g => g.id); this.sizes = groups.map(g => g.neurons.length);
    for (const id of this.ids) this.rates[id] = 0;
    this.nextGroom = expDraw(b.groomEvery.value * 1000, random);
  }
  rate(id: string) { return this.rates[id] ?? 0; }
  get time() { return this.now; }

  update(frame: BrainFrame, reading: Reading, body: BodyState): Command {
    const decay = Math.exp(-frame.dt / b.rateFilter.value);
    this.ids.forEach((id, k) => { this.rates[id] = this.rates[id] * decay + (frame.counts[k] ?? 0) / this.sizes[k] / (b.rateFilter.value / 1000); });
    this.now = frame.t;
    const now = frame.t; const random = this.random;
    const command: Command = { behaviour: 'rest', speed: 0, turn: 0, lean: 0, leanToward: body.heading, wings: 0, proboscis: 0, groom: null, takeoff: null, evade: null, flyTo: null };
    if (body.dead) { this.pending = null; return { ...command, behaviour: 'dead' }; }

    // Steering from the left-right difference of DNa01 and DNa02, which predict turns to their own side.
    const left = this.rate('DNa01_L') + this.rate('DNa02_L'); const right = this.rate('DNa01_R') + this.rate('DNa02_R');
    const steer = deg(b.steerGain.value) * (right - left);
    const away = reading.loom.bearing === null ? body.heading + Math.PI : reading.loom.bearing + Math.PI;

    if (body.airborne) {
      this.wasAirborne = true; this.pending = null; this.wing.active = false; this.adjust = 0;
      // A looming hand or a giant-fibre spike in flight sets off an evasive turn.
      const evade = reading.loom.strength > 0.3 || frame.events.some(e => this.ids[e.group]?.startsWith('DNp01'));
      return { ...command, behaviour: 'fly', turn: steer, wings: 1, evade: evade ? away : null };
    }
    if (this.wasAirborne) { this.wasAirborne = false; this.walking = { on: false, until: now + 500, speed: b.walkSpeed.value }; }

    // The wing raise: the first spike of a wing-raise neuron (DNp02, DNp04, DNp11) after a quiet spell starts it, it is
    // complete after its duration, and it lowers again when they have been quiet for 100 ms.
    const wingRate = wingGroups.reduce((sum, id) => sum + this.rate(id), 0) / wingGroups.length;
    const wingSpikes = frame.events.filter(e => wingGroups.includes(this.ids[e.group]));
    if (this.wing.active && now - this.wing.low > 100) this.wing.active = false;
    if (wingSpikes.length) {
      if (!this.wing.active) this.wing = { active: true, start: wingSpikes[0].t, low: 0, held: 0 };
      this.wing.low = wingSpikes[wingSpikes.length - 1].t;
    }
    const raised = (t: number) => this.wing.active && t >= this.wing.start + b.wingRaise.value;

    // The postural adjustment leans away from the threat and sets the jump's direction (Card and Dickinson 2008).
    const threatened = reading.loom.active || this.wing.active;
    this.adjust = threatened ? Math.min(1, this.adjust + frame.dt / b.postureLead.value) : Math.max(0, this.adjust - frame.dt / b.postureLead.value);
    const direction = body.heading + wrap(away - body.heading) * this.adjust;

    // Escape mode from spike timing: a giant-fibre spike before the wing raise is complete is a short-mode takeoff (wings
    // barely raised, under 7 ms); after it, a long-mode takeoff (7 ms or more from the first wing movement).
    if (!this.pending) for (const e of frame.events) {
      if (!this.ids[e.group]?.startsWith('DNp01')) continue;
      const at = e.t + b.legExtension.value;
      this.pending = raised(e.t)
        ? { mode: 'long', direction, at, duration: at - this.wing.start, withoutGiantFibre: false }
        : { mode: 'short', direction, at, duration: b.wingToLeg.value + b.legExtension.value, withoutGiantFibre: false };
      break;
    }
    // Long mode without the giant fibre: a wing raise held strongly enough.
    if (!this.pending && raised(now) && wingRate > 2 * b.wingRaiseRate.value) {
      if ((this.wing.held += frame.dt) >= b.wingRaiseHold.value) this.pending = { mode: 'long', direction, at: now, duration: now - this.wing.start, withoutGiantFibre: true };
    } else if (!this.pending) this.wing.held = 0;
    if (this.pending) {
      this.pending.direction = direction;
      if (now >= this.pending.at) {
        const takeoff = this.pending; this.pending = null; this.tookOff = true; this.wing.active = false; this.adjust = 0;
        return { ...command, behaviour: 'takeoff', wings: takeoff.mode === 'short' ? 0.3 : 1, takeoff };
      }
      return { ...command, behaviour: 'takeoff', lean: this.adjust, leanToward: away, wings: this.wing.active ? Math.min(1, (now - this.wing.start) / b.wingRaise.value) : 0.2 };
    }

    // Backing up while MDN fires, before freezing: the circuit drives MDN from frontal looming too, and backing away is its
    // answer then.
    const mdn = (this.rate('MDN_L') + this.rate('MDN_R')) / 2;
    if (mdn > b.backRate.value) return { ...command, behaviour: 'back', speed: -b.backSpeed.value * Math.min(2, mdn / b.backRate.value), turn: steer };

    // Looming without an escape: freeze and lean; after it ends, stay frozen a while.
    if (this.loomWasActive && !reading.loom.active && !this.tookOff) this.freezeUntil = now + b.freeze.value * 1000;
    if (reading.loom.onset) this.tookOff = false;
    this.loomWasActive = reading.loom.active;
    if (threatened) return { ...command, behaviour: 'adjust', lean: this.adjust, leanToward: away, wings: this.wing.active ? Math.min(1, (now - this.wing.start) / b.wingRaise.value) : 0 };
    // DNg11 firing starts a grooming bout, ending a freeze.
    const dng11 = (this.rate('DNg11_L') + this.rate('DNg11_R')) / 2;
    if (dng11 > b.groomRate.value && now >= this.groomUntil) { this.groomUntil = now + b.groomBout.value * 1000; this.groomKind = 'front'; this.freezeUntil = 0; }
    if (now < this.freezeUntil) return { ...command, behaviour: 'freeze', lean: this.adjust, leanToward: away };

    // Feeding while MN9 fires (the proboscis), with some hysteresis.
    const mn9 = (this.rate('MN9_L') + this.rate('MN9_R')) / 2;
    if (mn9 > b.feedRate.value) { this.feeding = { on: true, low: 0 }; } else if (this.feeding.on && mn9 < b.feedRate.value / 2 && (this.feeding.low += frame.dt) > 300) this.feeding.on = false;
    if (this.feeding.on) return { ...command, behaviour: 'feed', proboscis: Math.min(1, mn9 / (2 * b.feedRate.value) + 0.4) };

    // Grooming: the bout DNg11 started, and now and then one by itself.
    if (now >= this.nextGroom && !this.walking.on) { this.groomUntil = now + b.groomBout.value * 1000 * (0.5 + random()); this.groomKind = random() < 0.6 ? 'front' : 'hind'; this.nextGroom = now + expDraw(b.groomEvery.value * 1000, random); }
    if (now < this.groomUntil) return { ...command, behaviour: 'groom', groom: this.groomKind };

    // Smell: towards a food it smells, by flying when it is far and the fly is hungry (hand-written, like all navigation).
    const pn = ['PN-DM1_L', 'PN-DM1_R', 'PN-VA2_L', 'PN-VA2_R'].reduce((sum, id) => sum + this.rate(id), 0) / 4;
    const smelling = pn > 30 && reading.smell.toward !== null;
    const hungry = reading.hunger > 0.3 && reading.smell.nearest !== null && reading.tasting === null;
    if (smelling && hungry && reading.smell.distance > 80 && now - this.lastFlight > 4000) {
      this.lastFlight = now;
      return { ...command, behaviour: 'takeoff', wings: 1, takeoff: { mode: 'voluntary', direction: reading.smell.toward!, at: now, duration: b.wingRaise.value + b.legExtension.value, withoutGiantFibre: true }, flyTo: reading.smell.nearest };
    }

    // Walking in bouts, faster with P9 (DNp09), steered by the descending neurons, wandering a little, and towards a smell.
    const p9 = (this.rate('P9_L') + this.rate('P9_R')) / 2;
    if (now >= this.walking.until) {
      const on = !this.walking.on;
      const speed = Math.min(b.walkSpeedPeak.value, Math.max(b.walkSpeedSlow.value * 0.7, b.walkSpeed.value * Math.exp(0.3 * gaussian(random)) * (random() < 0.05 ? 1.6 : 1)));
      this.walking = { on, until: now + expDraw((on ? b.walkBout.value : b.pause.value) * 1000, random), speed };
    }
    const sd = deg(b.wander.value);
    this.wander += (-this.wander * frame.dt / 300) + sd * Math.sqrt(frame.dt / 150) * gaussian(random);
    let turn = steer + this.wander;
    if (smelling) turn += Math.sign(wrap(reading.smell.toward! - body.heading)) * deg(b.turnToSmell.value);
    turn = Math.max(-deg(b.turnRateMax.value), Math.min(deg(b.turnRateMax.value), turn));
    const walking = this.walking.on || p9 > 20 || smelling;
    if (!walking) return { ...command, behaviour: Math.abs(steer) > deg(100) ? 'turn' : 'rest', turn: Math.abs(steer) > deg(100) ? steer : 0 };
    return { ...command, behaviour: 'walk', speed: Math.min(b.walkSpeedPeak.value, this.walking.speed + b.walkGain.value * p9), turn };
  }
}

function gaussian(random: () => number) { return Math.sqrt(-2 * Math.log(1 - random() * 0.999999)) * Math.cos(2 * Math.PI * random()); }

import { shiuModel } from './brain.ts';
import { biology as b, deg, pxToMm } from './biology.ts';

// What the fly senses of the window, as Poisson input rates for its input groups (docs/fly.md, "Senses"). Pure: the
// overlay measures the window (geometry only: positions, sizes, scroll offsets; never text or which key was pressed) and
// this turns it into rates. The mappings from a stimulus to a rate are written by hand; every number is in biology.ts.

export type Point = { x: number; y: number };
// The fly as the senses need it: position in CSS px, heading in radians (screen coordinates, y down, so a positive angle
// turns clockwise, to the fly's right), height above the screen in mm.
export type Pose = Point & { heading: number; altitude: number };
// The cursor is a hand above the screen; height in mm, null when the pointer is outside the window.
export type Hand = (Point & { height: number }) | null;
export type Food = Point & { radius: number; sugar: number; bitter: number; smell: number };
export type World = {
  hand: Hand;
  // Scrolled content's motion around the fly (px/s) and the share of the view it fills.
  flow: Point & { coverage: number };
  // Key presses (at the focused element) and clicks away from the fly since the last update; strength 0..1.
  vibrations: (Point & { strength: number })[];
  // Elements that appeared or changed size since the last update.
  appearances: (Point & { width: number; height: number })[];
  food: Food[];
  hunger: number;
  blind: boolean;
  dusted: boolean;
};
export type Reading = {
  // Input rate per group (Hz) and, for the retinotopic visual groups, the share of the group's neurons it drives.
  drive: Record<string, number>;
  share: Record<string, number>;
  // The hand as the eyes see it: angular size and its rate of change (rad, rad/s), each eye's share, and where it is
  // (screen angle from the fly), or null when it is not seen.
  loom: { theta: number; thetaDot: number; left: number; right: number; bearing: number | null; strength: number; onset: boolean; active: boolean };
  smell: { level: number; toward: number | null; nearest: Point | null; distance: number };
  tasting: Food | null;
  gain: number;
  hunger: number;
};

const rMax = shiuModel.rPoisson;
// Hz: the lowest input rate the senses send.
const minRate = 1;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, c: number, v: number) => { const t = clamp01((v - a) / (c - a)); return t * t * (3 - 2 * t); };
export const wrap = (a: number) => { let x = (a + Math.PI) % (2 * Math.PI); if (x < 0) x += 2 * Math.PI; return x - Math.PI; };
export const visualGroups = ['LC4', 'LPLC2', 'LC10a', 'LC16', 'HS', 'H2'];

// The share of an angular interval [centre - half, centre + half] that falls inside [from, to], all relative to the
// heading and within ±π.
function share(centre: number, half: number, from: number, to: number) {
  if (half <= 0) return centre >= from && centre <= to ? 1 : 0;
  let inside = 0;
  for (const shift of [-2 * Math.PI, 0, 2 * Math.PI]) {
    const lo = Math.max(centre - half + shift, from); const hi = Math.min(centre + half + shift, to);
    if (hi > lo) inside += hi - lo;
  }
  return clamp01(inside / (2 * half));
}

// Each eye's share of something at bearing (relative to the heading, positive to the right) with angular radius half.
// The eyes overlap straight ahead and leave a blind zone straight behind.
export function eyeShares(bearing: number, half: number) {
  const front = deg(b.binocular.value) / 2; const back = Math.PI - deg(b.blindZone.value) / 2;
  return { left: share(bearing, half, -back, front), right: share(bearing, half, -front, back) };
}

// The hand's angular size from the fly: θ = 2·atan(R/d), d the distance from the eye to the hand's centre.
export function handAngle(pose: Pose, hand: Point & { height: number }) {
  const r = pxToMm(Math.hypot(hand.x - pose.x, hand.y - pose.y));
  const d = Math.hypot(r, Math.max(0, hand.height - pose.altitude));
  return { theta: 2 * Math.atan(b.handRadius.value / Math.max(d, 0.1)), r, d };
}

export class Senses {
  private theta = 0;
  private thetaDot = 0;
  private seen = false;
  private bearingWorld: number | null = null;
  private objectSpeed = 0;
  private vibration = { left: 0, right: 0 };
  private appear = { left: 0, right: 0 };
  private dust = 0;
  private gain = 1;
  private episode = { active: false, peak: 0, quiet: 0, escaped: false };

  // The fly took off: the looming episode it answered does not count towards habituation.
  escaped() { this.episode.escaped = true; }
  get loomGain() { return this.gain; }

  update(dtMs: number, pose: Pose, world: World): Reading {
    const dt = Math.max(dtMs, 1) / 1000;
    const drive: Record<string, number> = {}; const shares: Record<string, number> = {};
    const add = (group: string, hz: number) => { if (hz > 0) drive[group] = Math.min(rMax, (drive[group] ?? 0) + hz); };
    const cover = (group: string, theta: number) => { const s = clamp01(1 - Math.cos(Math.min(Math.PI, theta + deg(b.receptiveField.value)) / 2)); shares[group] = Math.max(shares[group] ?? 0, s); };

    // The hand: angular size per eye, expansion from the geometry (the fly's own turning never looms).
    let left = 0, right = 0, bearing: number | null = null;
    if (world.hand) {
      const { theta, r } = handAngle(pose, world.hand);
      // A hand that has just come into the window has no expansion yet.
      const raw = this.seen ? (theta - this.theta) / dt : 0;
      this.thetaDot += (raw - this.thetaDot) * Math.min(1, dtMs / 20);
      this.theta = theta; this.seen = true;
      const worldBearing = Math.atan2(world.hand.y - pose.y, world.hand.x - pose.x);
      // How fast the hand moves across the view, for LC10a.
      if (this.bearingWorld !== null) this.objectSpeed += (Math.abs(wrap(worldBearing - this.bearingWorld)) / dt - this.objectSpeed) * Math.min(1, dtMs / 50);
      this.bearingWorld = worldBearing;
      const relative = wrap(worldBearing - pose.heading);
      const shares = eyeShares(relative, theta / 2);
      // A hand largely overhead fills the upper field of both eyes.
      const overhead = smoothstep(deg(45), deg(75), Math.atan2(Math.max(0, world.hand.height - pose.altitude), Math.max(r, 0.01)));
      left = Math.max(shares.left, overhead); right = Math.max(shares.right, overhead);
      bearing = left + right > 0 ? worldBearing : null;
    } else { this.theta = 0; this.thetaDot = 0; this.bearingWorld = null; this.objectSpeed = 0; this.seen = false; }
    const expanding = Math.max(0, this.thetaDot);
    const eyes = { left, right } as const;
    let strength = 0;
    for (const side of ['left', 'right'] as const) {
      const w = eyes[side]; const s = side === 'left' ? 'L' : 'R';
      const size = this.theta * w; const dot = expanding * w;
      const lplc2 = smoothstep(deg(b.sizeLow.value), deg(b.sizeHigh.value), size) * clamp01(dot / deg(b.expansionGate.value));
      const lc4 = size > deg(3) ? clamp01(dot / deg(b.lc4Speed.value)) : 0;
      strength = Math.max(strength, lplc2, lc4);
      add(`LPLC2_${s}`, rMax * this.gain * lplc2); cover(`LPLC2_${s}`, size);
      add(`LC4_${s}`, rMax * this.gain * lc4); cover(`LC4_${s}`, size);
      // LC16 takes approach in the frontal field.
      if (bearing !== null) { const frontal = clamp01(Math.cos(wrap(bearing - pose.heading))); add(`LC16_${s}`, rMax * w * frontal * clamp01(dot / deg(b.lc4Speed.value))); cover(`LC16_${s}`, size); }
      // LC10a: a small object moving across the view.
      if (this.theta > deg(1) && this.theta < deg(b.objectSize.value)) { add(`LC10a_${s}`, rMax * w * clamp01(this.objectSpeed / deg(b.objectMotion.value)) * (1 - this.theta / deg(b.objectSize.value))); cover(`LC10a_${s}`, size); }
    }

    // Elements appearing near the fly loom briefly, on the side they appear, and count as looming for habituation, so a
    // transcript that keeps adding rows beside it soon stops alarming it.
    const fadeAppear = Math.exp(-dtMs / b.appearPulse.value);
    this.appear.left *= fadeAppear; this.appear.right *= fadeAppear;
    for (const a of world.appearances) {
      const nearX = Math.max(a.x - a.width / 2, Math.min(pose.x, a.x + a.width / 2)); const nearY = Math.max(a.y - a.height / 2, Math.min(pose.y, a.y + a.height / 2));
      const distance = Math.max(1, pxToMm(Math.hypot(nearX - pose.x, nearY - pose.y)));
      if (distance > b.appearRange.value) continue;
      const theta = 2 * Math.atan(pxToMm(Math.max(a.width, a.height)) / 2 / distance);
      const amount = clamp01(theta / deg(60)) * b.appearNear.value / (b.appearNear.value + distance);
      const shares = eyeShares(wrap(Math.atan2(a.y - pose.y, a.x - pose.x) - pose.heading), theta / 2);
      this.appear.left = Math.max(this.appear.left, amount * shares.left); this.appear.right = Math.max(this.appear.right, amount * shares.right);
    }
    for (const [side, amount] of [['L', this.appear.left], ['R', this.appear.right]] as const) {
      if (amount <= 0.01) continue;
      add(`LC4_${side}`, rMax * this.gain * 0.8 * amount); add(`LPLC2_${side}`, rMax * this.gain * 0.5 * amount);
      cover(`LC4_${side}`, amount * deg(60)); cover(`LPLC2_${side}`, amount * deg(60));
      strength = Math.max(strength, 0.8 * amount);
    }

    // Habituation: a weak looming stimulus that ends without an escape lowers the looming gain; the gain recovers.
    const episode = this.episode; let onset = false;
    if (strength > 0.05) {
      if (!episode.active) { episode.active = true; episode.peak = 0; episode.escaped = false; onset = true; }
      episode.peak = Math.max(episode.peak, strength); episode.quiet = 0;
    } else if (episode.active && (episode.quiet += dtMs) > 300) {
      episode.active = false;
      if (!episode.escaped && episode.peak < 0.5) this.gain *= 1 - b.habituation.value;
    }
    this.gain = 1 - (1 - this.gain) * Math.exp(-dt / b.habituationRecovery.value);

    // Scrolling is wide-field motion: content moving back along the fly is front-to-back on both eyes (HS), forward is
    // back-to-front (H2), and sideways motion is taken as a turn, front-to-back on one eye and back-to-front on the other.
    const forward = world.flow.x * Math.cos(pose.heading) + world.flow.y * Math.sin(pose.heading);
    const sideways = -world.flow.x * Math.sin(pose.heading) + world.flow.y * Math.cos(pose.heading);
    const flow = (v: number) => rMax * world.flow.coverage * clamp01(v / b.flowSpeed.value);
    add('HS_L', flow(-forward) + flow(sideways)); add('HS_R', flow(-forward) + flow(-sideways));
    add('H2_L', flow(forward) + flow(-sideways)); add('H2_R', flow(forward) + flow(sideways));

    // Key presses and clicks are vibration for Johnston's organ, weaker with distance.
    const fadeVibration = Math.exp(-dtMs / b.vibrationPulse.value);
    this.vibration.left *= fadeVibration; this.vibration.right *= fadeVibration;
    for (const v of world.vibrations) {
      const distance = pxToMm(Math.hypot(v.x - pose.x, v.y - pose.y));
      const amount = clamp01(v.strength) / (1 + (distance / b.vibrationRange.value) ** 2);
      const side = Math.sin(wrap(Math.atan2(v.y - pose.y, v.x - pose.x) - pose.heading));
      this.vibration.left = Math.max(this.vibration.left, amount * (0.5 - 0.3 * side) * 2); this.vibration.right = Math.max(this.vibration.right, amount * (0.5 + 0.3 * side) * 2);
    }
    add('JO_L', rMax * clamp01(this.vibration.left)); add('JO_R', rMax * clamp01(this.vibration.right));

    // Dust on the antennae: antennal deflection (JO-C and JO-E).
    if (world.dusted) this.dust = 1;
    this.dust *= Math.exp(-dt / b.dust.value);
    add('JOCE_L', rMax * this.dust); add('JOCE_R', rMax * this.dust);

    // Taste on contact, sugar more strongly when hungry; smell from every food, falling with distance.
    let tasting: Food | null = null;
    let level = 0, gx = 0, gy = 0, nearest: Point | null = null, distanceToNearest = Infinity;
    for (const f of world.food) {
      const distance = pxToMm(Math.max(0, Math.hypot(f.x - pose.x, f.y - pose.y) - f.radius));
      if (pose.altitude <= 0 && distance <= b.contact.value && !tasting) tasting = f;
      if (f.smell > 0 || f.sugar > 0) { if (distance < distanceToNearest) { distanceToNearest = distance; nearest = { x: f.x, y: f.y }; } }
      if (f.smell <= 0) continue;
      const c = f.smell * Math.exp(-distance / b.smellRange.value);
      level += c;
      const toward = Math.atan2(f.y - pose.y, f.x - pose.x); gx += c * Math.cos(toward); gy += c * Math.sin(toward);
    }
    if (tasting) {
      const sensitivity = b.sugarFed.value + (1 - b.sugarFed.value) * clamp01(world.hunger);
      add('Sugar_L', rMax * clamp01(tasting.sugar) * sensitivity); add('Sugar_R', rMax * clamp01(tasting.sugar) * sensitivity);
      add('Bitter_L', rMax * clamp01(tasting.bitter)); add('Bitter_R', rMax * clamp01(tasting.bitter));
    }
    const toward = level > 0 ? Math.atan2(gy, gx) : null;
    if (level > 0) {
      const side = toward === null ? 0 : Math.sin(wrap(toward - pose.heading));
      const odour = rMax * level / (level + 0.3);
      add('DM1_L', odour * (1 - 0.2 * side)); add('DM1_R', odour * (1 + 0.2 * side));
      add('VA2_L', odour * (1 - 0.2 * side)); add('VA2_R', odour * (1 + 0.2 * side));
    }

    // A fading pulse (a key press, an element appearing, dust) ends below a hertz rather than trailing off for ever: every
    // Poisson event is a spike, so even a tiny rate on a whole group keeps the brain working.
    for (const key of Object.keys(drive)) if (drive[key] < minRate) delete drive[key];
    if (world.blind) for (const key of Object.keys(drive)) if (visualGroups.includes(key.replace(/_[LR]$/, ''))) delete drive[key];
    for (const key of Object.keys(shares)) if (!(key in drive)) delete shares[key];
    return {
      drive, share: shares, gain: this.gain, tasting, hunger: world.hunger,
      loom: { theta: this.theta, thetaDot: this.thetaDot, left, right, bearing: world.blind ? null : bearing, strength: world.blind ? 0 : strength, onset: onset && !world.blind, active: episode.active && !world.blind },
      smell: { level, toward, nearest, distance: distanceToNearest },
    };
  }
}

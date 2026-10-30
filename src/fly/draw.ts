import { biology as b, type FoodKind } from './biology.ts';
import type { BodyPose } from './body.ts';

// Drawing the fly from above (docs/fly.md): procedural shapes in millimetres in the fly's own frame (x forwards, y to
// its right), scaled to px. Colours are a fly's own, with a light rim in dark themes so it reads on any background.

export type Smear = { x: number; y: number; at: number; size: number; seed: number };
export type DrawnFood = { x: number; y: number; radius: number; kind: FoodKind };

const tan = '#a27a45', thoraxColor = '#8f6a3b', band = '#3c2a17', eye = '#b8261c', eyeShine = '#f08070';
// Where each leg joins the thorax and where its foot rests (mm), left side; the right mirrors it. Tripod A is L1, R2, L3.
const legs = [{ base: [0.62, 0.2], foot: [1.15, 0.78] }, { base: [0.45, 0.22], foot: [0.4, 1.02] }, { base: [0.28, 0.2], foot: [-0.55, 0.88] }] as const;
export const smearFade = 180_000;

// The pose drawn at px per mm s, centred on (x, y) unless at is given.
export function drawFly(ctx: CanvasRenderingContext2D, pose: BodyPose, s: number, dark: boolean, now: number, at?: { x: number; y: number }) {
  const cx = at?.x ?? pose.x, cy = at?.y ?? pose.y;
  const lift = 1 + pose.altitude / 300;
  const k = s * lift;
  // Shadow: under the body on the ground, thrown down and right by height in the air.
  ctx.save();
  const off = pose.altitude * 0.35 * s;
  ctx.translate(cx + off, cy + off * 1.3); ctx.rotate(pose.heading);
  ctx.fillStyle = dark ? `rgba(0,0,0,${0.55 - Math.min(0.35, pose.altitude / 200)})` : `rgba(20,20,20,${0.28 - Math.min(0.18, pose.altitude / 250)})`;
  ctx.filter = pose.altitude > 1 ? `blur(${Math.min(6, pose.altitude / 8)}px)` : 'none';
  ctx.beginPath(); ctx.ellipse(-0.1 * s, 0, 1.25 * s, 0.5 * s, 0, 0, Math.PI * 2); ctx.fill();
  if (pose.mode === 'air') { ctx.beginPath(); ctx.ellipse(-0.2 * s, 0, 0.9 * s, 1.5 * s, 0, 0, Math.PI * 2); ctx.globalAlpha = 0.4; ctx.fill(); }
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(pose.heading); ctx.scale(k, k);
  const line = (w: number) => Math.max(0.55 / k, w);
  // Legs: tripod gait while walking, tucked in flight, front or hind pairs rubbing while grooming.
  ctx.strokeStyle = dark ? '#d8c3a0' : '#4a3520'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const stride = pose.moving ? 0.32 : 0;
  legs.forEach((leg, pair) => {
    for (const side of [-1, 1]) {
      const tripodA = (pair === 1) === (side === 1);
      let fx: number = leg.foot[0], fy: number = leg.foot[1] * side;
      if (pose.mode === 'air') { fx = leg.base[0] - 0.15 - pair * 0.2; fy = (leg.base[1] + 0.25) * side; }
      else {
        fx += Math.sin(pose.gait + (tripodA ? 0 : Math.PI)) * stride;
        if (pose.groom === 'front' && pair === 0) { fx = 1.08 + Math.sin(pose.groomPhase + (side > 0 ? Math.PI : 0)) * 0.14; fy = 0.16 * side; }
        if (pose.groom === 'hind' && pair === 2) { fx = -1.0 + Math.sin(pose.groomPhase + (side > 0 ? Math.PI : 0)) * 0.2; fy = 0.3 * side; }
      }
      const bx = leg.base[0], by = leg.base[1] * side;
      const kx = (bx + fx) / 2 + (pair === 0 ? 0.1 : pair === 2 ? -0.1 : 0), ky = (by + fy) / 2 + 0.28 * side;
      ctx.lineWidth = line(0.07);
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    }
  });
  // The postural adjustment shifts the body over the legs, away from the threat.
  const lean = Math.min(1, pose.lean) * 0.18; const rel = pose.leanToward - pose.heading;
  ctx.translate(Math.cos(rel) * lean, Math.sin(rel) * lean);
  const rim = dark ? 'rgba(255,248,235,0.55)' : 'rgba(30,20,10,0.35)';
  // Abdomen with its dark bands, thorax, head with the red eyes.
  ctx.fillStyle = tan; ctx.strokeStyle = rim; ctx.lineWidth = line(0.04);
  ctx.beginPath(); ctx.ellipse(-0.45, 0, 0.66, 0.42, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.ellipse(-0.45, 0, 0.66, 0.42, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = band; for (const x of [-0.25, -0.5, -0.75, -0.98]) ctx.fillRect(x - 0.07, -0.5, 0.11, 1);
  ctx.restore();
  ctx.fillStyle = thoraxColor; ctx.beginPath(); ctx.ellipse(0.45, 0, 0.42, 0.36, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(60,40,20,0.35)'; ctx.fillRect(0.2, -0.04, 0.5, 0.08);
  ctx.fillStyle = '#7d5c33'; ctx.beginPath(); ctx.ellipse(0.95, 0, 0.2, 0.34, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.fillStyle = eye; ctx.beginPath(); ctx.ellipse(0.97, 0.25 * side, 0.21, 0.17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = eyeShine; ctx.beginPath(); ctx.ellipse(1.02, 0.22 * side, 0.05, 0.04, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Antennae, and the proboscis when it is out.
  ctx.strokeStyle = dark ? '#e8d6b8' : '#3a2814'; ctx.lineWidth = line(0.035);
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(1.12, 0.07 * side); ctx.lineTo(1.28, 0.16 * side); ctx.stroke(); }
  if (pose.proboscis > 0.05) {
    ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = line(0.11);
    const tip = 1.15 + 0.45 * pose.proboscis;
    ctx.beginPath(); ctx.moveTo(1.12, 0); ctx.lineTo(tip, 0); ctx.stroke();
    ctx.fillStyle = '#8a6440'; ctx.beginPath(); ctx.ellipse(tip, 0, 0.07, 0.1, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Wings: folded over the abdomen at rest, raised before a long-mode takeoff, a blur while they beat.
  const wingFill = dark ? 'rgba(225,235,245,0.22)' : 'rgba(170,185,200,0.32)';
  const wingEdge = dark ? 'rgba(235,240,250,0.5)' : 'rgba(60,70,80,0.45)';
  if (pose.beating) {
    const flick = Math.sin(now / 1000 * 2 * Math.PI * b.wingbeat.value / 12);
    for (const side of [-1, 1]) {
      ctx.fillStyle = dark ? 'rgba(225,235,245,0.13)' : 'rgba(150,165,180,0.2)';
      ctx.beginPath(); ctx.moveTo(0.35, 0.12 * side); ctx.arc(0.35, 0.12 * side, 2.2, side > 0 ? -0.35 : Math.PI - 1.45, side > 0 ? 1.45 : Math.PI + 0.35); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.translate(0.35, 0.12 * side); ctx.rotate(side * (0.7 + 0.5 * flick));
      ctx.fillStyle = wingFill; ctx.strokeStyle = wingEdge; ctx.lineWidth = line(0.02);
      ctx.beginPath(); ctx.ellipse(-0.05, 1.05 * side, 0.38, 1.05, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  } else {
    const spread = 0.17 + 0.95 * pose.wings; const length = 1.1 * (1 - 0.35 * pose.wings);
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(0.3, 0.1 * side); ctx.rotate(Math.PI + spread * -side);
      ctx.fillStyle = wingFill; ctx.strokeStyle = wingEdge; ctx.lineWidth = line(0.025);
      ctx.beginPath(); ctx.ellipse(length, 0, length, 0.36, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.lineWidth = line(0.012); ctx.beginPath(); ctx.moveTo(0.1, 0); ctx.lineTo(2 * length - 0.15, 0.03); ctx.moveTo(0.3, -0.08); ctx.lineTo(2 * length - 0.3, -0.2); ctx.moveTo(0.3, 0.08); ctx.lineTo(2 * length - 0.35, 0.2); ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

// A pseudo-random sequence for a smear's shape, the same for every frame.
const wobble = (seed: number) => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };

// What a squash leaves: a small smear and a few drops, fading over a few minutes.
export function drawSmear(ctx: CanvasRenderingContext2D, smear: Smear, s: number, now: number) {
  const age = (now - smear.at) / smearFade; if (age >= 1) return;
  const r = wobble(smear.seed); const k = s * smear.size;
  ctx.save(); ctx.translate(smear.x, smear.y); ctx.globalAlpha = 0.85 * (1 - age);
  ctx.fillStyle = '#6d5a2a';
  ctx.beginPath();
  for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI * 2; const rad = (0.9 + 0.5 * r()) * k; if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b8261c'; ctx.beginPath(); ctx.ellipse(0.2 * k, -0.1 * k, 0.25 * k, 0.18 * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8a7a3a';
  for (let i = 0; i < 5; i++) { const a = r() * Math.PI * 2, d = (1.4 + r() * 1.2) * k; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, (0.12 + 0.12 * r()) * k, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

const foodLook: Record<FoodKind, { fill: string; edge: string }> = {
  sugar: { fill: 'rgba(250,250,245,0.95)', edge: 'rgba(120,120,110,0.7)' },
  banana: { fill: 'rgba(246,222,120,0.95)', edge: 'rgba(160,130,40,0.8)' },
  vinegar: { fill: 'rgba(196,128,60,0.55)', edge: 'rgba(130,80,30,0.8)' },
  bitter: { fill: 'rgba(120,160,90,0.6)', edge: 'rgba(60,90,40,0.85)' },
};
export function drawFood(ctx: CanvasRenderingContext2D, food: DrawnFood) {
  const look = foodLook[food.kind];
  ctx.save(); ctx.translate(food.x, food.y); ctx.fillStyle = look.fill; ctx.strokeStyle = look.edge; ctx.lineWidth = 1;
  if (food.kind === 'sugar') {
    for (const [dx, dy, r] of [[0, 0, 0.45], [-0.45, 0.3, 0.32], [0.4, 0.35, 0.3], [0.1, -0.45, 0.28]]) { ctx.beginPath(); ctx.rect((dx - r) * food.radius, (dy - r) * food.radius, 2 * r * food.radius, 2 * r * food.radius); ctx.fill(); ctx.stroke(); }
  } else if (food.kind === 'banana') {
    ctx.beginPath(); ctx.arc(0, 0, food.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(120,90,30,0.5)'; for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * food.radius * 0.3, Math.sin(a) * food.radius * 0.3, food.radius * 0.08, 0, Math.PI * 2); ctx.fill(); }
  } else {
    ctx.beginPath(); ctx.arc(0, 0, food.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(-food.radius * 0.35, -food.radius * 0.35, food.radius * 0.22, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// The hand coming down in a swat: its shadow darkens and shrinks to the palm as it nears the screen.
export function drawSwat(ctx: CanvasRenderingContext2D, swat: { x: number; y: number }, height: number, palm: number, dark: boolean) {
  const near = 1 - height / b.handHeight.value;
  ctx.save(); ctx.fillStyle = dark ? `rgba(0,0,0,${0.15 + 0.35 * near})` : `rgba(30,30,30,${0.08 + 0.22 * near})`;
  ctx.beginPath(); ctx.arc(swat.x, swat.y, palm * (1.8 - 0.8 * near), 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

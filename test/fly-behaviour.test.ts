import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { biology as b, deg, mmToPx } from '../src/fly/biology.ts';
import { Body, nearestEdge, type Terrain } from '../src/fly/body.ts';
import { Brain, advance, loadCircuit, random, type BrainFrame } from '../src/fly/brain.ts';
import type { CircuitFile } from '../src/fly/circuit.ts';
import { FlyLoop, handHeight, hitRadius, swatRadius, type Outcome } from '../src/fly/loop.ts';
import { Motor, type Command } from '../src/fly/motor.ts';
import { Senses, eyeShares, handAngle, type Reading, type World } from '../src/fly/senses.ts';

const circuit = loadCircuit(JSON.parse(readFileSync(new URL('../src/fly/circuit.json', import.meta.url), 'utf8')) as CircuitFile);
const inputs = circuit.groups.filter(g => g.role === 'input').map(g => g.id);
const terrain: Terrain = { width: 1600, height: 1000, panels: [] };
const quiet: World = { hand: null, flow: { x: 0, y: 0, coverage: 0 }, vibrations: [], appearances: [], food: [], hunger: 0, blind: false, dusted: false };
const pose = { x: 800, y: 500, heading: 0, altitude: 0 };
const frameMs = 1000 / 60;

void test('the hand\'s angular size is 2·atan(R/d), and the eyes leave a blind zone behind', () => {
  const R = b.handRadius.value, h = b.handHeight.value;
  assert.ok(Math.abs(handAngle(pose, { x: 800, y: 500, height: h }).theta - 2 * Math.atan(R / h)) < 1e-9);
  const away = handAngle(pose, { x: 800 + mmToPx(80), y: 500, height: h });
  assert.ok(Math.abs(away.theta - 2 * Math.atan(R / 100)) < 1e-9 && Math.abs(away.d - 100) < 1e-9);
  // Bearings relative to the heading, positive to the right (screen y is down).
  const near = (shares: { left: number; right: number }, left: number, right: number) => assert.ok(Math.abs(shares.left - left) < 1e-9 && Math.abs(shares.right - right) < 1e-9, JSON.stringify(shares));
  near(eyeShares(deg(90), deg(5)), 0, 1);
  near(eyeShares(deg(-90), deg(5)), 1, 0);
  near(eyeShares(0, deg(2)), 1, 1);
  near(eyeShares(deg(180), deg(5)), 0, 0);
});

// The hand moving straight at the fly from its right, from distance mm at speed mm/s, as the senses see it a frame at a
// time (the fly heads east; south, +y, is its right).
function approach(speed: number, from = 150, frames = 30) {
  const senses = new Senses(); let reading: Reading | undefined;
  for (let k = 0; k < frames; k++) {
    const d = Math.max(10, from - speed * k * frameMs / 1000);
    reading = senses.update(frameMs, pose, { ...quiet, hand: { x: 800, y: 500 + mmToPx(d), height: b.handHeight.value } });
  }
  return reading!;
}

void test('a fast approach looms on the eye that sees it; a still hand does not loom', () => {
  const fast = approach(500, 150, 10);
  assert.ok(fast.drive.LPLC2_R > 50 && fast.drive.LC4_R > 10, JSON.stringify(fast.drive));
  assert.equal(fast.drive.LPLC2_L ?? 0, 0);
  assert.ok(fast.share.LPLC2_R > 0 && fast.share.LPLC2_R < 0.5);
  assert.ok(fast.loom.active && fast.loom.bearing !== null && Math.abs(fast.loom.bearing - Math.PI / 2) < 0.01);
  const slow = approach(20, 150, 10);
  assert.ok((slow.drive.LPLC2_R ?? 0) < fast.drive.LPLC2_R / 4);
  const still = approach(0, 100, 40);
  assert.equal(still.drive.LPLC2_R ?? 0, 0);
  assert.equal(still.drive.LC4_R ?? 0, 0);
  // A hand that just came into the window does not loom.
  assert.equal(new Senses().update(frameMs, pose, { ...quiet, hand: { x: 800, y: 510, height: 60 } }).drive.LC4_R ?? 0, 0);
});

void test('a swat\'s descent looms hard on both eyes, and blinding removes every visual input', () => {
  const senses = new Senses(); const swat = { start: 0 };
  let reading = senses.update(frameMs, pose, { ...quiet, hand: { x: 802, y: 500, height: handHeight(swat, 0) } });
  for (let t = frameMs; t <= 50; t += frameMs) reading = senses.update(frameMs, pose, { ...quiet, hand: { x: 802, y: 500, height: handHeight(swat, t) } });
  for (const g of ['LPLC2_L', 'LPLC2_R', 'LC4_L', 'LC4_R']) assert.ok(reading.drive[g] > 100, `${g} ${reading.drive[g]}`);
  assert.ok(reading.share.LPLC2_L > 0.4);
  const blind = new Senses().update(frameMs, pose, { ...quiet, blind: true, hand: { x: 802, y: 500, height: 10 }, flow: { x: 400, y: 0, coverage: 1 }, dusted: true });
  assert.deepEqual(Object.keys(blind.drive).sort(), ['JOCE_L', 'JOCE_R']);
  assert.equal(handHeight(swat, b.swatDescent.value), 0);
  assert.equal(handHeight(swat, b.swatDescent.value / 2), b.handHeight.value / 2);
});

void test('scrolling drives HS and H2, vibration falls off with distance, dust reaches JO-C and JO-E', () => {
  // Content moving back along a fly heading east: front-to-back on both eyes.
  const back = new Senses().update(frameMs, pose, { ...quiet, flow: { x: -400, y: 0, coverage: 1 } });
  assert.ok(back.drive.HS_L === 150 && back.drive.HS_R === 150 && !back.drive.H2_L);
  const forward = new Senses().update(frameMs, pose, { ...quiet, flow: { x: 200, y: 0, coverage: 0.5 } });
  assert.ok(forward.drive.H2_L > 0 && !forward.drive.HS_L);
  const near = new Senses().update(frameMs, pose, { ...quiet, vibrations: [{ x: 810, y: 500, strength: 1 }] });
  const far = new Senses().update(frameMs, pose, { ...quiet, vibrations: [{ x: 800 + mmToPx(300), y: 500, strength: 1 }] });
  assert.ok(near.drive.JO_L > 2 * far.drive.JO_L);
  assert.ok(new Senses().update(frameMs, pose, { ...quiet, dusted: true }).drive.JOCE_L > 140);
});

void test('food is tasted on contact, sugar more strongly when hungry, and smelled from afar towards its side', () => {
  const food = { x: 800 + mmToPx(2), y: 500, radius: mmToPx(1.5), sugar: 1, bitter: 0, smell: 0.5 };
  const fed = new Senses().update(frameMs, pose, { ...quiet, food: [food], hunger: 0 });
  const hungry = new Senses().update(frameMs, pose, { ...quiet, food: [food], hunger: 1 });
  assert.ok(hungry.tasting && hungry.drive.Sugar_L > fed.drive.Sugar_L);
  assert.equal(Math.round(hungry.drive.Sugar_L), 150);
  const bitter = new Senses().update(frameMs, pose, { ...quiet, food: [{ ...food, sugar: 0, bitter: 1 }] });
  assert.ok(bitter.drive.Bitter_R === 150 && !bitter.drive.Sugar_R);
  const away = new Senses().update(frameMs, pose, { ...quiet, food: [{ ...food, y: 500 + mmToPx(60) }] });
  assert.equal(away.tasting, null);
  assert.ok(away.drive.DM1_R > away.drive.DM1_L && away.smell.toward !== null && Math.abs(away.smell.toward - Math.PI / 2) < 0.1);
});

void test('a weak looming stimulus repeated quickly loses its effect, and the gain recovers', () => {
  const senses = new Senses(); let t = 0;
  const episode = () => {
    for (let k = 0; k < 20; k++, t += frameMs) senses.update(frameMs, pose, { ...quiet, hand: { x: 800 + mmToPx(150 - 1.2 * k), y: 500, height: 60 } });
    for (let k = 0; k < 30; k++, t += frameMs) senses.update(frameMs, pose, quiet);
  };
  episode(); const once = senses.loomGain; episode(); episode();
  assert.ok(once < 1 && senses.loomGain < once * 0.9, `${once} then ${senses.loomGain}`);
  for (let k = 0; k < 60 * 120; k++) senses.update(frameMs, pose, quiet);
  assert.ok(senses.loomGain > 0.95);
  // An escape keeps the gain.
  const escaping = new Senses();
  for (let k = 0; k < 20; k++) { escaping.update(frameMs, pose, { ...quiet, hand: { x: 800 + mmToPx(150 - 1.2 * k), y: 500, height: 60 } }); escaping.escaped(); }
  for (let k = 0; k < 30; k++) escaping.update(frameMs, pose, quiet);
  assert.ok(escaping.loomGain > 0.99);
});

// The motor layer fed by hand: a frame with the given spikes ({group: times}) and rates built up beforehand.
function motorWith(rates: Record<string, number>) {
  const motor = new Motor(circuit.groups, random(1));
  const reading = new Senses().update(frameMs, pose, quiet);
  const counts = circuit.groups.map(g => Math.round((rates[g.id] ?? 0) * g.neurons.length * frameMs / 1000));
  let t = 0; let command: Command | undefined;
  for (let k = 0; k < 20; k++) { t += frameMs; command = motor.update({ t, dt: frameMs, counts, events: [] }, reading, { airborne: false, dead: false, heading: 0, position: pose }); }
  return { motor, reading, command: command!, t };
}
const frame = (t: number, events: [string, number][]): BrainFrame => ({ t, dt: frameMs, counts: circuit.groups.map(() => 0), events: events.map(([id, at]) => ({ group: circuit.groupIndex.get(id)!, t: at })) });
const body = { airborne: false, dead: false, heading: 0, position: pose };

void test('escape mode comes from spike timing: the giant fibre before the wing raise is complete is short mode', () => {
  const reading = new Senses().update(frameMs, pose, quiet);
  // The first takeoff over frames given as [end time, spikes].
  const takeoff = (frames: [number, [string, number][]][]) => { const motor = new Motor(circuit.groups, random(1)); for (const [t, events] of frames) { const c = motor.update(frame(t, events), reading, body); if (c.takeoff) return c.takeoff; } return null; };
  // Giant-fibre spike 2 ms after the first wing-raise spike: short mode, under 7 ms.
  const s = takeoff([[100, [['DNp04_L', 95], ['DNp01_L', 97]]], [117, []]])!;
  assert.equal(s.mode, 'short'); assert.ok(s.duration < b.modeThreshold.value);
  // Giant-fibre spike 20 ms after the wing raise began: long mode, 7 ms or more, wings raised.
  const l = takeoff([[100, [['DNp04_L', 90], ['DNp02_L', 95]]], [117, [['DNp04_L', 105], ['DNp01_L', 110]]], [134, []]])!;
  assert.equal(l.mode, 'long'); assert.ok(l.duration >= b.modeThreshold.value);
  // A giant-fibre spike with no wing raise at all is short mode too, and leaves the ground a leg extension later.
  const alone = takeoff([[50, [['DNp01_R', 45]]], [67, []]])!;
  assert.equal(alone.mode, 'short'); assert.equal(alone.at, 45 + b.legExtension.value);
  // Nothing happens without a giant-fibre spike or a strongly held wing raise.
  assert.equal(takeoff([[100, [['DNp04_L', 95]]], [117, []], [134, []]]), null);
});

void test('the output neurons\' rates steer, back up, groom and feed', () => {
  // DNa01 and DNa02 turn the fly to their own side: left neurons, a left turn (negative in screen angles).
  assert.ok(motorWith({ DNa02_L: 100, DNa01_L: 50 }).motor.rate('DNa02_L') > 50);
  const left = motorWith({ DNa02_L: 100, DNa01_L: 50, P9_L: 60, P9_R: 60 }).command;
  assert.equal(left.behaviour, 'walk'); assert.ok(left.turn < -deg(100));
  assert.equal(motorWith({ MDN_L: 60, MDN_R: 60 }).command.behaviour, 'back');
  assert.ok(motorWith({ MDN_L: 60, MDN_R: 60 }).command.speed < 0);
  assert.equal(motorWith({ DNg11_L: 30, DNg11_R: 30 }).command.behaviour, 'groom');
  const feed = motorWith({ MN9_L: 100, MN9_R: 100 }).command;
  assert.equal(feed.behaviour, 'feed'); assert.ok(feed.proboscis > 0.5);
  const walk = motorWith({ P9_L: 100, P9_R: 100 }).command;
  assert.equal(walk.behaviour, 'walk'); assert.ok(walk.speed > b.walkSpeedSlow.value);
});

void test('the body walks at real speed, keeps to walls and edges, and flies, lands and is carried by scrolling', () => {
  const walker = new Body(800, 500, 0, random(2));
  const go: Command = { behaviour: 'walk', speed: b.walkSpeed.value, turn: 0, lean: 0, leanToward: 0, wings: 0, proboscis: 0, groom: null, takeoff: null, evade: null, flyTo: null };
  for (let k = 0; k < 60; k++) walker.step(frameMs, k * frameMs, go, terrain);
  // About 28 mm in a second, less the first 80 ms of speeding up.
  assert.ok(Math.abs(walker.x - 800 - mmToPx(b.walkSpeed.value)) < mmToPx(4), `${walker.x}`);
  // Walking into the right wall turns it along the wall.
  const wall = new Body(1590, 500, 0.1, random(3));
  for (let k = 0; k < 60; k++) wall.step(frameMs, k * frameMs, go, terrain);
  assert.ok(wall.x <= 1600 - wall.radius + 1e-6 && Math.abs(Math.cos(wall.heading)) < 0.3);
  // A panel edge within reach pulls it along.
  const panels: Terrain = { ...terrain, panels: [{ left: 300, top: 300, right: 1300, bottom: 700 }] };
  const edge = nearestEdge({ x: 800, y: 300 + mmToPx(2), heading: 0.3 }, panels, mmToPx(b.edgeRange.value));
  assert.ok(edge && Math.abs(edge.angle) < 1e-9 && edge.side < 0);
  const follower = new Body(500, 300 + mmToPx(3), 0.4, random(4));
  for (let k = 0; k < 60; k++) follower.step(frameMs, 10_000 + k * frameMs, go, panels);
  assert.ok(Math.abs(follower.y - 300) < mmToPx(b.edgeRange.value) && Math.abs(Math.sin(follower.heading)) < 0.3, `${follower.y} ${follower.heading}`);
  // Takeoff, flight and landing.
  const flier = new Body(800, 500, 0, random(5));
  // A takeoff 20 ms ago has flown for 20 ms by now: up and away (towards -x here).
  flier.step(frameMs, 0, { ...go, behaviour: 'takeoff', takeoff: { mode: 'long', direction: Math.PI, at: 0, duration: 12, withoutGiantFibre: false } }, terrain, 20);
  assert.ok(flier.airborne && flier.x < 800 && flier.altitude > 0, `${flier.x} ${flier.altitude}`);
  let landed = -1;
  for (let k = 1; k < 60 * 20 && landed < 0; k++) { flier.step(frameMs, k * frameMs, { ...go, behaviour: 'fly' }, terrain); if (!flier.airborne) landed = k; }
  assert.ok(landed > 0 && flier.x > 0 && flier.x < 1600 && flier.y > 0 && flier.y < 1000, `landed at frame ${landed}`);
  // Every flight lands within seconds, also with panels along the window's edges, where landing places lie near a wall.
  const edged: Terrain = { width: 1280, height: 800, panels: [{ left: 0, top: 0, right: 64, bottom: 800 }, { left: 64, top: 0, right: 300, bottom: 800 }, { left: 300, top: 0, right: 1280, bottom: 60 }, { left: 1000, top: 60, right: 1280, bottom: 800 }] };
  for (let seed = 1; seed <= 30; seed++) {
    const f = Body.arrive(edged, random(seed), 1, 0); let t = 0;
    while (f.airborne && t < 15_000) { t += frameMs; f.step(frameMs, t, { ...go, behaviour: 'fly' }, edged); }
    assert.ok(!f.airborne, `seed ${seed} still flying after ${t} ms at ${f.x}, ${f.y}`);
  }
  // A title bar is a wall: walking up into it turns the fly along it, and flights land below it.
  const titled: Terrain = { ...terrain, top: 32 };
  const climber = new Body(800, 60, -Math.PI / 2 + 0.1, random(7));
  for (let k = 0; k < 60; k++) climber.step(frameMs, k * frameMs, go, titled);
  assert.ok(climber.y >= 32 + climber.radius - 1e-6 && Math.abs(Math.sin(climber.heading)) < 0.3, `${climber.y} ${climber.heading}`);
  for (let seed = 1; seed <= 10; seed++) {
    const f = Body.arrive(titled, random(seed), 1, 0); let t = 0;
    while (f.airborne && t < 15_000) { t += frameMs; f.step(frameMs, t, { ...go, behaviour: 'fly' }, titled); }
    assert.ok(!f.airborne && f.y > 32, `seed ${seed} at ${f.y}`);
  }
  const carried = new Body(800, 500, 0, random(6)); carried.carry(0, -120);
  assert.equal(carried.y, 380);
  carried.squash(); carried.step(frameMs, 0, go, terrain);
  assert.equal(carried.y, 380);
  assert.ok(swatRadius(1) >= hitRadius(1) && hitRadius(4) === 4 * hitRadius(1));
});

// The closed loop against the in-process brain, as the overlay runs it with the worker: frames of step ms, and the brain
// answering each frame's input lag frames later, as the worker does.
function closedLoop(seed: number, ms: number, hand: (t: number, fly: { x: number; y: number }) => World['hand'], lag = 1, swatAt?: number, step = frameMs) {
  const rnd = random(seed); const outcomes: (Outcome & { t: number })[] = []; let now = 0;
  const loop = new FlyLoop(circuit, new Body(800, 500, rnd() * 2 * Math.PI, rnd), rnd, o => outcomes.push({ ...o, t: now }));
  const brain = new Brain(circuit, seed); const frames: BrainFrame[] = [];
  let swat: { x: number; y: number; start: number; radius: number } | null = null;
  for (; now < ms; now += step) {
    if (swatAt !== undefined && now >= swatAt && !swat) swat = { x: loop.body.x, y: loop.body.y, start: now, radius: swatRadius(1) };
    const drive = loop.sense(step, now, { ...quiet, hand: swat ? { x: swat.x, y: swat.y, height: handHeight(swat, now) } : hand(now, loop.body) });
    for (const id of inputs) brain.setGroupRate(id, drive[id] ?? 0, loop.share[id] ?? 1);
    frames.push(advance(brain, step));
    while (frames.length > lag) loop.think(frames.shift()!, now);
    loop.move(step, now, terrain);
    if (swat && now - swat.start <= b.swatDescent.value + 2 * frameMs && loop.strike(swat, now)) break;
    if (outcomes.length && !swat) break;
    if (swat && now - swat.start > b.swatDescent.value + 2 * frameMs) break;
  }
  return outcomes;
}
const toward = (speed: number, from: number) => (t: number, fly: { x: number; y: number }) => ({ x: fly.x + mmToPx(Math.max(10, from - speed * t / 1000)), y: fly.y, height: b.handHeight.value });

void test('closed loop: a fast approach makes the fly escape, a slow creep eventually does, a close strike squashes', t => {
  const fast = [1, 2, 3, 4, 5, 6].map(seed => closedLoop(seed, 2000, toward(500, 150))[0]);
  for (const o of fast) assert.equal(o?.kind, 'escape');
  const creep = [1, 2, 3, 4].map(seed => closedLoop(seed, 15_000, toward(20, 150))[0]);
  assert.ok(creep.filter(o => o?.kind === 'escape').length >= 3);
  // The swat: the hand hovers 2 mm from the fly for half a second, then comes down over 80 ms. The fly must clear the palm
  // before the hand reaches its height, so the outcome turns on how soon it takes off: after the visual delay, the
  // brain's few milliseconds to a giant-fibre spike, a leg extension and the window's own latency. Steps of 4 ms with the
  // brain 1 to 6 steps behind span the browser's latencies.
  const hover = (time: number, fly: { x: number; y: number }) => ({ x: fly.x + mmToPx(2), y: fly.y, height: b.handHeight.value });
  const swats = [1, 2, 3, 4, 5, 6].flatMap(lag => [11, 12, 13, 14].map(seed => ({ lag, outcome: closedLoop(seed, 1000, hover, lag, 500, 4) })));
  const squashed = swats.filter(s => s.outcome.some(o => o.kind === 'squash'));
  t.diagnostic(`fast approach: ${fast.map(o => o && 'mode' in o ? `${o.mode} ${o.reaction?.toFixed(0)} ms` : '-').join(', ')}`);
  t.diagnostic(`slow creep: ${creep.map(o => o && 'mode' in o ? `${o.mode} after ${(o.t / 1000).toFixed(1)} s` : 'no escape').join(', ')}`);
  t.diagnostic(`swats squashed by brain lag (4 ms steps): ${[1, 2, 3, 4, 5, 6].map(lag => `${lag}: ${squashed.filter(s => s.lag === lag).length}/4`).join(', ')}`);
  // Both happen: a quick close strike usually squashes it, and a quick enough fly escapes mid-swat.
  assert.ok(squashed.length >= swats.length / 2, `${squashed.length} of ${swats.length}`);
  assert.ok(squashed.length < swats.length);
});

// Elements appearing beside a fly kept in place, one every `every` ms with its nearest edge `gap` px away; what it did.
function appearing(seed: number, gap: number, ms: number, every: number) {
  const rnd = random(seed); let escapes = 0, froze = false;
  const loop = new FlyLoop(circuit, new Body(800, 500, rnd() * 2 * Math.PI, rnd), rnd, o => { if (o.kind === 'escape') escapes++; });
  const brain = new Brain(circuit, seed); const frames: BrainFrame[] = [];
  for (let now = 0, next = 300; now < ms; now += frameMs) {
    const appearances = now >= next ? [{ x: loop.body.x, y: loop.body.y + gap + 10, width: 200, height: 20 }] : [];
    if (appearances.length) next += every;
    if (loop.body.airborne) loop.body = new Body(800, 500, rnd() * 2 * Math.PI, rnd);
    const drive = loop.sense(frameMs, now, { ...quiet, appearances });
    for (const id of inputs) brain.setGroupRate(id, drive[id] ?? 0, loop.share[id] ?? 1);
    frames.push(advance(brain, frameMs));
    while (frames.length > 1) loop.think(frames.shift()!, now);
    loop.move(frameMs, now, terrain);
    froze ||= ['freeze', 'adjust', 'back'].includes(loop.command?.behaviour ?? '');
  }
  return { escapes, froze };
}

void test('an element appearing next to the fly can set it off, one further away makes it freeze, and a stream habituates', () => {
  // Measured before the falloff with distance and the habituation: nearly every appearance within 60 mm, even 150 px
  // away, was an escape, and a streaming transcript set the fly off six times a minute.
  const far = [1, 2, 3, 4].map(seed => appearing(seed, 40, 1500, Infinity));
  assert.ok(far.every(r => r.escapes === 0) && far.filter(r => r.froze).length >= 3, JSON.stringify(far));
  const near = [1, 2, 3, 4, 5, 6].map(seed => appearing(seed, 0, 1500, Infinity));
  assert.ok(near.some(r => r.escapes > 0), JSON.stringify(near));
  // Twenty rows appearing right beside it, one every 1.5 s.
  const stream = [1, 2].map(seed => appearing(seed, 2, 30_000, 1500).escapes);
  assert.ok(stream[0] + stream[1] <= 8, `${stream.join(' + ')} escapes of 40 appearances`);
});

void test('brain frames that arrive together before the body moves tell a takeoff once, and the fly takes off', () => {
  // The window moves the body about every 16 ms and the worker sends a frame every 8 ms, so two frames often come at once.
  for (const seed of [1, 2, 3, 4]) {
    const rnd = random(seed); const outcomes: Outcome[] = [];
    const loop = new FlyLoop(circuit, new Body(800, 500, rnd() * 2 * Math.PI, rnd), rnd, o => outcomes.push(o));
    const brain = new Brain(circuit, seed); let airborneAt: number | null = null;
    for (let now = 0; now < 3000 && (airborneAt === null || now < airborneAt + 300); now += 16) {
      const drive = loop.sense(16, now, { ...quiet, hand: toward(500, 150)(now, loop.body) });
      for (const id of inputs) brain.setGroupRate(id, drive[id] ?? 0, loop.share[id] ?? 1);
      const frames = [advance(brain, 8), advance(brain, 8)];
      for (const frame of frames) loop.think(frame, now);
      loop.move(16, now, terrain);
      if (loop.body.airborne && airborneAt === null) airborneAt = now;
    }
    assert.ok(airborneAt !== null, `seed ${seed}: no takeoff`);
    const escapes = outcomes.filter(o => o.kind === 'escape');
    assert.equal(escapes.length, 1, `seed ${seed}: ${escapes.length} escapes told`);
    assert.ok(escapes[0].reaction !== null);
  }
});

void test('reaction times from looming onset to takeoff, and short against long mode', t => {
  const results: { speed: number; mode: string; reaction: number }[] = [];
  for (const speed of [100, 200, 400, 800]) for (let seed = 1; seed <= 10; seed++) {
    const o = closedLoop(100 * speed + seed, 4000, toward(speed, 200), 2)[0];
    if (o?.kind === 'escape' && o.reaction !== null) results.push({ speed, mode: o.mode, reaction: o.reaction });
  }
  const median = (v: number[]) => { const s = [...v].sort((a, c) => a - c); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
  for (const speed of [100, 200, 400, 800]) {
    const r = results.filter(x => x.speed === speed);
    t.diagnostic(`${speed} mm/s: ${r.length}/10 escaped, median ${median(r.map(x => x.reaction)).toFixed(0)} ms, ${r.filter(x => x.mode === 'short').length} short and ${r.filter(x => x.mode === 'long').length} long mode`);
  }
  const bins = [0, 50, 100, 200, 400, 800, 1600, Infinity];
  t.diagnostic(`histogram (ms): ${bins.slice(0, -1).map((lo, i) => `${lo}-${bins[i + 1]}: ${results.filter(x => x.reaction >= lo && x.reaction < bins[i + 1]).length}`).join(', ')}`);
  assert.ok(results.length >= 30);
  // Faster looming, quicker escapes.
  assert.ok(median(results.filter(x => x.speed === 800).map(x => x.reaction)) < median(results.filter(x => x.speed === 100).map(x => x.reaction)));
});

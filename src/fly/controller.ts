import { biology as b, foods, mmToPx, type FoodKind } from './biology.ts';
import { Body, type Rect, type Terrain } from './body.ts';
import type { BrainFrame } from './brain.ts';
import type { CircuitGroup } from './circuit.ts';
import { FlyLoop, handHeight, hitRadius, swatRadius, type Outcome, type Swat } from './loop.ts';
import type { FromBrain, ToBrain } from './protocol.ts';
import type { Point, World } from './senses.ts';
import { fed, flyStateKey, hungerNow, medianReaction, readFlyState, recordOutcome, sizeLimits, writeFlyState, type FlyState } from './store.ts';
import { drawFly, drawFood, drawSmear, drawSwat, smearFade, type Smear } from './draw.ts';

// The fly of this page (docs/fly.md): one per page, run while the settings menu has it on. It owns the two canvases, the brain's
// worker, the fly's loop (senses, motor layer, body) and what the page tells the senses. It reads the page's geometry only:
// positions and sizes of elements, scroll offsets, where the pointer is, that a key was pressed (never which) and that something
// was clicked; never any text. The settings menu (web/app.js) reads and steers it through the methods below.

// Page coordinates, so that it scrolls with the page, and when it was dropped.
type FoodItem = { id: number; kind: FoodKind; x: number; y: number; at: number };
export type FlySnapshot = { ready: boolean; behaviour: string; size: number; hunger: number; generation: number; escapes: number; squashes: number; reaction: number | null; blind: boolean; scrambled: boolean };
// Elements whose edges the fly walks along and on which it lands: the page's panels, measured, never read.
const panelSelector = 'header, footer, section, [role="dialog"], .tab, .champ, .build, .receipt, .cell';
// What is pale enough that the fly needs its dark outline: the receipt's paper.
const lightGround = '.sheet';
// How long food lies on the page, in ms: nothing eats it away.
const foodLife = 120_000;
const random = () => Math.random();
// ms between two of the fly's frames: about 60 a second, whatever the display's rate.
const frameMs = 16;

class FlyController {
  // The window-sized canvas holds what lies on the ground (smears, food, a swat's shadow) and is redrawn only when that
  // changes; the fly has a small canvas of its own that moves with it, so a frame never repaints the whole window.
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private flyCanvas: HTMLCanvasElement | null = null;
  private flyCtx: CanvasRenderingContext2D | null = null;
  private drawnGround = '';
  private drawnFly = '';
  private box = { width: 0, height: 0 };
  // The input last posted to the brain, so an unchanged one is not posted again.
  private sent = '';
  private dark = true;
  private worker: Worker | null = null;
  private groups: CircuitGroup[] = [];
  private loop: FlyLoop | null = null;
  private frames: BrainFrame[] = [];
  private state: FlyState = readFlyState();
  private terrain: Terrain = { width: 0, height: 0, panels: [] };
  private terrainAt = 0;
  private hand: Point | null = null;
  private swat: Swat | null = null;
  private vibrations: World['vibrations'] = [];
  private appearances: World['appearances'] = [];
  private flow = { x: 0, y: 0, coverage: 0 };
  private dusted = false;
  private added: Element[] = [];
  private addedAt = 0;
  private observer: MutationObserver | null = null;
  private scrolls = new WeakMap<Element, Point>();
  private lookedAt = 0;
  private blind = false;
  private scrambled = false;
  private smears: Smear[] = [];
  private arrival: number | null = null;
  private food: FoodItem[] = [];
  private foodId = 0;
  private listeners = new Set<() => void>();
  private timer = 0;
  private paintRequest = 0;
  private ticks = 0;
  private last = 0;
  private notified = 0;
  private savedAt = 0;
  private pendingEscape: { outcome: Outcome; at: number } | null = null;
  private running = false;

  // Starts the fly: its canvases over the page, the brain's worker, the page's listeners. Starting it again does nothing.
  start() {
    if (this.running) return;
    this.canvas = document.createElement('canvas'); this.flyCanvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483000;display:none';
    this.flyCanvas.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:2147483001;visibility:hidden;will-change:transform';
    for (const canvas of [this.canvas, this.flyCanvas]) canvas.setAttribute('aria-hidden', 'true');
    document.body.append(this.canvas, this.flyCanvas);
    this.ctx = this.canvas.getContext('2d'); this.flyCtx = this.flyCanvas.getContext('2d'); this.running = true;
    this.drawnGround = ''; this.drawnFly = ''; this.sent = ''; this.box = { width: 0, height: 0 };
    this.state = readFlyState();
    this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<FromBrain>) => this.receive(event.data);
    // a brain that could not start (its circuit did not load) leaves the page as it was
    this.worker.onerror = event => { event.preventDefault(); this.stop(); };
    document.addEventListener('pointermove', this.onPointerMove, { capture: true, passive: true });
    document.addEventListener('pointerdown', this.onPointerDown, { capture: true });
    document.documentElement.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
    window.addEventListener('blur', this.onPointerLeave);
    document.addEventListener('keydown', this.onKeyDown, { capture: true, passive: true });
    document.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('storage', this.onStorage);
    this.observer = new MutationObserver(this.onMutations);
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.last = performance.now();
    this.resume();
  }

  // The fly's frames run on a timer while the page is visible; a picture is drawn, at the display's next frame, only when it
  // changed. An animation-frame loop would cost the page a frame at the display's rate even with nothing to draw.
  private resume() { if (!this.timer && this.running && !document.hidden) { this.last = performance.now(); this.timer = window.setInterval(this.frame, frameMs); } }
  private pause() { clearInterval(this.timer); this.timer = 0; cancelAnimationFrame(this.paintRequest); this.paintRequest = 0; }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.pause();
    this.worker?.terminate(); this.worker = null;
    document.removeEventListener('pointermove', this.onPointerMove, { capture: true });
    document.removeEventListener('pointerdown', this.onPointerDown, { capture: true });
    document.documentElement.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('blur', this.onPointerLeave);
    document.removeEventListener('keydown', this.onKeyDown, { capture: true });
    document.removeEventListener('scroll', this.onScroll, { capture: true });
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('storage', this.onStorage);
    this.observer?.disconnect(); this.observer = null;
    this.loop = null; this.frames = []; this.swat = null; this.groups = []; this.food = []; this.smears = []; this.arrival = null;
    writeFlyState(this.state);
    this.canvas?.remove(); this.flyCanvas?.remove();
    this.canvas = null; this.ctx = null; this.flyCanvas = null; this.flyCtx = null;
    this.notify(true);
  }

  // The settings menu.
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  snapshot(): FlySnapshot {
    const loop = this.loop;
    return {
      ready: Boolean(loop), behaviour: loop?.body.dead ? 'squashed' : loop?.command?.behaviour ?? (loop ? 'arriving' : 'starting'),
      size: this.state.size, hunger: hungerNow(this.state), generation: this.state.generation, escapes: this.state.stats.escapes, squashes: this.state.stats.squashes,
      reaction: medianReaction(this.state.stats.reactions), blind: this.blind, scrambled: this.scrambled,
    };
  }
  // Food lands at the fly's head, so that it tastes it at once. Nothing eats it away; it is gone after a while.
  dropFood(kind: FoodKind) {
    const body = this.loop?.body; if (!body || body.dead) return;
    const reach = mmToPx(foods[kind].radius + b.contact.value / 2);
    const margin = mmToPx(foods[kind].radius);
    const x = Math.min(window.innerWidth - margin, Math.max(margin, body.x + Math.cos(body.heading) * reach));
    const y = Math.min(window.innerHeight - margin, Math.max(margin, body.y + Math.sin(body.heading) * reach));
    this.food = [...this.food.slice(-5), { id: ++this.foodId, kind, x: x + window.scrollX, y: y + window.scrollY, at: performance.now() }];
    this.notify(true);
  }
  dust() { this.dusted = true; }
  setSize(size: number) {
    this.state = { ...this.state, size: Math.min(sizeLimits.max, Math.max(sizeLimits.min, size)) };
    if (this.loop) this.loop.body.size = this.state.size;
    writeFlyState(this.state); this.notify(true);
  }
  setBlind(on: boolean) { this.blind = on; this.notify(true); }
  setScrambled(on: boolean) { this.scrambled = on; this.send({ type: 'scramble', on }); this.notify(true); }

  private send(message: ToBrain) { this.worker?.postMessage(message); }
  private notify(now = false) {
    const t = performance.now();
    if (!now && t - this.notified < 100) return;
    this.notified = t; for (const listener of this.listeners) listener();
  }

  private receive(message: FromBrain) {
    if (message.type === 'ready') {
      this.groups = message.groups;
      this.refreshTerrain(performance.now());
      this.loop = new FlyLoop({ groups: this.groups }, Body.arrive(this.terrain, random, this.state.size, performance.now()), random, outcome => this.outcome(outcome));
      if (this.scrambled) this.send({ type: 'scramble', on: true });
      this.send({ type: 'run', on: !document.hidden });
      this.notify(true);
    } else if (message.type === 'frame') {
      const events: BrainFrame['events'] = [];
      for (let k = 0; k < message.events.length; k += 2) events.push({ group: message.events[k], t: message.events[k + 1] });
      this.frames.push({ t: message.t, dt: message.dt, counts: message.counts, events });
      // Spikes of the output neurons are answered at once rather than at the next frame: an escape is a race.
      if (message.events.length && this.timer) queueMicrotask(this.frame);
    }
  }

  private outcome(outcome: Outcome) {
    const now = performance.now();
    if (outcome.kind === 'squash') {
      // A takeoff the swat still caught counts as a squash only.
      this.pendingEscape = null;
      this.state = recordOutcome(this.state, outcome);
      const body = this.loop!.body;
      this.smears = [...this.smears.filter(s => now - s.at < smearFade), { x: body.x + window.scrollX, y: body.y + window.scrollY, at: now, size: this.state.size, seed: Math.floor(Math.random() * 2 ** 31) }];
      this.arrival = now + 4000;
      writeFlyState(this.state); this.notify(true);
    } else this.pendingEscape = { outcome, at: now };
  }

  // Geometry of the panels, at most every 2 s.
  private refreshTerrain(now: number) {
    this.terrainAt = now;
    const width = window.innerWidth, height = window.innerHeight;
    const panels: Rect[] = [];
    for (const element of document.querySelectorAll(panelSelector)) {
      const r = element.getBoundingClientRect();
      if (r.width < 80 || r.height < 40 || r.right <= 0 || r.left >= width || r.bottom <= 0 || r.top >= height) continue;
      panels.push({ left: Math.max(0, r.left), top: Math.max(0, r.top), right: Math.min(width, r.right), bottom: Math.min(height, r.bottom) });
      if (panels.length >= 60) break;
    }
    this.terrain = { width, height, panels };
  }

  private onPointerMove = (event: PointerEvent) => { this.hand = { x: event.clientX, y: event.clientY }; };
  private onPointerLeave = () => { this.hand = null; };
  // A press on the fly starts a swat and is consumed, with the click it would make; any other press is a tap the fly feels.
  private onPointerDown = (event: PointerEvent) => {
    const body = this.loop?.body;
    if (!body || body.dead || this.swat || event.button !== 0 || Math.hypot(event.clientX - body.x, event.clientY - body.y) > hitRadius(this.state.size)) {
      this.vibrations.push({ x: event.clientX, y: event.clientY, strength: 1 }); return;
    }
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    swallowPress(event.pointerId);
    this.swat = { x: event.clientX, y: event.clientY, start: performance.now(), radius: swatRadius(this.state.size) };
    // The eyes see the hand coming down from now, not from the next frame.
    if (this.timer) this.frame();
  };
  // A key press is felt where the focused element is; which key it was is never read.
  private onKeyDown = () => {
    const focused = document.activeElement;
    const r = focused && focused !== document.body ? focused.getBoundingClientRect() : null;
    this.vibrations.push(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, strength: 0.6 } : { x: window.innerWidth / 2, y: window.innerHeight, strength: 0.4 });
  };
  // Scrolled content carries a fly standing on it and is wide-field motion for its eyes.
  private onScroll = (event: Event) => {
    const element = event.target instanceof Element ? event.target : document.scrollingElement;
    if (!element) return;
    const now = { x: element.scrollLeft, y: element.scrollTop };
    const before = this.scrolls.get(element); this.scrolls.set(element, now);
    if (!before) return;
    const dx = now.x - before.x, dy = now.y - before.y;
    if (!dx && !dy) return;
    const r = element === document.scrollingElement ? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight } : element.getBoundingClientRect();
    const body = this.loop?.body;
    if (body && body.x >= r.left && body.x <= r.right && body.y >= r.top && body.y <= r.bottom) body.carry(-dx, -dy);
    this.flow.x -= dx; this.flow.y -= dy;
    const area = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
    this.flow.coverage = Math.max(this.flow.coverage, Math.min(1, area / (window.innerWidth * window.innerHeight)));
  };
  // What lies under the fly, twice a second: whether it stands on the receipt's paper, and the scroll offsets of the containers
  // there, kept ahead of their first scroll event, which says only where they are now.
  private lookUnder(now: number) {
    const body = this.loop?.body; if (!body || now - this.lookedAt < 500) return;
    this.lookedAt = now;
    const under = document.elementFromPoint(body.x, body.y);
    const dark = !under?.closest(lightGround);
    if (dark !== this.dark) { this.dark = dark; this.drawnFly = ''; }
    for (let element = under; element; element = element.parentElement)
      if (!this.scrolls.has(element) && (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth)) this.scrolls.set(element, { x: element.scrollLeft, y: element.scrollTop });
    const page = document.scrollingElement;
    if (page && !this.scrolls.has(page)) this.scrolls.set(page, { x: page.scrollLeft, y: page.scrollTop });
  }
  // Every tab has its own fly but they share one record: another tab that wrote it is taken up here, or this tab's next write
  // would put back its older copy and lose that tab's escapes and squashes.
  private onStorage = (event: StorageEvent) => { if (event.key === flyStateKey) { this.state = readFlyState(); this.notify(true); } };
  private onVisibility = () => { this.send({ type: 'run', on: !document.hidden }); if (document.hidden) this.pause(); else this.resume(); };
  // Elements that appear: kept to be measured at most four times a second.
  private onMutations = (records: MutationRecord[]) => {
    for (const record of records) for (const node of record.addedNodes) if (node instanceof Element && this.added.length < 30) this.added.push(node);
  };
  private measureAdded(now: number) {
    if (now - this.addedAt < 250 || !this.added.length) return;
    this.addedAt = now;
    for (const element of this.added.splice(0)) {
      if (!element.isConnected) continue;
      const r = element.getBoundingClientRect();
      // Page-wide containers are a page changing, not something appearing beside the fly.
      if (r.width < 4 || r.height < 4 || r.width > window.innerWidth * 0.6) continue;
      this.appearances.push({ x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height });
    }
  }

  private foodInWindow() {
    const now = performance.now();
    if (this.food.some(f => now - f.at >= foodLife)) this.food = this.food.filter(f => now - f.at < foodLife);
    return this.food.map(f => ({ ...foods[f.kind], kind: f.kind, x: f.x - window.scrollX, y: f.y - window.scrollY, radius: mmToPx(foods[f.kind].radius) }));
  }

  private frame = () => {
    const now = performance.now();
    if (now - this.last < 1) return;
    const dt = Math.min(100, now - this.last); this.last = now;
    const canvas = this.canvas, loop = this.loop;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio), height = Math.round(window.innerHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; this.drawnGround = ''; this.drawnFly = ''; this.box = { width: 0, height: 0 }; this.refreshTerrain(now); }
    if (!loop) return;
    if (now - this.terrainAt > 2000) this.refreshTerrain(now);
    this.measureAdded(now);
    this.lookUnder(now);
    const food = this.foodInWindow();
    const hand = this.swat ? { x: this.swat.x, y: this.swat.y, height: handHeight(this.swat, now) } : this.hand && { ...this.hand, height: b.handHeight.value };
    const world: World = {
      hand, flow: { x: this.flow.x / (dt / 1000), y: this.flow.y / (dt / 1000), coverage: this.flow.coverage }, vibrations: this.vibrations, appearances: this.appearances,
      food, hunger: hungerNow(this.state), blind: this.blind, dusted: this.dusted,
    };
    this.vibrations = []; this.appearances = []; this.flow = { x: 0, y: 0, coverage: 0 }; this.dusted = false;
    const rates = loop.sense(dt, now, world); const shares = loop.share;
    const input = JSON.stringify([rates, shares]);
    if (input !== this.sent) { this.sent = input; this.send({ type: 'drive', rates, shares }); }
    for (const brainFrame of this.frames.splice(0)) loop.think(brainFrame, now);
    loop.move(dt, now, this.terrain);
    if (this.swat && (loop.strike(this.swat, now) || now - this.swat.start > b.swatDescent.value + 60)) this.swat = null;
    // Feeding on sugar sates it.
    if (loop.command?.behaviour === 'feed' && (loop.reading?.tasting?.sugar ?? 0) > 0) this.state = fed(this.state, dt);
    if (this.pendingEscape && now - this.pendingEscape.at > 300) { this.state = recordOutcome(this.state, this.pendingEscape.outcome); this.pendingEscape = null; writeFlyState(this.state); this.notify(true); }
    // A new fly arrives from an edge after a squash.
    if (loop.body.dead && this.arrival !== null && now >= this.arrival) {
      this.arrival = null;
      this.state = { ...this.state, generation: this.state.generation + 1 };
      loop.body = Body.arrive(this.terrain, random, this.state.size, now);
      writeFlyState(this.state); this.notify(true);
    }
    if (now - this.savedAt > 10_000) { this.savedAt = now; writeFlyState(this.state); }
    // Moving anything on the page costs the GPU process a frame (measured: a small layer moved 60 times a second, 38% of a
    // core; 30 times, 21%), so a fly on the ground is drawn every other frame, about 30 times a second; in the air and
    // under a swat, every frame.
    this.ticks++;
    const due = loop.body.airborne || this.swat !== null || this.ticks % 2 === 0;
    if (due && !this.paintRequest && (this.groundKey(now, food) !== this.drawnGround || this.flyKey(now) !== this.drawnFly)) this.paintRequest = requestAnimationFrame(this.paint);
    this.notify();
  };

  private paint = (now: number) => {
    this.paintRequest = 0;
    const ctx = this.ctx; if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    this.drawGround(ctx, ratio, now, this.foodInWindow());
    this.drawBody(ratio, now);
  };

  // What the ground layer shows: smears (a fading one changes once a second), food and a swat, where the page has scrolled them.
  private groundKey(now: number, food: ReturnType<FlyController['foodInWindow']>) {
    return [this.smears.map(smear => `${smear.at}:${Math.floor((now - smear.at) / 1000)}`).join(), food.map(f => `${f.kind}:${f.x.toFixed(1)}:${f.y.toFixed(1)}`).join(), this.swat ? now : '', this.smears.length ? `${window.scrollX}:${window.scrollY}` : ''].join('|');
  }
  // What the fly's picture shows, rounded below what can be seen: a fly at rest eases towards stillness without reaching
  // it. Beating wings change every frame.
  private flyKey(now: number) {
    const body = this.loop?.body;
    if (!body || body.dead) return '';
    const pose = body.pose(); const q = (v: number, step: number) => Math.round(v / step);
    return pose.beating ? String(now) : [q(pose.x, 0.1), q(pose.y, 0.1), q(pose.heading, 0.002), q(pose.altitude, 0.1), pose.mode, q(pose.wings, 0.01), pose.moving ? q(pose.gait, 0.05) : '',
      q(pose.proboscis, 0.01), pose.groom ? q(pose.groomPhase, 0.05) : '', q(pose.lean, 0.005), q(pose.leanToward, 0.01), this.state.size].join();
  }

  // Smears, food and a swat, redrawn only when one of them changes.
  private drawGround(ctx: CanvasRenderingContext2D, ratio: number, now: number, food: ReturnType<FlyController['foodInWindow']>) {
    this.smears = this.smears.filter(smear => now - smear.at < smearFade);
    const key = this.groundKey(now, food);
    if (key === this.drawnGround) return;
    this.drawnGround = key;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    // With nothing on the ground the canvas is taken out of the page: a window-sized layer over everything costs the GPU
    // process on every frame of the page, even while it never changes.
    const empty = !this.smears.length && !food.length && !this.swat;
    ctx.canvas.style.display = empty ? 'none' : 'block';
    if (empty) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    for (const smear of this.smears) drawSmear(ctx, { ...smear, x: smear.x - window.scrollX, y: smear.y - window.scrollY }, mmToPx(1), now);
    for (const f of food) drawFood(ctx, f);
    if (this.swat) drawSwat(ctx, this.swat, handHeight(this.swat, now), this.swat.radius, this.dark);
  }

  // The fly on its own canvas, just large enough for it and its shadow, moved to where it is; redrawn only when its
  // picture changes.
  private drawBody(ratio: number, now: number) {
    const canvas = this.flyCanvas, ctx = this.flyCtx; if (!canvas || !ctx) return;
    const body = this.loop?.body;
    const key = this.flyKey(now);
    if (key === this.drawnFly) return;
    this.drawnFly = key;
    if (!body || body.dead) { canvas.style.visibility = 'hidden'; return; }
    const pose = body.pose(); const s = mmToPx(1) * this.state.size;
    // drawFly reaches at most 2.8 body millimetres from the centre (the beating wings), scaled up with height; the shadow
    // lies down and right of it in flight, blurred.
    const reach = 2.8 * s * (1 + pose.altitude / 300) + 3;
    const off = pose.altitude * 0.35 * s; const shade = 1.8 * s + (pose.altitude > 1 ? 2 * Math.min(6, pose.altitude / 8) : 0) + 3;
    const left = Math.floor(Math.min(pose.x - reach, pose.x + off - shade)), top = Math.floor(Math.min(pose.y - reach, pose.y + off * 1.3 - shade));
    const width = Math.ceil(Math.max(pose.x + reach, pose.x + off + shade)) - left, height = Math.ceil(Math.max(pose.y + reach, pose.y + off * 1.3 + shade)) - top;
    // The canvas only grows (in steps, so it is rarely reallocated) and shrinks back once the fly lands.
    if (width > this.box.width || height > this.box.height || (!pose.altitude && this.box.width > 2 * width + 64)) {
      this.box = { width: Math.ceil(width / 32) * 32, height: Math.ceil(height / 32) * 32 };
      canvas.width = Math.round(this.box.width * ratio); canvas.height = Math.round(this.box.height * ratio);
      canvas.style.width = `${this.box.width}px`; canvas.style.height = `${this.box.height}px`;
    }
    canvas.style.transform = `translate(${left}px, ${top}px)`; canvas.style.visibility = 'visible';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawFly(ctx, pose, s, this.dark, now, { x: pose.x - left, y: pose.y - top });
  }
}

// After a press on the fly, the rest of that press (its release, the click and the mouse events) goes nowhere, so it never
// presses what lies under the fly.
function swallowPress(pointerId: number) {
  const types = ['pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu'];
  const stop = (event: Event) => {
    if (event instanceof PointerEvent && event.pointerId !== pointerId) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    if (event.type === 'click') done();
  };
  const done = () => { clearTimeout(timer); for (const type of types) document.removeEventListener(type, stop, { capture: true }); };
  for (const type of types) document.addEventListener(type, stop, { capture: true });
  const timer = setTimeout(done, 1500);
}

export const flyController = new FlyController();

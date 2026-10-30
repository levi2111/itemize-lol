import { biology as b } from './biology.ts';
import type { Outcome } from './loop.ts';

// What the fly keeps in this browser between visits (docs/fly.md): the size multiplier, its hunger, the generation (one more
// for every fly that arrives after a squash) and its escape record. Whether the fly shows at all is the settings menu's
// (web/app.js). Storage can be unavailable or hold anything; both fall back to the defaults.

export type Reaction = { ms: number; mode: 'short' | 'long' };
export type FlyStats = { escapes: number; squashes: number; short: number; long: number; reactions: Reaction[] };
// hunger is its value at hungerAt (ms since the epoch); it rises in real time from there.
export type FlyState = { size: number; hunger: number; hungerAt: number; generation: number; stats: FlyStats };

export const sizeLimits = { min: 1, max: 4 } as const;
const keptReactions = 200;
export const flyStateKey = 'fly';
export const defaultFlyState = (now = Date.now()): FlyState => ({ size: 1, hunger: 0.3, hungerAt: now, generation: 1, stats: { escapes: 0, squashes: 0, short: 0, long: 0, reactions: [] } });

const count = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function parseFlyState(value: unknown, now = Date.now()): FlyState {
  const v = (value ?? {}) as Partial<FlyState>; const fallback = defaultFlyState(now);
  const s = (v.stats ?? {}) as Partial<FlyStats>;
  const reactions = Array.isArray(s.reactions) ? s.reactions.filter((r): r is Reaction => !!r && typeof r.ms === 'number' && Number.isFinite(r.ms) && r.ms >= 0 && (r.mode === 'short' || r.mode === 'long')).slice(-keptReactions) : [];
  return {
    size: typeof v.size === 'number' && Number.isFinite(v.size) ? Math.min(sizeLimits.max, Math.max(sizeLimits.min, v.size)) : fallback.size,
    hunger: typeof v.hunger === 'number' && Number.isFinite(v.hunger) ? clamp01(v.hunger) : fallback.hunger,
    hungerAt: typeof v.hungerAt === 'number' && Number.isFinite(v.hungerAt) && v.hungerAt <= now ? v.hungerAt : now,
    generation: Math.max(1, count(v.generation)),
    stats: { escapes: count(s.escapes), squashes: count(s.squashes), short: count(s.short), long: count(s.long), reactions },
  };
}

// Hunger now: from fed (0) to fully hungry (1) over hungerRise hours.
export const hungerNow = (state: FlyState, now = Date.now()) => clamp01(state.hunger + (now - state.hungerAt) / (b.hungerRise.value * 3_600_000));
// Feeding for ms lowers hunger by a meal's worth per meal length.
export const fed = (state: FlyState, ms: number, now = Date.now()): FlyState => ({ ...state, hunger: clamp01(hungerNow(state, now) - ms / (b.meal.value * 1000)), hungerAt: now });

// A takeoff the fly survived, or a squash. Reaction times are kept for escapes from looming (the last 200).
export function recordOutcome(state: FlyState, outcome: Outcome): FlyState {
  const stats = { ...state.stats };
  if (outcome.kind === 'squash') stats.squashes++;
  else if (outcome.mode !== 'voluntary') {
    stats.escapes++;
    stats[outcome.mode]++;
    if (outcome.reaction !== null) stats.reactions = [...stats.reactions, { ms: Math.round(outcome.reaction), mode: outcome.mode }].slice(-keptReactions);
  }
  return { ...state, stats };
}

// The middle reaction time (ms), as the settings menu shows it; null before the first.
export function medianReaction(reactions: Reaction[]) {
  if (!reactions.length) return null;
  const ms = reactions.map(r => r.ms).sort((a, c) => a - c); const middle = Math.floor(ms.length / 2);
  return ms.length % 2 ? ms[middle] : Math.round((ms[middle - 1] + ms[middle]) / 2);
}

export function readFlyState(): FlyState {
  try { const raw = localStorage.getItem(flyStateKey); return parseFlyState(raw ? JSON.parse(raw) : undefined); } catch { return defaultFlyState(); }
}
export function writeFlyState(state: FlyState) {
  try { localStorage.setItem(flyStateKey, JSON.stringify(state)); } catch { /* storage unavailable */ }
}

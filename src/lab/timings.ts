/* Hand-written timings for the lab, by champion id and action. They replace what timingsFor
   reads from the dataset or assumes, and show as `model` on the page.

   Only write a number you have a source for: the game files (Community Dragon's
   characters/<id>/<id>.bin.json: the champion's basic attack windup, a spell's missile speed,
   cast range and line width) or a measurement of the live game. Each entry says where it came
   from. A champion left out plays with the dataset's values and the assumptions in timeline.ts.

     lock   basic attack: share of the attack period spent winding up (e.g. 0.17).
            ability: seconds the champion is locked in the cast
     range  edge to edge, in game units
     speed  units per second the damage travels after the lock; 0 lands at once
     dash   a dash toward the target, whose damage lands at its end; null removes one the data implied */

export interface HandTiming {
  lock?: number;
  range?: number;
  speed?: number;
  dash?: { speed: number; distance: number } | null;
  /** where the numbers came from */
  source: string;
}

export const TIMINGS: Record<string, Partial<Record<'aa' | 'q' | 'w' | 'e' | 'r', HandTiming>>> = {};

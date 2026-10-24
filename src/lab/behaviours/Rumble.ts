/* Rumble: Electro Harpoon holds two harpoons, each coming back after the ammo recharge the game file gives.
   Scrap Shield is self-cast with nothing to reach. At full Heat he overheats for OverheatDuration: silenced while
   his attacks burn, after which his Heat is back to zero. The hooks keep that. */
import { behaviour, type HookContext } from '../behaviour.ts';

/** RumbleHeatSystem.OverheatingHeat and OverheatDuration; the Heat each Q, W or E generates (their InitialHeatCost,
    HeatCost and FirstCastHeatCost are all 20) */
const OVERHEAT = 150, OVERHEAT_SECONDS = 4, PER_CAST = 20;

const heat = (c: HookContext) => c.option('startHeat') + c.counter('built');
/** Is Rumble overheated now? When the overheat runs out his Heat is emptied. */
function overheated(c: HookContext): boolean {
  // a fight that starts at full Heat starts overheated
  if (c.state.overUntil === undefined && heat(c) >= OVERHEAT) c.state.overUntil = c.t + OVERHEAT_SECONDS;
  if (c.state.overUntil === undefined) return false;
  if (c.t < c.state.overUntil - 1e-9) return true;
  c.setCounter('built', -c.option('startHeat'));
  delete c.state.overUntil;
  return false;
}

export default behaviour('Rumble', {
  reviewed: '16.20.1',
  sources: ['Electro Harpoon\'s two charges coming back 6 seconds apart are RumbleGrenade\'s ammo recharge in the game file.'],
  actions: {
    w: { range: 20000 },
    e: { charges: { count: 2, recharge: 6 } },
  },
  hooks: {
    canStart(c) {
      if (!overheated(c)) return true;
      c.note('Overheated, Rumble is silenced for 4 seconds: his abilities wait for it to end.');
      return false;
    },
    onStart(c) { overheated(c); },
    onLand(c) {
      // the model adds a cast's Heat as it lands: the cast that fills the bar starts the overheat
      if (c.action !== 'aa' && c.action !== 'r' && c.state.overUntil === undefined && heat(c) + PER_CAST >= OVERHEAT) c.state.overUntil = c.t + OVERHEAT_SECONDS;
    },
  },
  notes: [
    'Heat does not cool off between casts here; it only empties when an overheat ends.',
    'Electro Harpoon\'s ammo recharge is not shortened by ability haste.',
  ],
});

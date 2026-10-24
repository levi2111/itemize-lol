/* Ryze: Overload flies as RyzeQ (the wrapper the slot casts has no missile). Rune Prison and Spell Flux refresh
   Overload's cooldown as they are cast, which is his whole combo (E Q W Q E Q). Flux is set by Spell Flux for
   DebuffDuration and spent by the next Overload or Rune Prison that lands, so the model's "Target has Flux"
   follows the order of casts. */
import { behaviour, type HookContext } from '../behaviour.ts';

/** Flux spent by an Overload or Rune Prison is taken off after that cast's damage has landed. */
function spend(c: HookContext) {
  if (!c.state.init) { c.state.init = 1; c.setOption('flux', 0); }
  if (c.state.spent) { c.state.spent = 0; c.setOption('flux', 0); }
}

export default behaviour('Ryze', {
  reviewed: '16.20.1',
  actions: {
    q: { spell: 'RyzeQ' },
  },
  windows: [{ option: 'flux', after: 'e', for: 'DebuffDuration' }],
  hooks: {
    onStart(c) {
      spend(c);
      if (c.action === 'w' || c.action === 'e') c.setReadyAt('q', c.t);
    },
    onLand(c) {
      spend(c);
      if ((c.action === 'q' || c.action === 'w') && c.option('flux')) c.state.spent = 1;
    },
  },
  notes: ['Overload\'s runes and their move speed are not played.'],
});

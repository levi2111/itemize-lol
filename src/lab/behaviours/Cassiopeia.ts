/* Cassiopeia: Noxious Blast erupts a moment after it is cast, Petrifying Gaze's cast time is missing from the
   game file, and Twin Fang's bonus depends on the target being Poisoned when the fang lands. The model has that
   as an option; here the timeline keeps it: Poisoned from Noxious Blast's eruption for its poison's duration,
   and from Miasma for as long as its cloud lasts (the target is taken to stand in it) plus its lingering poison. */
import { behaviour } from '../behaviour.ts';

/** League wiki: Noxious Blast erupts 0.4 seconds after it is cast. */
const ERUPT = 0.4;

export default behaviour('Cassiopeia', {
  reviewed: '16.20.1',
  sources: [
    'Noxious Blast erupting 0.4 seconds after its cast is from the League wiki; the game file has no delay for it.',
    'Petrifying Gaze has no cast time in the game file; its total time there (spellTotalTime 0.5, castFrame 15 at 30 frames a second) is the 0.5 second cast the wiki gives.',
  ],
  actions: {
    q: { delay: ERUPT },
    r: { lock: 0.5 },
  },
  windows: [
    // from Noxious Blast's release: the eruption, then its poison
    { option: 'poisoned', after: 'q', for: `PoisonDuration + ${ERUPT}` },
    { option: 'poisoned', after: 'w', for: 'CloudDuration + PoisonDuration' },
  ],
  hooks: {
    // the windows open at release, Noxious Blast's poison only once it erupts: a fang landing in between sees
    // whatever poison was there before the blast. And nothing is Poisoned before the first blast or cloud.
    onStart(c) {
      if (!c.state.begun) { c.state.begun = 1; c.setOption('poisoned', 0); }
      if (c.action === 'q') { c.state.qOut = 1; c.state.before = c.option('poisoned'); }
    },
    onLand(c) {
      if (c.action === 'q') { c.state.qOut = 0; c.setOption('poisoned', 1); }
      else if (c.action === 'e' && c.state.qOut) c.setOption('poisoned', c.state.before ?? 0);
    },
  },
  notes: [
    'Twin Fang counts as hitting a Poisoned target while Noxious Blast\'s poison or Miasma\'s cloud is on it; the target is taken to stand in the cloud for its whole duration.',
    'With both Noxious Blast and Miasma up, the one cast later decides when Poisoned ends.',
  ],
});

/* Head Rush and Blood Frenzy are leaps and Certain Death a flight to the target, none of which the file
   gives as a dash. Blood Frenzy lasts BerserkDuration and Certain Death's frenzy until the prey dies: both
   are the model's "frenzy" option, which the timeline keeps. Chilling Scream is counted fully charged. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Briar', {
  reviewed: '16.20.1',
  sources: [
    'Head Rush\'s leap of 475 is BriarQ\'s cast range in the game file.',
    'Certain Death\'s flight of up to 12000 is BriarR\'s cast range in the game file.',
    'Chilling Scream: a full charge of 1 second (its tooltip, "over 1 second") and the release\'s 0.15 s cast; the scream flies at 1900. Both of the last are BriarEMis\'s in the game file.',
  ],
  actions: {
    q: { dash: { speed: 'DashSpeedBase + ExtraDashSpeedBasedOnDistance', distance: 475, direction: 'toward' } },
    // the game file has no cast time: the leap is the whole lock
    w: { lock: 0, dash: { speed: 'DashSpeed', distance: 'MaxDashDistance', direction: 'toward' } },
    e: { lock: 1.15, range: 'MaxMissileRange', speed: 1900 },
    r: { dash: { speed: 'MinDashSpeed', distance: 12000, direction: 'toward' } },
  },
  windows: [
    { option: 'frenzy', after: 'w', for: 'BerserkDuration' },
    { option: 'frenzy', after: 'r', for: 'HuntDuration' },
  ],
  hooks: {
    // the option is on by default for the plain calculation; in a fight the frenzy needs W or R first
    onStart(c) { if (!c.state.started) { c.state.started = 1; c.setOption('frenzy', 0); } },
  },
  notes: [
    'One W is the leap and the Snack Attack bite together, as in the model.',
    'Certain Death\'s flight starts with the kick, at its slowest speed; the hemolith\'s own flight is not timed.',
  ],
});

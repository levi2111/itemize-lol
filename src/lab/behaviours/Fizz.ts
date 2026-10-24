/* Fizz: Urchin Strike is a dash onto the target with no speed in the game data. Seastone Trident's active is an
   instant attack reset (the game file's cast time is the empowered attack's animation). Playful / Trickster
   hops onto the target and slams after the 0.75 seconds he is untargetable. Chum the Waters' shark erupts
   DetonationTime after the fish attaches; the fish's flight before that cannot be added to the same wait, so
   the eruption is timed from the cast. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Fizz', {
  reviewed: '16.20.1',
  sources: [
    'Urchin Strike\'s dash speed is not in the game data: 1400 units a second is an assumption.',
    'The 0.75 seconds Playful / Trickster keeps Fizz untargetable before its slam are in its tooltip; his hop onto the target, up to its 400 range, is drawn over them.',
  ],
  actions: {
    q: { dash: { speed: 1400, distance: 550, direction: 'toward' } },
    // a buff on the next attack: cast it once in attack range (175, edge to edge, plus his 55 radius)
    w: { lock: 0, range: 175 + 55 },
    e: { lock: 0.75, dash: { speed: '400 / 0.75', distance: 400, direction: 'toward' } },
    r: { speed: 0, delay: 'DetonationTime' },
  },
  notes: [
    'Chum the Waters erupts DetonationTime after its cast; the fish\'s flight (up to a second) is not added.',
    'Playful / Trickster is counted as one hop and slam; its recast is not played.',
  ],
});

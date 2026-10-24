/* Heimerdinger: H-28G Evolution Turret holds MaxKits kits that come back KitCooldown apart, with Q's
   1 second cooldown between placements; a turret is placed within the cast range and shoots from there,
   so he reaches as far as the turret does. The rockets and the grenade fly as missiles of their own
   (HeimerdingerWAttack2, HeimerdingerESpell), which the slot spells do not name. UPGRADE!!! in the
   combo stands for the upgraded ability the model's "UPGRADE!!! used on" picks, so it takes that
   ability's spell object; the toggle itself is instant. */
import { behaviour } from '../behaviour.ts';

/** HeimerdingerQ's cooldown in the game data: the time between two turret placements. */
const PLACE_GAP = 1;

export default behaviour('Heimerdinger', {
  reviewed: '16.20.1',
  sources: [
    'A turret\'s 525 attack range (added to Q\'s 350 and the Apex Turret\'s 450 cast range) is from the League wiki; the game data has no turret stats.',
    'Micro-rockets fly at 750 (HeimerdingerWAttack2 and HeimerdingerWAttack2Ult in the game file); grenades at 1200 (HeimerdingerESpell, HeimerdingerESpell_ult).',
  ],
  actions: {
    q: { range: 350 + 525, charges: { count: 'MaxKits', recharge: 'KitCooldown' } },
    w: { speed: 750 },
    e: { speed: 1200 },
    r: {
      variants: [
        { when: 'upgrade == 1', spell: 'HeimerdingerQUlt', range: 450 + 525 },
        { when: 'upgrade == 2', spell: 'HeimerdingerWUlt', speed: 750 },
        { when: 'upgrade == 3', spell: 'HeimerdingerESpell_ult' },
      ],
    },
  },
  hooks: {
    onStart(c) {
      if (c.action === 'q') c.setReadyAt('q', c.t + PLACE_GAP);
    },
  },
  notes: [
    'Each turret\'s regular shots land when it is placed; the game spreads them over its attacks.',
    'Heimerdinger starts the fight with all his turret kits.',
  ],
});

/* Jinx: Switcheroo! is an instant weapon swap; in the combo it flips the model's "Using Fishbones" option,
   which then says the weapon she starts with. Fishbones' rockets fly at JinxQAttack's speed and reach
   RocketBonusRange further. Zap!'s missile is JinxWMissile, whose cast time shortens with bonus attack speed
   down to JinxLowEndWCastTime. Flame Chompers! are thrown, arm in GrenadeArmTime and snap on the target.
   Super Mega Death Rocket! reaches the whole map. */
import { behaviour } from '../behaviour.ts';

/** Fishbones' bonus range at Switcheroo!'s ranks 1 to 5 (JinxQ.RocketBonusRange); an attack form's range is a
    number, so there is one form per rank, each checked against the game's value */
const ROCKET_BONUS = [100, 125, 150, 175, 200];
/** Pow-Pow's range: her attack range */
const RANGE = 525;

export default behaviour('Jinx', {
  reviewed: '16.20.1',
  sources: [
    'Rockets fly at 2000 (JinxQAttack in the game file).',
    'Fishbones\' range is her 525 plus RocketBonusRange (100 to 200 by rank, JinxQ in the game file).',
    'Zap!\'s cast time starts at JinxWMissile\'s 0.6 seconds and loses 0.01 for each JinxWASpeedCastTimeScalarPerHundrethSecond of bonus attack speed.',
    'Flame Chompers! land in JinxEHit\'s 0.4 seconds (game file) before arming.',
  ],
  attack: {
    variants: [
      ...ROCKET_BONUS.map(bonus => ({ when: `rockets && JinxQ.RocketBonusRange == ${bonus}`, missileSpeed: 2000, range: RANGE + bonus })),
      { when: 'rockets', missileSpeed: 2000 },
    ],
  },
  actions: {
    // a weapon swap: it can be cast from anywhere
    q: { lock: 0, range: 25000 },
    w: { lock: 'max(JinxLowEndWCastTime, 0.6 - bonusAs * 0.01 / JinxWASpeedCastTimeScalarPerHundrethSecond)' },
    e: { delay: '0.4 + GrenadeArmTime' },
    r: { range: 25000 },
  },
  hooks: {
    onLand(c) {
      if (c.action === 'q') c.setOption('rockets', c.option('rockets') ? 0 : 1);
    },
  },
  notes: ['Super Mega Death Rocket! flies at its starting speed all the way; the game speeds it up after a while.'],
});

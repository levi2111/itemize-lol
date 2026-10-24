/* Vi: Vault Breaker is charged, then a dash of MinDashRange plus ExtraDashRangeAtMaxCharge at full charge (the
   model's "charged"). Denting Blows has no active. Relentless Force is an instant buff on her next attack, which
   it resets, holding two charges with StaticCooldown between casts (a hook). Cease and Desist dashes onto the
   target at RBaseSpeed. */
import { behaviour } from '../behaviour.ts';

/** ViE.StaticCooldown */
const BETWEEN = 1;

export default behaviour('Vi', {
  reviewed: '16.20.1',
  sources: [
    'Vault Breaker reaching full charge after 1.25 seconds is from the League Wiki; the game data has no value for it. Its dash is taken at ViQMissile\'s 1500 units a second in the game file.',
    'Relentless Force\'s 2 charges are in its tooltip; they come back every 12 seconds at rank 1 down to 8 at rank 5 (ViE\'s ammoRecharge in the game file), cut by ability haste.',
    'Cease and Desist\'s reach of 800 is ViR\'s range in the game file.',
  ],
  actions: {
    q: {
      lock: 1.25,
      dash: { speed: 1500, distance: 'MinDashRange + ExtraDashRangeAtMaxCharge', direction: 'toward' },
      // a dash that would stop short of the target is not started: she walks in first (she has a 65 radius)
      variants: [
        { when: '!charged', beyond: 'MinDashRange', dash: null, range: 'MinDashRange + 65' },
        { when: '!charged', lock: 0, dash: { speed: 1500, distance: 'MinDashRange', direction: 'toward' } },
        { beyond: 'MinDashRange + ExtraDashRangeAtMaxCharge', dash: null, range: 'MinDashRange + ExtraDashRangeAtMaxCharge + 65' },
      ],
    },
    w: { requires: 0 },
    // the game file's 0.25 seconds is the empowered attack's; cast it in attack range (125, edge to edge, plus her 65 radius)
    e: { lock: 0, range: 125 + 65, charges: { count: 2, recharge: '(13 - rank) * 100 / (100 + abilityHaste)' } },
    r: { dash: { speed: 'RBaseSpeed', distance: 800, direction: 'toward' }, variants: [{ beyond: 800 - 65, dash: null }] },
  },
  hooks: {
    onStart(c) {
      if (c.action === 'e') c.setReadyAt('e', c.t + BETWEEN);
    },
  },
  notes: [
    'Vault Breaker\'s dash is drawn during its charge, so the punch lands when the charge ends.',
    'Denting Blows is never cast: it is on every third hit.',
  ],
});

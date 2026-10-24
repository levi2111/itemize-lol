/* Nunu & Willump: the model counts Biggest Snowball Ever! fully grown, so the cast rolls for MaxDamageTime
   toward the target before it hits: drawn as a dash at his move speed held until then. Absolute Zero channels
   for ChannelDuration and detonates at the end. Call of the Freljord's attack speed (the model's "freljord")
   lasts 4 seconds after each time they damage the champion. */
import { behaviour } from '../behaviour.ts';

const freljord = (after: 'aa' | 'q' | 'w' | 'e' | 'r') => ({ option: 'freljord', after, for: 'NunuPassive.BloodBoilBaseDuration' });

export default behaviour('Nunu', {
  reviewed: '16.20.1',
  sources: ['Call of the Freljord lasting 4 seconds is in its tooltip and in NunuPassive.BloodBoilBaseDuration.'],
  actions: {
    w: { lock: 'MaxDamageTime', dash: { speed: 'moveSpeed', distance: 'moveSpeed * MaxDamageTime', direction: 'toward' } },
    r: { channel: 'ChannelDuration', delay: 'ChannelDuration' },
  },
  windows: [freljord('aa'), freljord('q'), freljord('w'), freljord('e'), freljord('r')],
  notes: [
    'The snowball is rolled for the full MaxDamageTime; reaching the target earlier, Nunu waits beside it until then.',
    'Snowball Barrage\'s three volleys and its root are counted when it is first thrown.',
  ],
});

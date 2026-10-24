/* Cosmic Binding's cast spell has no range; its bolt (BardQMissile) flies 950. Caretaker's Shrine has no
   cooldown, only Ammo_Limit charges coming back every Ammo_Cooldown. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Bard', {
  reviewed: '16.20.1',
  sources: ['The reach of 950 is BardQMissile\'s range in the game file.'],
  actions: {
    q: { range: 950 },
    w: { charges: { count: 'Ammo_Limit', recharge: 'Ammo_Cooldown' } },
  },
});

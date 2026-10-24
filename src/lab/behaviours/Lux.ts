/* Lux: Light Binding's slot spell has a 10000 cast range and no projectile; the binding is LuxLightBindingMis. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Lux', {
  reviewed: '16.20.1',
  actions: { q: { spell: 'LuxLightBindingMis' } },
  notes: ['Lucent Singularity is detonated as soon as it lands.'],
});

/* Written by npm run lab:index: every behaviour file, by champion id. Do not edit by hand. */
import type { BehaviourFile, BehaviourSrc } from '../behaviour.ts';
import Cassiopeia from './Cassiopeia.ts';
import Chogath from './Chogath.ts';
import Corki from './Corki.ts';
import Darius from './Darius.ts';
import Diana from './Diana.ts';
import DrMundo from './DrMundo.ts';
import Samira from './Samira.ts';

const files: BehaviourFile[] = [Cassiopeia, Chogath, Corki, Darius, Diana, DrMundo, Samira];
export const BEHAVIOURS: Record<string, BehaviourSrc> = Object.fromEntries(files.map(f => [f.id, f.src]));

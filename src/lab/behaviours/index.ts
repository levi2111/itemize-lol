/* Written by npm run lab:index: every behaviour file, by champion id. Do not edit by hand. */
import type { BehaviourFile, BehaviourSrc } from '../behaviour.ts';
import Samira from './Samira.ts';

const files: BehaviourFile[] = [Samira];
export const BEHAVIOURS: Record<string, BehaviourSrc> = Object.fromEntries(files.map(f => [f.id, f.src]));

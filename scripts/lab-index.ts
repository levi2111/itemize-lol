/* npm run lab:index. Writes src/lab/behaviours/index.ts: one import per behaviour file, so the browser
   bundle and the Worker, which cannot read a directory, see them all. Run it after adding a file. */
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../src/pipeline/paths.ts';

const dir = join(ROOT, 'src', 'lab', 'behaviours');
const files = readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'index.ts').sort();
const id = (f: string) => f.replace(/\.ts$/, '');
const text = `/* Written by npm run lab:index: every behaviour file, by champion id. Do not edit by hand. */
import type { BehaviourFile, BehaviourSrc } from '../behaviour.ts';
${files.map(f => `import ${id(f)} from './${f}';`).join('\n')}

const files: BehaviourFile[] = [${files.map(id).join(', ')}];
export const BEHAVIOURS: Record<string, BehaviourSrc> = Object.fromEntries(files.map(f => [f.id, f.src]));
`;
writeFileSync(join(dir, 'index.ts'), text);
console.log(`behaviours: ${files.length}`);

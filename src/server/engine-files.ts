/* The engine as a browser runs it, for the auto-build (src/autobuild/): its Web Worker and every module the
   worker imports, as JavaScript, next to the data they read. The modules are this repository's own TypeScript
   with the types taken out and nothing else changed, so the page scores builds with the very code the API uses.
   Laid out as in src/, with the data of each patch served beside it:
     autobuild/worker.js, engine/calc.js, shared/types.js, ...
     data/<patch>/items.json, data/<patch>/champions/<id>.json
   The Node server serves them under /engine/ (src/server/main.ts); scripts/site.ts writes them into the site
   under a name made from their contents, and points the pages at it. */
import { readFileSync } from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { ROOT } from '../pipeline/paths.ts';

/** The worker's module, from the engine's base. */
export const ENGINE_ENTRY = 'autobuild/worker.js';
/** Where a page finds the engine when nothing else says: the Node server's address for it. Each page names it
    in `<meta name="engine">`, which scripts/site.ts points at the published copy. */
export const ENGINE_BASE = '/engine/';

/** The fly's first module, from its base, which the pages at /fly load (src/server/fly-page.ts). */
export const FLY_ENTRY = 'menu.js';
/** The Node server's address for the fly's files; the published site has them in a folder of their own (scripts/site.ts). */
export const FLY_BASE = '/fly-code/';

const SRC = join(ROOT, 'src');
const IMPORT = /(\bfrom\s*|\bimport\s*)(['"])(\.\.?\/[^'"]+)\.ts\2/g;

/** Every module the entries load, by its path under dir, with the types out: autobuild/worker.js -> code. */
function modulesFrom(dir: string, entries: string[]): Map<string, string> {
  const out = new Map<string, string>();
  const visit = (file: string) => {
    const at = relative(dir, file).split(/[\\/]/).join('/').replace(/\.ts$/, '.js');
    if (out.has(at)) return;
    const code = stripTypeScriptTypes(readFileSync(file, 'utf8'));
    const deps: string[] = [];
    // type-only imports are gone by now, so what is left is what runs
    out.set(at, code.replace(IMPORT, (_m, kw: string, q: string, path: string) => {
      deps.push(join(dirname(file), path + '.ts'));
      return `${kw}${q}${path}.js${q}`;
    }));
    for (const d of deps) visit(d);
  };
  for (const entry of entries) visit(join(dir, entry.replace(/\.js$/, '.ts')));
  return out;
}

/** Every module the worker loads, by its path under the engine's base. */
export const engineModules = () => modulesFrom(SRC, [ENGINE_ENTRY]);

/** The fly as a browser runs it (src/fly/): its modules and its circuit, by their path under its base. Apart from the
    engine, in a folder of its own, so a new patch doesn't send a visitor the circuit again. */
export function flyFiles(): Map<string, string> {
  const dir = join(SRC, 'fly'), out = modulesFrom(dir, [FLY_ENTRY, 'worker.js']);
  out.set('circuit.json', readFileSync(join(dir, 'circuit.json'), 'utf8'));
  return out;
}

/** The data path a request under the engine's base names, or null: data/<patch>/items.json, data/<patch>/champions/<id>.json. */
export function engineData(path: string): { patch: string; items: true } | { patch: string; champion: string } | null {
  const m = /^data\/(\d+\.\d+(?:\.\d+|-pbe))\/(?:(items)|champions\/([A-Za-z0-9]+))\.json$/.exec(posix.normalize(path));
  if (!m) return null;
  return m[2] ? { patch: m[1]!, items: true } : { patch: m[1]!, champion: m[3]! };
}

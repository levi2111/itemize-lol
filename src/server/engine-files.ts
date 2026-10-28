/* The engine as a browser runs it, for the auto-build (src/autobuild/): its Web Worker and every module the
   worker imports, as JavaScript, next to the data they read. The modules are this repository's own TypeScript
   with the types taken out and nothing else changed, so the page scores builds with the very code the API uses.
   Laid out as in src/, with the data beside it:
     autobuild/worker.js, engine/calc.js, shared/types.js, ...
     data/items.json, data/champions/<id>.json
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

const SRC = join(ROOT, 'src');
const IMPORT = /(\bfrom\s*|\bimport\s*)(['"])(\.\.?\/[^'"]+)\.ts\2/g;

/** Every module the worker loads, by its path under the engine's base: autobuild/worker.js -> code. */
export function engineModules(): Map<string, string> {
  const out = new Map<string, string>();
  const visit = (file: string) => {
    const at = relative(SRC, file).split(/[\\/]/).join('/').replace(/\.ts$/, '.js');
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
  visit(join(SRC, ENGINE_ENTRY.replace(/\.js$/, '.ts')));
  return out;
}

/** The data path a request under the engine's base names, or null: data/items.json, data/champions/<id>.json. */
export function engineData(path: string): { items: true } | { champion: string } | null {
  const p = posix.normalize(path);
  if (p === 'data/items.json') return { items: true };
  const m = /^data\/champions\/([A-Za-z0-9]+)\.json$/.exec(p);
  return m ? { champion: m[1]! } : null;
}

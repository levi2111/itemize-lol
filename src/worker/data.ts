/* The datasets packed into the Worker (scripts/bundle.ts): for each patch served, a line of JSON with everything
   but its champions, then a line per champion in the order of its index. The lines are parsed as the isolate starts
   but the champions', and a champion's line when it is first asked for: three patches' champions would take
   longer to read than the isolate's start allows comfortably, and a request reads one or two. */
import type { ChampionIndexEntry, ServedData } from '../server/dataset.ts';
import { patchSet, type PatchSet } from '../server/patches.ts';
import type { PatchKind } from '../shared/patch.ts';
import type { ChampionData, DatasetManifest, ItemData } from '../shared/types.ts';

interface Head { patch: string; kind: PatchKind; manifest: DatasetManifest; index: ChampionIndexEntry[]; items: ItemData[] }

export function readBundle(text: string): PatchSet {
  const lines = text.split('\n'), all: { data: ServedData; kind: PatchKind }[] = [];
  for (let at = 0; at < lines.length;) {
    const head: Head = JSON.parse(lines[at]!), from = at + 1;
    at = from + head.index.length;
    const row = new Map(head.index.map((c, i) => [c.id.toLowerCase(), from + i]));
    const parsed = new Map<number, ChampionData>();
    const itemById = new Map(head.items.map(i => [i.id, i]));
    const data: ServedData = {
      patch: head.patch, manifest: head.manifest, index: head.index, items: head.items,
      champion: id => {
        const n = row.get(String(id).toLowerCase());
        if (n === undefined) return undefined;
        let c = parsed.get(n);
        if (!c) { c = JSON.parse(lines[n]!) as ChampionData; parsed.set(n, c); }
        return c;
      },
      item: id => itemById.get(id),
    };
    all.push({ data, kind: head.kind });
  }
  return patchSet(all);
}

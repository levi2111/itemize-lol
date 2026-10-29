/* The patches the API serves (src/shared/patch.ts says which): the live one, which the site opens on and which the
   pages, short links and previews use, and those next to it, which the page can switch to. Nothing here reads files,
   so the Worker uses it as the Node server does. */
import type { PatchKind } from '../shared/patch.ts';
import type { PreviewInfo } from '../shared/types.ts';
import type { ServedData } from './dataset.ts';

export interface PatchSet {
  /** the live patch */
  readonly live: ServedData;
  /** every patch served, newest first, with what it is to the site */
  readonly all: readonly { data: ServedData; kind: PatchKind }[];
  /** a served patch by its id, or undefined */
  get(patch: string): ServedData | undefined;
}

/** What GET /meta lists about each patch, for the page's patch menu. */
export interface PatchEntry {
  patch: string;
  displayPatch: string;
  kind: PatchKind;
  builtAt: string;
  preview?: PreviewInfo;
}

export function patchSet(all: { data: ServedData; kind: PatchKind }[]): PatchSet {
  const live = all.find(p => p.kind === 'live')?.data;
  if (!live) throw new Error('no live patch to serve');
  const byId = new Map(all.map(p => [p.data.patch, p.data]));
  return { live, all, get: patch => byId.get(patch) };
}

/** One patch alone, as the live one. */
export const onePatch = (data: ServedData): PatchSet => patchSet([{ data, kind: 'live' }]);

export const patchEntries = (set: PatchSet): PatchEntry[] => set.all.map(({ data, kind }) => ({
  patch: data.patch, displayPatch: data.manifest.displayPatch, kind, builtAt: data.manifest.builtAt,
  ...(data.manifest.preview && { preview: data.manifest.preview }),
}));

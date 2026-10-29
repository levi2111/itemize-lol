/* Patch names, and which patches the site serves. Pure, so the pipeline, the Node server and the Worker share it.

   The site serves up to three: the live patch, which it always opens on; the one before it; and a preview of the
   next one, made from the test server's files (src/pipeline/fetch.ts, PBE) while that patch is being played there.
   A preview's id is the next patch's major.minor and "pbe" (16.22-pbe), so it never shares a name with the patch it
   becomes. */

export const PBE = 'pbe';
/** 16.22.8331392+branch.main.content.beta -> 16.22-pbe */
export const previewId = (build: string) => `${majorMinor(build)}-${PBE}`;
export const isPreview = (patch: string) => patch.endsWith(`-${PBE}`);
/** 16.20.1 -> 16.20, and 16.22-pbe -> 16.22 */
export const majorMinor = (v: string) => v.split(/[.-]/).slice(0, 2).join('.');
/** a is a later patch than b: 16.21.1 after 16.20.1 */
export const newer = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }) > 0;

export type PatchKind = 'preview' | 'live' | 'previous';

/** Of the compiled patches, the ones the site serves, newest first, with what each is to it: a preview only of a
    patch after the live one, and the newest patch before the live one. */
export function servedPatches(compiled: string[], live: string): { patch: string; kind: PatchKind }[] {
  const out: { patch: string; kind: PatchKind }[] = [];
  const previews = compiled.filter(p => isPreview(p) && newer(majorMinor(p), majorMinor(live))).sort((a, b) => newer(a, b) ? -1 : 1);
  if (previews[0]) out.push({ patch: previews[0], kind: 'preview' });
  out.push({ patch: live, kind: 'live' });
  const before = compiled.filter(p => !isPreview(p) && newer(majorMinor(live), majorMinor(p))).sort((a, b) => newer(a, b) ? -1 : 1);
  if (before[0]) out.push({ patch: before[0], kind: 'previous' });
  return out;
}

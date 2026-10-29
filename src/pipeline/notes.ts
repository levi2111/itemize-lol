/* Riot's patch notes, for a preview of the next patch (fetch.ts, PBE). The numbers come from the test server
   either way; the notes only say how settled they are. Until the notes for that patch are out it is still being
   tuned, and the site says the preview can change; once they are out, little changes before it ships. */
import { get } from './fetch.ts';

/** Riot's list of patch notes, newest first. */
export const NOTES_INDEX = 'https://www.leagueoflegends.com/en-us/news/tags/patch-notes/';

/** The address of the notes for a patch as players name it (26.22), or null while they are not out. */
export async function findPatchNotes(displayPatch: string): Promise<string | null> {
  const page = (await get(NOTES_INDEX)).toString('utf8');
  return notesIn(page, displayPatch);
}

/** The link to a patch's notes on Riot's list, or null. Pure, so a test can run it on a page of its own. */
export function notesIn(page: string, displayPatch: string): string | null {
  const [maj, min] = displayPatch.split('.');
  // /en-us/news/game-updates/league-of-legends-patch-26-22-notes, and the shorter patch-26-22-notes of earlier years
  const re = new RegExp(`href="((?:https://www\\.leagueoflegends\\.com)?/en-us/news/game-updates/[a-z0-9-]*\\bpatch-${maj}-${min}-notes/?)"`);
  const m = re.exec(page);
  return m ? new URL(m[1]!, NOTES_INDEX).href : null;
}

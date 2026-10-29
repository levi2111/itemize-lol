/* npm run patch:update. Follows Riot's patches. The scheduled workflow (.github/workflows/patch.yml) runs it every few
   hours; by hand it does the same.
     - When Data Dragon has a newer patch than data/dist/latest.json, it mirrors it, builds the dataset and the art,
       and keeps the patch it replaces as the previous one, which the site can switch to; any older patch's dataset
       goes (git keeps it).
     - With RIOT_API_KEY set, once a patch has been here for some days while its popularity sample is still an
       earlier patch's, it samples the new one (src/pipeline/popularity.ts) and builds again. A new patch keeps the
       last sample until then, so that there are games of it to count.
     - It keeps a preview of the next patch, from the test server (src/pipeline/fetch.ts, PBE): built when the test
       server moves on to a patch after the live one, fetched again once a day while its build changes, and at once
       when Riot's patch notes for it come out (src/pipeline/notes.ts), which the site then says. A preview whose
       numbers did not change is left as it was, so nothing is committed for it. It goes when its patch is out. A
       preview that cannot be fetched or built is left out and noted; it never stops the update.
   It stops, and so fails the workflow, where a person has to look before anything ships: a format canary failed
   (src/pipeline/anchors.ts) or a stat icon changed (src/pipeline/stat-icons.json). Otherwise it writes
   .build/patch/summary.md, which also lists the hand-written models that stopped binding or whose spell changed,
   and .build/patch/commit.txt, and tells the workflow what happened ($GITHUB_OUTPUT: changed, review, title).
     --force        rebuild the current patch even if nothing is new
     --popularity   sample popularity now (needs RIOT_API_KEY)
     --preview      fetch and build the preview again now */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildArt } from '../src/pipeline/art.ts';
import { buildDataset, displayPatch, type BuildReport } from '../src/pipeline/build.ts';
import { fetchPatch, latestPatch, pbeBuild } from '../src/pipeline/fetch.ts';
import { findPatchNotes } from '../src/pipeline/notes.ts';
import { DATA_DIR, ROOT, distDir } from '../src/pipeline/paths.ts';
import { fetchPopularity, loadPopularity } from '../src/pipeline/popularity.ts';
import { isPreview, majorMinor, newer, previewId } from '../src/shared/patch.ts';
import type { DatasetManifest } from '../src/shared/types.ts';

/** days a patch is out before its popularity is sampled */
const SAMPLE_AFTER_DAYS = 3;
/** hours between two fetches of the preview while the test server's build changes: it moves several times a day */
const PREVIEW_EVERY_HOURS = 24;

const args = process.argv.slice(2), flag = (name: string) => args.includes(`--${name}`);
const log = (msg: string) => console.log(msg);
const warn = (msg: string) => { log(msg); if (process.env.GITHUB_ACTIONS) console.log(`::warning::${msg}`); };
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const output = async (values: Record<string, string>) => {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, Object.entries(values).map(([k, v]) => `${k}=${v}\n`).join(''));
};

const dist = join(DATA_DIR, 'dist');
const latest: { patch: string; since?: string } = await readJson(join(dist, 'latest.json'));
const newest = await latestPatch();
const update = newer(newest, latest.patch);
const patch = update ? newest : latest.patch;

const key = process.env.RIOT_API_KEY;
const sample = await loadPopularity(patch);
const sampleBehind = !sample || newer(majorMinor(patch), majorMinor(sample.patch));
const days = update || !latest.since ? 0 : (Date.now() - Date.parse(latest.since)) / 86_400_000;
const sampleDue = sampleBehind && days >= SAMPLE_AFTER_DAYS;
const sampleNow = !!key && (flag('popularity') || sampleDue);
const live = update || sampleNow || flag('force');

// ---- the live patch ----
let report: BuildReport | null = null, before: BuildReport | null = null, sampled = false, sampleNote = '';
if (live) {
  before = existsSync(join(distDir(latest.patch), 'report.json')) ? await readJson(join(distDir(latest.patch), 'report.json')) : null;
  log(update ? `patch ${latest.patch} -> ${patch}` : sampleNow ? `patch ${patch}: popularity sample` : `patch ${patch}: rebuilt`);

  // data/raw is a cache the workflow starts without, so even a rebuild mirrors the patch first
  await fetchPatch({ patch, log });
  report = await buildDataset({ patch, log });

  if (sampleNow) {
    try {
      await fetchPopularity({ patch, log });
      // a build reads the newest sample only, so the earlier ones go
      for (const f of await readdir(join(DATA_DIR, 'popularity'))) if (f !== `${patch}.json`) await rm(join(DATA_DIR, 'popularity', f));
      report = await buildDataset({ patch, log });
      sampled = true;
    } catch (err) {
      sampleNote = `Popularity was not sampled: ${err instanceof Error ? err.message : err}`;
      warn(sampleNote);
    }
  } else if (sampleDue) sampleNote = 'Popularity is due for a sample of this patch, but RIOT_API_KEY is not set.';

  // the patch replaced stays as the previous one; the one before it goes
  if (update) for (const d of await readdir(dist)) if (d !== patch && d !== latest.patch && d !== 'latest.json' && !isPreview(d)) await rm(join(dist, d), { recursive: true });
} else if (sampleDue && !key) sampleNote = 'Popularity is due for a sample of this patch, but RIOT_API_KEY is not set.';

// ---- the preview of the next patch ----
const preview = await keepPreview();
// the art holds the items of every patch served, so it follows the patches served (the preview's are the live patch's)
if (update || flag('force')) await buildArt({ patch, log });

if (!live && !preview.changed) {
  log(`up to date: patch ${displayPatch(patch)} (${patch}), here since ${latest.since ?? 'before this was recorded'}; ` +
    `popularity from ${sample ? `patch ${sample.patch}` : 'no sample'}${sampleNote ? ` (${sampleNote})` : ''}; ${preview.state}`);
  await output({ changed: 'false' });
  process.exit(0);
}

// ---- the summary ----
const shown = `${displayPatch(patch)} (${patch})`;
const title = update ? `Patch ${shown}` : sampled ? `Popularity for patch ${shown}` : live ? `Patch ${shown} rebuilt` : preview.title;
const lines = [`# ${title}`, ''];
let review = false;
if (report) {
  const now = report;
  const coverage = (c: Record<string, number>) => Object.entries(c).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(', ');
  const change = (what: 'abilities' | 'items') => {
    const was = before ? coverage(before.coverage[what]) : '', is = coverage(now.coverage[what]);
    return was && was !== is ? `${was} → ${is}` : is;
  };
  // ARAM's and Arena's copies of a Rift item use its model and say so when their passive differs: nothing to fix there
  const copies = now.stale.filter(s => /copy of/.test(s)), stale = now.stale.filter(s => !/copy of/.test(s));
  review = now.modelIssues.length > 0 || stale.length > 0 || now.unlocked.length > 0;
  const pop = await loadPopularity(patch);
  lines.push(
    `- Abilities: ${change('abilities')}`,
    `- Items: ${change('items')}`,
    `- Format canaries: ${now.anchors.passed} passed${now.anchors.missing.length ? `, ${now.anchors.missing.length} could not be checked` : ''}`,
    `- Popularity: ${pop ? `${pop.games} games played on ${Object.keys(pop.versions ?? {}).join(', ') || '?'}, sampled for patch ${pop.patch}` : 'no sample; the picker sorts by name'}`,
    ...(sampleNote ? [`- ${sampleNote}`] : []),
    `- Preview: ${preview.state}`,
  );
  if (review) {
    lines.push('', '## To look at', '');
    if (now.modelIssues.length) {
      lines.push('Hand-written models that no longer bind fall back to an estimate until they are fixed in `src/models/`:', '');
      for (const i of now.modelIssues) lines.push(`- \`${i.where}\`: ${i.message}`);
      lines.push('');
    }
    if (stale.length) {
      lines.push('Models whose spell changed since they were accepted (the site marks them "needs review"). Re-read one with `npm run data:report -- --champion <id>` or `--item <id>`, fix it if needed, then `npm run data:accept`:', '');
      for (const s of stale) lines.push(`- ${s}`);
      lines.push('');
    }
    if (now.unlocked.length) lines.push(`Models never accepted: ${now.unlocked.join(', ')}. Check them, then \`npm run data:accept\`.`, '');
  }
  if (copies.length) lines.push(...(lines.at(-1) === '' ? [] : ['']), `${copies.length} copies of Rift items in other shops differ from the Rift item; they use its model and say so.`);
} else lines.push(`- ${preview.state}`);
const summary = lines.join('\n').trimEnd() + '\n';

const out = join(ROOT, '.build', 'patch');
await mkdir(out, { recursive: true });
await writeFile(join(out, 'summary.md'), summary);
await writeFile(join(out, 'commit.txt'), `${title}\n\n${summary.split('\n').slice(2).join('\n')}`);
log('');
log(summary);
await output({ changed: 'true', review: String(review), title });

/* Brings the preview up to date. `changed`: data/dist changed; `state`: one line on where it stands; `title`: the
   commit's, when only the preview changed. */
async function keepPreview(): Promise<{ changed: boolean; state: string; title: string }> {
  const have = (await readdir(dist)).filter(isPreview);
  let build: string;
  try { build = await pbeBuild(); } catch (err) {
    warn(`The test server's version could not be read, so the preview was left as it is: ${err instanceof Error ? err.message : err}`);
    return { changed: false, state: 'the test server could not be read', title: '' };
  }
  let id = previewId(build);
  const shown = displayPatch(id);
  // a preview only of a patch after the live one: once its patch is out, or the test server has moved past it, it goes
  const wanted = newer(majorMinor(id), majorMinor(patch));
  let changed = false;
  for (const p of have) if (!wanted || p !== id) { await rm(join(dist, p), { recursive: true }); changed = true; log(`preview ${p} removed`); }
  if (!wanted) return { changed, state: `none: the test server is on ${majorMinor(build)}, no later than the live patch`, title: `Preview of patch ${displayPatch(have[0] ?? id)} removed` };

  const at = join(dist, id, 'manifest.json');
  const was: DatasetManifest | null = existsSync(at) ? await readJson(at) : null;
  let notes = was?.preview?.notes, notesNew = false;
  if (!notes) {
    try { const n = await findPatchNotes(shown); if (n) { notes = n; notesNew = true; log(`patch notes for ${shown} are out: ${n}`); } }
    catch (err) { warn(`Riot's patch notes could not be read: ${err instanceof Error ? err.message : err}`); }
  }
  const age = was?.preview ? (Date.now() - Date.parse(was.preview.fetchedAt)) / 3_600_000 : Infinity;
  const due = !was || flag('preview') || was.sources.ddragon !== patch
    || (was.preview?.build !== build && (age >= PREVIEW_EVERY_HOURS || notesNew));
  const said = (state: string) => `${state}${notes ? ', patch notes out' : ', patch notes not out yet'}`;

  if (due) {
    const folder = join(dist, id);
    const keep = was ? { hash: await contentHash(folder), manifest: await readFile(at, 'utf8'), report: await readFile(join(folder, 'report.json'), 'utf8') } : null;
    try {
      // the build the test server reports may move on between the two reads; the mirror says which it fetched
      const raw = await fetchPatch({ patch, preview: true, log });
      if (raw.patch !== id) throw new Error(`the test server moved on to ${raw.patch} while it was read; next time`);
      await buildDataset({ patch: id, notes: notes ? { notes } : undefined, log });
    } catch (err) {
      warn(`The preview of patch ${shown} could not be ${was ? 'brought up to date' : 'built'}${was ? '; the one there stays' : ''}: ${err instanceof Error ? err.message : err}`);
      if (keep) { await writeFile(at, keep.manifest); await writeFile(join(folder, 'report.json'), keep.report); }
      return { changed: changed || notesNew, state: said(`patch ${shown}${was ? ', not updated' : ', not built'}`), title: notesNew ? `Patch notes for ${shown} are out` : `Preview of patch ${shown}` };
    }
    if (keep && keep.hash === await contentHash(folder)) {
      // the same numbers from a later build: the preview stays as it was, the notes aside
      const m: DatasetManifest = JSON.parse(keep.manifest);
      if (notesNew && m.preview) m.preview.notes = notes;
      await writeFile(at, notesNew ? JSON.stringify(m, null, 1) : keep.manifest);
      await writeFile(join(folder, 'report.json'), keep.report);
      log(`preview ${id}: the test server's build ${build} changed none of its numbers`);
      return { changed: changed || notesNew, state: said(`patch ${shown}, unchanged`), title: `Patch notes for ${shown} are out` };
    }
    return { changed: true, state: said(`patch ${shown} from the test server's build ${build}`), title: notesNew ? `Patch notes for ${shown} are out` : `Preview of patch ${shown}${was ? ' updated' : ''}` };
  }
  if (notesNew && was?.preview) {
    was.preview.notes = notes;
    await writeFile(at, JSON.stringify(was, null, 1));
    return { changed: true, state: said(`patch ${shown}`), title: `Patch notes for ${shown} are out` };
  }
  return { changed, state: said(`patch ${shown} from ${was?.preview?.fetchedAt.slice(0, 10)}`), title: `Preview of patch ${shown}` };
}

/** What a dataset says, without when it was built: its champions and items. */
async function contentHash(folder: string): Promise<string> {
  const h = createHash('sha256');
  for (const f of ['champions.json', 'items.json']) h.update(f).update(await readFile(join(folder, f)));
  for (const f of (await readdir(join(folder, 'champions'))).sort()) h.update(f).update(await readFile(join(folder, 'champions', f)));
  return h.digest('hex');
}

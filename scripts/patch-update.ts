/* npm run patch:update. Follows Riot's patches. The scheduled workflow (.github/workflows/patch.yml) runs it every few
   hours; by hand it does the same.
     - When Data Dragon has a newer patch than data/dist/latest.json, it mirrors it, builds the dataset and the art,
       and drops the previous patch's dataset (git keeps it).
     - With RIOT_API_KEY set, once a patch has been here for some days while its popularity sample is still an
       earlier patch's, it samples the new one (src/pipeline/popularity.ts) and builds again. A new patch keeps the
       last sample until then, so that there are games of it to count.
   It stops, and so fails the workflow, where a person has to look before anything ships: a format canary failed
   (src/pipeline/anchors.ts) or a stat icon changed (src/pipeline/stat-icons.json). Otherwise it writes
   .build/patch/summary.md, which also lists the hand-written models that stopped binding or whose spell changed,
   and .build/patch/commit.txt, and tells the workflow what happened ($GITHUB_OUTPUT: changed, review, title).
     --force        rebuild the current patch even if nothing is new
     --popularity   sample popularity now (needs RIOT_API_KEY) */
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildArt } from '../src/pipeline/art.ts';
import { buildDataset, displayPatch, type BuildReport } from '../src/pipeline/build.ts';
import { fetchPatch, latestPatch } from '../src/pipeline/fetch.ts';
import { DATA_DIR, ROOT, distDir } from '../src/pipeline/paths.ts';
import { fetchPopularity, loadPopularity } from '../src/pipeline/popularity.ts';

/** days a patch is out before its popularity is sampled */
const SAMPLE_AFTER_DAYS = 3;

const args = process.argv.slice(2), flag = (name: string) => args.includes(`--${name}`);
const log = (msg: string) => console.log(msg);
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const newer = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }) > 0;
const majorMinor = (v: string) => v.split('.').slice(0, 2).join('.');
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

if (!update && !sampleNow && !flag('force')) {
  log(`up to date: patch ${displayPatch(patch)} (${patch}), here since ${latest.since ?? 'before this was recorded'}; ` +
    `popularity from ${sample ? `patch ${sample.patch}` : 'no sample'}${sampleDue && !key ? ', due for a new sample but RIOT_API_KEY is not set' : ''}`);
  await output({ changed: 'false' });
  process.exit(0);
}

const before: BuildReport | null = existsSync(join(distDir(latest.patch), 'report.json')) ? await readJson(join(distDir(latest.patch), 'report.json')) : null;
log(update ? `patch ${latest.patch} -> ${patch}` : sampleNow ? `patch ${patch}: popularity sample` : `patch ${patch}: rebuilt`);

// data/raw is a cache the workflow starts without, so even a rebuild mirrors the patch first
await fetchPatch({ patch, log });
let report = await buildDataset({ patch, log });
if (update || flag('force')) await buildArt({ patch, log });

let sampled = false, sampleNote = '';
if (sampleNow) {
  try {
    await fetchPopularity({ patch, log });
    // a build reads the newest sample only, so the earlier ones go
    for (const f of await readdir(join(DATA_DIR, 'popularity'))) if (f !== `${patch}.json`) await rm(join(DATA_DIR, 'popularity', f));
    report = await buildDataset({ patch, log });
    sampled = true;
  } catch (err) {
    sampleNote = `Popularity was not sampled: ${err instanceof Error ? err.message : err}`;
    log(sampleNote);
    if (process.env.GITHUB_ACTIONS) console.log(`::warning::${sampleNote}`);
  }
} else if (sampleDue) sampleNote = 'Popularity is due for a sample of this patch, but RIOT_API_KEY is not set.';

if (update) for (const d of await readdir(dist)) if (d !== patch && d !== 'latest.json') await rm(join(dist, d), { recursive: true });

// ---- the summary ----
const shown = `${displayPatch(patch)} (${patch})`;
const title = update ? `Patch ${shown}` : sampled ? `Popularity for patch ${shown}` : `Patch ${shown} rebuilt`;
const coverage = (c: Record<string, number>) => Object.entries(c).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(', ');
const change = (what: 'abilities' | 'items') => {
  const now = coverage(report.coverage[what]), was = before ? coverage(before.coverage[what]) : '';
  return was && was !== now ? `${was} → ${now}` : now;
};
// ARAM's and Arena's copies of a Rift item use its model and say so when their passive differs: nothing to fix there
const copies = report.stale.filter(s => /copy of/.test(s)), stale = report.stale.filter(s => !/copy of/.test(s));
const review = report.modelIssues.length > 0 || stale.length > 0 || report.unlocked.length > 0;
const pop = await loadPopularity(patch);
const lines = [
  `# ${title}`, '',
  `- Abilities: ${change('abilities')}`,
  `- Items: ${change('items')}`,
  `- Format canaries: ${report.anchors.passed} passed${report.anchors.missing.length ? `, ${report.anchors.missing.length} could not be checked` : ''}`,
  `- Popularity: ${pop ? `${pop.games} games played on ${Object.keys(pop.versions ?? {}).join(', ') || '?'}, sampled for patch ${pop.patch}` : 'no sample; the picker sorts by name'}`,
  ...(sampleNote ? [`- ${sampleNote}`] : []),
];
if (review) {
  lines.push('', '## To look at', '');
  if (report.modelIssues.length) {
    lines.push('Hand-written models that no longer bind fall back to an estimate until they are fixed in `src/models/`:', '');
    for (const i of report.modelIssues) lines.push(`- \`${i.where}\`: ${i.message}`);
    lines.push('');
  }
  if (stale.length) {
    lines.push('Models whose spell changed since they were accepted (the site marks them "needs review"). Re-read one with `npm run data:report -- --champion <id>` or `--item <id>`, fix it if needed, then `npm run data:accept`:', '');
    for (const s of stale) lines.push(`- ${s}`);
    lines.push('');
  }
  if (report.unlocked.length) lines.push(`Models never accepted: ${report.unlocked.join(', ')}. Check them, then \`npm run data:accept\`.`, '');
}
if (copies.length) lines.push(...(lines.at(-1) === '' ? [] : ['']), `${copies.length} copies of Rift items in other shops differ from the Rift item; they use its model and say so.`);
const summary = lines.join('\n').trimEnd() + '\n';

const out = join(ROOT, '.build', 'patch');
await mkdir(out, { recursive: true });
await writeFile(join(out, 'summary.md'), summary);
await writeFile(join(out, 'commit.txt'), `${title}\n\n${summary.split('\n').slice(2).join('\n')}`);
log('');
log(summary);
await output({ changed: 'true', review: String(review), title });

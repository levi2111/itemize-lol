/* npm run data:popularity. How often players build each item, overall and champion by champion, for the
   item picker's order. Needs a Riot API key, so it is a step of its own and not part of fetch or build.

   It samples recent ranked solo/duo games of the top of the ladder in a few regions through Riot's API
   (League-V4 for the players, Match-V5 for their games) and counts, in every player's final inventory,
   each item and everything it was built from: a Kraken Slayer counts for the Pickaxe and the Recurve Bow
   inside it, so components rank by how many builds go through them. The counts are written to
   data/popularity/<patch>.json, which is kept in the repository so a build never needs the key. The games
   are cached under data/raw/<patch>/riot/, so a run that stops picks up where it left off.
     RIOT_API_KEY        a key from developer.riotgames.com
     --games N           games to count per region (default 1000)
     --patch X.Y.Z       the dataset's patch; games from it or a later one are counted */
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA_DIR, rawDir } from './paths.ts';

type Raw = Record<string, any>;

export interface PopularityFile {
  patch: string;
  fetchedAt: string;
  source: string;
  /** games counted, and the players' builds in them */
  games: number;
  builds: number;
  /** the patches the games were played on, major.minor -> games: the live game can be a patch ahead of the dataset */
  versions: Record<string, number>;
  /** item id -> builds that hold it, or something built from it */
  items: Record<string, number>;
  /** champion id -> its builds, and item id -> how many of them hold the item */
  champions: Record<string, { builds: number; items: Record<string, number> }>;
}

/** One game, as much of it as the counting needs; a game that is not counted keeps only why. */
export interface GameSummary {
  id: string;
  version: string;
  skip?: 'patch' | 'queue' | 'short';
  players?: { champion: number; items: number[] }[];
}

const REGIONS = [
  { platform: 'euw1', region: 'europe' },
  { platform: 'kr', region: 'asia' },
  { platform: 'na1', region: 'americas' },
];
const TIERS = ['challengerleagues', 'grandmasterleagues', 'masterleagues'];
const SOLO_QUEUE = 420;
/** a game shorter than this ended before builds were done (a remake or an early surrender) */
const MIN_SECONDS = 15 * 60;

export const popularityPath = (patch: string) => join(DATA_DIR, 'popularity', `${patch}.json`);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
/** 16.20.1 -> [16, 20]: games are matched to a patch by major and minor. */
const majorMinor = (v: string) => v.split('.').slice(0, 2).map(Number) as [number, number];
const before = (v: string, patch: string) => { const [a, b] = majorMinor(v), [c, d] = majorMinor(patch); return a < c || (a === c && b < d); };

/** The newest sample for a patch: its own, or else the newest from an earlier patch (item ids carry over). */
export async function loadPopularity(patch: string): Promise<PopularityFile | null> {
  const dir = join(DATA_DIR, 'popularity');
  if (!existsSync(dir)) return null;
  const patches = (await readdir(dir)).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5))
    .filter(p => !before(patch, p))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const newest = patches.at(-1);
  return newest ? JSON.parse(await readFile(popularityPath(newest), 'utf8')) : null;
}

/** Counts the builds in a sample of games. Pure, so a test can run it on games of its own. */
export function countBuilds(games: GameSummary[], ddItems: Raw, championIdByKey: Map<number, string>) {
  const dd: Record<string, Raw> = ddItems.data;
  // an item as the shop sells it: Muramana is a Manamune that has stacked, Bounty of Worlds a World Atlas
  const sold = (id: number) => { let x = id; for (let n = 0; dd[x]?.specialRecipe && n < 4; n++) x = Number(dd[x]!.specialRecipe); return x; };
  // the item and everything it is built from, all the way down
  const within = new Map<number, number[]>();
  const parts = (id: number, depth = 0): number[] => {
    if (!within.has(id)) within.set(id, [id, ...(depth < 6 ? (dd[id]?.from ?? []).flatMap((f: string) => parts(Number(f), depth + 1)) : [])]);
    return within.get(id)!;
  };
  const out = { games: 0, builds: 0, versions: {} as Record<string, number>, items: {} as Record<string, number>, champions: {} as PopularityFile['champions'] };
  for (const g of games) {
    if (g.skip || !g.players) continue;
    out.games++;
    const v = majorMinor(g.version).join('.');
    out.versions[v] = (out.versions[v] ?? 0) + 1;
    for (const p of g.players) {
      const champ = championIdByKey.get(p.champion);
      if (!champ) continue;
      const c = out.champions[champ] ??= { builds: 0, items: {} };
      out.builds++; c.builds++;
      for (const id of new Set(p.items.filter(i => dd[i]).flatMap(i => parts(sold(i))))) {
        out.items[id] = (out.items[id] ?? 0) + 1;
        c.items[id] = (c.items[id] ?? 0) + 1;
      }
    }
  }
  return out;
}

/** One request at a time per routing value, kept under Riot's limits for it ("20:1,100:120": 20 a second, 100 in two minutes). */
class Limiter {
  private stamps: number[] = [];
  // a development key's, until Riot's answers say what this key's are
  private limits: [number, number][] = [[20, 1], [100, 120]];
  private queue = Promise.resolve();
  learn(header: string | null) {
    const l = header?.split(',').map(p => p.split(':').map(Number) as [number, number]).filter(([n, s]) => n > 0 && s > 0);
    if (l?.length) this.limits = l;
  }
  take(): Promise<void> {
    const turn = this.queue.then(async () => {
      for (;;) {
        const now = Date.now();
        const wait = Math.max(0, ...this.limits.map(([n, s]) => {
          const recent = this.stamps.filter(t => t > now - s * 1000);
          return recent.length < n ? 0 : recent[recent.length - n]! + s * 1000 - now + 50;
        }));
        if (!wait) break;
        await sleep(wait);
      }
      const now = Date.now(), keep = Math.max(...this.limits.map(([, s]) => s)) * 1000;
      this.stamps = [...this.stamps.filter(t => t > now - keep), now];
    });
    this.queue = turn;
    return turn;
  }
}

async function riot(host: string, path: string, key: string, limiter: Limiter, attempt = 1): Promise<any> {
  await limiter.take();
  const res = await fetch(`https://${host}.api.riotgames.com${path}`, { headers: { 'X-Riot-Token': key }, signal: AbortSignal.timeout(30_000) })
    .catch((e: unknown) => e instanceof Error ? e : new Error(String(e)));
  if (res instanceof Error || res.status === 429 || res.status >= 500) {
    if (attempt >= 6) throw new Error(`Riot API: ${res instanceof Error ? res.message : res.status} for ${host}${path}`);
    const after = res instanceof Error ? 0 : Number(res.headers.get('retry-after') ?? 0);
    await sleep(Math.max(after * 1000, 1000 * 2 ** attempt));
    return riot(host, path, key, limiter, attempt + 1);
  }
  limiter.learn(res.headers.get('x-app-rate-limit'));
  if (res.status === 401 || res.status === 403) throw new Error(`Riot API ${res.status}: RIOT_API_KEY is wrong or has expired (a development key lasts 24 hours)`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Riot API ${res.status} for ${host}${path}`);
  return res.json();
}

function summarize(id: string, m: Raw | null, patch: string): GameSummary {
  const info = m?.info, version = String(info?.gameVersion ?? '');
  if (!info || before(version, patch)) return { id, version, skip: 'patch' };
  if (info.queueId !== SOLO_QUEUE) return { id, version, skip: 'queue' };
  if (!(info.gameDuration >= MIN_SECONDS)) return { id, version, skip: 'short' };
  return {
    id, version,
    players: (info.participants ?? []).map((p: Raw) => ({
      champion: p.championId,
      items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].filter((i: unknown) => typeof i === 'number' && i > 0),
    })),
  };
}

/** Games of one region's top players, until `target` of them are on the patch; the cache is kept as it grows. */
async function sampleRegion(r: { platform: string; region: string }, patch: string, target: number, key: string, log: (msg: string) => void): Promise<GameSummary[]> {
  const file = join(rawDir(patch), 'riot', `${r.platform}.jsonl`);
  const games: GameSummary[] = existsSync(file) ? (await readFile(file, 'utf8')).split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  const seen = new Set(games.map(g => g.id));
  let counted = games.filter(g => !g.skip).length;
  if (counted >= target) { log(`  ${r.platform}: ${counted} games cached`); return games; }
  const ladder = new Limiter(), matches = new Limiter();
  const started = Date.now(), from = counted;
  for (const tier of TIERS) {
    const league = await riot(r.platform, `/lol/league/v4/${tier}/by-queue/RANKED_SOLO_5x5`, key, ladder);
    const players: string[] = (league?.entries ?? []).sort((a: Raw, b: Raw) => b.leaguePoints - a.leaguePoints).map((e: Raw) => e.puuid).filter(Boolean);
    for (const puuid of players) {
      const ids: string[] = await riot(r.region, `/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=${SOLO_QUEUE}&type=ranked&start=0&count=20`, key, matches) ?? [];
      for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        const g = summarize(id, await riot(r.region, `/lol/match/v5/matches/${id}`, key, matches), patch);
        games.push(g);
        await appendFile(file, JSON.stringify(g) + '\n');
        // a player's games come newest first: once one is from an earlier patch, so are the rest
        if (g.skip === 'patch') break;
        if (g.skip) continue;
        if (++counted >= target) { log(`  ${r.platform}: ${counted} games`); return games; }
        if (counted % 50 === 0) {
          const rate = (counted - from) / ((Date.now() - started) / 60_000);
          log(`  ${r.platform}: ${counted}/${target} games, about ${Math.ceil((target - counted) / rate)} min to go`);
        }
      }
    }
  }
  log(`  ${r.platform}: the ladder ran out at ${counted} games`);
  return games;
}

export interface PopularityOptions {
  patch?: string;
  games?: number;
  log?: (msg: string) => void;
}

export async function fetchPopularity(opts: PopularityOptions = {}): Promise<PopularityFile> {
  const log = opts.log ?? (() => {});
  const key = process.env.RIOT_API_KEY;
  if (!key) throw new Error('set RIOT_API_KEY to a key from developer.riotgames.com');
  const { latestMirroredPatch } = await import('./build.ts');
  const patch = opts.patch ?? await latestMirroredPatch();
  const target = opts.games ?? 1000;
  const raw = rawDir(patch);
  const ddItems = JSON.parse(await readFile(join(raw, 'ddragon', 'item.json'), 'utf8'));
  const ddChampions = JSON.parse(await readFile(join(raw, 'ddragon', 'champion.json'), 'utf8')).data as Record<string, Raw>;
  const championIdByKey = new Map(Object.values(ddChampions).map(c => [Number(c.key), c.id as string]));
  await mkdir(join(raw, 'riot'), { recursive: true });

  log(`patch ${patch}: sampling ${target} ranked games in each of ${REGIONS.map(r => r.platform).join(', ')}`);
  const games = (await Promise.all(REGIONS.map(r => sampleRegion(r, patch, target, key, log)))).flat();
  const counts = countBuilds(games, ddItems, championIdByKey);
  const file: PopularityFile = {
    patch, fetchedAt: new Date().toISOString(),
    source: `Riot Match-V5: ranked solo/duo games of the top of the ladder in ${REGIONS.map(r => r.platform.toUpperCase()).join(', ')}`,
    ...counts,
  };
  await mkdir(join(DATA_DIR, 'popularity'), { recursive: true });
  await writeFile(popularityPath(patch), JSON.stringify(file));
  const thin = Object.values(counts.champions).filter(c => c.builds < 20).length;
  log(`${counts.games} games, ${counts.builds} builds -> ${popularityPath(patch)}${thin ? ` (${thin} champions with fewer than 20 builds use the overall order)` : ''}`);
  return file;
}

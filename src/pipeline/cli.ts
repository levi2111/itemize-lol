/* npm run data:<command> -- [--patch 16.20.1] [--champion Samira] [--draft] [--item 3153] [--accept] [--force] */
import { fetchPatch } from './fetch.ts';

const [command, ...rest] = process.argv.slice(2);
const flag = (name: string) => rest.includes(`--${name}`);
const arg = (name: string) => { const i = rest.indexOf(`--${name}`); return i > -1 ? rest[i + 1] : undefined; };
const log = (msg: string) => console.log(msg);

try {
  switch (command) {
    case 'fetch':
      await fetchPatch({ patch: arg('patch'), force: flag('force'), log });
      break;
    case 'build': {
      const { buildDataset } = await import('./build.ts');
      await buildDataset({ patch: arg('patch'), accept: flag('accept'), force: flag('force'), log });
      break;
    }
    case 'art': {
      const { buildArt } = await import('./art.ts');
      await buildArt({ patch: arg('patch'), force: flag('force'), accept: flag('accept'), log });
      break;
    }
    case 'report': {
      const { printReport } = await import('./report.ts');
      await printReport({ patch: arg('patch'), champion: arg('champion'), item: arg('item'), status: arg('status'), draft: flag('draft'), log });
      break;
    }
    case 'crosscheck': {
      const { crosscheck } = await import('./crosscheck.ts');
      await crosscheck({ patch: arg('patch'), champion: arg('champion'), refresh: flag('refresh'), log });
      break;
    }
    default:
      console.error('usage: node src/pipeline/cli.ts <fetch|build|art|report|crosscheck> [--patch X.Y.Z] [--champion Id] [--item id|name] [--status auto] [--accept] [--force]');
      process.exit(2);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

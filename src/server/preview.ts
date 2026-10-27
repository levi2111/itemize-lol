/* What a link preview says about a shared build: the numbers the page would show (from the engine, for
   the request share.ts mirrors), the words of the preview's title and description, and the facts the
   preview image draws. Sentences follow the page's verdicts: the same percentages, rounded the same way. */
import { headline, type Headline } from '../engine/calc.ts';
import type { ServedData } from './dataset.ts';
import type { SharedBuild } from './share.ts';

/** The builds' colours on the page; the winner's is the preview's accent (Discord's bar beside the embed). */
export const COLORS = { a: '#eef035', b: '#ff7fb2' } as const;
/** Longest build name shown, in characters; the page lets one be at most 40. */
const NAME_MAX = 40;

export interface CardBuild {
  key: 'a' | 'b';
  name: string;
  /** the name made from the build's items, for an image that cannot draw every letter of a typed one */
  fallback: string;
  items: number[];
  /** combo damage after mitigation, or raw without a target; as on the page, before rounding for display */
  total: number;
  dps: number;
  timeToKill: number | null;
  kills: boolean;
}
/** Everything a preview image shows. */
export interface CardFacts {
  champion: { id: string; name: string };
  level: number;
  patch: string;
  /** the target, said several ways, longest first, for the image to take the longest that fits */
  target: string[];
  builds: CardBuild[];
  /** two builds: the one ahead on combo damage and by how much, as the page's verdict counts it; null when they tie */
  lead: { key: 'a' | 'b'; percent: number | null } | null;
}
export interface Preview {
  title: string;
  description: string;
  imageAlt: string;
  color: string;
  card: CardFacts;
}

export const nf = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** The page's percentage: how much more x is than y, rounded; null when y is nothing. */
const pc = (x: number, y: number) => y > 0 ? Math.round((x / y - 1) * 100) : null;
const more = (p: number | null, what: string) => p === null ? `more ${what}` : p === 0 ? `slightly more ${what}` : `${p}% more ${what}`;
const list = (xs: string[]) => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;
/** One line of text: no control characters, runs of space as one, and at most `max` characters. */
export function clean(s: string, max = NAME_MAX): string {
  const flat = [...s.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ').replace(/\s+/g, ' ').trim()];
  return flat.length > max ? flat.slice(0, max - 1).join('').trimEnd() + '…' : flat.join('');
}

export function preview(data: ServedData, sb: SharedBuild): Preview {
  const results: Headline[] = sb.requests.map(r => headline(data, r));
  const item = (id: number) => data.item(id)?.name ?? `Item ${id}`;
  const champ = sb.champion.name, two = sb.builds.length === 2;

  // a build's name: the one written in the link, else the first item only it has, else its letter
  const auto = sb.builds.map((b, i) => {
    if (!two) return b.items.length ? `${item(b.items[0]!)} build` : 'No items';
    const other = new Set(sb.builds[1 - i]!.items), own = b.items.find(id => !other.has(id));
    return own !== undefined ? item(own) : `Build ${b.key.toUpperCase()}`;
  });
  const names = sb.builds.map((b, i) => b.typed && clean(b.name) || auto[i]!);
  const builds: CardBuild[] = sb.builds.map((b, i) => ({
    key: b.key, name: names[i]!, fallback: auto[i]!, items: b.items,
    total: results[i]!.combo.total.dealt, dps: results[i]!.dps.dealt, timeToKill: results[i]!.timeToKill, kills: results[i]!.combo.kills,
  }));

  const t = sb.target;
  const stats = t.kind === 'raw' ? null : `${nf(t.hp)} HP, ${nf(t.armor)} armor, ${nf(t.mr)} MR`;
  const against = t.kind === 'dummy' ? `a ${nf(t.hp)} HP dummy (${nf(t.armor)} armor, ${nf(t.mr)} MR)`
    : t.kind === 'champ' ? `a level ${t.level} ${t.champion.name} (${stats})` : null;
  const where = against ? `at level ${sb.level} against ${against}` : `at level ${sb.level}, before armor and magic resist`;
  const patch = ` Patch ${data.manifest.displayPatch}.`;

  let title: string, description: string, alt: string, lead: CardFacts['lead'] = null;
  if (two) {
    const [A, B] = builds as [CardBuild, CardBuild];
    title = `${champ} · ${A.name} vs ${B.name}`;
    alt = `${champ} at level ${sb.level}: ${A.name} ${nf(A.total)} combo damage, ${B.name} ${nf(B.total)}`;
    // DPS: who has more, said only where the page's verdict would say it
    const dw = Math.round(A.dps) === Math.round(B.dps) ? null : A.dps > B.dps ? A : B;
    const dp = dw && pc(Math.max(A.dps, B.dps), Math.min(A.dps, B.dps));
    if (Math.round(A.total) !== Math.round(B.total)) {
      const [w, l] = A.total > B.total ? [A, B] : [B, A];
      const p = pc(w.total, l.total);
      lead = { key: w.key, percent: p };
      description = dw === w ? `${w.name} deals ${more(p, 'combo damage')} and ${more(dp, 'DPS')} ${where}.`
        : dw ? `${w.name} deals ${more(p, 'combo damage')} ${where}; ${dw.name} has ${more(dp, 'DPS')}.`
        : `${w.name} deals ${more(p, 'combo damage')} ${where}.`;
    } else {
      const then = dw ? `; ${dw.name} has ${more(dp, 'DPS')}` : '';
      description = A.kills && B.kills && against
        ? `Both builds kill ${against} with the combo at level ${sb.level}${then}.`
        : `Both builds deal ${nf(A.total)} combo damage ${where}${then}.`;
    }
  } else {
    const [A] = builds as [CardBuild];
    title = `${champ} · ${A.name}`;
    alt = `${champ} at level ${sb.level}, ${A.name}: ${nf(A.total)} combo damage, ${nf(A.dps)} DPS`;
    const kill = A.timeToKill !== null && against ? `; autos alone kill it in ${A.timeToKill.toFixed(1)} s` : '';
    description = A.kills && against ? `The combo kills ${against} at level ${sb.level}; sustained autos deal ${nf(A.dps)} DPS.`
      : `${nf(A.total)} combo damage and ${nf(A.dps)} DPS ${where}${kill}.`;
    description += A.items.length ? ` ${list(A.items.map(item))}.` : ' No items.';
  }
  return {
    title, description: description + patch, imageAlt: alt,
    color: COLORS[lead?.key ?? 'a'],
    card: {
      champion: { id: sb.champion.id, name: champ }, level: sb.level, patch: data.manifest.displayPatch,
      target: t.kind === 'dummy' ? [`vs dummy: ${stats}`, `vs dummy: ${nf(t.hp)} HP, ${nf(t.armor)} AR, ${nf(t.mr)} MR`, `vs ${nf(t.hp)} HP dummy`]
        : t.kind === 'champ' ? [`vs ${t.champion.name}, level ${t.level}: ${stats}`, `vs ${t.champion.name}, level ${t.level}`, `vs ${t.champion.name}`]
        : ['raw damage, before armor and magic resist', 'raw damage, before resistances', 'raw damage'],
      builds, lead,
    },
  };
}

/* ---------- the tags in a page's head ---------- */
/** The site's own preview: for a page without a build, or with a link that cannot be read. web/index.html and
    web/receipt.html carry it as written by siteMeta, which test/share.test.ts checks. */
export const SITE = {
  name: 'itemize.lol',
  title: 'itemize.lol · League of Legends item builds, compared by damage',
  description: 'Compare League of Legends item builds by the damage they actually deal: combo damage, DPS and time to kill, broken down by source.',
  imageAlt: 'itemize.lol: two item builds side by side, with the damage each deals',
  /** the site's background: the embed's bar on Discord, and a phone browser's bar */
  color: '#0c2524',
  origin: 'https://itemize.lol',
} as const;

export interface Meta { title: string; description: string; url: string; image: string; imageAlt: string; color: string }
const attr = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** The link-preview tags of a page, one per line, every value escaped. Open Graph for Discord, Slack, WhatsApp,
    iMessage, Reddit and the rest; X reads those too once it is told to show a large image. */
export function metaTags(m: Meta): string {
  return [
    ['property', 'og:site_name', SITE.name], ['property', 'og:type', 'website'],
    ['property', 'og:title', m.title], ['property', 'og:description', m.description], ['property', 'og:url', m.url],
    ['property', 'og:image', m.image], ['property', 'og:image:type', 'image/png'],
    ['property', 'og:image:width', '1200'], ['property', 'og:image:height', '630'], ['property', 'og:image:alt', m.imageAlt],
    ['name', 'twitter:card', 'summary_large_image'], ['name', 'theme-color', m.color],
  ].map(([k, n, v]) => `<meta ${k}="${n}" content="${attr(v!)}">`).join('\n');
}
/** The site's own tags, for the page at `path` ("/" or "/receipt"). */
export const siteMeta = (path: string): Meta => ({
  title: SITE.title, description: SITE.description, url: SITE.origin + path,
  image: `${SITE.origin}/og/default.png`, imageAlt: SITE.imageAlt, color: SITE.color,
});

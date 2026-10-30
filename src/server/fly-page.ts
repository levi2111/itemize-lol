/* The pages at /fly: the two layouts with the fruit fly (docs/fly.md). The site's own pages know nothing of it. These are made
   from them, as the champion pages are: scripts/site.ts writes them as files for Cloudflare and the Node server makes the same
   per request. They are not in the sitemap, nothing links to them, and they ask search engines to leave them out. Each change must
   find its place exactly once, so a page that changes shape stops the build. */
import { ORIGIN, type Layout } from './pages.ts';

export const FLY_PAGES: Record<Layout, { path: string; file: string }> = {
  tabs: { path: '/fly', file: 'fly.html' },
  receipt: { path: '/fly/receipt', file: 'fly/receipt.html' },
};

/* The two pages name their colours differently, and each block of it takes whichever this page has. */
const CSS = `.fly-box{--fly-ink:var(--text,var(--chalk));--fly-mid:var(--dim,var(--chalk-dim));--fly-low:var(--faint,var(--chalk-faint));display:grid;gap:.5rem;margin-top:.3rem;padding:.55rem .3rem .1rem;border-top:1px solid var(--rule)}
.fly-on{display:flex;align-items:center;justify-content:space-between;cursor:pointer}
.fly-on input,.fly-row input{margin:0;width:.95rem;height:.95rem;accent-color:var(--fly-ink)}
.fly-set{display:grid;gap:.55rem;font-size:.78rem;color:var(--fly-mid)}
.fly-nums{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.4rem .6rem;margin:0}
.fly-nums dt{font-size:.66rem;color:var(--fly-low)}
.fly-nums dd{margin:0;color:var(--fly-ink);font-family:var(--font-mono);font-size:.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fly-size{display:grid;grid-template-columns:auto minmax(0,1fr) 4rem;align-items:center;gap:.55rem}
.fly-size input{width:100%;margin:0;accent-color:var(--fly-ink)}
.fly-size b{text-align:right;color:var(--fly-ink);font-weight:600}
.fly-row{display:flex;flex-wrap:wrap;align-items:center;gap:.3rem .8rem}
.fly-row:has(button){gap:.3rem}
.fly-row button{padding:.2rem .4rem;border:1px solid var(--rule);border-radius:3px}
.fly-row button:hover:not(:disabled){border-color:var(--fly-ink);color:var(--fly-ink)}
.fly-row button:disabled{opacity:.45;cursor:default}
.fly-row label{display:inline-flex;align-items:center;gap:.35rem;cursor:pointer}
.fly-det summary{cursor:pointer}
.fly-det summary:hover{color:var(--fly-ink)}
.fly-det p{margin:.35rem 0 0;font-size:.72rem;line-height:1.35}
.menu .fly-det a{display:inline;padding:0;border-radius:0;color:inherit;text-decoration:underline;text-underline-offset:.15em}
.menu .fly-det a::before{content:none}
.menu .fly-det a:hover{background:none;color:var(--fly-ink)}`;

const link = (href: string, text: string) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
/** The settings menu's block. Its label is the label of the menu it joins. */
const block = (label: string) => `<div class="fly-box">
  <label class="fly-on"><span class="${label}">Fly</span><input type="checkbox" id="fly-on"></label>
  <div class="fly-set" id="fly-set" hidden>
    <dl class="fly-nums">
      <div><dt>Generation</dt><dd id="fly-gen">1</dd></div>
      <div><dt>Escaped</dt><dd id="fly-escapes">0</dd></div>
      <div><dt>Squashed</dt><dd id="fly-squashes">0</dd></div>
      <div><dt>Reaction</dt><dd id="fly-reaction">–</dd></div>
      <div><dt>Hunger</dt><dd id="fly-hunger">–</dd></div>
      <div><dt>Now</dt><dd id="fly-now">–</dd></div>
    </dl>
    <label class="fly-size">Size<input type="range" id="fly-size" min="1" max="4" step=".25" value="1"><b id="fly-size-n">Real size</b></label>
    <div class="fly-row" role="group" aria-label="Food">
      <button data-food="sugar">Sugar</button><button data-food="banana">Banana</button><button data-food="vinegar">Vinegar</button><button data-food="bitter">Bitter</button><button id="fly-dust">Dust</button>
    </div>
    <div class="fly-row"><label><input type="checkbox" id="fly-blind">Blind</label><label><input type="checkbox" id="fly-scrambled">Scrambled wiring</label></div>
    <details class="fly-det"><summary>Details</summary>
      <p>${link('https://flywire.ai', 'FlyWire')} connectome v783, 2,000 neurons. Dorkenwald et al. 2024, Schlegel et al. 2024. ${link('https://creativecommons.org/licenses/by-nc/4.0/', 'CC BY-NC 4.0')}</p>
      <p>Model: ${link('https://github.com/philshiu/Drosophila_brain_model', 'Shiu et al. 2024')}. Cell types: ${link('https://github.com/flyconnectome/flywire_annotations', 'flywire_annotations')}</p>
    </details>
  </div>
</div>`;

/** A layout's page with the fly, from web/'s page of that layout (as it is, on the Node server, or as scripts/site.ts has
    prepared it). base is where the fly's files are. */
export function flyPage(html: string, layout: Layout, base: string): string {
  const one = (re: RegExp, to: (match: string) => string) => {
    const n = html.match(new RegExp(re.source, 'g'))?.length ?? 0;
    if (n !== 1) throw new Error(`expected one ${re} in the ${layout} page, found ${n}`);
    html = html.replace(re, to);
  };
  // layout.js keeps a visitor who chose the other layout under this address
  one(/<html\b/, m => `${m} data-base="${FLY_PAGES.tabs.path}"`);
  one(/<link rel="canonical" href="[^"]*">/, () => `<link rel="canonical" href="${ORIGIN}${FLY_PAGES[layout].path}">\n<meta name="robots" content="noindex">`);
  one(/<\/head>/, m => `<style>\n${CSS}\n</style>\n${m}`);
  one(/<script src="[^"]*app[^"]*\.js" defer><\/script>/, m => `${m}\n<script type="module" src="${base}menu.js"></script>`);
  // the menu holds more than menu items now: the layouts stay a menu inside it
  one(/(?<=id="set-btn" )aria-haspopup="true"/, () => 'aria-haspopup="dialog"');
  one(/(?<=id="set-menu" )role="menu"/, () => 'role="dialog"');
  one(/<a href="\/" role="menuitemradio" data-layout="tabs"[^]*?data-layout="receipt"[^]*?<\/a>/, links =>
    `<div role="menu" aria-label="Layout" style="display:contents">${links.replace('href="/"', `href="${FLY_PAGES.tabs.path}"`).replace('href="/receipt"', `href="${FLY_PAGES.receipt.path}"`)}</div>\n${block(layout === 'receipt' ? 'eyebrow' : 'lbl')}`);
  return html;
}

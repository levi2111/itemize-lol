/* Runs before the page is drawn. The two layouts are two pages, and a visitor who chose the other
   one in the settings menu (app.js stores the choice) is sent to its page, keeping the link's build.
   A champion's page has one in each layout as well (/vayne and /receipt/vayne), so it keeps its champion.
   A short link (/b/<id>) is served in the layout it was shared from, with its build written into the page
   (#shared-build, just above this script); that build is handed over as setLayout in app.js hands one over. */
(() => {
  const champ = document.documentElement.dataset.champ;
  const PAGES = champ ? {tabs: '/' + champ, receipt: '/receipt/' + champ} : {tabs: '/', receipt: '/receipt'};
  let want = null;
  try { want = localStorage.getItem('layout'); } catch (e) {}
  if (!Object.hasOwn(PAGES, want) || want === document.documentElement.dataset.layout) return;
  // never to the address this page was itself served from, whatever it turned out to hold
  if (location.pathname === PAGES[want]) return;
  let hash = location.hash;
  try {
    const s = JSON.parse(document.getElementById('shared-build')?.textContent || 'null')?.s;
    if (s) try { sessionStorage.setItem('carry', s); } catch (e) { hash = '#s=' + s; }
  } catch (e) {}
  location.replace(PAGES[want] + location.search + hash);
})();

/* Runs before the page is drawn. The two layouts are two pages, and a visitor who chose the other
   one in the settings menu (app.js stores the choice) is sent to its page, keeping the link's build. */
(() => {
  const PAGES = {tabs: '/', receipt: '/receipt'};
  let want = null;
  try { want = localStorage.getItem('layout'); } catch (e) {}
  if (!Object.hasOwn(PAGES, want) || want === document.documentElement.dataset.layout) return;
  // never to the address this page was itself served from, whatever it turned out to hold
  if (location.pathname !== PAGES[want]) location.replace(PAGES[want] + location.search + location.hash);
})();

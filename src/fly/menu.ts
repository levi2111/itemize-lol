import type { FoodKind } from './biology.ts';
import { flyController as fly } from './controller.ts';

// The fly's block of the settings menu, and what starts it: the first module of the pages at /fly (src/server/fly-page.ts), which
// are the only ones that load any of this. On there unless the visitor switched it off, which is remembered in this browser.

const OFF = 'fly-off';
const NOW: Record<string, string> = {
  walk: 'walking', rest: 'standing', turn: 'turning', groom: 'grooming', feed: 'feeding', freeze: 'frozen', adjust: 'leaning', back: 'backing',
  takeoff: 'taking off', fly: 'flying', land: 'landing', dead: 'squashed', squashed: 'squashed', arriving: 'flying in', starting: 'starting',
};
const by = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const nf = (n: number) => Math.round(n).toLocaleString('en-US');
const on = by<HTMLInputElement>('fly-on'), set = by('fly-set'), menu = by('set-menu');
const size = by<HTMLInputElement>('fly-size'), blind = by<HTMLInputElement>('fly-blind'), scrambled = by<HTMLInputElement>('fly-scrambled');

function paint() {
  if (menu.hidden || set.hidden) return;
  const f = fly.snapshot(), alive = f.ready && f.behaviour !== 'squashed';
  by('fly-gen').textContent = nf(f.generation);
  by('fly-escapes').textContent = nf(f.escapes);
  by('fly-squashes').textContent = nf(f.squashes);
  by('fly-reaction').textContent = f.reaction === null ? '–' : `${nf(f.reaction)} ms`;
  by('fly-hunger').textContent = `${Math.round(f.hunger * 100)}%`;
  by('fly-now').textContent = NOW[f.behaviour] ?? f.behaviour;
  size.value = String(f.size);
  by('fly-size-n').textContent = f.size === 1 ? 'Real size' : `${f.size}×`;
  blind.checked = f.blind;
  scrambled.checked = f.scrambled;
  for (const b of set.querySelectorAll('button')) b.disabled = !alive;
}

function turn(value: boolean) {
  try { if (value) localStorage.removeItem(OFF); else localStorage.setItem(OFF, '1'); } catch { /* storage unavailable */ }
  on.checked = value; set.hidden = !value;
  if (value) fly.start(); else fly.stop();
  paint();
}

fly.subscribe(paint);
on.addEventListener('change', () => turn(on.checked));
size.addEventListener('input', () => fly.setSize(Number(size.value)));
blind.addEventListener('change', () => fly.setBlind(blind.checked));
scrambled.addEventListener('change', () => fly.setScrambled(scrambled.checked));
by('fly-dust').addEventListener('click', () => fly.dust());
set.addEventListener('click', event => {
  const food = (event.target as Element).closest<HTMLElement>('[data-food]')?.dataset.food;
  if (food) fly.dropFood(food as FoodKind);
});

let wanted = true;
try { wanted = localStorage.getItem(OFF) !== '1'; } catch { /* storage unavailable */ }
on.checked = wanted; set.hidden = !wanted;
// the page first: the brain and its circuit wait until everything the page itself needs is in
if (wanted) { if (document.readyState === 'complete') fly.start(); else addEventListener('load', () => fly.start(), { once: true }); }

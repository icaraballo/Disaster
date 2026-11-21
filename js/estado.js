// El estado de la partida (G) y las consultas más usadas sobre él. Sin pantalla.
// G se importa como enlace vivo: cuando setG() lo cambia, todos los módulos ven el nuevo.
import { TOWNS } from '../data/pueblos.js';
import { OFICIOS, NAMES } from '../data/gente.js';
import { BUILD, N } from '../data/casillas.js';
import { INTENSIDAD } from '../data/balance.js';
import { pick } from './azar.js';
import { t } from './i18n.js';

export let G = null;
export function setG(g) { G = g; }

export const T = (i) => G.tiles[i];
export const town = () => TOWNS[G.town];
export const peligro = () => TOWNS[G.town].peligro || 1;
export const ofName = (w) => t('oficios.' + w.of + '.' + w.g);
export const aytoIdx = () => G.tiles.findIndex(x => x.t === 'A');
export const aytoDown = () => { const i = aytoIdx(); return i >= 0 && G.tiles[i].dmg; };
export const obsOk = () => G.tiles.some(x => x.t === 'O' && !x.dmg);
export const hasType = (k) => G.tiles.some(x => x.t === k);
export const aljibeOk = () => G.tiles.some(x => x.t === 'W' && !x.dmg);
export const granjasOk = () => G.tiles.filter(x => x.t === 'G' && !x.dmg).length;
export const obsLevel = () => Math.min(3, 1 + G.perks.radar + (obsOk() ? 1 : 0) + (G.alc === 'meteorologa' ? 1 : 0));
export const intensity = (idx) => INTENSIDAD(idx);
export const healthy = (of) => G.workers.some(w => w.of === of && !w.gone && !w.inj);
export const aliveWorkers = () => G.workers.filter(w => !w.gone);
export const W = (id) => G.workers.find(w => w.id === id);

// Casillas especiales del mapa: ladera, nevero, las que quedan bajo la ladera y dónde se trabaja.
export function computeGeo() {
  const L = [], S = [], slide = new Set();
  G.tiles.forEach((x, i) => { if (x.t === 'L') L.push(i); if (x.t === 'S') S.push(i); });
  L.forEach(i => { for (let k = 1; k <= 2; k++) { const j = i + 7 * k; if (j < N && BUILD.has(G.tiles[j].t)) slide.add(j); } });
  G.LADERA = L; G.NIEVE = S; G.SLIDE = [...slide];
  const first = (k) => G.tiles.findIndex(x => x.t === k);
  G.WORK = {talar:first('B'), cantera:first('L'), granja:first('G'), recaudar:aytoIdx()};
}

export function newWorker(of, temp) {
  const used = new Set(G.workers.map(w => w.name));
  const free = NAMES.filter(n => !used.has(n[0]));
  const [name, g] = free.length ? pick(free) : [t('ui.vecino', {n: G.workers.length + 1}), 'm'];
  const houses = G.tiles.map((x, i) => x.t === 'C' ? i : -1).filter(i => i >= 0);
  const w = {id:'w' + (G.nextId++), name, g, of: of || pick(Object.keys(OFICIOS).filter(k => k !== 'peon')), home: pick(houses), inj:0, gone:false, temp:!!temp};
  w.familia = w.home; // la familia con la que vive (si su casa cae, se muda con ella)
  G.workers.push(w);
  return w;
}

// Gente que puede trabajar este turno (ni se ha ido, ni está desanimada, ni herida salvo la enfermera).
export function availableWorkers() {
  return G.workers.filter(w => !w.gone && !G.desanimados.includes(w.id) && (!w.inj || (G.alc === 'enfermera' && G.turn >= 2)));
}
export const assigned = () => new Set([].concat(G.alloc.talar, G.alloc.cantera, G.alloc.granja, G.alloc.recaudar, G.busy));
export const freeWorkers = () => { const a = assigned(); return availableWorkers().filter(w => !a.has(w.id)); };
export function cleanAlloc() {
  const ok = new Set(availableWorkers().map(w => w.id));
  for (const k in G.alloc) G.alloc[k] = G.alloc[k].filter(id => ok.has(id));
  G.busy = G.busy.filter(id => ok.has(id));
}
export const townName = () => t('pueblos.' + G.town + '.nombre');

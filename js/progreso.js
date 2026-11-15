// Progreso entre partidas: victorias, desbloqueos y récord. Se guarda en localStorage y,
// si el juego corre dentro de Claude.ai, también en su base de datos (ver ranking.js).
import { TOWNS } from '../data/pueblos.js';
import { subirProgreso } from './ranking.js';

const CLAVE = 'villarrio-progress';

export const defaultProg = () => ({wins:{}, maxIdx:{}, total:0, seasons:0, test:false, best:0});
export let PROG = defaultProg();
export function setProg(p) { PROG = p; }

export function cargarProgreso() {
  try {
    const s = typeof localStorage !== 'undefined' && localStorage.getItem(CLAVE);
    if (s) PROG = Object.assign(defaultProg(), JSON.parse(s));
  } catch (e) { /* sin almacenamiento: se juega igual, sin guardar */ }
}

export function mergeProg(a, b) {
  const o = defaultProg();
  o.total = Math.max(a.total || 0, b.total || 0); o.seasons = Math.max(a.seasons || 0, b.seasons || 0);
  o.best = Math.max(a.best || 0, b.best || 0); o.test = !!(a.test || b.test);
  for (const k of new Set([...Object.keys(a.wins || {}), ...Object.keys(b.wins || {})])) o.wins[k] = Math.max((a.wins || {})[k] || 0, (b.wins || {})[k] || 0);
  for (const k of new Set([...Object.keys(a.maxIdx || {}), ...Object.keys(b.maxIdx || {})])) o.maxIdx[k] = Math.max((a.maxIdx || {})[k] || 0, (b.maxIdx || {})[k] || 0);
  return o;
}

export function saveProg() {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(CLAVE, JSON.stringify(PROG)); } catch (e) { /* idem */ }
  subirProgreso(PROG);
}

// Condiciones de desbloqueo de los datos (data/pueblos.js, data/alcaldes.js).
export function cumple(c, p) {
  switch (c.tipo) {
    case 'victorias': return (p.wins[c.pueblo] || 0) >= c.n;
    case 'alcance': return (p.maxIdx[c.pueblo] || 0) >= c.n;
    case 'total': return p.total >= c.n;
    case 'victoriasTotales': return Object.values(p.wins).some(v => v >= c.n);
    case 'temporadas': return p.seasons >= c.n;
    default: return false;
  }
}
export const unlockedTown = (k) => PROG.test || !TOWNS[k].unlock || cumple(TOWNS[k].unlock, PROG);
export const unlockedAlc = (a) => PROG.test || !a.unlock || cumple(a.unlock, PROG);

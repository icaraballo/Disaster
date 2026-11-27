// Progreso entre partidas: victorias, desbloqueos y récord. Se guarda en localStorage y,
// si el juego corre dentro de Claude.ai, también en su base de datos (ver ranking.js).
import { TOWNS } from '../data/pueblos.js';
import { MEDALLAS } from '../data/balance.js';
import { TEMAS } from '../data/temas.js';
import { subirProgreso } from './ranking.js';

const CLAVE = 'villarrio-progress';

// winsAlc: victorias con cada alcalde; retoOro: retos diarios ganados con oro (los dos desbloquean temas, T-15).
export const defaultProg = () => ({wins:{}, maxIdx:{}, total:0, seasons:0, test:false, best:0, medallas:{}, winsAlc:{}, retoOro:0});
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
  for (const k of new Set([...Object.keys(a.winsAlc || {}), ...Object.keys(b.winsAlc || {})])) o.winsAlc[k] = Math.max((a.winsAlc || {})[k] || 0, (b.winsAlc || {})[k] || 0);
  o.retoOro = Math.max(a.retoOro || 0, b.retoOro || 0);
  // la mejor medalla de cada pueblo
  for (const k of new Set([...Object.keys(a.medallas || {}), ...Object.keys(b.medallas || {})])) {
    const ma = (a.medallas || {})[k], mb = (b.medallas || {})[k];
    o.medallas[k] = MEDALLAS.indexOf(ma) >= MEDALLAS.indexOf(mb) ? ma : mb;
  }
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
    case 'victoriasAlcalde': return ((p.winsAlc || {})[c.alcalde] || 0) >= c.n;
    case 'retoOro': return (p.retoOro || 0) >= c.n;
    default: return false;
  }
}
export const unlockedTown = (k) => PROG.test || !TOWNS[k].unlock || cumple(TOWNS[k].unlock, PROG);
export const unlockedAlc = (a) => PROG.test || !a.unlock || cumple(a.unlock, PROG);
// Temas (T-15): los principales siempre; el resto, con su condición o con el modo prueba («Desbloquear todo»).
export const unlockedTema = (id) => { const x = TEMAS.find(m => m.id === id); return !!x && (x.principal || PROG.test || cumple(x.unlock, PROG)); };

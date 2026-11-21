// Las casas y sus familias (T-12). Sin pantalla.
//
// Escalera de una casa:  BIEN ─(le da un desastre)─► DAÑADA ─(1 desastre sin reparar)─► RUINAS ─(otro)─► SOLAR
//   - Casa (C): x.dmg dice si está dañada; x.propia, si su familia vive en ella; x.huespedes, las casas
//     de origen de las familias acogidas (como mucho FAMILIAS_POR_CASA familias en total).
//   - Ruinas (U): x.acogidaEn es la casa donde vive ahora su familia (null si la familia se ha ido).
//   - Solar vacío (V) y terraplén (E): sin familia. Ruinas, solar y terraplén no son edificios.
// Las familias son un número fijo de vecinos cada una (data/balance.js), no G.res.pop / casas.
import { FAMILIAS_POR_CASA, VECINOS_FAMILIA_SE_VA, MORAL_RUINAS } from '../data/balance.js';
import { clamp, cheb, cap } from './util.js';
import { G, T } from './estado.js';
import { t } from './i18n.js';

export const RUINAS = 'U', SOLAR = 'V', TERRAPLEN = 'E';

export const familias = (x) => x.t === 'C' ? (x.propia ? 1 : 0) + (x.huespedes ? x.huespedes.length : 0) : 0;
export const casaSana = (x) => x.t === 'C' && !x.dmg;
export const idxCasas = () => G.tiles.map((x, i) => x.t === 'C' ? i : -1).filter(i => i >= 0);

// Nombre de una casa para los textos: «la casa de Miren» si vive alguien de tu gente, si no «una casa».
export function nombreCasa(i) {
  const w = G.workers.find(v => v.home === i && !v.gone);
  return w ? t('nombres.casaDe', {nombre: w.name}) : t('nombres.C');
}

// La casa de acogida para la familia de la casa `origen`: primero una casa sana sin nadie; si no,
// la casa sana con una sola familia más cercana (si empatan, la de índice menor). null si no hay sitio.
export function elegirAcogida(origen) {
  const sanas = idxCasas().filter(i => i !== origen && casaSana(T(i)));
  const vacia = sanas.find(i => familias(T(i)) === 0);
  if (vacia != null) return vacia;
  const conSitio = sanas.filter(i => familias(T(i)) > 0 && familias(T(i)) < FAMILIAS_POR_CASA);
  conSitio.sort((a, b) => cheb(origen, a) - cheb(origen, b) || a - b);
  return conSitio.length ? conSitio[0] : null;
}

// La casa sana más cercana con sitio (para tu gente que se queda sin casa). null si no hay.
function casaConSitio(desde) {
  const c = idxCasas().filter(i => casaSana(T(i)) && familias(T(i)) < FAMILIAS_POR_CASA);
  c.sort((a, b) => cheb(desde, a) - cheb(desde, b) || a - b);
  return c.length ? c[0] : null;
}

// Tu gente de la familia de `origen` (la que vivía en esa casa) se muda a `destino`, o se realoja si
// la familia se ha ido del pueblo (decidido para la v4: tu gente no se va con su familia).
function moverGente(origen, destino) {
  G.workers.filter(w => !w.gone && w.familia === origen).forEach(w => {
    if (destino != null) { w.home = destino; return; }
    w.familia = null; w.home = casaConSitio(w.home == null ? origen : w.home);
  });
}

// La familia acogida que vive en `casa` y viene de `origen` se va del pueblo para siempre.
function seVaAcogida(casa, origen, ev) {
  const x = T(casa);
  x.huespedes = x.huespedes.filter(o => o !== origen);
  if (T(origen) && T(origen).t === RUINAS) T(origen).acogidaEn = null;
  G.res.pop -= VECINOS_FAMILIA_SE_VA;
  G.stats.familias = (G.stats.familias || 0) + 1;
  moverGente(origen, null);
  return {text: t('log.acogidaSeVa', {lugar: nombreCasa(casa), n: VECINOS_FAMILIA_SE_VA}), kind: 'bad', tiles: [[casa, 'dmg']]};
}

// Al dañarse una casa con familias acogidas, éstas se van del pueblo (el golpe doble).
export function seVanAcogidas(i, ev) {
  const x = T(i);
  (x.huespedes || []).slice().forEach(o => ev.push(seVaAcogida(i, o, ev)));
}

// La casa i (dañada) pasa a ruinas: su familia se muda a una casa de acogida o, sin sitio, se va.
export function aRuinas(i, ev) {
  const x = T(i), nm = nombreCasa(i);
  // las familias acogidas que hubiera aquí ya se fueron al dañarse la casa; por si acaso:
  seVanAcogidas(i, ev);
  const habia = x.propia;
  x.t = RUINAS; x.dmg = false; x.propia = false; x.huespedes = []; x.acogidaEn = null;
  x.evac = false;
  ev.push({text: t('log.aRuinas', {lugar: cap(nm)}), kind: 'bad', tiles: [[i, 'ruinas']]});
  if (!habia) return;
  G.res.moral = clamp(G.res.moral - MORAL_RUINAS, 0, 100);
  const dest = elegirAcogida(i);
  if (dest != null) {
    const nombre = nombreCasa(dest);   // antes de mudar a nadie, para que no se llame como quien llega
    T(dest).huespedes.push(i); x.acogidaEn = dest;
    moverGente(i, dest);
    ev.push({text: t('log.familiaAcogida', {lugar: nombre}), kind: 'warn', tiles: [[dest, 'acogida']]});
  } else {
    G.res.pop -= VECINOS_FAMILIA_SE_VA;
    G.stats.familias = (G.stats.familias || 0) + 1;
    moverGente(i, null);
    ev.push({text: t('log.familiaSinSitio', {n: VECINOS_FAMILIA_SE_VA}), kind: 'bad'});
  }
}

// Las ruinas i pasan a solar vacío: la familia acogida se cansa de esperar y se va del pueblo.
export function aSolar(i, ev) {
  const x = T(i), dest = x.acogidaEn;
  x.t = SOLAR; x.acogidaEn = null;
  ev.push({text: t('log.aSolar'), kind: 'bad', tiles: [[i, 'solar']]});
  if (dest != null && T(dest).t === 'C' && (T(dest).huespedes || []).includes(i)) {
    T(dest).huespedes = T(dest).huespedes.filter(o => o !== i);
    G.res.pop -= VECINOS_FAMILIA_SE_VA;
    G.stats.familias = (G.stats.familias || 0) + 1;
    moverGente(i, null);
    ev.push({text: t('log.familiaCansada', {lugar: nombreCasa(dest), n: VECINOS_FAMILIA_SE_VA}), kind: 'bad', tiles: [[dest, 'dmg']]});
  }
}

// Reparar las ruinas i: vuelve a ser una casa y su familia (si sigue en el pueblo) vuelve.
export function repararRuinas(i) {
  const x = T(i), dest = x.acogidaEn;
  x.t = 'C'; x.dmg = false; x.huespedes = []; x.propia = false; x.acogidaEn = null;
  if (dest != null && T(dest).t === 'C' && (T(dest).huespedes || []).includes(i)) {
    T(dest).huespedes = T(dest).huespedes.filter(o => o !== i);
    x.propia = true;
    moverGente(i, i);
  }
}

// Reconstruir el solar i: una casa nueva, vacía (no vuelve nadie).
export function reconstruir(i) {
  const x = T(i);
  x.t = 'C'; x.dmg = false; x.propia = false; x.huespedes = []; x.acogidaEn = null;
}

// Terraplén en las ruinas o el solar i: la casa desaparece para siempre; su familia se queda acogida.
export function terraplen(i) {
  const x = T(i);
  x.t = TERRAPLEN; x.acogidaEn = null; x.sacos = false;
}

// Lo que pasa al final del impacto (T-12 §B.2 y §B.4), con lo que estaba dañado o en ruinas al empezar.
//   inicio: {danadas: [casas dañadas], otros: [otros edificios dañados], ruinas: [ruinas]}
export function finDeImpacto(inicio, ev, MORAL) {
  // 1. Lo que sigue dañado sin reparar desde antes de este impacto pesa en la moral.
  let pierde = 0;
  inicio.danadas.forEach(i => { const x = T(i); if (x.t === 'C' && x.dmg) pierde += MORAL.porFamilia * familias(x); });
  inicio.otros.forEach(i => { if (T(i).dmg) pierde += MORAL.otroEdificio; });
  if (pierde) { G.res.moral = clamp(G.res.moral - pierde, 0, 100); ev.push({text: t('log.sinReparar', {n: pierde}), kind: 'cascade'}); }
  // 2. Las casas que siguen dañadas pasan a ruinas.
  inicio.danadas.forEach(i => { const x = T(i); if (x.t === 'C' && x.dmg) aRuinas(i, ev); });
  // 3. Las ruinas de antes de este impacto pasan a solar.
  inicio.ruinas.forEach(i => { if (T(i).t === RUINAS) aSolar(i, ev); });
}

export function fotoInicio() {
  const danadas = [], otros = [], ruinas = [];
  G.tiles.forEach((x, i) => {
    if (x.t === 'C' && x.dmg) danadas.push(i);
    else if (x.t === RUINAS) ruinas.push(i);
    else if (x.dmg) otros.push(i);
  });
  return {danadas, otros, ruinas};
}

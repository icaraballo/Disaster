// Las casas, sus familias y el refugio (T-12, revisado el 21-11 con Iñigo). Sin pantalla.
//
// Escalera de una casa:  BIEN ─(le da un desastre)─► DAÑADA ─(1 desastre sin reparar)─► RUINAS ─(otro)─► SOLAR
//   - Dañada: la familia sigue en casa; baja la moral, no los vecinos (los vecinos sólo bajan cuando
//     una familia se va del pueblo).
//   - Ruinas: la familia se muda a una casa de acogida; si no hay sitio, se va del pueblo. Las familias
//     que estaban acogidas en esa casa se van del pueblo.
//   - Solar: no pasa nada más; la familia sigue acogida esperando y reconstruir la devuelve a casa.
//   - Casa (C): x.dmg dice si está dañada; x.propia, si su familia vive en ella; x.huespedes, el origen
//     de las familias acogidas (como mucho FAMILIAS_POR_CASA familias en total).
//   - Ruinas (U) y solar (V): x.acogidaEn es la casa donde espera su familia (null si se fue).
//   - Terraplén (E): sin familia. Ruinas, solar y terraplén no son edificios.
// Refugio (H): evacuar lleva a las familias de una casa al refugio hasta que vuelvan; cada desastre
// allí cuesta más comida (1, 2, 3… por familia). x.evac, x.evacN (desastres pagados), x.evacPagado.
import { FAMILIAS_POR_CASA, VECINOS_FAMILIA_SE_VA, MORAL_RUINAS, MORAL_FAMILIA_SE_VA, REFUGIO_PLAZAS } from '../data/balance.js';
import { clamp, cheb, cap } from './util.js';
import { G, T } from './estado.js';
import { t } from './i18n.js';

export const RUINAS = 'U', SOLAR = 'V', TERRAPLEN = 'E', REFUGIO = 'H';

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

// Tu gente de la familia de `origen` se muda a `destino`, o se realoja si la familia se ha ido del
// pueblo (decidido para la v4: tu gente no se va con su familia).
function moverGente(origen, destino) {
  G.workers.filter(w => !w.gone && w.familia === origen).forEach(w => {
    if (destino != null) { w.home = destino; return; }
    w.familia = null; w.home = casaConSitio(w.home == null || w.home < 0 ? 0 : w.home);
  });
}

// Una familia se va del pueblo para siempre.
function seVa() {
  G.res.pop -= VECINOS_FAMILIA_SE_VA;
  G.res.moral = clamp(G.res.moral - MORAL_FAMILIA_SE_VA, 0, 100);
  G.stats.familias = (G.stats.familias || 0) + 1;
}

// La familia acogida en `casa` que viene de `origen` se va del pueblo.
function seVaAcogida(casa, origen) {
  const x = T(casa);
  x.huespedes = x.huespedes.filter(o => o !== origen);
  if (T(origen) && (T(origen).t === RUINAS || T(origen).t === SOLAR)) T(origen).acogidaEn = null;
  seVa();
  moverGente(origen, null);
  return {text: t('log.acogidaSeVa', {lugar: nombreCasa(casa), n: VECINOS_FAMILIA_SE_VA}), kind: 'bad', tiles: [[casa, 'dmg']]};
}

// La casa i cae en ruinas: las familias acogidas en ella se van del pueblo; su familia se muda a una
// casa de acogida o, sin sitio, se va.
export function aRuinas(i, ev) {
  const x = T(i), nm = nombreCasa(i);
  const habia = x.propia, huespedes = (x.huespedes || []).slice();
  if (x.evac) volverACasa(i);
  ev.push({text: t('log.aRuinas', {lugar: cap(nm)}), kind: 'bad', tiles: [[i, 'ruinas']]});
  huespedes.forEach(o => ev.push(seVaAcogida(i, o)));
  x.t = RUINAS; x.dmg = false; x.contra = false; x.propia = false; x.huespedes = []; x.acogidaEn = null;
  if (!habia && !huespedes.length) return;
  G.res.moral = clamp(G.res.moral - MORAL_RUINAS, 0, 100);
  if (!habia) return;
  const dest = elegirAcogida(i);
  if (dest != null) {
    const nombre = nombreCasa(dest);   // antes de mudar a nadie, para que no se llame como quien llega
    T(dest).huespedes.push(i); x.acogidaEn = dest;
    moverGente(i, dest);
    ev.push({text: t('log.familiaAcogida', {lugar: nombre}), kind: 'warn', tiles: [[dest, 'acogida']]});
  } else {
    seVa();
    moverGente(i, null);
    ev.push({text: t('log.familiaSinSitio', {n: VECINOS_FAMILIA_SE_VA}), kind: 'bad'});
  }
}

// Las ruinas i pasan a solar: la familia sigue acogida esperando; reconstruir costará más.
export function aSolar(i, ev) {
  T(i).t = SOLAR;
  ev.push({text: t('log.aSolar'), kind: 'warn', tiles: [[i, 'solar']]});
}

// La familia que esperaba en otra casa vuelve a la suya (al reparar las ruinas o reconstruir el solar).
function vuelveFamilia(i, dest) {
  const x = T(i);
  if (dest != null && T(dest).t === 'C' && (T(dest).huespedes || []).includes(i)) {
    T(dest).huespedes = T(dest).huespedes.filter(o => o !== i);
    x.propia = true;
    moverGente(i, i);
  }
}

// Reparar las ruinas i: vuelve a ser una casa y su familia (si sigue en el pueblo) vuelve.
export function repararRuinas(i) {
  const x = T(i), dest = x.acogidaEn;
  x.t = 'C'; x.dmg = false; x.contra = false; x.huespedes = []; x.propia = false; x.acogidaEn = null;
  vuelveFamilia(i, dest);
}

// Reconstruir el solar i: una casa nueva. Si su familia esperaba acogida, vuelve; si no, queda vacía.
export function reconstruir(i) {
  repararRuinas(i);
}

// Terraplén en las ruinas o el solar i: la casa desaparece para siempre; su familia se queda acogida.
export function terraplen(i) {
  const x = T(i);
  x.t = TERRAPLEN; x.acogidaEn = null; x.sacos = false; x.contra = false;
}

// ---------- el refugio ----------
export const idxRefugio = () => G.tiles.findIndex(x => x.t === REFUGIO);
export const refugioOk = () => { const i = idxRefugio(); return i >= 0 && !G.tiles[i].dmg; };
export const plazasUsadas = () => G.tiles.reduce((s, x) => s + (x.evac ? familias(x) : 0), 0);
export const plazasRefugio = () => REFUGIO_PLAZAS + (G.alc === 'enfermera' ? 1 : 0);   // la enfermera: una plaza más
export const plazasLibres = () => refugioOk() ? plazasRefugio() - plazasUsadas() : 0;
// DB-01: comida que cuesta meter a las familias de la casa x en el refugio (1 por familia; mitad con agricultor).
export const costeEntradaRefugio = (x) => { const c = Math.max(1, x ? familias(x) : 1); return G.alc === 'agricultor' ? Math.ceil(c / 2) : c; };
// Lo que costará en comida el próximo desastre de la casa evacuada i (1, 2, 3… por familia).
// (con el agricultor, la mitad: comen de los huertos del pueblo)
const tarifa = (x) => { const c = (x.evacN + 1) * familias(x); return G.alc === 'agricultor' ? Math.ceil(c / 2) : c; };
export const costeRefugio = (x) => x.evacPagado ? 0 : tarifa(x);

export function evacuarCasa(i) {
  const x = T(i);
  x.evac = true; x.evacN = 1; x.evacPagado = true;   // al entrar se paga el primer desastre
}
export function volverACasa(i) {
  const x = T(i);
  x.evac = false; x.evacN = 0; x.evacPagado = false;
}
// Al empezar un impacto: cada familia evacuada paga su estancia; sin comida, vuelve a casa.
export function cobrarRefugio(ev) {
  G.tiles.forEach((x, i) => {
    if (!x.evac) return;
    if (x.evacPagado) { x.evacPagado = false; return; }
    const c = tarifa(x);
    if (G.res.comida >= c) { G.res.comida -= c; x.evacN++; ev.push({text: t('log.refugioPaga', {lugar: nombreCasa(i), n: c}), kind: 'info'}); }
    else { volverACasa(i); ev.push({text: t('log.refugioSinComida', {lugar: nombreCasa(i)}), kind: 'bad', tiles: [[i, 'ok']]}); }
  });
}
// Si el refugio se daña, todas las familias vuelven a casa.
export function vaciarRefugio(ev) {
  let n = 0;
  G.tiles.forEach((x, i) => { if (x.evac) { volverACasa(i); n++; } });
  if (n) ev.push({text: t('log.refugioVacio', {n}), kind: 'cascade'});
}

// Lo que pasa al final del impacto (T-12 §B.2), con lo que estaba dañado o en ruinas al empezar.
export function finDeImpacto(inicio, ev) {
  // 1. Las casas que siguen dañadas desde antes de este impacto caen en ruinas.
  inicio.danadas.forEach(i => { const x = T(i); if (x.t === 'C' && x.dmg) aRuinas(i, ev); });
  // 2. Las ruinas de antes de este impacto pasan a solar.
  inicio.ruinas.forEach(i => { if (T(i).t === RUINAS) aSolar(i, ev); });
}

export function fotoInicio() {
  const danadas = [], ruinas = [];
  G.tiles.forEach((x, i) => {
    if (x.t === 'C' && x.dmg) danadas.push(i);
    else if (x.t === RUINAS) ruinas.push(i);
  });
  return {danadas, ruinas};
}

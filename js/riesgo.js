// El mapa de riesgo (probabilidad de daño de cada edificio según la previsión) y la ficha de
// cada casilla (qué le puede pasar, en qué estado está). Sin pantalla.
// Usa los mismos números que los desastres (data/balance.js).
import { BUILD, N } from '../data/casillas.js';
import { SLIDE_MULT } from '../data/desastres.js';
import { DIQUE_ARRASTRE, TERRAPLEN_ARRASTRE, PASA_AGUA, FAMILIAS_POR_CASA, riadaP, temporalP, aludP, deslizamientoP, deslizamientoCasillas, rayosTormenta, focosIncendio } from '../data/balance.js';
import { clamp, nb4, cheb } from './util.js';
import { G, T, town, peligro, healthy } from './estado.js';
import { detras } from './desastres.js';
import { RUINAS, SOLAR, TERRAPLEN, REFUGIO, familias, elegirAcogida, nombreCasa, plazasUsadas, plazasRefugio, costeRefugio } from './casas.js';
import { REFUGIO_PLAZAS } from '../data/balance.js';
import { t } from './i18n.js';

// Probabilidad (0-1) de que cada casilla sufra daños si llegan estos desastres con intensidad I.
export function riskFor(types, I) {
  const acc = new Array(N).fill(0);
  const add = (i, p) => { if (BUILD.has(T(i).t)) acc[i] = 1 - (1 - acc[i]) * (1 - clamp(p, 0, 1)); };
  // Las mismas reglas que waterFlood (desastres.js): el terraplén frena y empuja río abajo, los sacos
  // protegen y tapan el agujero, y las ruinas (50 %) y el solar (100 %) dejan pasar el agua detrás.
  const water = (src, p0, river) => {
    let carry = 0;
    for (const s of src) {
      if (T(s).dique) { if (river) carry += p0 * DIQUE_ARRASTRE; continue; }
      const pt = Math.min(0.9, p0 + carry); if (river) carry *= 0.5;
      nb4(s).forEach(n => {
        const tt = T(n).t;
        if (tt === 'R' || tt === 'M') return;
        if (tt === TERRAPLEN) { if (river) carry += p0 * TERRAPLEN_ARRASTRE; return; }
        if (T(n).sacos) return;
        add(n, pt);
        let de = s, cur = n, p = pt;
        while (T(cur).t === RUINAS || T(cur).t === SOLAR) {
          const j = detras(de, cur);
          if (j == null || T(j).t === TERRAPLEN) break;
          p *= PASA_AGUA[T(cur).t];
          if (T(j).sacos) break;
          add(j, p);
          de = cur; cur = j;
        }
      });
    }
  };
  types.forEach(k => {
    if (k === 'riada') water(town().river, riadaP(I, town().riadaMult, G.perks.bomba, peligro()), true);
    if (k === 'temporal') water(G.tiles.map((x, i) => x.t === 'M' ? i : -1).filter(i => i >= 0), temporalP(I, G.perks.bomba, peligro()), false);
    if (k === 'incendio') {
      const f = (G.dry || types.includes('sequia') || types.includes('ola') ? 1.3 : 1) * (healthy('bombero') ? 0.8 : 1) * (G.perks.bomberos ? 0.7 : 1);
      const focos = focosIncendio(I, peligro());
      G.tiles.forEach((x, b) => {
        if (!BUILD.has(x.t)) return;
        G.tiles.forEach((u, j) => { if (u.t !== 'B') return; const d = cheb(b, j); if (d === 1) add(b, 0.18 * focos * f); else if (d === 2) add(b, 0.07 * focos * f); });
      });
    }
    if (k === 'tormenta') {
      const bs = G.tiles.map((x, i) => BUILD.has(x.t) ? i : -1).filter(i => i >= 0);
      const p = Math.min(0.95, rayosTormenta(I, peligro()) / bs.length); // los mismos edificios que alcanza la tormenta (desastres.js)
      bs.forEach(i => { if (!G.tiles.some((x, j) => x.rayo && cheb(i, j) <= 1)) add(i, p); });
    }
    if (k === 'alud') {
      const pT = aludP(I, G.res.riesgo, peligro()), cols = {};
      G.NIEVE.forEach(i => { const c = i % 7; if (cols[c] === undefined || i < cols[c]) cols[c] = i; });
      Object.values(cols).forEach(s => {
        if (T(s).muro) return;
        for (let j = s + 7; j < N; j += 7) {
          const x = T(j);
          if (x.t === 'S') { if (x.muro) return; continue; }
          if (x.muro || x.t === 'B') return;
          if (BUILD.has(x.t)) { add(j, pT); return; }
        }
      });
    }
  });
  const slide = G.SLIDE.filter(i => BUILD.has(T(i).t)); // como en startImpact: ruinas y solares no cuentan
  if (slide.length) {
    const mult = Math.max(...types.map(k => SLIDE_MULT[k]));
    const ch = deslizamientoP(G.res.riesgo, mult, I, peligro()), kk = Math.min(slide.length, deslizamientoCasillas(I));
    slide.forEach(i => add(i, ch * kk / slide.length));
  }
  return acc;
}

// El riesgo «habitual» de cada casilla en el próximo desastre, sin previsión: la media de los
// desastres del pueblo según lo a menudo que salen. Lo usa el evento del refugio lleno (entre
// desastres todavía no hay parte del observatorio, y no se puede dar pistas del calendario).
export function riesgoHabitual() {
  const pool = town().pool, I = G.schedule[Math.min(G.idx, G.schedule.length - 1)].I;
  let tot = 0; const acc = new Array(N).fill(0);
  for (const k in pool) { tot += pool[k]; riskFor([k], I).forEach((v, i) => { acc[i] += v * pool[k]; }); }
  return acc.map(v => v / tot);
}

// Mezcla el riesgo del desastre real y del señuelo según la precisión de la previsión.
export function riskMap() {
  const f = G.fc, a = riskFor(f.real, f.I), b = riskFor(f.decoy, f.I), p = f.pReal / 100;
  return a.map((v, i) => v * p + b[i] * (1 - p));
}

// Qué le puede pasar a la casilla i: lista de [gravedad, texto].
export function tileRisks(i) {
  const x = T(i), n = nb4(i), out = [];
  const nearRiver = n.some(j => T(j).t === 'R'), nearSea = n.some(j => T(j).t === 'M');
  const nearFire = n.some(j => ['B','P'].includes(T(j).t));
  const rayoCover = G.tiles.some((u, j) => u.rayo && cheb(i, j) <= 1);
  if (x.t === 'B') out.push(['bad', t('riesgos.B1')], ['warn', t('riesgos.B2')]);
  if (x.t === 'P') out.push(['warn', t('riesgos.P')]);
  if (x.t === 'L') out.push([G.res.riesgo >= 30 ? 'bad' : 'warn', t('riesgos.L1', {n: G.res.riesgo})], ['info', t('riesgos.L2')]);
  if (x.t === 'S') out.push(['bad', t('riesgos.S1')], ['info', t(x.muro ? 'riesgos.S2muro' : 'riesgos.S2')]);
  if (x.t === 'R') {
    const pos = town().river.indexOf(i);
    out.push(['warn', t('riesgos.R')]);
    if (pos >= 0) out.push(['info', t('riesgos.Rtramo', {pos: pos + 1, total: town().river.length})]);
  }
  if (x.t === 'M') out.push(['warn', t('riesgos.M')]);
  if (BUILD.has(x.t)) {
    if (nearRiver) out.push(['bad', t('riesgos.cercaRio')]);
    if (nearSea) out.push(['bad', t('riesgos.cercaMar')]);
    if (nearFire) out.push(['warn', t('riesgos.cercaFuego')]);
    if (G.SLIDE.includes(i)) out.push(['bad', t('riesgos.bajoLadera')]);
    if (G.NIEVE.length) { const c = i % 7; if (G.NIEVE.some(s => s % 7 === c && s < i)) out.push(['warn', t('riesgos.cercaAlud')]); }
    out.push(rayoCover ? ['good', t('riesgos.rayoProtegido')] : ['warn', t('riesgos.rayoRiesgo')]);
  }
  if (x.t === 'X' || x.t === 'Q') out.push(['good', t('riesgos.noArde')]);
  // T-12: la escalera de la casa y el agua que pasa por ruinas y solares
  if (x.t === 'C' && x.dmg) {
    const fam = familias(x);
    const dest = elegirAcogida(i);
    out.push(['bad', fam && x.propia ? (dest != null ? t('riesgos.aRuinasAcogida', {lugar: nombreCasa(dest)}) : t('riesgos.aRuinasSinSitio')) : t('riesgos.aRuinas')]);
  } else if (x.t === 'C' && familias(x) >= FAMILIAS_POR_CASA) out.push(['bad', t('riesgos.casaLlena')]);
  if (x.t === RUINAS) out.push(['bad', x.acogidaEn != null ? t('riesgos.aSolarFamilia', {lugar: nombreCasa(x.acogidaEn)}) : t('riesgos.aSolar')]);
  if (x.t === RUINAS || x.t === SOLAR) {
    const pasa = pasaAgua(i);
    if (pasa.length) out.push(['warn', t(x.t === RUINAS ? 'riesgos.pasaMitad' : 'riesgos.pasaTodo', {destino: pasa.map(j => tileNameCorto(j)).join(t('ui.y'))})]);
    else if (nearRiver || nearSea) out.push(['info', t('riesgos.pasaNada')]);
  }
  if (x.t === TERRAPLEN) out.push(['good', t('riesgos.terraplen')]);
  return out;
}

// A qué casillas puede pasar el agua desde las ruinas o el solar i (si llega desde el río o el mar).
export function pasaAgua(i) {
  const out = [];
  nb4(i).forEach(s => { const tt = T(s).t; if (tt !== 'R' && tt !== 'M') return; const j = detras(s, i); if (j != null && T(j).t !== TERRAPLEN && !out.includes(j)) out.push(j); });
  return out;
}
const tileNameCorto = (j) => T(j).t === 'C' ? nombreCasa(j) : (['A','G','O','W','U','V'].includes(T(j).t) ? t('nombres.' + T(j).t) : t('casillas.' + T(j).t + '.nombre').toLowerCase());

// En qué estado está la casilla i: lista de {text, bad}.
export function tileState(i) {
  const x = T(i), s = [];
  if (x.dmg) s.push({text: t('estado.danado'), bad: true});
  if (x.dique) s.push({text: x.t === 'M' ? t('estado.escollera') : t(x.cheap ? 'estado.diqueBarato' : 'estado.dique')});
  if (x.sacos) s.push({text: t('estado.sacos')});
  if (x.rayo) s.push({text: t('estado.pararrayos')});
  if (x.muro) s.push({text: t('estado.muro')});
  if (x.evac) s.push({text: costeRefugio(x) ? t('estado.refugioCoste', {n: costeRefugio(x)}) : t('estado.refugioPagado')});
  if (x.t === REFUGIO) s.push({text: t('estado.plazas', {n: plazasUsadas(), total: plazasRefugio()})});
  for (const k in G.WORK) if (G.WORK[k] === i && G.alloc[k].length) s.push({text: t('estado.trabajando', {n: G.alloc[k].length})});
  if (x.t === 'C') { const f = familias(x); s.push(f ? {text: t('estado.familias', {n: f, s: f > 1 ? 's' : ''}), bad: f >= FAMILIAS_POR_CASA} : {text: t('estado.vacia')}); }
  if (x.t === RUINAS) s.push(x.acogidaEn != null ? {text: t('estado.acogidaEn', {lugar: nombreCasa(x.acogidaEn)})} : {text: t('estado.familiaIda'), bad: true});
  const who = G.workers.filter(w => w.home === i && !w.gone).map(w => w.name);
  if (who.length) s.push({text: t('estado.viven', {nombres: who.join(', ')})});
  return s;
}

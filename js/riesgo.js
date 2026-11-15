// El mapa de riesgo (probabilidad de daño de cada edificio según la previsión) y la ficha de
// cada casilla (qué le puede pasar, en qué estado está). Sin pantalla.
// Usa los mismos números que los desastres (data/balance.js).
import { BUILD, N } from '../data/casillas.js';
import { SLIDE_MULT } from '../data/desastres.js';
import { DIQUE_ARRASTRE, riadaP, temporalP, aludP, deslizamientoP, deslizamientoCasillas } from '../data/balance.js';
import { clamp, nb4, cheb } from './util.js';
import { G, T, town, healthy } from './estado.js';
import { t } from './i18n.js';

// Probabilidad (0-1) de que cada casilla sufra daños si llegan estos desastres con intensidad I.
export function riskFor(types, I) {
  const acc = new Array(N).fill(0);
  const add = (i, p) => { if (BUILD.has(T(i).t)) acc[i] = 1 - (1 - acc[i]) * (1 - clamp(p, 0, 1)); };
  const water = (src, p0, river) => {
    let carry = 0;
    for (const s of src) {
      if (T(s).dique) { if (river) carry += p0 * DIQUE_ARRASTRE; continue; }
      const pt = Math.min(0.9, p0 + carry); if (river) carry *= 0.5;
      nb4(s).forEach(n => { if (!T(n).sacos) add(n, pt); });
    }
  };
  types.forEach(k => {
    if (k === 'riada') water(town().river, riadaP(I, town().riadaMult, G.perks.bomba), true);
    if (k === 'temporal') water(G.tiles.map((x, i) => x.t === 'M' ? i : -1).filter(i => i >= 0), temporalP(I, G.perks.bomba), false);
    if (k === 'incendio') {
      const f = (G.dry || types.includes('sequia') || types.includes('ola') ? 1.3 : 1) * (healthy('bombero') ? 0.8 : 1) * (G.perks.bomberos ? 0.7 : 1);
      G.tiles.forEach((x, b) => {
        if (!BUILD.has(x.t)) return;
        G.tiles.forEach((u, j) => { if (u.t !== 'B') return; const d = cheb(b, j); if (d === 1) add(b, 0.18 * I * f); else if (d === 2) add(b, 0.07 * I * f); });
      });
    }
    if (k === 'tormenta') {
      const bs = G.tiles.map((x, i) => BUILD.has(x.t) ? i : -1).filter(i => i >= 0);
      const p = Math.min(0.95, (2 + I) / bs.length);
      bs.forEach(i => { if (!G.tiles.some((x, j) => x.rayo && cheb(i, j) <= 1)) add(i, p); });
    }
    if (k === 'alud') {
      const pT = aludP(I, G.res.riesgo), cols = {};
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
  if (G.SLIDE.length) {
    const mult = Math.max(...types.map(k => SLIDE_MULT[k]));
    const ch = deslizamientoP(G.res.riesgo, mult, I), kk = deslizamientoCasillas(I);
    G.SLIDE.forEach(i => add(i, ch * kk / G.SLIDE.length));
  }
  return acc;
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
  return out;
}

// En qué estado está la casilla i: lista de {text, bad}.
export function tileState(i) {
  const x = T(i), s = [];
  if (x.dmg) s.push({text: t('estado.danado'), bad: true});
  if (x.dique) s.push({text: x.t === 'M' ? t('estado.escollera') : t(x.cheap ? 'estado.diqueBarato' : 'estado.dique')});
  if (x.sacos) s.push({text: t('estado.sacos')});
  if (x.rayo) s.push({text: t('estado.pararrayos')});
  if (x.muro) s.push({text: t('estado.muro')});
  if (x.evac) s.push({text: t('estado.evacuada')});
  for (const k in G.WORK) if (G.WORK[k] === i && G.alloc[k].length) s.push({text: t('estado.trabajando', {n: G.alloc[k].length})});
  const who = G.workers.filter(w => w.home === i && !w.gone).map(w => w.name);
  if (who.length) s.push({text: t('estado.viven', {nombres: who.join(', ')})});
  return s;
}

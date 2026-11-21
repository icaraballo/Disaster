// Jugadores automáticos y bucle de partida sin pantalla. Los usan los tests y tools/simular.mjs.
//   ingenuo: reparte a la gente al azar y no construye nunca ni elige con criterio.
//   listo:   usa el mapa de riesgo, protege según la previsión, produce lo que falta y deja
//            la cantera cuando la ladera pasa del 35 %. Cada turno suelta el reparto del turno
//            anterior (el reparto se arrastra de un turno a otro) y vuelve a pensar: primero
//            proteger, luego producir con la gente que queda libre.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BUILD } from '../data/casillas.js';
import { TEMPORADA } from '../data/balance.js';
import { mulberry32 } from '../js/azar.js';
import { cargarTextos } from '../js/i18n.js';
import { G, T, freeWorkers } from '../js/estado.js';
import { newGame } from '../js/partida.js';
import { ACTIONS, doAction } from '../js/acciones.js';
import { changeJob, endTurn } from '../js/turnos.js';
import { toResult, choosePerk, chooseEvent, finish } from '../js/temporada.js';
import { riskMap } from '../js/riesgo.js';
import { cheb, nb4 } from '../js/util.js';
import { RUINAS, SOLAR, familias } from '../js/casas.js';
import { pasaAgua } from '../js/riesgo.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function cargarTextosDeDisco() {
  cargarTextos(JSON.parse(fs.readFileSync(path.join(RAIZ, 'i18n', 'es.json'), 'utf8')));
}

const TRABAJOS = ['talar', 'cantera', 'granja', 'recaudar'];

// ---------- el ingenuo ----------
export function ingenuo(seed) {
  const R = mulberry32(seed * 31 + 7);
  return {
    preparar() {
      let guard = 0;
      while (freeWorkers().length && guard++ < 50) changeJob(TRABAJOS[Math.floor(R() * 4)], 1);
    },
    mejora: (ofertas) => ofertas[Math.floor(R() * ofertas.length)],
    evento: (ev) => Math.floor(R() * ev.opts.filter(o => !o.ok || o.ok()).length)
  };
}

// ---------- el listo ----------
const MEJORAS_ORDEN = ['bomba', 'bomberos', 'radar', 'muros', 'voluntarios', 'obras', 'reforestar', 'silos', 'carpinteros', 'fiesta', 'ayuda'];
// Para cada evento, qué opción elegir (índice entre las que se pueden elegir).
const EVENTO_ELIGE = {
  constructor: () => 1, fiestas: () => G.res.moral < 60 ? 0 : 1, refugiados: () => G.res.comida >= 14 ? 0 : 1,
  mercado: (n) => (G.res.comida < 12 && n > 2 ? 1 : n - 1), bosqueviejo: () => 1, periodista: () => G.res.moral < 50 ? 1 : 0,
  hospital: () => 0, miedo: () => 0, montaneros: () => 0, subvencion: () => 0
};

// opc (para el «medio»): olvido = probabilidad de saltarse una obra; sinEvacuar; sinObservatorio.
export function listo(seed, opc = {}) {
  const R = mulberry32(seed * 17 + 3);
  const libres = () => freeWorkers().length;
  const construir = (acc, i) => {
    if (!ACTIONS[acc] || !ACTIONS[acc].valid(T(i), i) || libres() < ACTIONS[acc].cuad) return false;
    if (opc.olvido && R() < opc.olvido) return false;
    G.sel = acc; const ok = doAction(i); G.sel = null; return ok;
  };
  // Lo que ve el jugador: dos opciones con su %. El listo espera a que la previsión se afine: antes del
  // último turno sólo se prepara para un desastre si su % pasa del umbral; el impaciente (medio) no espera.
  const pct = (k) => (G.fc.real.includes(k) ? G.fc.pReal : 0) + (G.fc.decoy.includes(k) ? 100 - G.fc.pReal : 0);
  const ultimo = () => G.turn >= G.maxTurns;
  const hay = (k) => (G.fc.real.includes(k) || G.fc.decoy.includes(k)) && (opc.impaciente || ultimo() || pct(k) >= (opc.umbral || 70));

  function proteger() {
    const heat = riskMap();
    const edif = G.tiles.map((x, i) => i).filter(i => BUILD.has(T(i).t)).sort((a, b) => heat[b] - heat[a]);
    // 1. reparar lo dañado, primero las casas con más familias (si no, caen en ruinas)
    const prioridad = (i) => (T(i).t === 'C' ? 10 * familias(T(i)) : 5) + heat[i];
    [...edif].sort((a, b) => prioridad(b) - prioridad(a)).forEach(i => { if (T(i).dmg && G.res.madera >= 2) construir('reparar', i); });
    // 1b. ruinas y solares: terraplén junto al agua, reparar las ruinas lejos; sacos de parche si no llega
    const junto = (i) => nb4(i).some(j => T(j).t === 'R' || T(j).t === 'M');
    G.tiles.forEach((x, i) => {
      if (x.t !== RUINAS && x.t !== SOLAR) return;
      if (junto(i)) {
        if (x.t === RUINAS && G.res.madera >= 2) { if (construir('terraplen', i)) return; }
        if (x.t === SOLAR && G.res.madera >= 2 && G.res.piedra >= 2) { if (construir('terraplenSolar', i)) return; }
        if (pasaAgua(i).some(j => BUILD.has(T(j).t)) && G.res.dinero >= 8 && (hay('riada') || hay('temporal'))) construir('sacos', i);
      } else if (x.t === RUINAS && x.acogidaEn != null && G.res.madera >= 4) construir('repararRuinas', i);
    });
    // 2. observatorio si se puede (mejora la previsión)
    if (!opc.sinObservatorio && G.res.madera >= 4 && G.res.dinero >= 30 + 15) {
      const prados = G.tiles.map((x, i) => i).filter(i => T(i).t === 'P');
      if (prados.length && libres() >= 2) construir('observatorio', prados[Math.floor(R() * prados.length)]);
    }
    // 2b. evacuar las casas amenazadas (una casa evacuada no pierde vecinos ni deja heridos)
    // (primero la casa con 2 familias: si se daña, la acogida se va del pueblo)
    if (!opc.sinEvacuar && (opc.impaciente || ultimo())) edif.filter(i => T(i).t === 'C' && familias(T(i)) > 0 && heat[i] >= 0.1)
      .sort((a, b) => familias(T(b)) * heat[b] - familias(T(a)) * heat[a]).slice(0, 6).forEach(i => { if (G.res.comida >= 6) construir('evacuar', i); });
    const peligrosos = edif.filter(i => heat[i] >= 0.12).slice(0, 8);
    // 3. proteger según lo que viene
    if (hay('riada') || hay('temporal')) {
      peligrosos.forEach(i => { if (G.res.dinero >= 8) construir('sacos', i); });
      for (let k = 0; k < 2; k++) {
        const agua = G.tiles.map((x, i) => i).filter(i => (T(i).t === 'R' || T(i).t === 'M') && !T(i).dique);
        if (G.res.piedra < 2 || !agua.length) break;
        const puntua = (i) => [i - 7, i + 7, i - 1, i + 1].reduce((s, j) => s + (heat[j] || 0), 0);
        const mejor = agua.sort((a, b) => puntua(b) - puntua(a))[0];
        if (puntua(mejor) > 0.25) construir('dique', mejor); else break;
      }
    }
    if (hay('incendio')) {
      const bosques = G.tiles.map((x, i) => i).filter(i => T(i).t === 'B');
      const junto = (i) => edif.some(e => Math.max(Math.abs(Math.floor(e / 7) - Math.floor(i / 7)), Math.abs(e % 7 - i % 7)) === 1);
      bosques.filter(junto).slice(0, 2).forEach(i => construir('cortafuegos', i));
    }
    if (hay('tormenta')) {
      // varios pararrayos, cada uno donde más edificios sin cubrir tiene al lado
      for (let k = 0; k < 3 && G.res.madera >= 2 && G.res.dinero >= 15; k++) {
        const cubierto = (i) => G.tiles.some((u, j) => u.rayo && cheb(i, j) <= 1);
        const sin = edif.filter(i => !cubierto(i));
        if (!sin.length) break;
        const cubre = (i) => sin.filter(j => cheb(i, j) <= 1).length;
        const mejor = edif.filter(i => !T(i).rayo).sort((a, b) => cubre(b) - cubre(a))[0];
        if (!mejor || !construir('pararrayos', mejor)) break;
      }
    }
    if (hay('alud')) {
      const nieve = G.NIEVE.filter(i => !T(i).muro);
      if (nieve.length && G.res.piedra >= 1 && G.res.madera >= 2) construir('muro', nieve[Math.floor(R() * nieve.length)]);
    }

  }

  function producir() {
    const mas = (job, n) => { for (let k = 0; k < n && libres() > 0; k++) changeJob(job, 1); };
    const necesita = Math.ceil(G.res.pop / 6);
    const granjas = G.tiles.some(x => x.t === 'G' && !x.dmg);
    if (granjas && G.res.comida < necesita * 2 + 3) mas('granja', 3);
    if (G.res.madera < 8 && G.res.riesgo < 40) mas('talar', 1);
    if (G.res.piedra < 5 && G.res.riesgo < 35) mas('cantera', 1);
    if (G.res.dinero < 50 && G.res.moral > 60) mas('recaudar', 1);
    if (granjas && G.res.comida < 30) mas('granja', 2);
    // el resto: lo más útil que no tensa la ladera ni la moral
    while (libres() > 0) {
      const antes = libres();
      if (granjas && G.res.comida < 40) mas('granja', 1); else if (G.res.riesgo < 30) mas('talar', 1); else mas('recaudar', G.res.moral > 80 ? 1 : 0);
      if (libres() === antes) break;
    }
  }

  return {
    preparar() {
      // Como haría un jugador: el reparto de producción se arrastra al turno siguiente, así que se
      // libera a todos antes de proteger. Sin esto, en los turnos 2 y 3 no quedaba gente para construir.
      for (const j of TRABAJOS) while (G.alloc[j].length) changeJob(j, -1);
      proteger(); producir();
    },
    mejora(ofertas) {
      return [...ofertas].sort((a, b) => MEJORAS_ORDEN.indexOf(a.id) - MEJORAS_ORDEN.indexOf(b.id))[0];
    },
    evento(ev) {
      const validas = ev.opts.filter(o => !o.ok || o.ok()).length;
      const f = EVENTO_ELIGE[G.lastEvent];
      return Math.min(validas - 1, f ? f(validas) : 0);
    }
  };
}

// ---------- el medio: un jugador que se despista ----------
// El listo, pero se olvida de una de cada tres obras, no evacúa, no construye el observatorio y no sabe
// esperar a la previsión: construye desde el turno 1 con lo que vea.
// Sirve de referencia de un jugador humano normal: el equilibrio se mide entre el ingenuo y el listo.
export const medio = (seed) => listo(seed, {olvido: 0.35, sinEvacuar: true, sinObservatorio: true, impaciente: true});

// ---------- bucle de una partida sin pantalla ----------
// opts: lo mismo que newGame (town, alc, semilla…). Devuelve cómo acabó.
export function jugar(opts, bot) {
  newGame(opts);
  let guard = 0, moralMin = G.res.moral;
  while (G.phase !== 'end' && guard++ < 600) {
    moralMin = Math.min(moralMin, G.res.moral);
    if (G.phase === 'forecast') { G.phase = 'prep'; G.msg = ''; }
    else if (G.phase === 'prep') { bot.preparar(); endTurn(); }
    else if (G.phase === 'impact') toResult();
    else if (G.phase === 'result') {
      if (G.lost || G.idx === TEMPORADA - 1) finish();
      else choosePerk(bot.mejora(G.result.offers).id);
    }
    else if (G.phase === 'event') chooseEvent(bot.evento(G.event));
    else throw new Error('Fase inesperada: ' + G.phase);
  }
  if (G.phase !== 'end') throw new Error('La partida no ha terminado');
  moralMin = Math.min(moralMin, G.res.moral);
  return {ganada: !G.lost, desastre: G.lost ? G.idx + 1 : TEMPORADA, puntos: G.final, town: G.town, alc: G.alc,
    vecinos: G.res.pop, moralMin, medalla: G.medalla || null};
}

const cuantil = (a, q) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(q * b.length))] : 0; };

// Juega n partidas y devuelve el porcentaje ganado, el desastre medio alcanzado, los vecinos
// finales (p10 y mediana), la moral mínima (mediana) y el reparto de medallas entre las ganadas.
export function simular(botFn, {town, alc = 'ingeniera', n = 200, semilla0 = 1}) {
  let ganadas = 0, suma = 0; const vec = [], mor = [], med = {bronce:0, plata:0, oro:0};
  for (let s = 0; s < n; s++) {
    const r = jugar({town, alc, semilla: semilla0 + s}, botFn(semilla0 + s));
    if (r.ganada) ganadas++;
    suma += r.desastre; vec.push(r.vecinos); mor.push(r.moralMin);
    if (r.medalla) med[r.medalla]++;
  }
  const pctMed = (k) => ganadas ? 100 * med[k] / ganadas : 0;
  return {pct: 100 * ganadas / n, medio: suma / n, vecP10: cuantil(vec, 0.1), vecMed: cuantil(vec, 0.5), moralMed: cuantil(mor, 0.5),
    oro: pctMed('oro'), plata: pctMed('plata') + pctMed('oro')};
}

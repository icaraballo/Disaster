// Jugadores automáticos y bucle de partida sin pantalla. Los usan los tests y tools/simular.mjs.
//   ingenuo: reparte a la gente al azar y no construye nunca ni elige con criterio.
//   listo:   usa el mapa de riesgo, protege según la previsión, aprovecha las ventajas y la acción
//            propia de su alcalde (salvo opc.generico), produce lo que falta y vigila la ladera y la moral.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BUILD } from '../data/casillas.js';
import { TEMPORADA } from '../data/balance.js';
import { mulberry32 } from '../js/azar.js';
import { cargarTextos } from '../js/i18n.js';
import { G, T, obsOk, granjasReforzadasOk, freeWorkers } from '../js/estado.js';
import { newGame } from '../js/partida.js';
import { ACTIONS, planObra, doAction } from '../js/acciones.js';
import { changeJob, endTurn } from '../js/turnos.js';
import { toResult, choosePerk, chooseEvent, finish } from '../js/temporada.js';
import { riskMap, pasaAgua } from '../js/riesgo.js';
import { cheb, nb4 } from '../js/util.js';
import { RUINAS, SOLAR, REFUGIO, familias, plazasLibres, costeRefugio, costeEntradaRefugio } from '../js/casas.js';

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
const EVENTO_ELIGE = {
  constructor: () => 1, fiestas: () => G.res.moral < 60 ? 0 : 1, refugiados: () => G.res.comida >= 14 ? 0 : 1,
  mercado: (n) => (G.res.comida < 12 && n > 2 ? 1 : n - 1), bosqueviejo: () => 1, periodista: () => G.res.moral < 50 ? 1 : 0,
  hospital: () => 0, miedo: () => 0, montaneros: () => 0, subvencion: () => 0, refugioLleno: () => 0
};

// opc: olvido, sinEvacuar, sinRefugio, sinObservatorio, impaciente, generico (no usa habilidad exclusiva ni adapta estilo al alcalde).
export function listo(seed, opc = {}) {
  const R = mulberry32(seed * 17 + 3);
  const libres = () => freeWorkers().length;
  const propio = (alc) => !opc.generico && G.alc === alc;

  const puedePagar = (acc, i) => {
    if (!ACTIONS[acc] || !ACTIONS[acc].valid(T(i), i)) return false;
    const plan = planObra(acc, i);
    if (!plan.completo) return false;
    for (const r in plan.coste) if (G.res[r] < plan.coste[r]) return false;
    return true;
  };
  const construir = (acc, i) => {
    if (!puedePagar(acc, i)) return false;
    if (opc.olvido && R() < opc.olvido) return false;
    G.sel = acc; const ok = doAction(i); G.sel = null; return ok;
  };

  const pct = (k) => (G.fc.real.includes(k) ? G.fc.pReal : 0) + (G.fc.decoy.includes(k) ? 100 - G.fc.pReal : 0);
  const ultimo = () => G.turn >= G.maxTurns;
  const hay = (k) => pct(k) > 0 && (opc.impaciente || ultimo() || pct(k) >= (opc.umbral || 70));
  const puede = (k) => propio('meteorologa') ? pct(k) >= 35 : pct(k) > 0;
  const vieneLuego = (k) => propio('meteorologa') && !!G.schedule[G.idx + 1] && G.schedule[G.idx + 1].types.includes(k);

  function proteger() {
    const juntoAgua = (i) => nb4(i).some(j => T(j).t === 'R' || T(j).t === 'M');

    // 0. Meteoróloga: confirma el desastre al 100 % con un sondeo (0 personas) antes de gastar materiales en señuelos.
    if (propio('meteorologa') && !G.sondeoHecho && G.fc.pReal < 86 && G.res.dinero >= (obsOk() ? 12 : 28)) {
      const sede = G.tiles.findIndex(x => x.t === 'O') >= 0 ? G.tiles.findIndex(x => x.t === 'O') : G.tiles.findIndex(x => x.t === 'A');
      if (sede >= 0) construir('sondeo', sede);
    }

    const heat = riskMap();
    const edif = G.tiles.map((x, i) => i).filter(i => BUILD.has(T(i).t)).sort((a, b) => heat[b] - heat[a]);

    // 1. Reparar lo dañado: el tesorero subcontrata cuando falta madera o escasean las manos.
    const prioridad = (i) => (T(i).t === 'C' ? 10 * familias(T(i)) : 5) + heat[i];
    [...edif].sort((a, b) => prioridad(b) - prioridad(a)).forEach(i => {
      if (!T(i).dmg || (opc.sinReparar && T(i).t === 'C')) return;
      if (propio('tesorero') && G.res.dinero >= 35 && (!puedePagar('reparar', i) || G.res.madera < 4 || libres() <= 3)) {
        if (construir('subcontrata', i)) return;
      }
      if (!construir('reparar', i) && propio('tesorero')) construir('subcontrata', i);
    });

    // 1b. Ruinas y solares: terraplén junto al agua; lejos, reparar ruinas o reconstruir solar si espera familia.
    G.tiles.forEach((x, i) => {
      if (x.t !== RUINAS && x.t !== SOLAR) return;
      if (juntoAgua(i) && (opc.terraplenSiempre || !opc.gente)) {
        if (propio('tesorero') && G.res.dinero >= 38 && (!puedePagar('terraplen', i) || G.res.madera < 4 || libres() <= 3)) {
          if (construir('subcontrataTerraplen', i)) return;
        }
        if (x.t === RUINAS && construir('terraplen', i)) return;
        if (x.t === SOLAR && construir('terraplenSolar', i)) return;
        if (propio('tesorero') && construir('subcontrataTerraplen', i)) return;
        if (pasaAgua(i).some(j => BUILD.has(T(j).t)) && (hay('riada') || hay('temporal'))) construir('sacos', i);
      } else if (!opc.sinReparar && x.acogidaEn != null) {
        if (propio('tesorero') && G.res.dinero >= 50 && (G.res.madera < 5 || libres() <= 3)) {
          if (construir('subcontrata', i)) return;
        }
        if (x.t === RUINAS && !construir('repararRuinas', i) && propio('tesorero')) construir('subcontrata', i);
        if (x.t === SOLAR && !construir('reconstruir', i) && propio('tesorero')) construir('subcontrata', i);
      }
    });

    // 2. El refugio.
    if (!opc.sinRefugio && !G.tiles.some(x => x.t === REFUGIO) && G.res.madera >= (G.alc === 'enfermera' ? 3 : 4) && G.res.piedra >= (G.alc === 'enfermera' ? 1 : 2) && libres() >= 2) {
      const prados = G.tiles.map((x, i) => i).filter(i => T(i).t === 'P' && !juntoAgua(i));
      const todos = prados.length ? prados : G.tiles.map((x, i) => i).filter(i => T(i).t === 'P');
      if (todos.length) construir('refugio', todos[Math.floor(R() * todos.length)]);
    }

    // 2b. Observatorio.
    if (!opc.sinObservatorio && G.res.madera >= 4 && G.res.dinero >= (propio('meteorologa') ? 34 : 45) && libres() >= 2) {
      const prados = G.tiles.map((x, i) => i).filter(i => T(i).t === 'P');
      if (prados.length) construir('observatorio', prados[Math.floor(R() * prados.length)]);
    }

    // 2c. Gestión del refugio en el último turno.
    if (!opc.sinEvacuar && (opc.impaciente || ultimo())) {
      const umbral = opc.gente ? 0.06 : 0.12;
      const topeComida = propio('agricultor') ? 5 : 3;
      G.tiles.forEach((x, i) => { if (x.evac && (heat[i] < umbral || costeRefugio(x) > topeComida)) construir('volverCasa', i); });
      edif.filter(i => T(i).t === 'C' && familias(T(i)) > 0 && !T(i).evac && heat[i] >= umbral)
        .sort((a, b) => familias(T(b)) * heat[b] - familias(T(a)) * heat[a])
        .forEach(i => {
          const reserva = propio('agricultor') ? 3 : 6;
          if (G.res.comida < costeEntradaRefugio(T(i)) + reserva || plazasLibres() < familias(T(i))) return;
          // La enfermera reserva los trabajadores si hay heridos en la casa y le sobra caja holgada.
          const hayHerido = G.workers.some(w => w.home === i && w.inj && !w.gone);
          if (propio('enfermera') && hayHerido && G.res.dinero >= 35) {
            if (construir('evacuacionRapida', i)) return;
          }
          construir('evacuar', i);
        });
    }

    const peligrosos = edif.filter(i => heat[i] >= 0.12).slice(0, 8);

    // 3. Proteger según lo que viene (obras permanentes y sacos primero).
    if ((hay('riada') || hay('temporal')) && !opc.sinDiques) {
      peligrosos.forEach(i => { if (G.res.dinero >= (propio('tesorero') ? 5 : 8)) construir('sacos', i); });
    }
    const maxDiques = opc.muros || propio('ingeniera') ? 3 : 2;
    if ((puede('riada') || puede('temporal')) && !opc.sinDiques) {
      for (let k = 0; k < maxDiques; k++) {
        const agua = G.tiles.map((x, i) => i).filter(i => (T(i).t === 'R' || T(i).t === 'M') && !T(i).dique);
        if (!agua.length) break;
        const puntua = (i) => [i - 7, i + 7, i - 1, i + 1].reduce((s, j) => s + (heat[j] || 0), 0);
        const mejor = agua.sort((a, b) => puntua(b) - puntua(a))[0];
        if (puntua(mejor) > (opc.muros ? 0.1 : 0.25) && construir('dique', mejor)) continue;
        break;
      }
    }
    if (puede('incendio') || (vieneLuego('incendio') && libres() >= 2)) {
      const bosques = G.tiles.map((x, i) => i).filter(i => T(i).t === 'B');
      const cerca = (i) => edif.some(e => cheb(e, i) === 1);
      bosques.filter(cerca).slice(0, 2).forEach(i => construir('cortafuegos', i));
    }
    if (puede('tormenta') || (vieneLuego('tormenta') && libres() >= 2 && G.res.madera >= 4)) {
      for (let k = 0; k < 3; k++) {
        const cubierto = (i) => G.tiles.some((u, j) => u.rayo && cheb(i, j) <= 1);
        const sin = edif.filter(i => !cubierto(i));
        if (!sin.length) break;
        const cubre = (i) => sin.filter(j => cheb(i, j) <= 1).length;
        const mejor = edif.filter(i => !T(i).rayo).sort((a, b) => cubre(b) - cubre(a))[0];
        if (!mejor || !construir('pararrayos', mejor)) break;
      }
    }
    if (puede('alud') || (opc.muros && G.NIEVE.length) || (vieneLuego('alud') && libres() >= 3)) {
      const nieve = G.NIEVE.filter(i => !T(i).muro);
      if (nieve.length) construir('muro', nieve[Math.floor(R() * nieve.length)]);
    }

    // 3b. Agricultor: después de cubrir defensas urgentes, refuerza sus granjas (da +comida, +moral y protege de sequía/plaga/fuego).
    if (propio('agricultor') && G.res.piedra >= 2 && G.res.dinero >= 24 && libres() >= 1) {
      G.tiles.forEach((x, i) => { if (x.t === 'G' && !x.dmg && !x.reforzada && G.res.piedra >= 1 && G.res.dinero >= 18) construir('granjaReforzada', i); });
    }

    // 3c. Ingeniera: tras asegurar obras permanentes, blinda con contrafuerte edificios muy expuestos o casas llenas.
    if (propio('ingeniera') && G.res.piedra >= 2 && G.res.madera >= 5 && libres() >= 1) {
      const candidatos = edif.filter(i => !T(i).contra && (heat[i] >= 0.32 || (familias(T(i)) >= 2 && heat[i] >= 0.18)))
        .sort((a, b) => (familias(T(b)) * 0.25 + heat[b]) - (familias(T(a)) * 0.25 + heat[a]));
      if (candidatos.length) construir('contrafuerte', candidatos[0]);
    }

    // 3d. Enfermera: cuando ya no quedan manos libres tras las obras y sobran recursos, evacúa rápido con dinero.
    if (propio('enfermera') && !opc.sinEvacuar && ultimo() && libres() === 0 && plazasLibres() > 0 && G.res.dinero >= 24) {
      edif.filter(i => T(i).t === 'C' && familias(T(i)) > 0 && !T(i).evac && heat[i] >= 0.12)
        .forEach(i => {
          if (G.res.comida >= costeEntradaRefugio(T(i)) + 5 && plazasLibres() >= familias(T(i))) construir('evacuacionRapida', i);
        });
    }
  }

  function producir() {
    const mas = (job, n) => { for (let k = 0; k < n && libres() > 0; k++) changeJob(job, 1); };
    const necesita = Math.ceil(G.res.pop / 6);
    const granjas = G.tiles.some(x => x.t === 'G' && !x.dmg);
    const refG = granjasReforzadasOk();
    if (granjas && G.res.comida < necesita * 2 + 3) mas('granja', refG ? 2 : 3);
    if (G.res.madera < 8 && G.res.riesgo < 40) mas('talar', 1);
    if (G.res.piedra < (propio('ingeniera') ? 6 : 5) && G.res.riesgo < 35) mas('cantera', 1);
    const moralRecaudar = G.alc === 'tesorero' ? 62 : 60;
    const metaDinero = propio('tesorero') ? 68 : (propio('meteorologa') || propio('enfermera') ? 55 : 50);
    if (G.res.dinero < metaDinero && G.res.moral > moralRecaudar) mas('recaudar', 1);
    if (granjas && G.res.comida < 30) mas('granja', refG ? 1 : 2);
    while (libres() > 0) {
      const antes = libres();
      if (granjas && G.res.comida < 40) mas('granja', 1);
      else if (G.res.riesgo < 30) mas('talar', 1);
      else if (G.res.moral > (G.alc === 'tesorero' ? 82 : 80)) mas('recaudar', 1);
      if (libres() === antes) break;
    }
  }

  return {
    preparar() {
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

// ---------- el listo sin usar la habilidad ni el estilo propio del alcalde (referencia genérica) ----------
export const generico = (seed) => listo(seed, {generico: true});

// ---------- el medio: un jugador que se despista ----------
export const medio = (seed) => listo(seed, {olvido: 0.35, sinEvacuar: true, sinRefugio: true, sinObservatorio: true, impaciente: true, generico: true});

// ---------- tres estrategias puras (21-11): ¿hay varios caminos para ganar? ----------
export const muros = (seed) => listo(seed, {sinEvacuar: true, sinRefugio: true, muros: true, generico: true});
export const gente = (seed) => listo(seed, {sinDiques: true, gente: true, generico: true});
export const sacrificio = (seed) => listo(seed, {sinReparar: true, terraplenSiempre: true, sinRefugio: true, sinEvacuar: true, generico: true});

// ---------- bucle de una partida sin pantalla ----------
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

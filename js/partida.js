// Crear una partida y preparar la previsión de cada desastre. Sin pantalla.
import { TOWNS } from '../data/pueblos.js';
import { ALCALDES } from '../data/alcaldes.js';
import { PAIRS } from '../data/desastres.js';
import { OFICIOS_INICIALES } from '../data/gente.js';
import { TEMPORADA, SEMILLA_RETO, PREVISION, desanimados, COMBO_DESDE, COMBO_P, COMBO_P_ULTIMO } from '../data/balance.js';
import { RS, RI, rnd, pick, shuffle, wpick, mulberry32, hashStr, azarLibre, azarConSemilla } from './azar.js';
import { G, setG, town, aytoDown, obsLevel, obsOk, intensity, newWorker, computeGeo, cleanAlloc, freeWorkers } from './estado.js';

// Pueblo y alcalde del reto de una fecha (sin tocar el azar de la partida en curso).
export function retoDelDia(fecha) {
  const f = mulberry32(hashStr(SEMILLA_RETO + fecha));
  return {town: pick(Object.keys(TOWNS), f), alc: pick(ALCALDES, f).id};
}

// opts: {town, alc} para una temporada normal, o {daily: 'AAAA-MM-DD'} para el reto diario.
// Con {semilla} la temporada normal es reproducible (simulaciones y tests); sin ella, al azar.
export function newGame(opts) {
  const daily = opts.daily;
  if (daily) azarConSemilla(SEMILLA_RETO + daily);
  else if (opts.semilla != null) azarConSemilla('sim-' + opts.semilla);
  else azarLibre();
  const townKey = daily ? pick(Object.keys(TOWNS)) : opts.town;
  const alc = daily ? pick(ALCALDES).id : opts.alc;
  setG({
    daily: daily || null, town: townKey, alc,
    phase:'forecast', idx:0, turn:1, maxTurns:3,
    tiles: TOWNS[townKey].map.join('').split('').map(x => ({t:x, dmg:false, dique:false, cheap:false, sacos:false, rayo:false, muro:false, evac:false, ...(x === 'C' ? {propia:true, huespedes:[]} : {})})),
    res:{pop:40, heridos:0, moral:70, dinero:60, madera:4, piedra:3, comida:12, riesgo:10},
    workers:[], nextId:1,
    alloc:{talar:[], cantera:[], granja:[], recaudar:[]}, busy:[], sel:null, msg:'', insp:null, heat:false,
    perks:{voluntarios:0, radar:0, bomba:false, bomberos:false, carpinteros:false, muros:false},
    chosen:[], fc:null, impact:null, result:null, lost:null, event:null,
    dry:false, dryFarm:false, cheapDique:false, lostTurn:0, paperwork:false, desanimados:[], lastAgri:false,
    stats:{cause:{}, saves:{}, builds:{}, hist:[], startPop:40, startMoral:70}, lastEvent:null
  });
  computeGeo();
  if (alc === 'ingeniera') G.res.piedra += 2;
  if (alc === 'agricultor') G.res.comida += 20;
  if (alc === 'tesorero') G.res.dinero += 40;
  OFICIOS_INICIALES.forEach(of => newWorker(of));
  // calendario de desastres (igual para todos en el reto diario)
  const pool = TOWNS[townKey].pool, pairs = PAIRS.filter(p => pool[p[0]] && pool[p[1]]);
  G.schedule = [];
  for (let i = 0; i < TEMPORADA; i++) {
    const comboP = i >= COMBO_DESDE ? (i === TEMPORADA - 1 ? COMBO_P_ULTIMO : COMBO_P) : 0;
    let types;
    if (pairs.length && RS() < comboP) types = pick(pairs).slice();
    else {
      let k, guard = 0;
      do { k = wpick(pool); guard++; } while (guard < 10 && i >= 2 && G.schedule[i-1].types[0] === k && G.schedule[i-2].types[0] === k);
      types = [k];
    }
    G.schedule.push({types, I:intensity(i)});
  }
  // El señuelo y los tres números de la previsión de cada desastre también se sortean al empezar:
  // así lo que construya el jugador nunca cambia el azar del reto diario (T-12 §B.6).
  const tipos = Object.keys(pool);
  G.schedule.forEach(s => {
    let decoy;
    if (s.types.length === 2 && RS() < 0.5) decoy = [pick(s.types)];
    else { let d, guard = 0; do { d = [pick(tipos)]; guard++; } while (guard < 20 && d[0] === s.types[0] && s.types.length === 1); decoy = d; }
    s.decoy = decoy; s.u = [RS(), RS(), RS()];
  });
  newForecast();
}

// El % del desastre real en el turno actual: con los rangos del nivel de precisión de ahora y de ese
// turno (los turnos perdidos son los primeros). Nunca baja respecto al turno anterior.
export function afinarPrevision() {
  const f = G.fc, tr = Math.min(3, G.turn + (3 - G.maxTurns)), lvl = obsLevel();
  const [lo, hi] = PREVISION[lvl][tr - 1];
  const v = Math.round(lo + f.u[tr - 1] * (hi - lo));
  f.pReal = Math.max(f.pReal || 0, v); f.lvl = lvl; f.tramo = tr;
  f.fuentes = {obs: obsOk(), radar: G.perks.radar > 0, alc: G.alc === 'meteorologa'};
  f.hist.push(f.pReal);
}

// La previsión del próximo desastre: el real y un señuelo, con la probabilidad que da el observatorio.
export function newForecast() {
  const s = G.schedule[G.idx];
  G.maxTurns = Math.max(1, (aytoDown() ? 2 : 3) - G.lostTurn); G.lostTurn = 0;
  G.fc = {real:s.types, decoy:s.decoy, u:s.u, pReal:0, hist:[], I:s.I, lvl:obsLevel()};
  G.turn = 1;
  afinarPrevision(); G.busy = []; G.sel = null; G.msg = ''; G.lastAgri = false;
  // la moral baja quita brazos (con el azar de los impactos, para no tocar el del calendario)
  const nDes = desanimados(G.res.moral);
  G.desanimados = nDes ? shuffle(G.workers.filter(w => !w.gone && !w.inj), RI).slice(0, nDes).map(w => w.id) : [];
  cleanAlloc();
  if (G.paperwork) { const f = freeWorkers(); if (f.length) G.busy.push(pick(f, RI).id); G.paperworkId = G.busy[0]; G.paperwork = false; } else G.paperworkId = null;
}

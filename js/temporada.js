// Lo que pasa entre desastres (resultado, mejora, evento) y al acabar la temporada. Sin pantalla.
import { TOWNS } from '../data/pueblos.js';
import { ALCALDES } from '../data/alcaldes.js';
import { TEMPORADA, VECINOS_MINIMOS, MEDALLAS, MEDALLA_PLATA, MEDALLA_ORO } from '../data/balance.js';
import { RUINAS, SOLAR } from './casas.js';
import { RS, pick, shuffle } from './azar.js';
import { G, townName, aliveWorkers } from './estado.js';
import { newForecast } from './partida.js';
import { PERKS, EVENTS } from './mejoras.js';
import { PROG, saveProg, cumple } from './progreso.js';
import { borrarPartidaGuardada } from './guardado.js';
import { submitDaily } from './ranking.js';
import { t } from './i18n.js';

// Tras el impacto: comprueba si el pueblo ha caído y ofrece 3 mejoras.
export function toResult() {
  const r = G.res;
  if (r.pop < VECINOS_MINIMOS) G.lost = t('fin.vacio', {pueblo: townName()});
  else if (r.moral <= 0) G.lost = t('fin.moral');
  else if (!aliveWorkers().length) G.lost = t('fin.nadie');
  G.stats.hist.push({n:G.idx + 1, types:G.fc.real.slice(), pop:r.pop, moral:r.moral, dmg:G.lastDmg});
  G.result = {offers: shuffle(PERKS.filter(p => p.ok())).slice(0, 3)};
  G.phase = 'result';
}

// Elige una mejora y pasa al evento (si toca), a la siguiente previsión o al final.
export function choosePerk(id) {
  const p = PERKS.find(x => x.id === id); G.msg = ''; p.apply(); G.chosen.push(t('mejoras.' + p.id + '.nombre'));
  G.idx++;
  if (G.idx >= TEMPORADA) return finish();
  const cands = EVENTS.filter(e => e.id !== G.lastEvent && e.cond());
  if (RS() < 0.7 && cands.length) {
    const e = pick(cands); G.lastEvent = e.id;
    const ctx = {id: e.id}; G.eventCtx = ctx;
    G.event = e.mk(ctx); G.phase = 'event'; return;
  }
  newForecast(); G.phase = 'forecast';
}

export function chooseEvent(k) {
  const o = G.event.opts.filter(x => !x.ok || x.ok())[k]; o.a();
  G.event = null; G.eventCtx = null; newForecast(); G.phase = 'forecast';
}

export function score() {
  return (G.lost ? G.idx : TEMPORADA) * 100 + Math.max(0, G.res.pop) * 10 + G.res.moral * 3 + aliveWorkers().length * 20 + (G.lost ? 0 : 500);
}

// La medalla de la temporada: null si se ha perdido.
export function medalla() {
  if (G.lost) return null;
  const r = G.res, plata = r.pop >= MEDALLA_PLATA.vecinos && r.moral >= MEDALLA_PLATA.moral;
  const oro = plata && r.pop >= MEDALLA_ORO.vecinos && r.moral >= MEDALLA_ORO.moral && !G.tiles.some(x => x.t === RUINAS || x.t === SOLAR);
  return oro ? 'oro' : (plata ? 'plata' : 'bronce');
}

// Cierra la temporada: puntúa, apunta el progreso y mira qué se ha desbloqueado.
export function finish() {
  G.phase = 'end'; G.final = score();
  borrarPartidaGuardada();
  const before = JSON.parse(JSON.stringify(PROG));
  const reached = G.lost ? G.idx : TEMPORADA - 1;
  PROG.total += G.lost ? G.idx : TEMPORADA;
  PROG.seasons += 1;
  PROG.maxIdx[G.town] = Math.max(PROG.maxIdx[G.town] || 0, reached);
  if (!G.lost) PROG.wins[G.town] = (PROG.wins[G.town] || 0) + 1;
  G.medalla = medalla();
  G.medallaNueva = !!G.medalla && MEDALLAS.indexOf(G.medalla) > MEDALLAS.indexOf((PROG.medallas || {})[G.town]);
  if (G.medallaNueva) PROG.medallas = {...(PROG.medallas || {}), [G.town]: G.medalla};
  G.record = G.final > (PROG.best || 0); PROG.best = Math.max(PROG.best || 0, G.final);
  G.unlocked = [];
  Object.keys(TOWNS).forEach(k => { const u = TOWNS[k].unlock; if (u && !cumple(u, before) && cumple(u, PROG)) G.unlocked.push(t('fin.desbloqueoPueblo', {nombre: t('pueblos.' + k + '.nombre')})); });
  ALCALDES.forEach(a => { const u = a.unlock; if (u && !cumple(u, before) && cumple(u, PROG)) G.unlocked.push(t('fin.desbloqueoAlcalde', {titulo: t('alcaldes.' + a.id + '.titulo'), nombre: t('alcaldes.' + a.id + '.nombre')})); });
  saveProg();
  if (G.daily) submitDaily(G.final);
}

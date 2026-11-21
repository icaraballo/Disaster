// Producción y paso de turnos de la preparación. Sin pantalla.
import { clamp } from './util.js';
import { G, W, granjasOk, freeWorkers, cleanAlloc } from './estado.js';
import { rankJob } from './acciones.js';
import { startImpact } from './desastres.js';
import { afinarPrevision } from './partida.js';
import { t } from './i18n.js';

// Lo que producirá este turno el reparto actual.
export function production() {
  const r = {madera:0, piedra:0, comida:0, dinero:0, moral:0, riesgo:0};
  G.alloc.talar.forEach(id => { const w = W(id); r.madera += 2 + (w.of==='lenador'?2:0) + (G.perks.carpinteros?1:0); r.riesgo += 4; });
  G.alloc.cantera.forEach(id => { const w = W(id); r.piedra += 1 + (w.of==='cantero'?1:0); r.riesgo += w.of==='cantero'?3:6; });
  const g = granjasOk(), base = g >= 2 ? 2 : g;
  G.alloc.granja.forEach(id => { const w = W(id); let v = base > 0 ? base + (w.of==='agricultor'?2:0) + (G.alc==='agricultor'?2:0) : 0; if (G.dryFarm) v = Math.floor(v/2); r.comida += v; });
  G.alloc.recaudar.forEach(id => { const w = W(id); r.dinero += 15 + (w.of==='comerciante'?10:0) + (G.alc==='tesorero'?5:0); r.moral -= (G.alc==='tesorero' || w.of==='comerciante') ? 1 : 2; });
  return r;
}

// Añade (d > 0) o quita (d < 0) a una persona de un trabajo, eligiendo a la más adecuada.
export function changeJob(job, d) {
  if (d > 0) {
    const f = freeWorkers().sort((x, y) => rankJob(x, job) - rankJob(y, job));
    if (f.length) G.alloc[job].push(f[0].id);
  } else if (G.alloc[job].length) {
    const ids = G.alloc[job].slice().sort((a, b) => rankJob(W(b), job) - rankJob(W(a), job));
    G.alloc[job] = G.alloc[job].filter(id => id !== ids[0]);
  }
}

// Termina el turno: cobra la producción. Tras el último turno llega el desastre.
export function endTurn() {
  const p = production(), r = G.res;
  r.madera += p.madera; r.piedra += p.piedra; r.comida += p.comida; r.dinero += p.dinero;
  r.moral = clamp(r.moral + p.moral, 0, 100); r.riesgo = clamp(r.riesgo + p.riesgo, 0, 95);
  if (G.alloc.granja.some(id => W(id).of === 'agricultor')) G.lastAgri = true;
  const got = [];
  if (p.madera) got.push(t('msg.produccion.madera', {n: p.madera})); if (p.piedra) got.push(t('msg.produccion.piedra', {n: p.piedra}));
  if (p.comida) got.push(t('msg.produccion.comida', {n: p.comida})); if (p.dinero) got.push(t('msg.produccion.dinero', {n: p.dinero}));
  G.msg = got.length ? t('msg.produccion.total', {lista: got.join(', ')}) : '';
  G.busy = []; G.sel = null; G.turn++;
  cleanAlloc();
  if (G.turn > G.maxTurns) startImpact(); else afinarPrevision();
}

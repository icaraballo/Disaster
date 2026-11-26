// Acciones de construcción: coste, dónde valen y qué hacen. Se elige la acción y se toca una casilla.
import { BUILD } from '../data/casillas.js';
import { OFICIOS } from '../data/gente.js';
import { INGENIERA_REPARAR_EXTRA, INGENIERA_RUINAS_EXTRA, CONTRAFUERTE_COSTE,
  ENFERMERA_MURO_EXTRA, ENFERMERA_RAYO_EXTRA, ENFERMERA_REFUGIO_COSTE, EVAC_RAPIDA_DINERO,
  GRANJA_REFORZADA_COSTE, METEOROLOGA_OBRA_EXTRA, SONDEO_DINERO, SONDEO_DINERO_OBS,
  TESORERO_SACOS_DINERO, TESORERO_RAYO_DINERO, SUBCONTRATA_COSTE } from '../data/balance.js';
import { clamp, nb4 } from './util.js';
import { G, T, hasType, obsOk, freeWorkers } from './estado.js';
import { RUINAS, SOLAR, REFUGIO, familias, repararRuinas, reconstruir, terraplen, plazasLibres, costeEntradaRefugio, evacuarCasa, volverACasa } from './casas.js';
import { t } from './i18n.js';

export const RECURSOS = ['dinero', 'madera', 'piedra', 'comida'];

// Coste mínimo de entrada al refugio entre las casas evacuables actuales (para la tarjeta general sin casilla).
function minCosteEvacuar() {
  const cs = G.tiles.filter(x => x.t === 'C' && familias(x) > 0 && !x.evac && plazasLibres() >= familias(x)).map(costeEntradaRefugio);
  return cs.length ? Math.min(...cs) : costeEntradaRefugio(null);
}

// Coste en dinero de la subcontrata del tesorero según el estado de la casilla (o el menor disponible en el mapa).
function costeSubcontrata(x) {
  if (x) {
    if (x.dmg) return SUBCONTRATA_COSTE.reparar;
    if (x.t === RUINAS) return SUBCONTRATA_COSTE.ruinas;
    if (x.t === SOLAR) return SUBCONTRATA_COSTE.solar;
  }
  if (G.tiles.some(u => u.dmg)) return SUBCONTRATA_COSTE.reparar;
  if (G.tiles.some(u => u.t === RUINAS)) return SUBCONTRATA_COSTE.ruinas;
  if (G.tiles.some(u => u.t === SOLAR)) return SUBCONTRATA_COSTE.solar;
  return SUBCONTRATA_COSTE.reparar;
}

const extraMuroPiedra = () => (G.alc === 'enfermera' ? ENFERMERA_MURO_EXTRA : 0) + (G.alc === 'meteorologa' ? METEOROLOGA_OBRA_EXTRA : 0) - (G.alc === 'ingeniera' ? 1 : 0);

// cuad = personas que hacen falta; cost(casilla) = materiales; valid(casilla, i) = dónde se puede; apply(casilla, i) = efecto.
export const ACTIONS = {
  dique:{cuad:1, cost:()=>({piedra: G.cheapDique ? 1 : Math.max(1, 3 + extraMuroPiedra() - (G.perks.muros ? 1 : 0))}), valid:(x)=>(x.t==='R'||x.t==='M') && !x.dique,
    apply:(x)=>{ x.dique=true; x.cheap=G.cheapDique; }},
  sacos:{cuad:1, cost:()=>({dinero: G.alc === 'tesorero' ? TESORERO_SACOS_DINERO : 8}), valid:(x)=>(BUILD.has(x.t) || x.t===RUINAS || x.t===SOLAR) && !x.sacos,
    apply:(x)=>{ x.sacos=true; }},
  cortafuegos:{cuad:1, cost:()=>({}), valid:(x)=>x.t==='B',
    apply:(x)=>{ x.t='X'; G.res.madera+=2; G.res.riesgo=clamp(G.res.riesgo+5,0,95); }},
  pararrayos:{cuad:1, cost:()=>({madera:2, dinero: G.alc === 'tesorero' ? TESORERO_RAYO_DINERO : (15 + (G.alc === 'enfermera' ? ENFERMERA_RAYO_EXTRA : 0))}), valid:(x)=>BUILD.has(x.t) && !x.rayo,
    apply:(x)=>{ x.rayo=true; }},
  muro:{cuad:2, cost:()=>({piedra: Math.max(0, 2 + extraMuroPiedra()), madera:2}), valid:(x)=>(x.t==='L'||x.t==='S') && !x.muro,
    apply:(x)=>{ x.muro=true; if (x.t==='L') G.res.riesgo=clamp(G.res.riesgo-15,0,95); }},
  // evacuar (DB-01): 1 comida por familia al entrar (mitad con agricultor); se queda hasta que vuelva
  evacuar:{cuad:1, cost:(x)=>({comida: x ? costeEntradaRefugio(x) : minCosteEvacuar()}), valid:(x)=>x.t==='C' && familias(x) > 0 && !x.evac && plazasLibres() >= familias(x), casa:true,
    apply:(x, i)=>evacuarCasa(i)},
  volverCasa:{cuad:0, cost:()=>({}), valid:(x)=>x.t==='C' && !!x.evac, casa:true,
    apply:(x, i)=>volverACasa(i)},
  refugio:{cuad:2, cost:()=>(G.alc === 'enfermera' ? {...ENFERMERA_REFUGIO_COSTE} : {madera: 4 + (G.alc === 'meteorologa' ? METEOROLOGA_OBRA_EXTRA : 0), piedra:2}), valid:(x)=>x.t==='P' && !hasType(REFUGIO),
    apply:(x)=>{ x.t=REFUGIO; }},
  reparar:{cuad:1, cost:()=>({madera: 2 + (G.alc === 'ingeniera' ? INGENIERA_REPARAR_EXTRA : 0)}), valid:(x)=>x.dmg,
    apply:(x)=>{ x.dmg=false; }},
  // T-12: la escalera de la casa.
  repararRuinas:{cuad:2, cost:()=>({madera: 4 + (G.alc === 'ingeniera' ? INGENIERA_RUINAS_EXTRA : 0)}), valid:(x)=>x.t===RUINAS, casa:true,
    apply:(x, i)=>repararRuinas(i)},
  reconstruir:{cuad:2, cost:()=>({madera:4, piedra:2}), valid:(x)=>x.t===SOLAR, casa:true,
    apply:(x, i)=>reconstruir(i)},
  terraplen:{cuad:2, cost:()=>({madera:2}), valid:(x, i)=>x.t===RUINAS && junto_agua(i), casa:true,
    apply:(x, i)=>terraplen(i)},
  terraplenSolar:{cuad:2, cost:()=>({piedra:2, madera:2}), valid:(x, i)=>x.t===SOLAR && junto_agua(i), casa:true,
    apply:(x, i)=>terraplen(i)},
  observatorio:{cuad:2, cost:()=>({madera:4, dinero:30}), valid:(x)=>x.t==='P' && !hasType('O'),
    apply:(x)=>{ x.t='O'; }},
  aljibe:{cuad:2, cost:()=>({piedra:3, madera:2}), valid:(x)=>x.t==='P' && !hasType('W'),
    apply:(x)=>{ x.t='W'; }},
  // Acciones y obras exclusivas de cada alcalde:
  contrafuerte:{cuad:1, alc:'ingeniera', cost:()=>({...CONTRAFUERTE_COSTE}), valid:(x)=>G.alc==='ingeniera' && BUILD.has(x.t) && !x.contra,
    apply:(x)=>{ x.contra=true; }},
  evacuacionRapida:{cuad:0, alc:'enfermera', casa:true, cost:(x)=>({comida: x ? costeEntradaRefugio(x) : minCosteEvacuar(), dinero: EVAC_RAPIDA_DINERO}),
    valid:(x)=>G.alc==='enfermera' && x.t==='C' && familias(x) > 0 && !x.evac && plazasLibres() >= familias(x),
    apply:(x, i)=>{ evacuarCasa(i); G.workers.forEach(w => { if (w.home === i && !w.gone) w.inj = 0; }); }},
  granjaReforzada:{cuad:1, alc:'agricultor', cost:()=>({...GRANJA_REFORZADA_COSTE}), valid:(x)=>G.alc==='agricultor' && x.t==='G' && !x.dmg && !x.reforzada,
    apply:(x)=>{ x.reforzada=true; }},
  sondeo:{cuad:0, alc:'meteorologa', cost:()=>({dinero: obsOk() ? SONDEO_DINERO_OBS : SONDEO_DINERO}),
    valid:(x)=>G.alc==='meteorologa' && (x.t==='O' || x.t==='A') && !G.sondeoHecho && !!G.fc && G.fc.pReal < 100,
    apply:()=>{ G.sondeoHecho=true; G.fc.pReal=100; if (G.fc.hist.length) G.fc.hist[G.fc.hist.length - 1] = 100; }},
  subcontrata:{cuad:0, alc:'tesorero', casa:true, cost:(x)=>({dinero: costeSubcontrata(x)}),
    valid:(x)=>G.alc==='tesorero' && (x.dmg || x.t===RUINAS || x.t===SOLAR),
    apply:(x, i)=>{ if (x.dmg) x.dmg=false; else if (x.t===RUINAS) repararRuinas(i); else if (x.t===SOLAR) reconstruir(i); }},
  subcontrataTerraplen:{cuad:0, alc:'tesorero', casa:true, cost:()=>({dinero: SUBCONTRATA_COSTE.terraplen}),
    valid:(x, i)=>G.alc==='tesorero' && (x.t===RUINAS || x.t===SOLAR) && junto_agua(i),
    apply:(x, i)=>terraplen(i)}
};

// El terraplén sólo se puede hacer junto al río o al mar.
function junto_agua(i) { return i != null && nb4(i).some(j => T(j).t === 'R' || T(j).t === 'M'); }

// Nombre corto de lo que se construye en una casilla (el dique en el mar es una escollera).
export const construccion = (k, casilla) => k === 'dique' && casilla && casilla.t === 'M' ? 'escollera' : (k === 'terraplenSolar' ? 'terraplen' : k);
export const nombreConstruccion = (id) => t('construcciones.' + id);

export function costLabel(a, x) {
  const c = a.cost(x);
  const parts = Object.keys(c).filter(k => c[k] > 0).map(k => c[k] + ' ' + t('recursos.' + k));
  if (a.cuad) parts.push(a.cuad > 1 ? t('ui.variasPersonas', {n: a.cuad}) : t('ui.unaPersona', {n: a.cuad}));
  return parts.length ? parts.join(' · ') : t('ui.gratis');
}

const rankBuild = (w) => w.of === 'albanil' ? 0 : (['peon','bombero','medico'].includes(w.of) ? 1 : 2);
const rankSondeo = (w) => ['peon','bombero','medico'].includes(w.of) ? 0 : (w.of === 'albanil' ? 2 : 1);
export function rankJob(w, job) {
  if (OFICIOS[w.of].job === job) return 0;
  if (['peon','bombero','medico'].includes(w.of)) return 1;
  if (w.of === 'albanil') return 2;
  return 3;
}

// Quién construye una obra y cuánto cuesta de verdad, sin tocar la partida (sin DOM y sin modificar G).
// Si se pasa `i`, evalúa el coste exacto sobre esa casilla (p. ej. evacuar una casa con 2 familias o subcontrata).
export function planObra(clave, i) {
  const a = ACTIONS[clave];
  const rFn = clave === 'sondeo' ? rankSondeo : rankBuild;
  const fw = freeWorkers().sort((p, q) => rFn(p) - rFn(q));
  const equipo = fw.slice(0, a.cuad);
  const coste = {...a.cost(i != null ? T(i) : null, i)};
  let albanil = null, material = null;
  const alb = equipo.find(w => w.of === 'albanil');
  if (alb) {
    const mats = ['piedra','madera'].filter(k => (coste[k] || 0) > 0).sort((p, q) => coste[q] - coste[p]);
    if (mats.length) { coste[mats[0]]--; albanil = alb; material = mats[0]; }
  }
  return {equipo, coste, albanil, material, completo: equipo.length >= a.cuad};
}

// Texto del coste con el descuento ya aplicado (el mismo cálculo que la obra real).
export function costLabelObra(clave, i) {
  const a = ACTIONS[clave];
  const c = planObra(clave, i).coste;
  const parts = Object.keys(c).filter(k => c[k] > 0).map(k => c[k] + ' ' + t('recursos.' + k));
  if (a.cuad) parts.push(a.cuad > 1 ? t('ui.variasPersonas', {n: a.cuad}) : t('ui.unaPersona', {n: a.cuad}));
  return parts.length ? parts.join(' · ') : t('ui.gratis');
}

// Construye la acción elegida (G.sel) en la casilla i. Deja en G.msg lo que ha pasado.
// Devuelve true si se ha construido.
export function doAction(i) {
  const a = ACTIONS[G.sel]; const x = T(i);
  if (!a || !a.valid(x, i)) return false;
  const plan = planObra(G.sel, i);
  if (!plan.completo) { G.msg = t('msg.sinGente'); return false; }
  const crew = plan.equipo, c = plan.coste;
  const note = plan.albanil ? ' ' + t('msg.albanil', {nombre: plan.albanil.name, material: t('recursos.' + plan.material)}) : '';
  for (const k in c) if (G.res[k] < c[k]) { G.msg = t('msg.falta', {recurso: t('recursos.' + k), n: c[k]}); return false; }
  for (const k in c) G.res[k] -= c[k];
  crew.forEach(w => G.busy.push(w.id));
  const id = construccion(G.sel, x);
  a.apply(x, i);
  G.stats.builds[id] = (G.stats.builds[id] || 0) + 1;
  if (G.sel === 'sondeo') {
    const lista = G.fc.real.map(k => t('desastres.' + k + '.nombre')).join(' + ');
    G.msg = t('msg.sondeoHecho', {desastre: lista});
  } else {
    G.msg = crew.length ? t('msg.hecho', {obra: nombreConstruccion(id), quien: crew.map(w => w.name).join(t('ui.y'))}) + note : t('msg.hechoSolo', {obra: nombreConstruccion(id)});
  }
  if (freeWorkers().length < 1 && a.cuad > 0) G.sel = null;
  return true;
}

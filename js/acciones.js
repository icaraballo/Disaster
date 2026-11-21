// Acciones de construcción: coste, dónde valen y qué hacen. Se elige la acción y se toca una casilla.
import { BUILD } from '../data/casillas.js';
import { OFICIOS } from '../data/gente.js';
import { clamp } from './util.js';
import { G, T, hasType, freeWorkers } from './estado.js';
import { nb4 } from './util.js';
import { RUINAS, SOLAR, REFUGIO, familias, repararRuinas, reconstruir, terraplen, refugioOk, plazasLibres, evacuarCasa, volverACasa } from './casas.js';
import { t } from './i18n.js';

export const RECURSOS = ['dinero', 'madera', 'piedra', 'comida'];

// cuad = personas que hacen falta; cost() = materiales; valid(casilla) = dónde se puede; apply(casilla) = efecto.
export const ACTIONS = {
  dique:{cuad:1, cost:()=>({piedra: G.cheapDique ? 1 : Math.max(1, 3 - (G.alc==='ingeniera'?1:0) - (G.perks.muros?1:0))}), valid:(x)=>(x.t==='R'||x.t==='M') && !x.dique,
    apply:(x)=>{ x.dique=true; x.cheap=G.cheapDique; }},
  sacos:{cuad:1, cost:()=>({dinero:8}), valid:(x)=>(BUILD.has(x.t) || x.t===RUINAS || x.t===SOLAR) && !x.sacos,
    apply:(x)=>{ x.sacos=true; }},
  cortafuegos:{cuad:1, cost:()=>({}), valid:(x)=>x.t==='B',
    apply:(x)=>{ x.t='X'; G.res.madera+=2; G.res.riesgo=clamp(G.res.riesgo+5,0,95); }},
  pararrayos:{cuad:1, cost:()=>({madera:2, dinero:15}), valid:(x)=>BUILD.has(x.t) && !x.rayo,
    apply:(x)=>{ x.rayo=true; }},
  muro:{cuad:2, cost:()=>({piedra:Math.max(0,2-(G.alc==='ingeniera'?1:0)), madera:2}), valid:(x)=>(x.t==='L'||x.t==='S') && !x.muro,
    apply:(x)=>{ x.muro=true; if (x.t==='L') G.res.riesgo=clamp(G.res.riesgo-15,0,95); }},
  // evacuar: la familia va al refugio y se queda hasta que vuelva; el primer desastre se paga al entrar
  evacuar:{cuad:1, cost:()=>({comida:1}), valid:(x)=>x.t==='C' && familias(x) > 0 && !x.evac && plazasLibres() >= familias(x), casa:true,
    apply:(x, i)=>evacuarCasa(i)},
  volverCasa:{cuad:0, cost:()=>({}), valid:(x)=>x.t==='C' && !!x.evac, casa:true,
    apply:(x, i)=>volverACasa(i)},
  refugio:{cuad:2, cost:()=>({madera:4, piedra:2}), valid:(x)=>x.t==='P' && !hasType(REFUGIO),
    apply:(x)=>{ x.t=REFUGIO; }},
  reparar:{cuad:1, cost:()=>({madera:2}), valid:(x)=>x.dmg,
    apply:(x)=>{ x.dmg=false; }},
  // T-12: la escalera de la casa. Cada estado es una acción con su coste fijo, para que la tarjeta y la
  // ficha enseñen siempre lo mismo que se cobra (planObra no necesita conocer la casilla).
  repararRuinas:{cuad:2, cost:()=>({madera:4}), valid:(x)=>x.t===RUINAS, casa:true,
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
    apply:(x)=>{ x.t='W'; }}
};

// El terraplén sólo se puede hacer junto al río o al mar.
function junto_agua(i) { return i != null && nb4(i).some(j => T(j).t === 'R' || T(j).t === 'M'); }

// Nombre corto de lo que se construye en una casilla (el dique en el mar es una escollera).
export const construccion = (k, casilla) => k === 'dique' && casilla && casilla.t === 'M' ? 'escollera' : (k === 'terraplenSolar' ? 'terraplen' : k);
export const nombreConstruccion = (id) => t('construcciones.' + id);

export function costLabel(a) {
  const c = a.cost();
  const parts = Object.keys(c).filter(k => c[k] > 0).map(k => c[k] + ' ' + t('recursos.' + k));
  if (a.cuad) parts.push(a.cuad > 1 ? t('ui.variasPersonas', {n: a.cuad}) : t('ui.unaPersona', {n: a.cuad}));
  return parts.length ? parts.join(' · ') : t('ui.gratis');
}

const rankBuild = (w) => w.of === 'albanil' ? 0 : (['peon','bombero','medico'].includes(w.of) ? 1 : 2);
export function rankJob(w, job) {
  if (OFICIOS[w.of].job === job) return 0;
  if (['peon','bombero','medico'].includes(w.of)) return 1;
  if (w.of === 'albanil') return 2;
  return 3;
}

// Quién construye una obra y cuánto cuesta de verdad, sin tocar la partida (sin DOM y sin modificar G).
// equipo: las `cuad` personas libres más adecuadas; coste: materiales con el descuento del albañil ya aplicado;
// albanil y material: quién ahorra y de qué, o null si no hay descuento; completo: hay gente libre suficiente.
// La vista y doAction usan esta misma función: lo que se enseña antes de construir es lo que se cobra después.
export function planObra(clave) {
  const a = ACTIONS[clave];
  const fw = freeWorkers().sort((p, q) => rankBuild(p) - rankBuild(q));
  const equipo = fw.slice(0, a.cuad);
  const coste = a.cost();
  let albanil = null, material = null;
  const alb = equipo.find(w => w.of === 'albanil');
  if (alb) {
    const mats = ['piedra','madera'].filter(k => (coste[k] || 0) > 0).sort((p, q) => coste[q] - coste[p]);
    if (mats.length) { coste[mats[0]]--; albanil = alb; material = mats[0]; }
  }
  return {equipo, coste, albanil, material, completo: equipo.length >= a.cuad};
}

// Texto del coste con el descuento ya aplicado (el mismo cálculo que la obra real).
export function costLabelObra(clave) {
  const a = ACTIONS[clave];
  const c = planObra(clave).coste;
  const parts = Object.keys(c).filter(k => c[k] > 0).map(k => c[k] + ' ' + t('recursos.' + k));
  if (a.cuad) parts.push(a.cuad > 1 ? t('ui.variasPersonas', {n: a.cuad}) : t('ui.unaPersona', {n: a.cuad}));
  return parts.length ? parts.join(' · ') : t('ui.gratis');
}

// Construye la acción elegida (G.sel) en la casilla i. Deja en G.msg lo que ha pasado.
// Devuelve true si se ha construido.
export function doAction(i) {
  const a = ACTIONS[G.sel]; const x = T(i);
  if (!a || !a.valid(x, i)) return false;
  const plan = planObra(G.sel);
  if (!plan.completo) { G.msg = t('msg.sinGente'); return false; }
  const crew = plan.equipo, c = plan.coste;
  const note = plan.albanil ? ' ' + t('msg.albanil', {nombre: plan.albanil.name, material: t('recursos.' + plan.material)}) : '';
  for (const k in c) if (G.res[k] < c[k]) { G.msg = t('msg.falta', {recurso: t('recursos.' + k), n: c[k]}); return false; }
  for (const k in c) G.res[k] -= c[k];
  crew.forEach(w => G.busy.push(w.id));
  const id = construccion(G.sel, x);
  a.apply(x, i);
  G.stats.builds[id] = (G.stats.builds[id] || 0) + 1;
  G.msg = crew.length ? t('msg.hecho', {obra: nombreConstruccion(id), quien: crew.map(w => w.name).join(t('ui.y'))}) + note : t('msg.hechoSolo', {obra: nombreConstruccion(id)});
  if (freeWorkers().length < 1) G.sel = null;
  return true;
}

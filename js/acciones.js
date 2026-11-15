// Acciones de construcción: coste, dónde valen y qué hacen. Se elige la acción y se toca una casilla.
import { BUILD } from '../data/casillas.js';
import { OFICIOS } from '../data/gente.js';
import { clamp } from './util.js';
import { G, T, hasType, freeWorkers } from './estado.js';
import { t } from './i18n.js';

export const RECURSOS = ['dinero', 'madera', 'piedra', 'comida'];

// cuad = personas que hacen falta; cost() = materiales; valid(casilla) = dónde se puede; apply(casilla) = efecto.
export const ACTIONS = {
  dique:{cuad:1, cost:()=>({piedra: G.cheapDique ? 1 : Math.max(1, 3 - (G.alc==='ingeniera'?1:0) - (G.perks.muros?1:0))}), valid:(x)=>(x.t==='R'||x.t==='M') && !x.dique,
    apply:(x)=>{ x.dique=true; x.cheap=G.cheapDique; }},
  sacos:{cuad:1, cost:()=>({dinero:8}), valid:(x)=>BUILD.has(x.t) && !x.sacos,
    apply:(x)=>{ x.sacos=true; }},
  cortafuegos:{cuad:1, cost:()=>({}), valid:(x)=>x.t==='B',
    apply:(x)=>{ x.t='X'; G.res.madera+=2; G.res.riesgo=clamp(G.res.riesgo+5,0,95); }},
  pararrayos:{cuad:1, cost:()=>({madera:2, dinero:15}), valid:(x)=>BUILD.has(x.t) && !x.rayo,
    apply:(x)=>{ x.rayo=true; }},
  muro:{cuad:2, cost:()=>({piedra:Math.max(0,2-(G.alc==='ingeniera'?1:0)), madera:2}), valid:(x)=>(x.t==='L'||x.t==='S') && !x.muro,
    apply:(x)=>{ x.muro=true; if (x.t==='L') G.res.riesgo=clamp(G.res.riesgo-15,0,95); }},
  evacuar:{cuad:1, cost:()=>({comida:2}), valid:(x)=>x.t==='C' && !x.evac,
    apply:(x)=>{ x.evac=true; }},
  reparar:{cuad:1, cost:()=>({madera:2}), valid:(x)=>x.dmg,
    apply:(x)=>{ x.dmg=false; }},
  observatorio:{cuad:2, cost:()=>({madera:4, dinero:30}), valid:(x)=>x.t==='P' && !hasType('O'),
    apply:(x)=>{ x.t='O'; }},
  aljibe:{cuad:2, cost:()=>({piedra:3, madera:2}), valid:(x)=>x.t==='P' && !hasType('W'),
    apply:(x)=>{ x.t='W'; }}
};

// Nombre corto de lo que se construye en una casilla (el dique en el mar es una escollera).
export const construccion = (k, casilla) => k === 'dique' && casilla && casilla.t === 'M' ? 'escollera' : k;
export const nombreConstruccion = (id) => t('construcciones.' + id);

export function costLabel(a) {
  const c = a.cost();
  const parts = Object.keys(c).filter(k => c[k] > 0).map(k => c[k] + ' ' + t('recursos.' + k));
  parts.push(a.cuad > 1 ? t('ui.variasPersonas', {n: a.cuad}) : t('ui.unaPersona', {n: a.cuad}));
  return parts.join(' · ');
}

const rankBuild = (w) => w.of === 'albanil' ? 0 : (['peon','bombero','medico'].includes(w.of) ? 1 : 2);
export function rankJob(w, job) {
  if (OFICIOS[w.of].job === job) return 0;
  if (['peon','bombero','medico'].includes(w.of)) return 1;
  if (w.of === 'albanil') return 2;
  return 3;
}

// Construye la acción elegida (G.sel) en la casilla i. Deja en G.msg lo que ha pasado.
// Devuelve true si se ha construido.
export function doAction(i) {
  const a = ACTIONS[G.sel]; const x = T(i);
  if (!a || !a.valid(x, i)) return false;
  const fw = freeWorkers().sort((p, q) => rankBuild(p) - rankBuild(q));
  if (fw.length < a.cuad) { G.msg = t('msg.sinGente'); return false; }
  const crew = fw.slice(0, a.cuad);
  const c = a.cost();
  let note = '';
  const alb = crew.find(w => w.of === 'albanil');
  if (alb) {
    const mats = ['piedra','madera'].filter(k => (c[k] || 0) > 0).sort((p, q) => c[q] - c[p]);
    if (mats.length) { c[mats[0]]--; note = ' ' + t('msg.albanil', {nombre: alb.name, material: t('recursos.' + mats[0])}); }
  }
  for (const k in c) if (G.res[k] < c[k]) { G.msg = t('msg.falta', {recurso: t('recursos.' + k), n: c[k]}); return false; }
  for (const k in c) G.res[k] -= c[k];
  crew.forEach(w => G.busy.push(w.id));
  const id = construccion(G.sel, x);
  a.apply(x, i);
  G.stats.builds[id] = (G.stats.builds[id] || 0) + 1;
  G.msg = t('msg.hecho', {obra: nombreConstruccion(id), quien: crew.map(w => w.name).join(t('ui.y'))}) + note;
  if (freeWorkers().length < 1) G.sel = null;
  return true;
}

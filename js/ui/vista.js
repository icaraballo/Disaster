// El dibujo: una función render() que rehace el HTML según la fase de la partida.
// Aquí no hay reglas del juego, sólo lectura del estado (G) y texto de i18n/es.json.
import { TOWNS } from '../../data/pueblos.js';
import { ALCALDES } from '../../data/alcaldes.js';
import { DIS } from '../../data/desastres.js';
import { OFICIOS, JOBS } from '../../data/gente.js';
import { BUILD, BG, ICON } from '../../data/casillas.js';
import { TEMPORADA, VECINOS_MINIMOS, MEDALLA_PLATA, MEDALLA_ORO } from '../../data/balance.js';
import { cap, esc, ao, pl, todayKey } from '../util.js';
import { t } from '../i18n.js';
import { G, T, townName, ofName, aytoDown, granjasOk, availableWorkers, freeWorkers, W } from '../estado.js';
import { familias } from '../casas.js';
import { ACTIONS, costLabel, costLabelObra, planObra, construccion, nombreConstruccion } from '../acciones.js';
import { production } from '../turnos.js';
import { riskMap, tileRisks, tileState } from '../riesgo.js';
import { retoDelDia } from '../partida.js';
import { PROG, unlockedTown, unlockedAlc } from '../progreso.js';
import { CAPS } from '../ranking.js';
import { lineChart, barChart } from './graficos.js';

// Estado de la pantalla (no es de la partida): qué pantalla, reglas desplegadas, elección en «Nueva temporada».
export const UI = {screen:'menu', howto:false, town:'villarrio', alc:'ingeniera', persona:null, mapa3d:false};

const u = (k, v) => t('ui.' + k, v);
const nombreAlc = (a) => t('alcaldes.' + a.id + '.nombre');
const tituloAlc = (a) => t('alcaldes.' + a.id + '.titulo');
const optName = (types) => types.map(k => t('desastres.' + k + '.aviso')).join(' + ');
const nombreDesastres = (types) => types.map(k => t('desastres.' + k + '.nombre')).join(' + ');

function ranking() {
  if (!CAPS.db) return '';
  let h = '<div class="card"><div class="label" style="margin-bottom:8px">' + u('ranking.titulo') + '</div>';
  if (CAPS.boardState === 'loading') h += '<div class="muted" style="font-size:13px">' + u('ranking.cargando') + '</div>';
  else if (CAPS.boardState === 'timeout' || CAPS.boardState === 'error') h += '<div class="muted" style="font-size:13px">' + u('ranking.error') + '</div>';
  else if (!CAPS.board || !CAPS.board.length) h += '<div class="muted" style="font-size:13px">' + u('ranking.vacio') + '</div>';
  else h += '<div class="board">' + CAPS.board.map((r, i) => '<div class="r' + (r.id === CAPS.uid ? ' me' : '') + '"><span class="pos-n">' + (i + 1) + '</span><span style="flex:1">' + esc(r.name || u('ranking.alguien')) + '</span><span class="muted" style="font-size:12px">' + (r.won ? u('ranking.gano') : u('ranking.desastre', {n: (r.idx || 0) + 1})) + '</span><b>' + r.score + '</b></div>').join('') + '</div>';
  return h + '</div>';
}

function svg(x) { return '<svg class="ic" viewBox="0 0 28 28" aria-hidden="true">' + ICON[x] + '</svg>'; }

// Con el mapa 3D activo el HTML sólo deja un hueco: js/ui/mapa3d.js pone ahí su lienzo (que no se rehace).
function mapHTML(mode) {
  if (UI.mapa3d) return '<div class="mapa3d" data-modo="' + mode + '"></div>';
  const ov = {};
  if (mode === 'impact') G.impact.events.slice(0, G.impact.shown).forEach(e => (e.tiles || []).forEach(([i, k]) => { (ov[i] = ov[i] || new Set()).add(k); }));
  const a = G.sel ? ACTIONS[G.sel] : null;
  const heat = G.heat && (mode === 'prep' || mode === 'view') && G.fc ? riskMap() : null;
  let h = '<div class="map">';
  G.tiles.forEach((x, i) => {
    const o = ov[i] || new Set();
    const snap = mode === 'impact' ? G.snapTiles[i] : x;
    const base = mode === 'impact' && (o.has('ruinas') || o.has('solar')) ? {t: o.has('solar') ? 'V' : 'U', dmg: false} : snap;
    const dmgShown = mode === 'impact' ? (base.t === snap.t && (base.dmg || o.has('dmg'))) : x.dmg;
    let cls = 'tile' + (dmgShown && BUILD.has(base.t) ? ' broken' : '');
    let canPick = false;
    if (mode === 'prep' && a) { canPick = a.valid(x, i); cls += canPick ? ' pick' : ' nopick'; }
    const clickable = mode !== 'impact';
    if (clickable) cls += ' click';
    if (clickable && G.insp === i) cls += ' insp';
    if (heat && !BUILD.has(x.t)) cls += ' heatdim';
    const label = canPick ? ' aria-label="' + u('mapa.accionAqui', {accion: nombreConstruccion(construccion(G.sel, x))}) + '"' : ' aria-label="' + t('casillas.' + base.t + '.nombre') + '"';
    h += '<button class="' + cls + '" style="background:' + BG[base.t] + '" data-tile="' + i + '"' + (clickable ? '' : ' disabled') + label + '>';
    h += svg(base.t);
    if (x.dique) h += '<div class="dique' + (x.cheap ? ' cheap' : '') + '"></div>';
    if (x.muro) h += '<div class="muro"></div>';
    if (x.sacos && mode !== 'impact') h += '<div class="sacos"></div>';
    ['flood','fire','slide','snow','bolt'].forEach(k => { if (o.has(k)) h += '<div class="ov ' + k + '"></div>'; });
    if (heat && BUILD.has(x.t)) { const r = heat[i]; if (r >= 0.02) h += '<div class="ov heat" style="background:rgba(176,52,14,' + (0.18 + 0.7 * Math.min(1, r)).toFixed(2) + ')"><span>' + Math.round(r * 100) + '%</span></div>'; }
    if (x.rayo) h += '<div class="badge b-rayo"><svg width="8" height="10" viewBox="0 0 10 12" aria-hidden="true"><path d="M6 0 L1 7 L5 7 L4 12 L9 5 L5 5 Z" fill="#23262B"/></svg></div>';
    if (x.evac && mode !== 'impact') h += '<div class="badge b-evac">E</div>';
    if (mode !== 'impact' && familias(x) >= 2) h += '<div class="badge b-fam" title="' + esc(t('estado.familias', {n: 2, s: 's'})) + '">2</div>';
    if (dmgShown && BUILD.has(base.t)) h += '<div class="badge b-dmg">✕</div>';
    else if (o.has('ok')) h += '<div class="badge b-ok">✓</div>';
    if (mode === 'prep') { for (const k in G.WORK) if (G.WORK[k] === i && G.alloc[k].length) h += '<div class="badge b-work">' + G.alloc[k].length + '</div>'; }
    h += '</button>';
  });
  return h + '</div>';
}

function headerHTML() {
  let s = '<div class="season">';
  for (let i = 0; i < TEMPORADA; i++) s += '<div class="' + (i < G.idx ? 'done' : (i === G.idx ? 'now' : '')) + '"></div>';
  s += '</div>';
  const alc = ALCALDES.find(a => a.id === G.alc);
  return '<div class="row"><div><h3 style="font-size:16px">' + townName() + (G.daily ? u('suf.reto') : '') + '</h3><div class="muted" style="font-size:11.5px">' + tituloAlc(alc) + ' (' + nombreAlc(alc) + ')</div></div><div style="display:flex;align-items:center;gap:10px"><div class="muted" style="font-size:13px">' + u('desastreDe', {n: Math.min(G.idx + 1, TEMPORADA), total: TEMPORADA}) + '</div><button class="menubtn" data-go="menu">' + u('botonMenu') + '</button></div></div>' + s;
}

function resHTML(proj) {
  const r = G.res, p = proj || {};
  const d = (k, bad) => { const v = p[k]; if (!v) return ''; const isBad = bad ? v > 0 : v < 0; return '<span class="d ' + (isBad ? 'neg' : 'pos') + '">' + (v > 0 ? '+' : '') + v + '</span>'; };
  const avail = availableWorkers().length;
  const cells = [
    [u('res.vecinos'), r.pop + (r.heridos ? ' <span class="d neg">' + u('res.her', {n: r.heridos}) + '</span>' : '')],
    [u('res.moral'), r.moral + '%' + d('moral')],
    [u('res.dinero'), r.dinero + d('dinero')],
    [u('res.libre'), (G.phase === 'prep' ? freeWorkers().length + '/' : '') + avail],
    [u('res.madera'), r.madera + d('madera')],
    [u('res.piedra'), r.piedra + d('piedra')],
    [u('res.comida'), r.comida + d('comida')],
    [u('res.riesgo'), r.riesgo + '%' + d('riesgo', true)]
  ];
  return '<div class="res">' + cells.map(c => '<div><div class="k">' + c[0] + '</div><div class="v">' + c[1] + '</div></div>').join('') + '</div>';
}

function forecastOptions() { const f = G.fc; return [[f.real, f.pReal, f.hist[0], true], [f.decoy, 100 - f.pReal, 100 - f.hist[0], false]].sort((a, b) => b[1] - a[1]); }
// «55 % → 70 %» si la previsión ya se ha afinado desde el primer turno.
const pctAfinado = (p, p0) => (p0 != null && p0 !== p ? p0 + '% → ' : '') + p + '%';
// Precisión con sus fuentes (T-12 §B.6): «Precisión media · Observatorio ✓ · Radar ✗ · Meteoróloga ✗».
function precisionHTML() {
  const f = G.fc, fu = f.fuentes || {}, ok = (b) => b ? '✓' : '✗';
  return u('parte.precisionFuentes', {precision: u('parte.nivel.' + f.lvl), obs: ok(fu.obs), radar: ok(fu.radar), alc: ok(fu.alc)});
}
function forecastBars() {
  return forecastOptions().map(([k, p, p0]) => '<div style="display:flex;flex-direction:column;gap:4px"><div class="row" style="font-size:14px"><span>' + optName(k) + (k.length > 1 ? ' <span class="chip" style="background:#7A5A9E;font-size:10px;padding:2px 7px">' + u('combinado') + '</span>' : '') + '</span><b>' + pctAfinado(p, p0) + '</b></div><div class="bar"><div style="width:' + p + '%;background:' + DIS[k[0]].color + '"></div></div></div>').join('');
}

function warnings() {
  const w = [];
  if (aytoDown()) w.push(u('warn.ayto'));
  const dm = G.tiles.filter(x => x.dmg).length;
  if (dm) w.push(u('warn.danados', {n: dm, s: pl(dm)}));
  if (G.res.riesgo >= 30 && G.SLIDE.length) w.push(u('warn.ladera', {n: G.res.riesgo}));
  if (G.res.comida < Math.ceil(G.res.pop / 6)) w.push(u('warn.comida'));
  if (G.dry) w.push(u('warn.seca'));
  if (G.dryFarm) w.push(u('warn.granjas'));
  if (G.cheapDique) w.push(u('warn.constructor'));
  const inj = G.workers.filter(v => v.inj && !v.gone);
  if (inj.length) w.push(u(G.alc === 'enfermera' ? 'warn.heridosEnfermera' : 'warn.heridos', {a: inj.length > 1 ? 'os' : ao(inj[0]), nombres: inj.map(v => v.name).join(', ')}));
  const des = G.desanimados.map(W).filter(Boolean);
  if (des.length === 1) w.push(u('warn.desanimado', {nombre: des[0].name, a: ao(des[0])}));
  else if (des.length > 1) w.push(u('warn.desanimados', {nombres: des.map(s => s.name).join(t('ui.y'))}));
  return w.map(x => '<div class="warnline">' + x + '</div>').join('');
}

const heatBtn = () => '<button class="heatbtn' + (G.heat ? ' on' : '') + '" data-heat="1">' + u(G.heat ? 'riesgo.ocultar' : 'riesgo.ver') + '</button>';
const heatLegend = () => G.heat ? '<div class="muted" style="font-size:12px;line-height:1.4">' + u('riesgo.leyenda') + '</div>' : '';

function personStatus(w) {
  if (w.gone) return {code:'ido', text:u('persona.ido')};
  if (w.inj && !(G.alc === 'enfermera' && G.turn >= 2 && G.phase === 'prep')) return {code:'fuera', text:u('persona.herido', {a: ao(w)})};
  if (G.desanimados.includes(w.id)) return {code:'fuera', text:u('persona.desanimado', {a: ao(w)})};
  if (w.id === G.paperworkId && G.turn === 1 && G.busy.includes(w.id)) return {code:'fuera', text:u('persona.papeleo')};
  for (const k in G.alloc) if (G.alloc[k].includes(w.id)) return {code:'trabaja', text:t('trabajando.' + k)};
  if (G.busy.includes(w.id)) return {code:'obra', text:u('persona.construyendo')};
  return {code:'libre', text:u('persona.libre')};
}
// Iconos de trabajo (SVG de trazo, 14 px) para la esquina del avatar.
const ICONO_TRABAJO = {
  talar:'<path d="M12 21v-6M12 3 6 12h3l-3 4h12l-3-4h3z"/>',
  cantera:'<path d="M3 18 8 8l5 3 4-5 4 12z"/>',
  granja:'<path d="M12 21v-9M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 14c0-3 2-5 6-5 0 3-2 5-6 5z"/>',
  recaudar:'<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5c0-1.2 1.2-2 2.5-2s2.5.8 2.5 2-1.2 1.6-2.5 2-2.5.8-2.5 2 1.2 2 2.5 2 2.5-.8 2.5-2"/>',
  obra:'<path d="M14 4 20 10 17 13 11 7zM12 9 4 17 7 20 15 12"/>'
};
const iconoTrabajo = (k) => '<span class="wi" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONO_TRABAJO[k] + '</svg></span>';

// Franja de avatares: enseña quién está libre y en qué trabaja cada cual (no se asigna a mano).
function peopleHTML() {
  const vivos = G.workers.filter(w => !w.gone);
  let h = '<div class="people">' + vivos.map(w => {
    const st = personStatus(w);
    const job = st.code === 'trabaja' ? Object.keys(G.alloc).find(k => G.alloc[k].includes(w.id)) : (st.code === 'obra' ? 'obra' : null);
    const cls = 'person' + (st.code === 'fuera' ? ' out' : '') + (job ? ' busy' : '') + (UI.persona === w.id ? ' sel' : '');
    const aria = u('persona.aria', {nombre: w.name, oficio: ofName(w), estado: st.text});
    return '<button class="' + cls + '" data-person="' + w.id + '" aria-label="' + esc(aria) + '" aria-pressed="' + (UI.persona === w.id) + '"><span class="av" style="background:' + OFICIOS[w.of].color + '">' + esc(w.name.charAt(0)) + (job ? iconoTrabajo(job) : '') + '</span><span class="nm">' + esc(w.name) + (w.temp ? '*' : '') + '</span></button>';
  }).join('') + '</div>';
  const sel = UI.persona ? vivos.find(w => w.id === UI.persona) : null;
  if (sel) {
    h += '<div class="pcard"><div><b>' + esc(sel.name) + '</b> · ' + ofName(sel) + (sel.temp ? u('persona.temporal') : '') + '</div>'
      + '<div>' + t('oficios.' + sel.of + '.desc') + '</div>'
      + '<div><b>' + personStatus(sel).text + '</b></div>'
      + '<div class="muted">' + u('persona.casa', {a: ao(sel)}) + '</div></div>';
  } else h += '<div class="muted" style="font-size:12.5px">' + u('prep.ayudaGente') + '</div>';
  return h;
}

// Ficha de la casilla tocada.
function infoHTML() {
  if (G.insp == null) return '<div class="muted" style="font-size:12.5px;text-align:center">' + u('ficha.toca') + '</div>';
  const i = G.insp, x = T(i);
  const st = tileState(i), risks = tileRisks(i);
  const acts = Object.keys(ACTIONS).filter(k => ACTIONS[k].valid(x, i));
  const work = ['B','L','G','A'].includes(x.t) ? u('ficha.trabajo.' + x.t) : null;
  let h = '<div class="info"><div class="row"><div style="display:flex;gap:10px;align-items:center"><div class="sw" style="background:' + BG[x.t] + '">' + svg(x.t) + '</div><h3 style="font-size:17px">' + t('casillas.' + x.t + '.nombre') + '</h3></div><button class="x" data-close="1" aria-label="' + u('ficha.cerrar') + '">✕</button></div>';
  if (st.length) h += '<div style="display:flex;gap:6px;flex-wrap:wrap">' + st.map(s => '<span class="tag' + (s.bad ? ' bad' : '') + '">' + esc(s.text) + '</span>').join('') + '</div>';
  h += '<div style="font-size:13.5px;line-height:1.45">' + t('casillas.' + x.t + '.que') + '</div>';
  if (BUILD.has(x.t) && (G.phase === 'prep' || G.phase === 'forecast')) { const r = Math.round(riskMap()[i] * 100); h += '<div style="font-size:13px"><b>' + u('ficha.riesgo', {n: r}) + '</b> <span class="muted">' + u('ficha.segunPrevision') + '</span></div>'; }
  if (work || acts.length) {
    h += '<div class="label">' + u('ficha.quePuedes') + '</div>';
    if (work) h += '<div style="font-size:13px;line-height:1.4">' + work + '</div>';
    if (acts.length) {
      if (G.phase === 'prep') h += '<div style="display:flex;gap:6px;flex-wrap:wrap">' + acts.map(k => '<button class="doat" data-doat="' + k + '">' + (k === 'dique' ? nombreConstruccion(construccion(k, x)) : t('acciones.' + k + '.nombre')) + ' <span>' + costLabelObra(k) + '</span></button>').join('') + '</div>';
      else h += '<div style="font-size:13px;line-height:1.4">' + acts.map(k => t('acciones.' + k + '.nombre') + ' (' + costLabel(ACTIONS[k]) + ')').join(' · ') + ' <span class="muted">' + u('ficha.enPreparacion') + '</span></div>';
    }
  }
  if (risks.length) h += '<div class="label">' + u('ficha.quePasar') + '</div><div class="log">' + risks.map(([k, s]) => '<div class="e k-' + k + '" style="font-size:13px;animation:none"><div class="dot"></div><div>' + s + '</div></div>').join('') + '</div>';
  return h + '</div>';
}

// La mejor medalla de un pueblo, como etiqueta pequeña (nada si aún no tiene).
const medallaChip = (m) => m ? ' <span class="chip medalla-chip m-' + m + '">' + u('medallas.' + m) + '</span>' : '';

const topOf = (o) => { const ks = Object.keys(o).filter(k => o[k] > 0).sort((a, b) => o[b] - o[a]); return ks.length ? [ks[0], o[ks[0]]] : null; };

function menuHTML() {
  const dk = todayKey(), dia = retoDelDia(dk), dTown = dia.town, dAlc = ALCALDES.find(a => a.id === dia.alc);
  let h = '<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px"><div class="label">' + u('menu.prototipo') + '</div><h1 style="font-size:34px">' + u('titulo') + '</h1><div class="muted" style="font-size:15px">' + u('menu.subtitulo', {n: TEMPORADA}) + '</div></div>';
  h += '<button class="btn" data-go="setup">' + u('menu.nueva') + '<small>' + u('menu.nuevaSub') + '</small></button>';
  h += '<button class="btn ghost" data-go="daily">' + u('menu.reto') + '<small>' + u('menu.retoSub', {pueblo: t('pueblos.' + dTown + '.nombre'), alcalde: tituloAlc(dAlc)}) + '</small></button>';
  h += ranking();
  h += '<button class="btn ghost" data-go="howto">' + u(UI.howto ? 'menu.ocultarReglas' : 'menu.comoSeJuega') + '</button>';
  if (UI.howto) h += '<div class="card"><ul class="rules">' + ['aviso','prep','ojo','impacto','casas','entre','pierdes','medallas'].map(k => '<li>' + u('reglas.' + k, {n: VECINOS_MINIMOS, plata: MEDALLA_PLATA.vecinos, plataMoral: MEDALLA_PLATA.moral, oro: MEDALLA_ORO.vecinos, oroMoral: MEDALLA_ORO.moral}) + '</li>').join('') + '</ul></div>';
  const nT = Object.keys(TOWNS).filter(unlockedTown).length, nA = ALCALDES.filter(unlockedAlc).length;
  h += '<div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="label">' + u('menu.progreso') + '</div><div style="font-size:14px;line-height:1.5">' + u('menu.progresoDatos', {pueblos: nT, pueblosTotal: Object.keys(TOWNS).length, alcaldes: nA, alcaldesTotal: ALCALDES.length, temporadas: PROG.seasons, mejor: PROG.best || 0}) + '</div>' +
    '<label class="toggle"><input type="checkbox" data-test="1"' + (PROG.test ? ' checked' : '') + '> ' + u('menu.modoPrueba') + '</label></div>';
  return h;
}

function setupHTML() {
  let h = '<div class="row"><h2 style="font-size:22px">' + u('menu.nueva') + '</h2><button class="x" data-go="menu" aria-label="' + u('setup.volver') + '">✕</button></div>';
  h += '<div class="label">' + u('setup.pueblo') + '</div><div style="display:flex;flex-direction:column;gap:8px">';
  Object.keys(TOWNS).forEach(k => {
    const tw = TOWNS[k], ok = unlockedTown(k), nom = t('pueblos.' + k + '.nombre');
    h += '<button class="pick-card' + (UI.town === k ? ' sel' : '') + (ok ? '' : ' locked') + '" ' + (ok ? 'data-town="' + k + '"' : 'disabled') + '><div class="sw" style="background:' + tw.color + '">' + nom.charAt(0) + '</div><div><div class="n">' + nom + ' <span class="muted" style="font-weight:500;font-size:12px">· ' + t('pueblos.' + k + '.tipo') + '</span>' + medallaChip((PROG.medallas || {})[k]) + '</div><div class="dd">' + (ok ? t('pueblos.' + k + '.desc') : u('setup.bloqueado', {cond: t('pueblos.' + k + '.desbloqueo')})) + '</div></div></button>';
  });
  h += '</div><div class="label">' + u('setup.alcalde') + '</div><div style="display:flex;flex-direction:column;gap:8px">';
  ALCALDES.forEach(a => {
    const ok = unlockedAlc(a);
    h += '<button class="pick-card' + (UI.alc === a.id ? ' sel' : '') + (ok ? '' : ' locked') + '" ' + (ok ? 'data-alc="' + a.id + '"' : 'disabled') + '><div class="sw" style="background:' + a.color + '">' + nombreAlc(a).charAt(0) + '</div><div><div class="n">' + tituloAlc(a) + ' <span class="muted" style="font-weight:500;font-size:12px">· ' + nombreAlc(a) + '</span></div><div class="dd">' + (ok ? t('alcaldes.' + a.id + '.desc') : u('setup.bloqueado', {cond: t('alcaldes.' + a.id + '.desbloqueo')})) + '</div></div></button>';
  });
  return h + '</div><button class="btn" data-go="start">' + u('setup.empezar') + '</button>';
}

function forecastHTML() {
  const f = G.fc;
  let h = headerHTML() + resHTML();
  h += '<div class="row"><div class="label">' + u('pueblo') + '</div>' + heatBtn() + '</div>';
  h += '<div class="mapwrap' + (G.heat ? '' : ' dim') + '">' + mapHTML('view') + '</div>' + heatLegend() + infoHTML();
  h += '<div class="card" style="display:flex;flex-direction:column;gap:12px">';
  h += '<div class="row"><div class="label">' + u('parte.titulo') + '</div><div class="chip" style="background:#C2531F">' + u('parte.llegaEn', {n: G.maxTurns, s: pl(G.maxTurns)}) + '</div></div>';
  h += '<h2 style="font-size:23px">' + u('parte.aviso.' + f.I) + '</h2>';
  h += forecastBars();
  h += '<div class="muted" style="font-size:13px;line-height:1.45">' + u('parte.intensidad', {puntos: '●'.repeat(f.I) + '○'.repeat(3 - f.I), precision: u('parte.precision.' + f.lvl)}) + '</div>';
  h += '<div style="font-size:13px;line-height:1.45">' + precisionHTML() + '<br><span class="muted">' + u('parte.seAfina') + '</span></div>';
  if (G.alc === 'meteorologa' && G.schedule[G.idx + 1]) h += '<div style="font-size:13px;line-height:1.45">' + u('parte.intuye', {nombre: nombreAlc(ALCALDES.find(a => a.id === 'meteorologa')), que: optName(G.schedule[G.idx + 1].types)}) + '</div>';
  h += '</div>' + warnings();
  return h + '<button class="btn" data-go="prep">' + u('parte.empezar') + '</button>';
}

function prepHTML() {
  let h = headerHTML();
  h += '<div class="row"><h2 style="font-size:20px">' + u('prep.titulo') + '</h2><div class="muted" style="font-size:13px">' + u('prep.turno', {n: G.turn, total: G.maxTurns}) + '</div></div>';
  h += resHTML(production());
  h += '<div class="row" style="font-size:12.5px;align-items:flex-start"><span><span class="muted">' + u('prep.prevision') + '</span> ' + forecastOptions().map(([k, p, p0]) => optName(k) + ' ' + pctAfinado(p, p0)).join(' · ') + '<br><span class="muted">' + precisionHTML() + (G.turn < G.maxTurns ? ' · ' + u('prep.seAfina') : '') + '</span></span>' + heatBtn() + '</div>';
  h += '<div class="mapwrap">' + mapHTML('prep') + '</div>' + heatLegend();
  h += '<div class="msg">' + (G.msg || '') + '</div>' + (G.sel ? '' : infoHTML());
  h += '<div class="label">' + u('prep.tuGente') + '</div>' + peopleHTML();
  h += '<div class="label">' + u('prep.producir') + '</div><div class="jobs">';
  const free = freeWorkers().length;
  const yields = {talar:u('prep.rinde.talar'), cantera:u('prep.rinde.cantera'), granja:u('prep.rinde.granja', {n: granjasOk() >= 2 ? 2 : granjasOk(), sequia: G.dryFarm ? u('prep.rinde.sequia') : ''}), recaudar:u('prep.rinde.recaudar')};
  JOBS.forEach(k => {
    const n = t('trabajos.' + k);
    const who = G.alloc[k].map(id => W(id).name).join(', ');
    const cnt = G.alloc[k].length;
    h += '<div class="job' + (cnt ? ' on' : '') + (k === 'talar' || k === 'cantera' ? ' danger' : '') + '"><div class="n">' + n + '</div><div class="y">' + yields[k] + '</div><div class="who">' + esc(who) + '</div><b class="cnt">' + cnt + '</b>'
      + '<button class="half l" data-job="' + k + '" data-d="-1" aria-label="' + esc(u('prep.quitar', {trabajo: n})) + '"' + (cnt ? '' : ' disabled') + '><span aria-hidden="true">−</span></button>'
      + '<button class="half r" data-job="' + k + '" data-d="1" aria-label="' + esc(u('prep.anadir', {trabajo: n})) + '"' + (free > 0 ? '' : ' disabled') + '><span aria-hidden="true">+</span></button></div>';
  });
  h += '</div><div class="label">' + u('prep.construir') + '</div><div class="acts">';
  for (const k in ACTIONS) {
    if (ACTIONS[k].casa && !G.tiles.some((x, i) => ACTIONS[k].valid(x, i))) continue;
    const plan = planObra(k);
    h += '<button class="act' + (G.sel === k ? ' sel' : '') + (plan.completo ? '' : ' low') + '" data-act="' + k + '"><span class="n">' + t('acciones.' + k + '.nombre') + '</span><span class="c">' + costLabelObra(k) + '</span>'
      + (plan.albanil ? '<span class="d">' + u('prep.ahorra', {nombre: esc(plan.albanil.name), material: t('recursos.' + plan.material)}) + '</span>' : '') + '</button>';
  }
  h += '</div>';
  if (G.sel) h += '<div class="hint">' + t('acciones.' + G.sel + '.desc') + (G.workers.some(w => w.of === 'albanil' && !w.gone) ? ' ' + u('prep.albanil') : '') + '</div>';
  h += warnings();
  return h + '<button class="btn" data-go="endturn">' + u(G.turn < G.maxTurns ? 'prep.terminarTurno' : 'prep.terminarEsperar') + '</button>';
}

function impactHTML() {
  const types = G.fc.real, done = G.impact.shown >= G.impact.events.length;
  let h = headerHTML();
  h += '<div class="banner" style="background:' + DIS[types[0]].color + '"><div class="label" style="color:rgba(255,255,255,.85)">' + u('impacto.titulo', {n: G.idx + 1}) + '</div><h2 style="font-size:24px">' + u('impacto.nombre', {lista: nombreDesastres(types)}) + '</h2><div style="font-size:13px;opacity:.9">' + u('impacto.previsto', {p: G.fc.pReal}) + '</div></div>';
  h += '<div class="mapwrap">' + mapHTML('impact') + '</div>';
  h += '<div class="card"><div class="log">' + G.impact.events.slice(0, G.impact.shown).map(e => '<div class="e k-' + e.kind + '"><div class="dot"></div><div>' + e.text + '</div></div>').join('') + '</div></div>';
  return h + '<button class="btn" data-go="result"' + (done ? '' : ' disabled') + '>' + u(done ? 'impacto.ver' : 'impacto.espera') + '</button>';
}

function resultHTML() {
  const r = G.res, s = G.snap;
  const dl = (a, b) => { const v = a - b; return v ? ' <span style="font-size:13px" class="' + (v > 0 ? 'pos' : 'neg') + '">' + (v > 0 ? '+' : '') + v + '</span>' : ''; };
  let h = headerHTML();
  h += '<div><div class="label" style="color:' + (G.lost ? '#A8441A' : '#2F6B37') + '">' + u(G.lost ? 'resultado.cae' : 'resultado.superado', {n: G.idx + 1}) + '</div><h2 style="font-size:26px">' + u(G.lost ? 'resultado.caeTitulo' : 'resultado.aguantaTitulo', {pueblo: townName()}) + '</h2></div>';
  h += '<div class="grid2">' +
    '<div class="stat"><div class="k">' + u('res.vecinos') + '</div><div class="v">' + r.pop + dl(r.pop, s.pop) + '</div></div>' +
    '<div class="stat"><div class="k">' + u('res.moral') + '</div><div class="v">' + r.moral + '%' + dl(r.moral, s.moral) + '</div></div>' +
    '<div class="stat"><div class="k">' + u('resultado.heridos') + '</div><div class="v">' + r.heridos + '</div></div>' +
    '<div class="stat"><div class="k">' + u('resultado.danados') + '</div><div class="v">' + G.tiles.filter(x => x.dmg).length + '</div></div>' +
    '<div class="stat"><div class="k">' + u('res.comida') + '</div><div class="v">' + r.comida + dl(r.comida, s.comida) + '</div></div>' +
    '<div class="stat"><div class="k">' + u('res.riesgo') + '</div><div class="v">' + r.riesgo + '%' + dl(r.riesgo, s.riesgo) + '</div></div></div>';
  if (G.lost) h += '<div class="warnline">' + G.lost + '</div><button class="btn" data-go="finish">' + u('resultado.informe') + '</button>';
  else if (G.idx === TEMPORADA - 1) h += '<div class="goodline">' + u('resultado.ultimo') + '</div><button class="btn" data-go="finish">' + u('resultado.informe') + '</button>';
  else {
    h += '<h3 style="font-size:17px">' + u('resultado.eligeMejora') + '</h3><div style="display:flex;flex-direction:column;gap:8px">';
    G.result.offers.forEach(p => { h += '<button class="pick-card" data-perk="' + p.id + '"><div class="sw" style="background:' + p.sw + '"></div><div><div class="n">' + t('mejoras.' + p.id + '.nombre') + '</div><div class="dd">' + t('mejoras.' + p.id + '.desc') + '</div></div></button>'; });
    h += '</div>';
  }
  return h;
}

function eventHTML() {
  const e = G.event;
  let h = headerHTML();
  if (G.msg) h += '<div class="goodline">' + G.msg + '</div>';
  h += '<div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="label">' + u('evento.mientras') + '</div><h2 style="font-size:22px">' + e.titulo + '</h2><div style="font-size:14.5px;line-height:1.5">' + esc(e.texto) + '</div></div>';
  h += resHTML();
  return h + '<div style="display:flex;flex-direction:column;gap:8px">' + e.opts.filter(o => !o.ok || o.ok()).map((o, k) => '<button class="ev-opt" data-ev="' + k + '"><div class="n">' + o.l + '</div><div class="dd">' + esc(o.d) + '</div></button>').join('') + '</div>';
}

function endHTML() {
  const won = !G.lost, hist = G.stats.hist;
  let h = '<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px"><div class="label">' + u('fin.titulo') + (G.daily ? u('suf.reto') : '') + '</div><h1 style="font-size:30px">' + u(won ? 'fin.sobrevive' : 'fin.noAguanta', {pueblo: townName()}) + '</h1><div class="muted" style="font-size:15px">' + u(won ? 'fin.superado' : 'fin.llegaste', {total: TEMPORADA, n: G.idx + 1}) + '</div></div>';
  if (G.medalla) h += '<div class="card row medalla m-' + G.medalla + '"><div><div class="label">' + u('fin.medalla') + '</div><div style="font-family:Rubik,sans-serif;font-weight:700;font-size:24px">' + u('medallas.' + G.medalla) + '</div><div class="muted" style="font-size:13px">' + u('medallas.' + G.medalla + 'Por', {plata: MEDALLA_PLATA.vecinos, plataMoral: MEDALLA_PLATA.moral, oro: MEDALLA_ORO.vecinos, oroMoral: MEDALLA_ORO.moral}) + '</div></div><div style="text-align:right;font-size:13px">' + (G.medallaNueva ? '<b style="color:#2F6B37">' + u('fin.medallaNueva') + '</b>' : u('fin.medallaMejor', {medalla: u('medallas.' + ((PROG.medallas || {})[G.town] || G.medalla))})) + '</div></div>';
  h += '<div class="card row"><div><div class="label">' + u('fin.puntuacion') + '</div><div style="font-family:Rubik,sans-serif;font-weight:700;font-size:34px">' + G.final + '</div></div><div style="text-align:right;font-size:13px" class="muted">' + (G.record ? '<b style="color:#2F6B37">' + u('fin.record') + '</b>' : u('fin.recordActual', {n: PROG.best})) + '</div></div>';
  if (G.unlocked && G.unlocked.length) h += '<div class="goodline"><b>' + u('fin.desbloqueado') + '</b> ' + G.unlocked.join(' · ') + '</div>';
  if (G.daily) { h += G.submitted ? '<div class="goodline">' + u('fin.enRanking') + '</div>' : (G.submitFail ? '<div class="warnline">' + u('fin.rankingFallo') + '</div>' : ''); h += ranking(); }
  const pops = [G.stats.startPop || 40].concat(hist.map(x => x.pop)), morals = [G.stats.startMoral || 70].concat(hist.map(x => x.moral));
  h += '<div class="card chart"><div class="label" style="margin-bottom:6px">' + u('fin.graficaVecinos') + '</div>' + lineChart(pops, '#2A62A0', u('res.vecinos'), 50) + '</div>';
  h += '<div class="card chart"><div class="label" style="margin-bottom:6px">' + u('fin.graficaMoral') + '</div>' + lineChart(morals, '#7A5A9E', u('res.moral'), 100) + '</div>';
  h += '<div class="card chart"><div class="label" style="margin-bottom:6px">' + u('fin.graficaDanados') + '</div>' + barChart(hist.map(x => x.dmg)) + '<div class="muted" style="font-size:12px;margin-top:6px">' + hist.map(x => x.n + ': ' + nombreDesastres(x.types)).join(' · ') + '</div></div>';
  const tc = topOf(G.stats.cause), ts = topOf(G.stats.saves), tb = topOf(G.stats.builds);
  h += '<div class="grid2">' +
    '<div class="stat"><div class="k">' + u('fin.masDanio') + '</div><div style="font-weight:600;font-size:14px;margin-top:2px">' + (tc ? cap(t('causas.' + tc[0])) + ' (' + tc[1] + ')' : u('fin.nada')) + '</div></div>' +
    '<div class="stat"><div class="k">' + u('fin.masSalvo') + '</div><div style="font-weight:600;font-size:14px;margin-top:2px">' + (ts ? cap(t('salvaciones.' + ts[0])) + ' (' + ts[1] + ')' : u('fin.suerte')) + '</div></div>' +
    '<div class="stat"><div class="k">' + u('fin.masConstruiste') + '</div><div style="font-weight:600;font-size:14px;margin-top:2px">' + (tb ? nombreConstruccion(tb[0]) + ' (' + tb[1] + ')' : u('fin.nada')) + '</div></div>' +
    '<div class="stat"><div class="k">' + u('fin.tuGente') + '</div><div style="font-weight:600;font-size:14px;margin-top:2px">' + u('fin.gente', {siguen: G.workers.filter(w => !w.gone).length, fueron: G.workers.filter(w => w.gone).length}) + '</div></div>' +
    '<div class="stat"><div class="k">' + u('fin.familias') + '</div><div style="font-weight:600;font-size:14px;margin-top:2px">' + (G.stats.familias || 0) + '</div></div>' +
    '<div class="stat"><div class="k">' + u('fin.ruinas') + '</div><div style="font-weight:600;font-size:14px;margin-top:2px">' + G.tiles.filter(x => x.t === 'U' || x.t === 'V').length + '</div></div></div>';
  h += '<div class="mapwrap">' + mapHTML('view') + '</div>' + infoHTML();
  if (G.chosen.length) h += '<div class="card"><div class="label" style="margin-bottom:6px">' + u('fin.mejoras') + '</div><div style="font-size:14px;line-height:1.5">' + G.chosen.join(' · ') + '</div></div>';
  return h + '<button class="btn" data-go="menu">' + u('fin.volver') + '</button>';
}

export function render() {
  const app = document.getElementById('app');
  let h = '';
  if (UI.screen === 'menu' || (!G && UI.screen !== 'setup')) h = menuHTML();
  else if (UI.screen === 'setup') h = setupHTML();
  else if (G.phase === 'forecast') h = forecastHTML();
  else if (G.phase === 'prep') h = prepHTML();
  else if (G.phase === 'impact') h = impactHTML();
  else if (G.phase === 'result') h = resultHTML();
  else if (G.phase === 'event') h = eventHTML();
  else if (G.phase === 'end') h = endHTML();
  app.innerHTML = h;
}

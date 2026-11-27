// Arranque y escuchas de clics. Une la lógica (js/*.js) con el dibujo (js/ui/vista.js).
import { todayKey } from './util.js';
import { cargarTextosWeb, t } from './i18n.js';
import { cargarProgreso, PROG, saveProg, unlockedTown } from './progreso.js';
import { guardarPartida, continuarPartida, verificarGuardadoInicial, limpiarFalloGuardado } from './guardado.js';
import { ganchos, initCaps } from './ranking.js';
import { G, setG, T, W, ofName } from './estado.js';
import { OFICIOS } from '../data/gente.js';
import { newGame } from './partida.js';
import { ACTIONS, doAction, planObra } from './acciones.js';
import { TIEMPOS } from '../data/escena3d.js';
import { animarNumeros } from './ui/numeros.js';
import { changeJob, endTurn } from './turnos.js';
import { toResult, choosePerk, chooseEvent, finish } from './temporada.js';
import { render, UI } from './ui/vista.js';
import { AJUSTES, ALTURAS_PANEL, cargarAjustes, guardarAjustes, aplicarTema } from './ui/temas.js';

let timer = null;
let mapa3d = null;   // el módulo del mapa en 3D, si el navegador lo permite (si no, queda el mapa plano)

// Si la partida acaba de llegar al impacto, va enseñando los sucesos de uno en uno.
function vigilarImpacto() {
  if (!G || G.phase !== 'impact' || timer || G.impact.shown >= G.impact.events.length) return;
  const base = mapa3d ? TIEMPOS.ritmoImpacto : 700;
  const ms = UI.velImpacto === 2 ? Math.round(base / 2) : base;
  timer = setInterval(() => {
    if (!G || G.phase !== 'impact') { clearInterval(timer); timer = null; return; }
    G.impact.shown++;
    if (G.impact.shown >= G.impact.events.length) { clearInterval(timer); timer = null; guardarPartida(); }
    render(); if (mapa3d) mapa3d.alDibujar();
  }, ms);
}
// Antes de pintar, el tema (T-15): si ha cambiado, el 3D rehace sus casillas con los colores nuevos.
function dibujar() { if (aplicarTema() && mapa3d) mapa3d.refrescarTema(); render(); if (mapa3d) mapa3d.alDibujar(); animarNumeros(); vigilarImpacto(); }

// Carga el 3D sin bloquear el menú. Con ?mapa=plano, o sin WebGL, se queda el mapa plano de siempre.
async function activar3d() {
  if (/[?&]mapa=plano/.test(location.search)) return;
  try {
    const m = await import('./ui/mapa3d.js');
    if (!m.iniciar()) return;
    m.hooks.alTocarCasilla = tocarCasilla;
    mapa3d = m; UI.mapa3d = true;
    dibujar();
  } catch (e) { console.warn('El mapa 3D no está disponible; se usa el mapa plano.', e); }
}

// Construye la acción elegida en la casilla i y, en el 3D, manda a la gente a esa casilla.
function construir(i) {
  const ids = G.sel && ACTIONS[G.sel] ? planObra(G.sel, i).equipo.map(w => w.id) : [];
  if (doAction(i)) { if (mapa3d) mapa3d.enviarA(ids, i); guardarPartida(); }
}

// Tocar una casilla (del mapa plano o del 3D): construir si hay una acción elegida, o abrir la ficha.
function tocarCasilla(i) {
  UI.persona = null;
  if (G.phase === 'prep' && G.sel) {
    if (ACTIONS[G.sel].valid(T(i), i)) { construir(i); return dibujar(); }
    G.msg = t('msg.aquiNo', {accion: t('acciones.' + G.sel + '.nombre').toLowerCase()}); G.sel = null; G.insp = i; return dibujar();
  }
  G.insp = G.insp === i ? null : i; return dibujar();
}

function irA(g) {
  UI.persona = null;
  const top = () => window.scrollTo(0, 0);
  if (g === 'continue') { if (continuarPartida()) { UI.screen = 'game'; top(); } return dibujar(); }
  if (g === 'setup') { UI.screen = 'setup'; if (!unlockedTown(UI.town)) UI.town = 'villarrio'; top(); return dibujar(); }
  if (g === 'menu') { guardarPartida(); UI.screen = 'menu'; setG(null); clearInterval(timer); timer = null; top(); return dibujar(); }
  if (g === 'aspecto') { UI.screen = 'aspecto'; top(); return dibujar(); }
  if (g === 'howto') { UI.howto = !UI.howto; return dibujar(); }
  if (g === 'start') { limpiarFalloGuardado(); newGame({town: UI.town, alc: UI.alc}); UI.screen = 'game'; guardarPartida(); top(); return dibujar(); }
  if (g === 'daily') { limpiarFalloGuardado(); newGame({daily: todayKey()}); UI.screen = 'game'; guardarPartida(); top(); return dibujar(); }
  if (g === 'prep') { G.phase = 'prep'; G.msg = ''; guardarPartida(); top(); return dibujar(); }
  if (g === 'endturn') { endTurn(); guardarPartida(); return dibujar(); }
  if (g === 'result') { top(); toResult(); guardarPartida(); return dibujar(); }
  if (g === 'finish') { top(); finish(); return dibujar(); }
}

function clic(e) {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const top = () => window.scrollTo(0, 0);
  const d = b.dataset;
  if (d.go) return irA(d.go);
  if (d.speed) { UI.velImpacto = +d.speed; clearInterval(timer); timer = null; return dibujar(); }
  if (d.skip) { if (G && G.impact) { G.impact.shown = G.impact.events.length; clearInterval(timer); timer = null; guardarPartida(); } return dibujar(); }
  if (d.town) { UI.town = d.town; return dibujar(); }
  if (d.alc) { UI.alc = d.alc; return dibujar(); }
  if (d.heat) { G.heat = !G.heat; return dibujar(); }
  if (d.job) { changeJob(d.job, +d.d); guardarPartida(); return dibujar(); }
  if (d.act) { G.sel = G.sel === d.act ? null : d.act; G.msg = ''; G.insp = null; return dibujar(); }
  if (d.tema) { AJUSTES.tema = d.tema; guardarAjustes(); return dibujar(); }
  if (d.panel) { AJUSTES.panel = ALTURAS_PANEL[(ALTURAS_PANEL.indexOf(AJUSTES.panel) + 1) % ALTURAS_PANEL.length]; guardarAjustes(); return dibujar(); }
  if (d.tab) { if (AJUSTES.panel === 'plegado') { AJUSTES.panel = 'normal'; guardarAjustes(); } UI.tab = d.tab; UI.persona = null; G.insp = null; return dibujar(); }
  if (d.cancel) { G.sel = null; G.msg = ''; return dibujar(); }
  if (d.person) { if (UI.persona === d.person) { UI.persona = null; G.insp = null; } else { UI.persona = d.person; G.insp = W(d.person).home; } return dibujar(); }
  if (d.tile) return tocarCasilla(+d.tile);
  if (d.close) { UI.persona = null; G.insp = null; return dibujar(); }
  if (d.doat) { G.sel = d.doat; construir(G.insp); G.sel = null; return dibujar(); }
  if (d.perk) { top(); choosePerk(d.perk); guardarPartida(); return dibujar(); }
  if (d.ev) { top(); chooseEvent(+d.ev); guardarPartida(); return dibujar(); }
}

async function arrancar() {
  const app = document.getElementById('app');
  try { await cargarTextosWeb(); }
  catch (e) { app.textContent = 'No se han podido cargar los textos del juego. Recarga la página.'; return; }
  cargarProgreso();
  cargarAjustes();
  aplicarTema();
  // Si el móvil pasa a modo oscuro (o vuelve), la Noche automática entra o sale sin recargar.
  if (window.matchMedia) { const mq = matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', () => dibujar()); }
  verificarGuardadoInicial();
  ganchos.alCambiar = dibujar;
  app.addEventListener('change', (e) => {
    if (e.target.dataset && e.target.dataset.test) { PROG.test = e.target.checked; saveProg(); dibujar(); }
    if (e.target.dataset && e.target.dataset.nocheauto) { AJUSTES.nocheAuto = e.target.checked; guardarAjustes(); dibujar(); }
  });
  app.addEventListener('click', clic);
  dibujar();
  initCaps();
  activar3d();
}
arrancar();

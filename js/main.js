// Arranque y escuchas de clics. Une la lógica (js/*.js) con el dibujo (js/ui/vista.js).
import { todayKey } from './util.js';
import { cargarTextosWeb, t } from './i18n.js';
import { cargarProgreso, PROG, saveProg, unlockedTown } from './progreso.js';
import { ganchos, initCaps } from './ranking.js';
import { G, setG, T, W, ofName } from './estado.js';
import { OFICIOS } from '../data/gente.js';
import { newGame } from './partida.js';
import { ACTIONS, doAction } from './acciones.js';
import { changeJob, endTurn } from './turnos.js';
import { toResult, choosePerk, chooseEvent, finish } from './temporada.js';
import { render, UI } from './ui/vista.js';

let timer = null;

// Si la partida acaba de llegar al impacto, va enseñando los sucesos de uno en uno.
function vigilarImpacto() {
  if (!G || G.phase !== 'impact' || timer) return;
  timer = setInterval(() => {
    if (!G || G.phase !== 'impact') { clearInterval(timer); timer = null; return; }
    G.impact.shown++;
    if (G.impact.shown >= G.impact.events.length) { clearInterval(timer); timer = null; }
    render();
  }, 700);
}
function dibujar() { render(); vigilarImpacto(); }

function irA(g) {
  UI.persona = null;
  const top = () => window.scrollTo(0, 0);
  if (g === 'setup') { UI.screen = 'setup'; if (!unlockedTown(UI.town)) UI.town = 'villarrio'; top(); return dibujar(); }
  if (g === 'menu') { UI.screen = 'menu'; setG(null); clearInterval(timer); timer = null; top(); return dibujar(); }
  if (g === 'howto') { UI.howto = !UI.howto; return dibujar(); }
  if (g === 'start') { newGame({town: UI.town, alc: UI.alc}); UI.screen = 'game'; top(); return dibujar(); }
  if (g === 'daily') { newGame({daily: todayKey()}); UI.screen = 'game'; top(); return dibujar(); }
  if (g === 'prep') { G.phase = 'prep'; G.msg = ''; top(); return dibujar(); }
  if (g === 'endturn') { endTurn(); return dibujar(); }
  if (g === 'result') { top(); toResult(); return dibujar(); }
  if (g === 'finish') { top(); finish(); return dibujar(); }
}

function clic(e) {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const top = () => window.scrollTo(0, 0);
  const d = b.dataset;
  if (d.go) return irA(d.go);
  if (d.town) { UI.town = d.town; return dibujar(); }
  if (d.alc) { UI.alc = d.alc; return dibujar(); }
  if (d.heat) { G.heat = !G.heat; return dibujar(); }
  if (d.job) { changeJob(d.job, +d.d); return dibujar(); }
  if (d.act) { G.sel = G.sel === d.act ? null : d.act; G.msg = ''; return dibujar(); }
  if (d.person) { if (UI.persona === d.person) { UI.persona = null; G.insp = null; } else { UI.persona = d.person; G.insp = W(d.person).home; } return dibujar(); }
  if (d.tile) {
    const i = +d.tile; UI.persona = null;
    if (G.phase === 'prep' && G.sel) {
      if (ACTIONS[G.sel].valid(T(i), i)) { doAction(i); return dibujar(); }
      G.msg = t('msg.aquiNo', {accion: t('acciones.' + G.sel + '.nombre').toLowerCase()}); G.sel = null; G.insp = i; return dibujar();
    }
    G.insp = G.insp === i ? null : i; return dibujar();
  }
  if (d.close) { UI.persona = null; G.insp = null; return dibujar(); }
  if (d.doat) { G.sel = d.doat; doAction(G.insp); G.sel = null; return dibujar(); }
  if (d.perk) { top(); choosePerk(d.perk); return dibujar(); }
  if (d.ev) { top(); chooseEvent(+d.ev); return dibujar(); }
}

async function arrancar() {
  const app = document.getElementById('app');
  try { await cargarTextosWeb(); }
  catch (e) { app.textContent = 'No se han podido cargar los textos del juego. Recarga la página.'; return; }
  cargarProgreso();
  ganchos.alCambiar = dibujar;
  app.addEventListener('change', (e) => {
    if (e.target.dataset && e.target.dataset.test) { PROG.test = e.target.checked; saveProg(); dibujar(); }
  });
  app.addEventListener('click', clic);
  dibujar();
  initCaps();
}
arrancar();

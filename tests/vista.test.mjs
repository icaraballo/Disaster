// T-02 · El dibujo: cada pantalla se genera sin errores y sin textos que falten, en todas las
// fases de partidas completas. (No abre navegador: pone un documento de mentira.)
// Uso: npm test   (o node --test tests/vista.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarTextosDeDisco, ingenuo, listo } from './bots.mjs';
import { TOWNS } from '../data/pueblos.js';
import { ALCALDES } from '../data/alcaldes.js';
import { TEMPORADA } from '../data/balance.js';
import { G, setG } from '../js/estado.js';
import { newGame } from '../js/partida.js';
import { doAction } from '../js/acciones.js';
import { endTurn } from '../js/turnos.js';
import { toResult, choosePerk, chooseEvent, finish } from '../js/temporada.js';
import { render, UI } from '../js/ui/vista.js';

cargarTextosDeDisco();

const app = {_h: '', set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; }};
globalThis.document = {getElementById: () => app};

const FALTA = /\[[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)+\]/;
const MALO = /undefined|NaN|\[object/;
function dibuja(donde) {
  render();
  const h = app.innerHTML;
  assert.ok(h.length > 100, `pantalla vacía (${donde})`);
  assert.ok(!FALTA.test(h), `falta un texto (${donde}): ${(h.match(FALTA) || [])[0]}`);
  assert.ok(!MALO.test(h), `valor roto (${donde}): ${(h.match(MALO) || [])[0]}`);
  return h;
}

test('menú y selección de pueblo y alcalde', () => {
  setG(null);
  UI.screen = 'menu'; dibuja('menú');
  UI.howto = true; dibuja('menú con reglas'); UI.howto = false;
  UI.screen = 'setup'; dibuja('setup');
});

test('todas las pantallas de partidas completas, en todos los pueblos y con los dos bots', () => {
  UI.screen = 'game';
  let fases = new Set();
  for (const town of Object.keys(TOWNS)) {
    for (const alc of ALCALDES.map(a => a.id)) {
      const bot = (alc.length + town.length) % 2 ? listo(3) : ingenuo(3);
      newGame({town, alc, semilla: 21});
      let guard = 0;
      while (G.phase !== 'end' && guard++ < 600) {
        fases.add(G.phase);
        // pantalla y una casilla inspeccionada / el mapa de riesgo
        G.insp = null; G.heat = false; dibuja(`${town}/${alc}/${G.phase}`);
        G.insp = guard % 56; G.heat = true; dibuja(`${town}/${alc}/${G.phase}+ficha`);
        G.insp = null; G.heat = false;
        if (G.phase === 'forecast') { G.phase = 'prep'; continue; }
        if (G.phase === 'prep') { G.sel = 'sacos'; dibuja('prep con acción elegida'); G.sel = null; bot.preparar(); endTurn(); continue; }
        if (G.phase === 'impact') { const total = G.impact.events.length; for (G.impact.shown = 1; G.impact.shown <= total; G.impact.shown++) dibuja('impacto ' + G.impact.shown); G.impact.shown = total; toResult(); continue; }
        if (G.phase === 'result') { if (G.lost || G.idx === TEMPORADA - 1) finish(); else choosePerk(bot.mejora(G.result.offers).id); continue; }
        if (G.phase === 'event') { chooseEvent(bot.evento(G.event)); continue; }
      }
      assert.equal(G.phase, 'end'); fases.add('end');
      dibuja(`${town}/${alc}/fin`);
    }
  }
  for (const f of ['forecast', 'prep', 'impact', 'result', 'event', 'end']) assert.ok(fases.has(f), 'no se llegó a la fase ' + f);
});

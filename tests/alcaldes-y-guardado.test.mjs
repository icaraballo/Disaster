// Tests de DB-01, los 5 alcaldes (pasivas, obras exclusivas, defectos y riesgo), el guardado de partida
// en curso (todas las fases, azar RS/RI y migración/corrupción) y los controles de velocidad del impacto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarTextosDeDisco, listo, jugar } from './bots.mjs';
import { ALCALDES } from '../data/alcaldes.js';
import { SUBCONTRATA_COSTE, TESORERO_MORAL_INI } from '../data/balance.js';
import { RS, RI, mulberry32, inyectarAzar } from '../js/azar.js';
import { G, setG, T } from '../js/estado.js';
import { newGame } from '../js/partida.js';
import { ACTIONS, doAction, planObra } from '../js/acciones.js';
import { production, changeJob, endTurn } from '../js/turnos.js';
import { RESOLVE, damage, startImpact } from '../js/desastres.js';
import { riskFor, riesgoHabitual } from '../js/riesgo.js';
import { EVENTS } from '../js/mejoras.js';
import { toResult, choosePerk, chooseEvent, finish } from '../js/temporada.js';
import { RUINAS, SOLAR, TERRAPLEN, REFUGIO, familias } from '../js/casas.js';
import { CLAVE_PARTIDA, ESQUEMA_GUARDADO, guardarPartida, continuarPartida, leerResumenGuardado,
  borrarPartidaGuardada, verificarGuardadoInicial, falloGuardado, limpiarFalloGuardado } from '../js/guardado.js';
import { render, UI } from '../js/ui/vista.js';

cargarTextosDeDisco();

const RICO = {dinero: 500, madera: 60, piedra: 60, comida: 60};
function preparar(alc = 'ingeniera', semilla = 2) {
  newGame({town: 'villarrio', alc, semilla});
  Object.assign(G.res, RICO);
  G.phase = 'prep';
}
const construir = (k, i) => { G.sel = k; const ok = doAction(i); G.sel = null; return ok; };

// ---------- 1. DB-01: coste de evacuar por familia ----------
test('DB-01: evacuar cobra 1 de comida por familia al entrar (2 con 2 familias; mitad redondeada con agricultor)', () => {
  preparar('ingeniera');
  T(21).t = REFUGIO;
  const c0 = G.res.comida;
  assert.ok(construir('evacuar', 17));
  assert.equal(c0 - G.res.comida, 1, 'casa con 1 familia: 1 de comida');

  G.busy = [];
  T(18).huespedes = [99]; // 2 familias en la casa 18
  assert.equal(familias(T(18)), 2);
  assert.equal(planObra('evacuar', 18).coste.comida, 2, 'planObra enseña 2 de comida para 2 familias');
  const c1 = G.res.comida;
  assert.ok(construir('evacuar', 18));
  assert.equal(c1 - G.res.comida, 2, 'casa con 2 familias: 2 de comida al entrar');

  // Con el agricultor: 2 familias cuestan ceil(2 / 2) = 1 de comida
  preparar('agricultor');
  T(21).t = REFUGIO; T(18).huespedes = [99];
  const c2 = G.res.comida;
  assert.ok(construir('evacuar', 18));
  assert.equal(c2 - G.res.comida, 1, 'agricultor con 2 familias: 1 de comida');

  // Evento refugioLleno con 2 familias en la casa que pide entrar
  preparar('ingeniera'); G.idx = 2; T(21).t = REFUGIO;
  const r = riesgoHabitual();
  const casas = G.tiles.map((x, i) => x.t === 'C' ? i : -1).filter(i => i >= 0).sort((a, b) => r[a] - r[b]);
  casas.slice(0, 3).forEach(i => { G.busy = []; construir('evacuar', i); });
  casas.slice(3).forEach(i => { T(i).huespedes = [99]; }); // 2 familias en las casas en peligro
  T(casas[0]).huespedes = [98];                            // la casa que sale libera 2 plazas
  const ev = EVENTS.find(e => e.id === 'refugioLleno').mk();
  assert.ok(ev.opts[0].d.includes('−2 de comida'), 'el texto del evento enseña −2 de comida: ' + ev.opts[0].d);
  const antes = G.res.comida;
  ev.opts[0].a();
  assert.equal(antes - G.res.comida, 2, 'el evento cobra 2 de comida por las 2 familias');
});

// ---------- 2. Los 5 alcaldes ----------
test('acciones exclusivas: cada una sólo puede usarla su alcalde', () => {
  const exclusivas = {
    contrafuerte: 'ingeniera',
    evacuacionRapida: 'enfermera',
    granjaReforzada: 'agricultor',
    sondeo: 'meteorologa',
    subcontrata: 'tesorero',
    subcontrataTerraplen: 'tesorero'
  };
  for (const [acc, dueno] of Object.entries(exclusivas)) {
    for (const a of ALCALDES) {
      preparar(a.id);
      T(17).dmg = true; T(25).t = RUINAS; T(21).t = REFUGIO; G.fc.pReal = 60;
      const hayCasilla = G.tiles.some((x, i) => ACTIONS[acc].valid(x, i));
      assert.equal(hayCasilla, a.id === dueno, `${acc} con ${a.id}`);
    }
  }
});

test('ingeniera: contrafuerte absorbe un golpe de cualquier causa, coincide con el mapa de riesgo y reparar cuesta +1 madera', async () => {
  const { TOWNS } = await import('../data/pueblos.js');
  preparar('ingeniera');
  T(17).dmg = true;
  assert.equal(ACTIONS.reparar.cost().madera, 3, 'reparar cuesta +1 madera a la ingeniera');
  assert.equal(ACTIONS.repararRuinas.cost().madera, 5, 'repararRuinas cuesta +1 madera a la ingeniera');
  T(17).dmg = false;

  assert.ok(construir('contrafuerte', 25)); // casa 25 junto al río
  assert.ok(T(25).contra);
  G.res.riesgo = 0;
  assert.equal(riskFor(['riada'], 3)[25], 0, 'ante un solo desastre sin deslizamiento, el riesgo con contrafuerte es 0');

  // Golpe real: el contrafuerte lo para y se gasta
  const pop = G.res.pop, moral = G.res.moral;
  damage(25, 'rayo', {dmg: 0});
  assert.ok(!T(25).dmg && !T(25).contra, 'absorbe el rayo y se consume');
  assert.equal(G.res.pop, pop); assert.equal(G.res.moral, moral);

  // Monte Carlo con desastre doble (riada + tormenta, peligro 1.2 para que rayos < edificios): el riesgo coincide con recibir los 2 golpes
  const pg = TOWNS.villarrio.peligro; TOWNS.villarrio.peligro = 1.2;
  T(25).contra = true; G.res.riesgo = 0;
  const previsto = riskFor(['riada', 'tormenta'], 2)[25];
  const foto = JSON.stringify(G.tiles);
  let danos = 0; const M = 2500;
  for (let s = 0; s < M; s++) {
    G.tiles = JSON.parse(foto);
    inyectarAzar(mulberry32(7), mulberry32(5000 + s));
    const ctx = {dmg: 0, dry: false};
    RESOLVE.riada(2, [], ctx);
    RESOLVE.tormenta(2, [], ctx);
    if (T(25).dmg) danos++;
  }
  TOWNS.villarrio.peligro = pg;
  assert.ok(previsto > 0.05, 'con dos amenazas simultáneas sí hay riesgo');
  assert.ok(Math.abs(danos / M - previsto) < 0.03, `riesgo ${previsto.toFixed(3)} frente a ${(danos / M).toFixed(3)} real`);
});

test('enfermera: refugio de 4 plazas más barato, evacuacionRapida sin gastar persona y cura heridos de la casa', () => {
  preparar('enfermera');
  assert.deepEqual(ACTIONS.refugio.cost(), {madera: 3, piedra: 1});
  assert.equal(ACTIONS.dique.cost().piedra, 4, 'defecto: dique +1 piedra');
  assert.ok(construir('refugio', 21));
  G.busy = [];
  const vecino = G.workers[0]; vecino.home = 17; vecino.inj = 1;
  assert.ok(construir('evacuacionRapida', 17));
  assert.equal(G.busy.length, 0, 'evacuacionRapida no gasta trabajadores');
  assert.ok(T(17).evac, 'la familia entra en el refugio');
  assert.equal(vecino.inj, 0, 'atiende al vecino herido de esa casa');
});

test('agricultor: talar da −1 madera y granjaReforzada da +2 comida y protege en sequía y plaga', () => {
  preparar('agricultor');
  const peon = G.workers.find(w => w.of === 'peon');
  G.alloc.talar = [peon.id];
  assert.equal(production().madera, 1, 'defecto: talar da 1 de madera de base');
  G.alloc.talar = [];

  G.alloc.granja = [peon.id];
  const antes = production().comida;
  const idxG = G.tiles.findIndex(x => x.t === 'G');
  assert.ok(construir('granjaReforzada', idxG));
  assert.equal(production().comida, antes + 2, '+2 comida por granja reforzada');

  inyectarAzar(mulberry32(1), () => 0.99);
  RESOLVE.sequia(2, [], {dmg: 0});
  assert.equal(G.dryFarm, false, 'la granja reforzada evita que los campos queden secos');
});

test('meteorologa: sondeo confirma el 100 % sin tocar el azar del reto diario', () => {
  const correr = (conSondeo) => {
    newGame({daily: '2026-11-26'});
    // Forzamos meteoróloga manteniendo la semilla del reto para comprobar que RS/RI no cambian
    G.alc = 'meteorologa'; Object.assign(G.res, RICO); G.phase = 'prep'; G.fc.pReal = 60;
    if (conSondeo) {
      assert.ok(construir('sondeo', G.tiles.findIndex(x => x.t === 'A')));
      assert.equal(G.fc.pReal, 100);
      assert.ok(!construir('sondeo', G.tiles.findIndex(x => x.t === 'A')), 'sólo una vez por desastre');
    }
    return {rs: RS(), ri: RI()};
  };
  assert.deepEqual(correr(true), correr(false), 'hacer un sondeo no altera RS ni RI');
});

test('tesorero: moral inicial 62, recaudar baja el doble y subcontrata repara/reconstruye/hace terraplén con 0 personas', () => {
  newGame({town: 'villarrio', alc: 'tesorero', semilla: 4});
  assert.equal(G.res.moral, TESORERO_MORAL_INI);
  Object.assign(G.res, RICO); G.phase = 'prep';
  const peon = G.workers.find(w => w.of === 'peon');
  G.alloc.recaudar = [peon.id];
  assert.equal(production().moral, -4, 'defecto: recaudar baja 4 de moral');
  G.alloc.recaudar = [];

  T(17).dmg = true; T(25).t = RUINAS; T(31).t = SOLAR;
  let d0 = G.res.dinero;
  assert.ok(construir('subcontrata', 17));
  assert.ok(!T(17).dmg); assert.equal(d0 - G.res.dinero, SUBCONTRATA_COSTE.reparar); assert.equal(G.busy.length, 0);

  d0 = G.res.dinero;
  assert.ok(construir('subcontrataTerraplen', 25));
  assert.equal(T(25).t, TERRAPLEN); assert.equal(d0 - G.res.dinero, SUBCONTRATA_COSTE.terraplen);

  d0 = G.res.dinero;
  assert.ok(construir('subcontrata', 31));
  assert.equal(T(31).t, 'C'); assert.equal(d0 - G.res.dinero, SUBCONTRATA_COSTE.solar);
});

// ---------- 3. Guardado de partida en curso ----------
function instalarStorage() {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); },
    removeItem: (k) => { mem.delete(k); }
  };
  return mem;
}

test('guardado: guardar y continuar en cualquier fase da exactamente el mismo resultado que jugar del tirón', () => {
  instalarStorage();
  // Partida de referencia sin interrupción
  const ref = jugar({town: 'arrieta', alc: 'meteorologa', semilla: 42}, listo(42));

  // La misma partida guardando, borrando memoria y recargando en TODAS las fases (forecast, prep, impact, result, event)
  const bot = listo(42);
  newGame({town: 'arrieta', alc: 'meteorologa', semilla: 42});
  let vistas = new Set(), guard = 0;
  while (G.phase !== 'end' && guard++ < 600) {
    vistas.add(G.phase);
    assert.ok(guardarPartida(), `fallo al guardar en ${G.phase}`);
    const res = leerResumenGuardado();
    assert.ok(res && res.town === 'arrieta' && res.alc === 'meteorologa');
    setG(null);
    assert.ok(continuarPartida(), `fallo al continuar en ${res.phase}`);

    if (G.phase === 'forecast') { G.phase = 'prep'; G.msg = ''; }
    else if (G.phase === 'prep') { bot.preparar(); endTurn(); }
    else if (G.phase === 'impact') toResult();
    else if (G.phase === 'result') {
      if (G.lost || G.idx === 7) finish();
      else choosePerk(bot.mejora(G.result.offers).id);
    }
    else if (G.phase === 'event') chooseEvent(bot.evento(G.event));
  }
  assert.equal(leerResumenGuardado(), null, 'al terminar la temporada se borra la partida guardada');
  for (const f of ['forecast', 'prep', 'impact', 'result', 'event']) assert.ok(vistas.has(f), 'se probó guardar en ' + f);
  assert.equal(!G.lost, ref.ganada);
  assert.equal(G.final, ref.puntos, 'la puntuación final coincide al punto tras guardar/cargar en cada paso');
  assert.equal(G.res.pop, ref.vecinos);
  delete globalThis.localStorage;
});

test('guardado: detecta archivos dañados o de versión incompatible y avisa en el menú sin mutar al pintar', () => {
  const mem = instalarStorage();
  const app = {_h: '', set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; }};
  globalThis.document = {getElementById: () => app};

  mem.set(CLAVE_PARTIDA, JSON.stringify({v: ESQUEMA_GUARDADO + 5, G: {}}));
  verificarGuardadoInicial();
  assert.equal(falloGuardado, 'incompatible');
  assert.equal(mem.has(CLAVE_PARTIDA), false, 'limpia el guardado incompatible');
  setG(null); UI.screen = 'menu'; render();
  assert.ok(app.innerHTML.includes('otra versión'), 'el menú muestra el aviso al jugador');
  limpiarFalloGuardado();
  delete globalThis.localStorage;
});

// ---------- 4. Velocidad y saltar en el impacto ----------
test('impacto: muestra controles ×1, ×2 y Saltar mientras avanza, y los oculta al terminar', () => {
  const app = {_h: '', set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; }};
  globalThis.document = {getElementById: () => app};
  newGame({town: 'villarrio', alc: 'ingeniera', semilla: 5});
  startImpact();
  UI.screen = 'game'; UI.velImpacto = 2;
  G.impact.shown = 1;
  render();
  assert.ok(app.innerHTML.includes('data-speed="1"') && app.innerHTML.includes('data-speed="2"') && app.innerHTML.includes('data-skip="1"'));
  G.impact.shown = G.impact.events.length;
  render();
  assert.ok(!app.innerHTML.includes('data-skip="1"'), 'al terminar el impacto ya no salen los botones de saltar');
  setG(null);
});

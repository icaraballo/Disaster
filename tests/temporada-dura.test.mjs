// T-12 · Temporada dura: la escalera de la casa, la acogida, la moral que pesa, el agua que atraviesa
// ruinas y solares, la previsión que se afina y las medallas. (El equilibrio está en equilibrio.test.mjs.)
//
// Mapa de Villarrío (índice = fila * 7 + columna), para seguir los casos del agua:
//   fila 2: B L P C C P R   (14-20)      casas 17 y 18, río 20
//   fila 3: P P C A C R R   (21-27)      casa 23, ayuntamiento 24, casa 25, río 26 y 27
//   fila 4: P C C C R R P   (28-34)      casas 29-31, río 32 y 33
// El agua del tramo 26 entra en la casa 25 yendo hacia el oeste: «detrás» de 25 está el ayuntamiento (24).
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarTextosDeDisco } from './bots.mjs';
import { TOWNS } from '../data/pueblos.js';
import { VECINOS_CASA_DANADA, VECINOS_FAMILIA_SE_VA, VECINOS_EVACUADA, MORAL_RUINAS, MORAL_SIN_REPARAR,
  MEDALLA_PLATA, MEDALLA_ORO, TEMPORADA } from '../data/balance.js';
import { mulberry32, inyectarAzar, RS } from '../js/azar.js';
import { G, T, peligro } from '../js/estado.js';
import { newGame, newForecast } from '../js/partida.js';
import { doAction } from '../js/acciones.js';
import { endTurn } from '../js/turnos.js';
import { RESOLVE, startImpact, damage, detras } from '../js/desastres.js';
import { riskFor } from '../js/riesgo.js';
import { familias, elegirAcogida, fotoInicio, finDeImpacto, RUINAS, SOLAR, TERRAPLEN } from '../js/casas.js';
import { medalla } from '../js/temporada.js';
import { mergeProg } from '../js/progreso.js';
import { t } from '../js/i18n.js';

cargarTextosDeDisco();

const RICO = {dinero: 500, madera: 60, piedra: 60, comida: 60};
const constante = (v) => () => v;
// Una partida de Villarrío con los recursos de sobra y el azar de los impactos fijo.
function nueva({ri = 0.99, town = 'villarrio', semilla = 1} = {}) {
  newGame({town, alc: 'ingeniera', semilla});
  Object.assign(G.res, RICO);
  inyectarAzar(mulberry32(semilla), typeof ri === 'function' ? ri : constante(ri));
  G.phase = 'prep';
}
// Un impacto que no daña ninguna casilla (plaga) y sin deslizamientos (RI alto): sólo pasa lo de fin de impacto.
function impactoTranquilo() {
  G.fc.real = ['plaga']; G.fc.I = 1;
  startImpact();
  return G.impact.events.map(e => e.text);
}
const ctx = () => ({dmg: 0});
const textos = (ev) => ev.map(e => e.text).join(' | ');
const construir = (k, i) => { G.sel = k; const ok = doAction(i); G.sel = null; return ok; };

// ---------- 1. escalera ----------
test('escalera: sana → dañada → ruinas (tras un desastre sin reparar) → solar', () => {
  nueva();
  damage(17, 'rayo', ctx());
  assert.equal(T(17).t, 'C'); assert.ok(T(17).dmg, 'golpeada queda dañada');
  impactoTranquilo();
  assert.equal(T(17).t, RUINAS, 'un desastre sin reparar: ruinas');
  impactoTranquilo();
  assert.equal(T(17).t, SOLAR, 'otro desastre: solar');
});

test('escalera: dañada y golpeada otra vez pasa a ruinas una sola vez', () => {
  nueva();
  damage(17, 'rayo', ctx()); damage(17, 'rayo', ctx());
  assert.equal(T(17).t, RUINAS, 'sana golpeada dos veces en el mismo impacto: ruinas');
  // dañada al empezar el impacto y golpeada durante él: ruinas, y «sigue dañada» no la sube a solar
  nueva();
  T(17).dmg = true;
  const inicio = fotoInicio();
  damage(17, 'rayo', ctx());
  assert.equal(T(17).t, RUINAS);
  finDeImpacto(inicio, [], MORAL_SIN_REPARAR);
  assert.equal(T(17).t, RUINAS, 'un solo escalón');
});

test('reparar ruinas devuelve a la familia; reconstruir el solar deja la casa vacía', () => {
  nueva();
  T(17).dmg = true; impactoTranquilo();
  const acogida = T(17).acogidaEn;
  assert.ok(acogida != null && T(acogida).huespedes.includes(17), 'la familia vive en la casa de acogida');
  G.phase = 'prep'; G.turn = 1; G.busy = [];
  assert.ok(construir('repararRuinas', 17));
  assert.equal(T(17).t, 'C'); assert.ok(T(17).propia, 'la familia vuelve a casa');
  assert.ok(!T(acogida).huespedes.includes(17), 'la casa de acogida queda libre');
  T(18).t = SOLAR; G.busy = [];
  assert.ok(construir('reconstruir', 18));
  assert.equal(T(18).t, 'C'); assert.equal(familias(T(18)), 0, 'la casa reconstruida está vacía');
});

// ---------- 2. acogida ----------
test('acogida: primero una casa vacía, si no la más cercana con una familia; como mucho 2', () => {
  nueva();
  T(31).propia = false;                            // una casa vacía (como una reconstruida)
  assert.equal(elegirAcogida(17), 31, 'elige la casa vacía aunque esté más lejos');
  T(31).propia = true;
  assert.equal(elegirAcogida(17), 18, 'si no, la más cercana');
  T(18).huespedes = [99];                          // 18 ya tiene 2 familias
  assert.equal(elegirAcogida(17), 23, 'la siguiente más cercana (empate: la de índice menor)');
  G.tiles.forEach((x, i) => { if (x.t === 'C' && i !== 17) x.huespedes = [99]; });
  assert.equal(elegirAcogida(17), null, 'sin sitio en ninguna casa');
});

test('acogida: sin sitio la familia se va (−5); en solar la familia acogida se va (−5)', () => {
  nueva();
  G.tiles.forEach((x, i) => { if (x.t === 'C' && i !== 17) x.huespedes = [99]; });
  T(17).dmg = true;
  let pop = G.res.pop; impactoTranquilo();
  assert.equal(G.res.pop, pop - VECINOS_FAMILIA_SE_VA);
  nueva();
  T(17).dmg = true; impactoTranquilo();
  pop = G.res.pop; impactoTranquilo();
  assert.equal(T(17).t, SOLAR);
  assert.equal(G.res.pop, pop - VECINOS_FAMILIA_SE_VA, 'la familia se cansa de esperar');
});

test('acogida: el golpe doble y la evacuación', () => {
  nueva();
  T(17).dmg = true; impactoTranquilo();
  const h = T(17).acogidaEn; let pop = G.res.pop;
  const ev = damage(h, 'rayo', ctx());
  // T-12 §B.4 lo daba como −2 −5 = −7 con los números de partida; con los de la v4 es −4 −5.
  assert.equal(G.res.pop, pop - VECINOS_CASA_DANADA - VECINOS_FAMILIA_SE_VA, textos(ev));
  assert.equal(familias(T(h)), 1, 'la familia acogida se ha ido');
  assert.equal(T(17).acogidaEn, null);
  nueva();
  T(17).dmg = true; impactoTranquilo();
  const h2 = T(17).acogidaEn; T(h2).evac = true; pop = G.res.pop; G.res.heridos = 0;
  damage(h2, 'rayo', ctx());
  assert.equal(G.res.pop, pop - VECINOS_EVACUADA, 'evacuada: sólo se pierde lo de la evacuación');
  assert.equal(G.res.heridos, 0, 'evacuada: nadie herido');
  assert.equal(familias(T(h2)), 2, 'la familia acogida no se va');
});

// ---------- 3. moral por desastre ----------
test('moral: −2 por familia en casa sin reparar y −1 por otro edificio, sólo si ya estaban dañados', () => {
  nueva(); impactoTranquilo(); const control = G.res.moral;
  nueva(); T(17).dmg = true; T(41).dmg = true; impactoTranquilo();
  assert.equal(G.res.moral, control - MORAL_SIN_REPARAR.porFamilia - MORAL_SIN_REPARAR.otroEdificio - MORAL_RUINAS);
  nueva({ri: 0}); G.fc.real = ['riada']; G.fc.I = 3; startImpact();
  assert.ok(G.tiles.some(x => x.dmg), 'el impacto ha dañado algo');
  assert.ok(!G.impact.events.some(e => e.text.startsWith(t('log.sinReparar', {n: 1}).split(':')[0])), 'lo dañado en este impacto no paga todavía');
});

test('moral: personas desanimadas con 50 y con 30', () => {
  for (const [moral, n] of [[50, 0], [49, 1], [30, 1], [29, 2], [5, 2]]) {
    nueva(); G.res.moral = moral; newForecast();
    assert.equal(G.desanimados.length, n, `moral ${moral}`);
  }
});

// ---------- 4. agua ----------
test('agua: las ruinas y el solar la pasan a la casilla de detrás, también en cadena', () => {
  // I = 3: el tramo 26 inunda con p ≈ 0,55; con RI = 0,4 entra y las ruinas la dejan pasar (0,4 < 0,5).
  nueva({ri: 0.4}); T(25).t = RUINAS; T(24).t = SOLAR;
  const ev = []; RESOLVE.riada(3, ev, ctx());
  assert.ok(T(23).dmg, 'el agua atraviesa ruinas y solar y llega a la casa 23: ' + textos(ev));
  nueva({ri: 0.52}); T(25).t = RUINAS;
  RESOLVE.riada(3, [], ctx());
  assert.ok(!T(24).dmg, 'con 0,52 entra en las ruinas pero no pasa (50 %)');
  nueva({ri: 0.52}); T(25).t = SOLAR;
  RESOLVE.riada(3, [], ctx());
  assert.ok(T(24).dmg, 'el solar la deja pasar siempre');
});

test('agua: el terraplén la frena y empuja el 30 % río abajo (en el mar, nada)', () => {
  nueva({ri: 0}); T(25).t = TERRAPLEN;
  const ev = []; RESOLVE.riada(3, ev, ctx());
  assert.ok(!T(24).dmg, 'detrás del terraplén no llega');
  assert.ok(!ev.some(e => (e.tiles || []).some(([i, k]) => i === 25 && k === 'flood')), 'el terraplén no se inunda');
  nueva(); T(25).t = 'P'; const sin = riskFor(['riada'], 3);
  T(25).t = TERRAPLEN; const con = riskFor(['riada'], 3);
  const suma = (a) => a.reduce((s, v) => s + v, 0);
  assert.ok(suma(con) > suma(sin), 'río abajo hay más riesgo con el terraplén');
  // en el mar no empuja: Arrieta, un prado junto al mar convertido en terraplén
  nueva({town: 'arrieta'});
  const junto = G.tiles.findIndex((x, i) => x.t === 'P' && [i - 7, i + 7, i - 1, i + 1].some(j => G.tiles[j] && G.tiles[j].t === 'M'));
  const a = riskFor(['temporal'], 3); T(junto).t = TERRAPLEN; const b = riskFor(['temporal'], 3);
  a.forEach((v, i) => { if (i !== junto) assert.ok(Math.abs(v - b[i]) < 1e-12, `casilla ${i}`); });
});

test('agua: los sacos tapan el agujero y se gastan; no cruza los bordes del mapa', () => {
  nueva({ri: 0}); T(25).t = RUINAS; T(25).sacos = true;
  const ev = []; RESOLVE.riada(3, ev, ctx());
  assert.ok(!T(24).dmg, 'los sacos tapan el agujero');
  assert.equal(T(25).sacos, false, 'y se gastan');
  nueva();
  assert.equal(detras(1, 0), null, 'por la izquierda');
  assert.equal(detras(8, 7), null, 'sin saltar de fila');
  assert.equal(detras(13, 6), null, 'por arriba');
  assert.equal(detras(26, 25), 24, 'el caso normal: del tramo 26 a la casa 25, detrás está el ayuntamiento');
  // si detrás hay río o mar, no cuenta (en Arrieta hay casas entre el río y el mar)
  nueva({town: 'arrieta'});
  let casos = 0;
  G.tiles.forEach((x, s0) => { if (x.t !== 'R' && x.t !== 'M') return; [s0 - 7, s0 + 7, s0 - 1, s0 + 1].forEach(n => {
    if (!G.tiles[n] || ['R', 'M'].includes(G.tiles[n].t)) return;
    const j = n + (n - s0);
    if (G.tiles[j] && ['R', 'M'].includes(G.tiles[j].t) && Math.abs((j % 7) - (n % 7)) <= 1) { casos++; assert.equal(detras(s0, n), null); }
  }); });
  assert.ok(casos > 0, 'hay casos de agua detrás en Arrieta');
});

// ---------- 5. no son edificios ----------
test('ruinas, solar y terraplén no reciben rayos ni deslizamientos, y arden como un prado', () => {
  nueva({ri: Math.random});
  G.tiles.forEach((x, i) => { if (x.t === 'C') x.t = [RUINAS, SOLAR, TERRAPLEN][i % 3]; });
  const raros = new Set(G.tiles.map((x, i) => [RUINAS, SOLAR, TERRAPLEN].includes(x.t) ? i : -1).filter(i => i >= 0));
  for (let k = 0; k < 50; k++) {
    const ev = []; RESOLVE.tormenta(3, ev, ctx());
    ev.forEach(e => (e.tiles || []).forEach(([i, kk]) => assert.ok(!(raros.has(i) && kk === 'bolt'), 'un rayo en ruinas o solar')));
  }
  nueva({ri: 0});
  G.tiles.forEach((x, i) => { if (x.t === 'C') x.t = RUINAS; });
  G.res.riesgo = 95; G.fc.real = ['riada']; G.fc.I = 3;
  const antes = G.tiles.map(x => x.t);
  startImpact();
  G.tiles.forEach((x, i) => { if (antes[i] === RUINAS) assert.ok(x.t === RUINAS || x.t === SOLAR, 'ni se dañan ni dejan de ser ruinas'); });
  // incendio: arden (se ven en llamas) pero no se dañan
  nueva({ri: 0}); T(17).t = RUINAS;
  const ev = []; RESOLVE.incendio(3, ev, ctx());
  assert.ok(ev.some(e => (e.tiles || []).some(([i, k]) => i === 17 && k === 'fire')), 'las ruinas arden');
  assert.equal(T(17).t, RUINAS); assert.ok(!T(17).dmg);
});

// ---------- 6. mapa de riesgo y desastre coinciden ----------
test('el mapa de riesgo coincide con el desastre detrás de ruinas y solares', () => {
  for (const tipo of [RUINAS, SOLAR]) {
    nueva(); T(25).t = tipo;
    G.res.riesgo = 0;   // el ayuntamiento está bajo la ladera: sin esto el riesgo sumaría el deslizamiento
    const previsto = riskFor(['riada'], 2)[24];
    const foto = JSON.stringify(G.tiles);
    let n = 0; const N = 3000;
    for (let s = 0; s < N; s++) {
      G.tiles = JSON.parse(foto);
      inyectarAzar(mulberry32(5), mulberry32(1000 + s));
      RESOLVE.riada(2, [], ctx());
      if (T(24).dmg) n++;
    }
    assert.ok(previsto > 0, 'hay riesgo detrás');
    assert.ok(Math.abs(n / N - previsto) < 0.03, `${tipo}: riesgo ${previsto.toFixed(3)} frente a ${(n / N).toFixed(3)} de verdad`);
  }
});

// ---------- 7. previsión ----------
test('previsión: nunca baja de un turno a otro; con 2 turnos se ven los turnos 2 y 3', () => {
  for (let s = 1; s <= 40; s++) {
    newGame({town: 'villarrio', alc: 'ingeniera', semilla: s}); G.phase = 'prep';
    while (G.phase === 'prep') { const h = G.fc.hist.slice(); endTurn(); if (G.phase === 'prep') assert.ok(G.fc.pReal >= h[h.length - 1]); }
    assert.equal(G.fc.hist.length, 3);
  }
  newGame({town: 'villarrio', alc: 'ingeniera', semilla: 3}); G.lostTurn = 1; newForecast();
  assert.equal(G.maxTurns, 2); assert.equal(G.fc.tramo, 2, 'el primer turno es el 2.º de la tabla');
  G.phase = 'prep'; endTurn(); assert.equal(G.fc.tramo, 3);
});

test('previsión: construir el observatorio en el turno 1 sube la precisión de los turnos siguientes', () => {
  nueva({ri: Math.random});
  assert.equal(G.fc.lvl, 1);
  assert.ok(construir('observatorio', G.tiles.findIndex(x => x.t === 'P')));
  assert.equal(G.fc.lvl, 1, 'en este turno no cambia');
  endTurn();
  assert.equal(G.fc.lvl, 2, 'en el siguiente, sí');
});

test('reto diario: con o sin observatorio, mismo calendario, mismos señuelos y el mismo azar', () => {
  const jugar = (conObs) => {
    newGame({daily: '2026-11-21'}); Object.assign(G.res, RICO); G.phase = 'prep';
    const cal = JSON.stringify(G.schedule);
    if (conObs) construir('observatorio', G.tiles.findIndex(x => x.t === 'P'));
    endTurn(); endTurn(); endTurn();               // tres turnos y llega el impacto
    return {cal, decoy: JSON.stringify(G.fc.decoy), lvl: G.fc.lvl, siguiente: RS()};
  };
  const a = jugar(true), b = jugar(false);
  assert.equal(a.cal, b.cal); assert.equal(a.decoy, b.decoy);
  assert.notEqual(a.lvl, b.lvl, 'el observatorio sí cambia la precisión');
  assert.equal(a.siguiente, b.siguiente, 'el azar del calendario se ha consumido igual');
});

// ---------- 8. escalada ----------
test('escalada: intensidades 1-1-2-2-2-3-3-3 y el último desastre siempre doble', () => {
  for (const town of Object.keys(TOWNS)) for (let s = 1; s <= 20; s++) {
    newGame({town, alc: 'ingeniera', semilla: s});
    assert.deepEqual(G.schedule.map(d => d.I), [1, 1, 2, 2, 2, 3, 3, 3]);
    assert.equal(G.schedule[TEMPORADA - 1].types.length, 2);
    assert.ok(peligro() >= 1);
  }
});

// ---------- 9. medallas ----------
test('medallas: umbrales y la mejor por pueblo', () => {
  nueva();
  const con = (pop, moral, ruinas) => { G.lost = null; G.res.pop = pop; G.res.moral = moral; T(17).t = ruinas ? RUINAS : 'C'; return medalla(); };
  assert.equal(con(MEDALLA_PLATA.vecinos - 1, 90, false), 'bronce');
  assert.equal(con(MEDALLA_PLATA.vecinos, MEDALLA_PLATA.moral, false), 'plata');
  assert.equal(con(MEDALLA_ORO.vecinos, MEDALLA_ORO.moral, false), 'oro');
  assert.equal(con(MEDALLA_ORO.vecinos, MEDALLA_ORO.moral, true), 'plata', 'con ruinas no hay oro');
  G.lost = 'perdida'; assert.equal(medalla(), null);
  const m = mergeProg({medallas: {villarrio: 'plata', arrieta: 'oro'}}, {medallas: {villarrio: 'oro', arrieta: 'bronce', errekalde: 'bronce'}});
  assert.deepEqual(m.medallas, {villarrio: 'oro', arrieta: 'oro', errekalde: 'bronce'});
});

// T-15 · Temas (pieles) y altura del panel: los datos están completos, cada tema tiene su bloque de
// estilos, los desbloqueos funcionan (y «Desbloquear todo» los abre) y las pantallas se dibujan.
// Uso: npm test   (o node --test tests/temas.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarTextosDeDisco, listo, jugar } from './bots.mjs';
import { TEMAS, TEMA_POR_DEFECTO, TEMA_OSCURO } from '../data/temas.js';
import { ALCALDES } from '../data/alcaldes.js';
import { TOWNS } from '../data/pueblos.js';
import { COLOR_SUELO, COLOR_AGUA, PALETA, AMBIENTE } from '../data/escena3d.js';
import { t } from '../js/i18n.js';
import { G, setG } from '../js/estado.js';
import { newGame } from '../js/partida.js';
import { finish } from '../js/temporada.js';
import { PROG, setProg, defaultProg, cumple, mergeProg, unlockedTema } from '../js/progreso.js';
import { AJUSTES, aplicarEscena, temaVisible } from '../js/ui/temas.js';
import { render, UI } from '../js/ui/vista.js';

cargarTextosDeDisco();
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(RAIZ, 'css', 'estilos.css'), 'utf8');
const app = {_h: '', set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; }};
globalThis.document = {getElementById: () => app};
const FALTA = /\[[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)+\]/, MALO = /undefined|NaN|\[object/;

test('los temas están completos: textos, estilos, muestra y colores del 3D válidos', () => {
  const ids = TEMAS.map(m => m.id);
  assert.equal(new Set(ids).size, ids.length, 'dos temas con el mismo id');
  assert.ok(ids.includes(TEMA_POR_DEFECTO) && ids.includes(TEMA_OSCURO));
  assert.equal(TEMAS.filter(m => m.principal).length, 4, 'cuatro principales: papel, diorama, mesa y noche');
  assert.ok(TEMAS.find(m => m.id === TEMA_OSCURO).oscuro && TEMAS.find(m => m.id === TEMA_OSCURO).principal);
  for (const m of TEMAS) {
    for (const k of ['nombre', 'desc']) assert.ok(t('temas.' + m.id + '.' + k) && !FALTA.test(t('temas.' + m.id + '.' + k)), `falta temas.${m.id}.${k}`);
    if (!m.principal) {
      assert.ok(m.unlock, `${m.id} no es principal y no dice cómo se desbloquea`);
      assert.ok(t('temas.' + m.id + '.desbloqueo').length > 5, `falta el texto de desbloqueo de ${m.id}`);
      assert.notEqual(cumple(m.unlock, {...defaultProg(), winsAlc: {}}), true, `${m.id} sale desbloqueado de inicio`);
    }
    if (m.id !== TEMA_POR_DEFECTO) assert.ok(css.includes('body[data-tema="' + m.id + '"]'), `falta el bloque de estilos de ${m.id}`);
    assert.equal(m.muestra.length, 3);
    m.muestra.forEach(c => assert.match(c, /^#[0-9A-Fa-f]{6}$/));
    assert.ok(m.fuentes && m.fuentes.startsWith('family='), `${m.id} sin fuentes`);
    const e = m.escena;
    for (const k of Object.keys(e.suelo || {})) assert.ok(k in COLOR_SUELO, `${m.id}: casilla ${k} desconocida`);
    for (const k of Object.keys(e.agua || {})) assert.ok(k in COLOR_AGUA, `${m.id}: agua ${k} desconocida`);
    for (const k of Object.keys(e.paleta || {})) assert.ok(k in PALETA, `${m.id}: pieza ${k} desconocida`);
    if (e.paleta) for (const k of ['hojas', 'tejados']) if (e.paleta[k]) assert.equal(e.paleta[k].length, PALETA[k].length);
    if (e.prep) for (const k of ['fondo', 'niebla', 'sol', 'amb']) assert.ok(k in e.prep, `${m.id}: al ambiente le falta ${k}`);
  }
});

test('cada alcalde desbloquea un tema distinto, y Errekalde y el oro del reto, otro cada uno', () => {
  const por = (f) => TEMAS.filter(m => m.unlock && f(m.unlock));
  for (const a of ALCALDES) assert.equal(por(u => u.tipo === 'victoriasAlcalde' && u.alcalde === a.id).length, 1, `el alcalde ${a.id} no desbloquea un tema`);
  assert.equal(por(u => u.tipo === 'victorias' && u.pueblo === 'errekalde').length, 1);
  assert.ok(TOWNS.errekalde);
  assert.equal(por(u => u.tipo === 'retoOro').length, 1);
});

test('ganar apunta la victoria del alcalde (y el oro del reto) y avisa del tema desbloqueado', () => {
  setProg(defaultProg());
  // una temporada ganada con la ingeniera desbloquea Protocolo
  let ganada = null;
  for (let s = 1; s < 40 && !ganada; s++) { const r = jugar({town: 'villarrio', alc: 'ingeniera', semilla: s}, listo(s)); if (r.ganada) ganada = r; }
  assert.ok(ganada, 'el bot listo debería ganar alguna en Villarrío');
  assert.ok((PROG.winsAlc.ingeniera || 0) >= 1);
  assert.ok(unlockedTema('protocolo'));
  assert.ok(!unlockedTema('cuaderno'));
  // el oro de un reto diario
  const p = defaultProg(); setProg(p);
  newGame({daily: '2026-11-27'}); G.lost = null; G.idx = 7; G.res.pop = 99; G.res.moral = 100; G.tiles.forEach(x => { if (x.t === 'U' || x.t === 'V') x.t = 'P'; });
  finish();
  assert.equal(G.medalla, 'oro');
  assert.equal(PROG.retoOro, 1);
  assert.ok(unlockedTema('nordico'));
  assert.ok(G.unlocked.some(x => x.includes(t('temas.nordico.nombre'))), 'el final de temporada dice qué tema se ha desbloqueado');
  // juntar el progreso de dos sitios no pierde ni las victorias por alcalde ni el oro
  const m = mergeProg({winsAlc: {ingeniera: 2}, retoOro: 0}, {winsAlc: {ingeniera: 1, tesorero: 1}, retoOro: 3});
  assert.deepEqual(m.winsAlc, {ingeniera: 2, tesorero: 1}); assert.equal(m.retoOro, 3);
  setG(null); setProg(defaultProg());
});

test('«Desbloquear todo» (modo prueba) abre todos los temas; uno bloqueado no se ve aunque esté elegido', () => {
  setProg(defaultProg());
  assert.ok(TEMAS.filter(m => !m.principal).every(m => !unlockedTema(m.id)));
  AJUSTES.tema = 'comic'; AJUSTES.nocheAuto = false;
  assert.equal(temaVisible(), TEMA_POR_DEFECTO, 'un tema bloqueado no se aplica');
  PROG.test = true;
  assert.ok(TEMAS.every(m => unlockedTema(m.id)));
  assert.equal(temaVisible(), 'comic');
  AJUSTES.tema = TEMA_POR_DEFECTO; setProg(defaultProg());
});

test('aplicar un tema cambia los colores del 3D y volver al de siempre los deja como estaban', () => {
  const antes = JSON.stringify({s: COLOR_SUELO, a: COLOR_AGUA, p: PALETA, prep: AMBIENTE.prep});
  aplicarEscena('boletin');
  assert.equal(PALETA.tierra, TEMAS.find(m => m.id === 'boletin').escena.paleta.tierra);
  assert.notEqual(JSON.stringify({s: COLOR_SUELO, a: COLOR_AGUA, p: PALETA, prep: AMBIENTE.prep}), antes);
  aplicarEscena('nordico'); aplicarEscena(TEMA_POR_DEFECTO);
  assert.equal(JSON.stringify({s: COLOR_SUELO, a: COLOR_AGUA, p: PALETA, prep: AMBIENTE.prep}), antes);
  assert.ok(AMBIENTE.riada.fondo !== AMBIENTE.prep.fondo, 'los ambientes de los desastres no los toca el tema');
});

test('pantallas: menú con «Aspecto», la lista de temas y el panel en sus tres alturas', () => {
  const dibuja = (donde) => { render(); const h = app.innerHTML; assert.ok(!FALTA.test(h), `falta un texto (${donde}): ${(h.match(FALTA) || [])[0]}`); assert.ok(!MALO.test(h), `valor roto (${donde})`); return h; };
  setG(null); setProg(defaultProg());
  UI.screen = 'menu'; assert.ok(dibuja('menú').includes('data-go="aspecto"'));
  UI.screen = 'aspecto'; let h = dibuja('aspecto');
  for (const m of TEMAS) assert.ok(h.includes(t('temas.' + m.id + '.nombre')), `falta ${m.id} en Aspecto`);
  assert.equal((h.match(/data-tema="/g) || []).length, TEMAS.filter(m => m.principal).length, 'sólo se pueden elegir los desbloqueados');
  PROG.test = true; h = dibuja('aspecto con todo');
  assert.equal((h.match(/data-tema="/g) || []).length, TEMAS.length);
  PROG.test = false;
  newGame({town: 'villarrio', alc: 'ingeniera', semilla: 4}); G.phase = 'prep'; UI.screen = 'game';
  for (const alt of ['plegado', 'normal', 'grande']) {
    AJUSTES.panel = alt; h = dibuja('panel ' + alt);
    assert.ok(h.includes('class="shell p-' + alt), `el panel no queda ${alt}`);
    assert.ok(h.includes('data-panel="1"') && h.includes('data-tab="obras"') && h.includes('data-go="endturn"'), 'tirador, pestañas y botón siempre a mano');
  }
  // fuera de la preparación, el plegado se ve como normal (hay que poder elegir y leer)
  AJUSTES.panel = 'plegado'; G.phase = 'forecast'; h = dibuja('aviso plegado');
  assert.ok(h.includes('class="shell p-normal'));
  AJUSTES.panel = 'normal'; setG(null); UI.screen = 'menu';
});

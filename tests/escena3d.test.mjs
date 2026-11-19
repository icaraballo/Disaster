// T-10 · El mapa en 3D: los datos están completos y el dibujo no puede tocar el azar ni las reglas del juego.
// (No abre navegador: lo gráfico se comprueba a mano y con capturas; aquí van las reglas que no pueden romperse.)
// Uso: npm test   (o node --test tests/escena3d.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarTextosDeDisco, listo, jugar } from './bots.mjs';
import { BG } from '../data/casillas.js';
import { DIS } from '../data/desastres.js';
import { ALTURA, COLOR_SUELO, AMBIENTE, FUERZA_AMBIENTE, EFECTOS, RIESGO, TIEMPOS, CAMARA, PARTICULAS } from '../data/escena3d.js';
import { C, semillaCosmetica } from '../js/ui/cosmetico.js';
import { newGame } from '../js/partida.js';
import { G, setG } from '../js/estado.js';
import { render, UI } from '../js/ui/vista.js';

cargarTextosDeDisco();
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

test('los datos del 3D cubren todos los tipos de casilla y todos los desastres', () => {
  for (const t of Object.keys(BG)) {
    assert.ok(ALTURA[t] > 0, `falta la altura de la casilla ${t}`);
    assert.ok(COLOR_SUELO[t] !== undefined, `falta el color de la casilla ${t}`);
  }
  assert.ok(AMBIENTE.prep, 'falta el ambiente de la preparación');
  for (const k of [...Object.keys(DIS), 'deslizamiento']) {
    assert.ok(AMBIENTE[k], `falta el ambiente de ${k}`);
    assert.ok(Array.isArray(EFECTOS[k]) && EFECTOS[k].length, `faltan los efectos de ${k}`);
    assert.ok(FUERZA_AMBIENTE[k] > 0, `falta la fuerza de ambiente de ${k}`);
  }
  assert.equal(new Set(Object.values(FUERZA_AMBIENTE)).size, Object.keys(FUERZA_AMBIENTE).length, 'dos desastres con la misma fuerza: no se sabe cuál manda la luz');
});

test('la cámara no puede mirar desde debajo del suelo y los umbrales de riesgo tienen sentido', () => {
  assert.ok(CAMARA.inclMin > 0 && CAMARA.inclMax < 90 && CAMARA.inclMin < CAMARA.inclMax);
  assert.ok(CAMARA.distMin > 0 && CAMARA.distMin < CAMARA.distInicial && CAMARA.distInicial < CAMARA.distMax);
  assert.ok(CAMARA.inclInicial >= CAMARA.inclMin && CAMARA.inclInicial <= CAMARA.inclMax);
  assert.ok(RIESGO.minimo < RIESGO.ambar && RIESGO.ambar < RIESGO.rojo);
  for (const v of Object.values(TIEMPOS)) assert.ok(v > 0);
  for (const v of Object.values(PARTICULAS)) assert.ok(v > 0 && v <= 600, 'demasiadas partículas para el móvil');
});

test('regla 1: lo visual no toca el azar del juego (ni lo importa)', () => {
  const dibujo = ['js/ui/cosmetico.js', 'js/ui/camara3d.js', 'js/ui/modelos3d.js', 'js/ui/efectos3d.js', 'js/ui/mapa3d.js', 'js/ui/numeros.js'];
  for (const f of dibujo) {
    const s = leer(f);
    assert.ok(!/from\s+['"][^'"]*azar\.js['"]/.test(s), `${f} importa azar.js: usa ./cosmetico.js`);
    assert.ok(!/\b(RS|RI)\s*\(/.test(s.replace(/\/\/.*$/gm, '')), `${f} llama a RS o RI`);
  }
});

test('regla 2: el 3D sólo dibuja; la lógica no lo conoce y la vista no lo importa', () => {
  for (const f of fs.readdirSync(path.join(RAIZ, 'js')).filter(x => x.endsWith('.js'))) {
    if (f === 'main.js') continue;
    assert.ok(!/ui\/|mapa3d|three/i.test(leer('js/' + f).replace(/\/\/.*$/gm, '')), `js/${f} (lógica) menciona el dibujo`);
  }
  assert.ok(!/import[^;]*(mapa3d|three)/i.test(leer('js/ui/vista.js')), 'vista.js importa el 3D: tiene que ir cargado sólo desde main.js');
});

test('el azar cosmético no cambia ninguna partida (ni el calendario del reto diario)', () => {
  for (const opts of [{town: 'villarrio', alc: 'ingeniera', semilla: 5}, {town: 'arrieta', alc: 'tesorero', semilla: 9}, {daily: '2026-11-19'}]) {
    const base = jugar(opts, listo(5));
    const b = listo(5), preparar = b.preparar;
    b.preparar = () => { semillaCosmetica(99); for (let k = 0; k < 500; k++) C(); preparar(); };
    assert.deepEqual(jugar(opts, b), base, 'dibujar (azar cosmético) ha cambiado el resultado de la partida');
    newGame(opts); const a = JSON.stringify(G.schedule);
    for (let k = 0; k < 2000; k++) C();
    newGame(opts); assert.equal(JSON.stringify(G.schedule), a, 'el calendario cambia según el azar cosmético');
  }
});

test('con el 3D activo la vista deja un hueco y sin él sigue el mapa plano de siempre', () => {
  const app = {_h: '', set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; }};
  globalThis.document = {getElementById: () => app};
  newGame({town: 'villarrio', alc: 'ingeniera', semilla: 3}); G.phase = 'prep'; UI.screen = 'game';
  UI.mapa3d = true; render();
  assert.ok(app.innerHTML.includes('class="mapa3d" data-modo="prep"'), 'falta el hueco del mapa 3D');
  assert.ok(!app.innerHTML.includes('data-tile='), 'con 3D no debería haber casillas HTML');
  UI.mapa3d = false; render();
  assert.equal((app.innerHTML.match(/data-tile=/g) || []).length, 56, 'el mapa plano debe seguir teniendo sus 56 casillas');
  setG(null);
});

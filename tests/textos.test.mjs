// T-02 · Los textos: todo lo que ve el jugador está en i18n/es.json y no falta ninguna clave.
// Uso: npm test   (o node --test tests/textos.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarTextosDeDisco } from './bots.mjs';
import { existe } from '../js/i18n.js';
import { TOWNS } from '../data/pueblos.js';
import { ALCALDES } from '../data/alcaldes.js';
import { DIS } from '../data/desastres.js';
import { OFICIOS, JOBS } from '../data/gente.js';
import { ICON } from '../data/casillas.js';
import { ACTIONS } from '../js/acciones.js';
import { PERKS, EVENTS } from '../js/mejoras.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
cargarTextosDeDisco();

function ficherosJs(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? ficherosJs(p) : (p.endsWith('.js') ? [p] : []);
  });
}

test('todas las claves que el código pide con texto fijo existen en es.json', () => {
  const faltan = [];
  for (const f of ficherosJs(path.join(RAIZ, 'js'))) {
    const src = fs.readFileSync(f, 'utf8');
    const esVista = f.endsWith(path.join('ui', 'vista.js'));
    // t('clave'…) en todos los ficheros; u('clave'…) sólo en la vista (u añade «ui.»)
    for (const m of src.matchAll(/(?<![\w.])(t|u)\(\s*'([^']+)'\s*[,)]/g)) {
      if (m[1] === 'u' && !esVista) continue;
      const clave = m[1] === 'u' ? 'ui.' + m[2] : m[2];
      if (!existe(clave)) faltan.push(path.relative(RAIZ, f) + ' → ' + clave);
    }
  }
  assert.deepEqual(faltan, [], 'Faltan claves en i18n/es.json');
});

test('los datos tienen sus textos (pueblos, alcaldes, desastres, oficios, casillas, acciones, mejoras, eventos)', () => {
  const faltan = [];
  const pide = (c) => { if (!existe(c)) faltan.push(c); };
  for (const [k, p] of Object.entries(TOWNS)) { ['nombre', 'tipo', 'desc'].forEach(x => pide(`pueblos.${k}.${x}`)); if (p.unlock) pide(`pueblos.${k}.desbloqueo`); }
  for (const a of ALCALDES) { ['nombre', 'titulo', 'desc'].forEach(x => pide(`alcaldes.${a.id}.${x}`)); if (a.unlock) pide(`alcaldes.${a.id}.desbloqueo`); }
  for (const k of Object.keys(DIS)) { pide(`desastres.${k}.nombre`); pide(`desastres.${k}.aviso`); }
  for (const k of Object.keys(OFICIOS)) { ['m', 'f', 'desc'].forEach(x => pide(`oficios.${k}.${x}`)); }
  for (const j of JOBS) { pide('trabajos.' + j); pide('trabajando.' + j); }
  for (const k of Object.keys(ICON)) { pide(`casillas.${k}.nombre`); pide(`casillas.${k}.que`); }
  for (const k of Object.keys(ACTIONS)) { pide(`acciones.${k}.nombre`); pide(`acciones.${k}.desc`); pide('construcciones.' + k); }
  pide('construcciones.escollera');
  for (const r of ['dinero', 'madera', 'piedra', 'comida']) pide('recursos.' + r);
  for (const p of PERKS) { pide(`mejoras.${p.id}.nombre`); pide(`mejoras.${p.id}.desc`); }
  for (const e of EVENTS) pide(`eventos.${e.id}.titulo`);
  for (const k of ['agua', 'mar', 'fuego', 'rayo', 'tierra', 'nieve', 'hambre', 'calor']) pide('causas.' + k);
  for (const k of ['dique', 'escollera', 'sacos', 'pararrayos', 'cortafuegos', 'muro', 'bosque', 'evacuar', 'refugio', 'aljibe']) pide('salvaciones.' + k);
  assert.deepEqual(faltan, []);
});

test('es.json no tiene claves huérfanas que ya nadie pida (aviso, no error)', () => {
  // Sólo informativo: lista las hojas de es.json cuyo último tramo no aparece en ningún fichero de js/.
  const todo = ficherosJs(path.join(RAIZ, 'js')).map(f => fs.readFileSync(f, 'utf8')).join('\n');
  const json = JSON.parse(fs.readFileSync(path.join(RAIZ, 'i18n', 'es.json'), 'utf8'));
  const huerfanas = [];
  (function recorre(o, ruta) {
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === 'object') recorre(v, ruta.concat(k));
      else if (ruta.length > 1 && ruta[0] === 'log' && !todo.includes("'log." + k + "'") && !todo.includes('log.' + k)) huerfanas.push(ruta.concat(k).join('.'));
    }
  })(json, []);
  assert.deepEqual(huerfanas, [], 'Textos de log sin usar');
});

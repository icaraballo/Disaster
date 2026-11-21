// T-02 · La lógica: partidas reproducibles, reto diario justo y sin pantalla.
// Uso: npm test   (o node --test tests/partida.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarTextosDeDisco, ingenuo, listo, jugar } from './bots.mjs';
import { TOWNS } from '../data/pueblos.js';
import { ALCALDES } from '../data/alcaldes.js';
import { TEMPORADA } from '../data/balance.js';
import { G } from '../js/estado.js';
import { newGame, retoDelDia } from '../js/partida.js';
import { cumple, defaultProg } from '../js/progreso.js';
import { riskFor } from '../js/riesgo.js';

cargarTextosDeDisco();

test('la misma semilla da exactamente la misma partida', () => {
  const a = jugar({town: 'villarrio', alc: 'ingeniera', semilla: 5}, listo(5));
  const b = jugar({town: 'villarrio', alc: 'ingeniera', semilla: 5}, listo(5));
  assert.deepEqual(a, b);
  const c = jugar({town: 'villarrio', alc: 'ingeniera', semilla: 6}, listo(6));
  const d = jugar({town: 'villarrio', alc: 'ingeniera', semilla: 7}, listo(7));
  assert.notDeepEqual([c.puntos, c.desastre], [d.puntos, d.desastre].map(x => x), 'semillas distintas deberían dar partidas distintas (al menos alguna vez)');
});

test('el reto diario es igual para todos: mismo pueblo, alcalde y calendario', () => {
  for (const fecha of ['2026-11-15', '2026-12-01', '2027-02-28']) {
    newGame({daily: fecha});
    const cal1 = JSON.stringify(G.schedule), pueblo = G.town, alc = G.alc;
    // jugarlo de otra manera no cambia el calendario
    jugar({daily: fecha}, ingenuo(3));
    const otro = JSON.stringify(G.schedule);
    assert.equal(otro, cal1);
    assert.deepEqual(retoDelDia(fecha), {town: pueblo, alc});
  }
});

test('el calendario de desastres respeta el pueblo y la temporada', () => {
  for (const [k, p] of Object.entries(TOWNS)) {
    for (let s = 1; s <= 30; s++) {
      newGame({town: k, alc: 'ingeniera', semilla: s});
      assert.equal(G.schedule.length, TEMPORADA);
      G.schedule.forEach((d, i) => {
        d.types.forEach(t => assert.ok(p.pool[t], `${t} no existe en ${k}`));
        // T-12: escalada 1-1-2-2-2-3-3-3; dobles desde el 5.º y el 8.º siempre doble (si el pueblo tiene parejas)
        assert.equal(d.I, [1, 1, 2, 2, 2, 3, 3, 3][i]);
        if (d.types.length === 2) assert.ok(i >= 4, 'los combinados sólo desde el desastre 5');
      });
      assert.equal(G.schedule[TEMPORADA - 1].types.length, 2, `${k}: el último desastre es doble`);
    }
  }
});

test('el mapa de riesgo da probabilidades válidas y sólo en edificios', () => {
  newGame({town: 'altuzarra', alc: 'ingeniera', semilla: 1});
  for (const tipos of [['riada'], ['incendio'], ['tormenta'], ['alud'], ['temporal'], ['sequia'], ['plaga'], ['ola'], ['alud', 'tormenta']]) {
    for (const I of [1, 2, 3]) {
      riskFor(tipos, I).forEach((v, i) => {
        assert.ok(v >= 0 && v <= 1, `riesgo fuera de rango en ${i}`);
        if (!'CAGOW'.includes(G.tiles[i].t)) assert.equal(v, 0);
      });
    }
  }
});

test('las partidas terminan con números sanos, con cualquier pueblo y alcalde', () => {
  for (const town of Object.keys(TOWNS)) {
    for (const a of ALCALDES) {
      for (const bot of [ingenuo, listo]) {
        const r = jugar({town, alc: a.id, semilla: 11}, bot(11));
        assert.ok(Number.isFinite(r.puntos), 'la puntuación no es un número');
        assert.ok(r.desastre >= 1 && r.desastre <= TEMPORADA);
        for (const k of ['pop', 'moral', 'dinero', 'madera', 'piedra', 'comida', 'riesgo', 'heridos']) {
          assert.ok(Number.isFinite(G.res[k]), `${k} no es un número`);
        }
        assert.ok(G.res.moral >= 0 && G.res.moral <= 100);
        assert.ok(G.res.riesgo >= 0 && G.res.riesgo <= 95);
      }
    }
  }
});

test('las condiciones de desbloqueo funcionan', () => {
  const p = defaultProg();
  assert.equal(cumple({tipo: 'victorias', pueblo: 'villarrio', n: 1}, p), false);
  p.wins.villarrio = 1;
  assert.equal(cumple({tipo: 'victorias', pueblo: 'villarrio', n: 1}, p), true);
  assert.equal(cumple({tipo: 'victoriasTotales', n: 1}, p), true);
  assert.equal(cumple({tipo: 'alcance', pueblo: 'arrieta', n: 5}, p), false);
  p.maxIdx.arrieta = 5; p.total = 10; p.seasons = 3;
  assert.equal(cumple({tipo: 'alcance', pueblo: 'arrieta', n: 5}, p), true);
  assert.equal(cumple({tipo: 'total', n: 10}, p), true);
  assert.equal(cumple({tipo: 'temporadas', n: 3}, p), true);
});

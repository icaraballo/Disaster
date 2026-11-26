// El equilibrio: los bots juegan cientos de partidas y los resultados deben quedarse dentro de los
// objetivos de T-12 (DS-DESIGN §4), con un margen. Si cambias un número del juego (sobre todo la moral)
// y este test falla, hay que volver a mirar el equilibrio con `npm run simular`.
// Uso: npm test   (o node --test tests/equilibrio.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarTextosDeDisco, ingenuo, medio, listo, generico, simular } from './bots.mjs';

cargarTextosDeDisco();
const N = 300;
const MARGEN = 6;
const cache = new Map();
const medir = (nombre, bot, town, alc = 'ingeniera') => {
  const k = nombre + town + alc;
  if (!cache.has(k)) cache.set(k, simular(bot, {town, alc, n: N}));
  return cache.get(k);
};

// T-12 §B.8: dificultad progresiva en el orden de desbloqueo (% de temporadas ganadas).
const OBJETIVO = {
  villarrio: {listo: [70, 85], medio: [30, 45], ingenuo: [0, 5]},
  arrieta:   {listo: [60, 75], medio: [20, 35], ingenuo: [0, 0]},
  altuzarra: {listo: [50, 65], medio: [10, 25], ingenuo: [0, 0]},
  errekalde: {listo: [40, 55], medio: [5, 15],  ingenuo: [0, 0]}
};
const BOTS = {listo, medio, ingenuo};

for (const [town, obj] of Object.entries(OBJETIVO)) {
  test(`${town}: cada bot gana lo que le toca`, () => {
    for (const [nombre, [lo, hi]] of Object.entries(obj)) {
      const pct = medir(nombre, BOTS[nombre], town).pct;
      assert.ok(pct >= lo - MARGEN && pct <= hi + MARGEN, `${town} ${nombre}: ${pct.toFixed(0)} % (objetivo ${lo}-${hi}, margen ${MARGEN})`);
    }
  });
}

test('la dificultad sube en el orden de desbloqueo', () => {
  const orden = Object.keys(OBJETIVO);
  for (let i = 1; i < orden.length; i++) {
    const antes = medir('listo', listo, orden[i - 1]).pct, ahora = medir('listo', listo, orden[i]).pct;
    assert.ok(ahora < antes, `${orden[i]} (${ahora.toFixed(0)} %) debería ser más difícil que ${orden[i - 1]} (${antes.toFixed(0)} %)`);
  }
});

test('pensar siempre sale a cuenta: el listo gana mucho más que el medio, y el medio más que el ingenuo', () => {
  for (const town of Object.keys(OBJETIVO)) {
    const a = medir('ingenuo', ingenuo, town).pct, m = medir('medio', medio, town).pct, b = medir('listo', listo, town).pct;
    assert.ok(b - m >= 25, `${town}: medio ${m.toFixed(0)} % frente a listo ${b.toFixed(0)} %`);
    assert.ok(m - a >= 5, `${town}: ingenuo ${a.toFixed(0)} % frente a medio ${m.toFixed(0)} %`);
  }
});

test('medallas: ganar bien cuesta (plata o más en ~45-60 % de las victorias del listo, oro en ~20-35 %)', () => {
  const towns = Object.keys(OBJETIVO);
  const plata = towns.reduce((s, k) => s + medir('listo', listo, k).plata, 0) / towns.length;
  const oro = towns.reduce((s, k) => s + medir('listo', listo, k).oro, 0) / towns.length;
  assert.ok(plata >= 45 - MARGEN && plata <= 60 + MARGEN, `plata o más: ${plata.toFixed(0)} %`);
  assert.ok(oro >= 20 - MARGEN && oro <= 35 + MARGEN, `oro: ${oro.toFixed(0)} %`);
});

test('ningún alcalde está roto y ninguno es el mejor en todos los pueblos', () => {
  const alcs = ['ingeniera', 'agricultor', 'meteorologa', 'tesorero', 'enfermera'];
  const towns = Object.keys(OBJETIVO);
  for (const alc of alcs) {
    const a = medir('ingenuo', ingenuo, 'villarrio', alc).pct, b = medir('listo', listo, 'villarrio', alc).pct;
    assert.ok(a <= 15, `${alc} ingenuo en Villarrío: ${a.toFixed(0)} % (demasiado fácil)`);
    assert.ok(b >= 65, `${alc} listo en Villarrío: ${b.toFixed(0)} % (demasiado difícil)`);
    const mediaPropio = towns.reduce((s, t) => s + medir('listo', listo, t, alc).pct, 0) / towns.length;
    const mediaGen = towns.reduce((s, t) => s + medir('generico', generico, t, alc).pct, 0) / towns.length;
    assert.ok(mediaPropio >= mediaGen - 1, `${alc}: su estilo (${mediaPropio.toFixed(1)} %) debería rendir al menos como lo genérico (${mediaGen.toFixed(1)} %)`);
  }
  const ganadores = new Set(towns.map(t => [...alcs].sort((x, y) => medir('listo', listo, t, y).pct - medir('listo', listo, t, x).pct)[0]));
  assert.ok(ganadores.size >= 2, 'un solo alcalde es el mejor en los cuatro pueblos');
});

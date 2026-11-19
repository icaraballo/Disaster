// T-03 · El equilibrio: dos bots juegan cientos de partidas y los resultados deben quedarse
// dentro de un margen (DS-Traspaso §12). Si cambias un número del juego (sobre todo la moral)
// y este test falla, hay que volver a mirar el equilibrio con `npm run simular`.
// Uso: npm test   (o node --test tests/equilibrio.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarTextosDeDisco, ingenuo, medio, listo, simular } from './bots.mjs';

cargarTextosDeDisco();
const N = 300;
const medir = (bot, town, alc = 'ingeniera') => simular(bot, {town, alc, n: N});

test('jugando sin pensar: poco en Villarrío y casi nada en los demás', () => {
  const v = medir(ingenuo, 'villarrio').pct, a = medir(ingenuo, 'arrieta').pct, e = medir(ingenuo, 'errekalde').pct;
  assert.ok(v <= 15, `Villarrío ingenuo: ${v.toFixed(0)} % (esperado ≤ 15)`);
  assert.ok(a <= 10, `Arrieta ingenuo: ${a.toFixed(0)} % (esperado ≤ 10)`);
  assert.ok(e <= 10, `Errekalde ingenuo: ${e.toFixed(0)} % (esperado ≤ 10)`);
});

test('jugando con cabeza se gana casi siempre, en todos los pueblos', () => {
  // 19-11: con el bot corregido (T-07) y el equilibrio más duro, el listo gana ~83-100 %; margen de unos 5 puntos.
  const minimo = {villarrio: 90, arrieta: 88, altuzarra: 90, errekalde: 78};
  for (const [town, min] of Object.entries(minimo)) {
    const pct = medir(listo, town).pct;
    assert.ok(pct >= min, `${town} listo: ${pct.toFixed(0)} % (esperado ≥ ${min})`);
  }
});

test('el jugador que se despista (medio) queda entre el ingenuo y el listo', () => {
  for (const town of ['villarrio', 'arrieta', 'altuzarra', 'errekalde']) {
    const m = medir(medio, town).pct, l = medir(listo, town).pct;
    assert.ok(m >= 30 && m <= 90, `${town} medio: ${m.toFixed(0)} % (esperado 30-90)`);
    assert.ok(l - m >= 8, `${town}: medio ${m.toFixed(0)} % frente a listo ${l.toFixed(0)} %`);
  }
});

test('pensar siempre sale a cuenta: el listo gana mucho más que el ingenuo', () => {
  for (const town of ['villarrio', 'arrieta', 'altuzarra', 'errekalde']) {
    const a = medir(ingenuo, town).pct, b = medir(listo, town).pct;
    assert.ok(b - a >= 40, `${town}: ingenuo ${a.toFixed(0)} % frente a listo ${b.toFixed(0)} %`);
  }
});

test('ningún alcalde está roto: ninguno se acerca a ganar siempre sin pensar ni a perder siempre pensando', () => {
  // El tesorero llegó a estar roto (recaudar sin perder moral): vigilamos los extremos.
  for (const alc of ['ingeniera', 'agricultor', 'meteorologa', 'tesorero', 'enfermera']) {
    const a = medir(ingenuo, 'villarrio', alc).pct, b = medir(listo, 'villarrio', alc).pct;
    assert.ok(a <= 65, `${alc} ingenuo en Villarrío: ${a.toFixed(0)} % (demasiado fácil)`);
    assert.ok(b >= 70, `${alc} listo en Villarrío: ${b.toFixed(0)} % (demasiado difícil)`);
  }
});

// T-09 · planObra: lo que enseña la pantalla antes de construir es exactamente lo que se cobra después.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarTextosDeDisco } from './bots.mjs';
import { ALCALDES } from '../data/alcaldes.js';
import { G } from '../js/estado.js';
import { newGame } from '../js/partida.js';
import { RUINAS, SOLAR, REFUGIO } from '../js/casas.js';
import { ACTIONS, planObra, doAction } from '../js/acciones.js';

cargarTextosDeDisco();

const RIC = {dinero: 500, madera: 50, piedra: 50, comida: 50};
function preparar(semilla, alc = 'ingeniera') {
  newGame({town: 'villarrio', alc, semilla});
  Object.assign(G.res, RIC);
  G.phase = 'prep';
  G.tiles[17].dmg = true;       // casa dañada para reparar / subcontrata
  G.tiles[25].t = RUINAS;       // ruinas junto al río (tramo 26)
  G.tiles[31].t = SOLAR;        // solar junto al río (tramo 32)
  G.tiles[21].t = REFUGIO;      // refugio activo para evacuar / evacuacionRapida
}
const albanil = () => G.workers.find(w => w.of === 'albanil');
const casilla = (k) => G.tiles.findIndex((x, i) => ACTIONS[k].valid(x, i));

// Situaciones: albañil libre, ocupado en otra cosa y sin albañil (se ha ido).
const SITUACIONES = {
  libre: () => {},
  ocupado: () => { G.busy.push(albanil().id); },
  produciendo: () => { G.alloc.talar.push(albanil().id); },
  sinAlbanil: () => { albanil().gone = true; }
};

test('el coste que enseña planObra es exactamente lo que cobra doAction (en todos los alcaldes)', () => {
  for (const a of ALCALDES) {
    for (const [nombre, poner] of Object.entries(SITUACIONES)) {
      for (const k of Object.keys(ACTIONS)) {
        preparar(3, a.id);
        poner();
        const i = casilla(k);
        if (i < 0) continue;
        const plan = planObra(k, i);
        assert.ok(plan.completo, `${a.id}/${k}/${nombre}: debería haber gente`);
        const antes = {...G.res};
        G.sel = k;
        const hecho = doAction(i);
        assert.ok(hecho, `${a.id}/${k}/${nombre}: no se ha construido`);
        for (const r of Object.keys(RIC)) {
          const esperado = plan.coste[r] || 0;
          const cobrado = antes[r] - G.res[r] + (r === 'madera' && k === 'cortafuegos' ? 2 : 0);
          assert.equal(cobrado, esperado, `${a.id}/${k}/${nombre}: ${r}`);
        }
        assert.deepEqual(G.busy.filter(id => plan.equipo.some(w => w.id === id)).sort(), plan.equipo.map(w => w.id).sort());
      }
    }
  }
});

test('el descuento del albañil: casos con la ingeniera y albañil libre', () => {
  preparar(3, 'ingeniera');
  const esperado = {dique: {piedra: 1}, muro: {piedra: 1, madera: 1}, contrafuerte: {piedra: 1, madera: 1},
    aljibe: {piedra: 2, madera: 2}, observatorio: {madera: 3, dinero: 30}, pararrayos: {madera: 1, dinero: 15},
    reparar: {madera: 2}, sacos: {dinero: 8}, cortafuegos: {}, evacuar: {comida: 1}};
  for (const [k, c] of Object.entries(esperado)) {
    G.workers.forEach(w => { w.inj = 0; });
    const plan = planObra(k);
    const llevaAlbanil = plan.equipo.some(w => w.of === 'albanil');
    if (['sacos', 'cortafuegos', 'evacuar'].includes(k)) {
      assert.equal(plan.albanil, null, `${k} no debería tener descuento`);
    } else assert.ok(llevaAlbanil && plan.albanil, `${k} debería llevar al albañil`);
    for (const r of Object.keys(c)) assert.equal(plan.coste[r] || 0, c[r], `${k}: ${r}`);
  }
});

test('con el albañil ocupado no hay descuento y al terminar el turno vuelve', () => {
  preparar(3);
  G.sel = 'sacos'; doAction(casilla('sacos'));          // lo usa el albañil (rankBuild 0)
  const plan = planObra('aljibe');
  assert.equal(plan.albanil, null);
  assert.equal(plan.coste.piedra, 3);
  G.busy = [];                                           // nuevo turno
  assert.ok(planObra('aljibe').albanil);
});

test('planObra no modifica la partida', () => {
  for (const a of ALCALDES) {
    preparar(4, a.id);
    const foto = JSON.stringify(G);
    for (const k of Object.keys(ACTIONS)) planObra(k);
    assert.equal(JSON.stringify(G), foto);
  }
});

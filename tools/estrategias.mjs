// ¿Hay varios caminos para ganar, y cada alcalde tiene el suyo?
// 1. Estrategias puras (listo, muros, gente, sacrificio) en los cuatro pueblos.
// 2. Matriz Alcalde × Pueblo: cada alcalde jugando a su estrategia (listo) frente a jugar genérico (sin su habilidad propia).
// Uso: npm run estrategias [-- partidas] [alcalde]     (por defecto 300)
import { cargarTextosDeDisco, listo, generico, muros, gente, sacrificio, simular } from '../tests/bots.mjs';
import { TOWNS } from '../data/pueblos.js';
import { ALCALDES } from '../data/alcaldes.js';

cargarTextosDeDisco();
const n = +(process.argv[2] || 300);
const alcFiltro = process.argv[3] || null;
const BOTS = {listo, muros, gente, sacrificio};

const alcBase = alcFiltro || 'ingeniera';
console.log(`\n1) Estrategias en cada pueblo (alcalde: ${alcBase} · ${n} partidas por casilla)`);
console.log('pueblo       ' + Object.keys(BOTS).map(k => k.padEnd(20)).join(''));
for (const town of Object.keys(TOWNS)) {
  const fila = Object.values(BOTS).map(b => { const r = simular(b, {town, alc: alcBase, n}); return `${r.pct.toFixed(0).padStart(3)} % (${r.vecMed} · ${r.moralMed})`.padEnd(20); });
  console.log(town.padEnd(12), fila.join(''));
}

const listaAlc = alcFiltro ? ALCALDES.filter(a => a.id === alcFiltro) : ALCALDES;
console.log(`\n2) Tabla Alcalde × Pueblo (${n} partidas: % jugando a su manera / % genérico sin habilidad propia)`);
console.log('pueblo       ' + listaAlc.map(a => a.id.padEnd(16)).join(''));
for (const town of Object.keys(TOWNS)) {
  const fila = listaAlc.map(a => {
    const propio = simular(listo, {town, alc: a.id, n}).pct;
    const gen = simular(generico, {town, alc: a.id, n}).pct;
    return `${propio.toFixed(0).padStart(2)}/${gen.toFixed(0).padStart(2)} %`.padEnd(16);
  });
  console.log(town.padEnd(12), fila.join(''));
}

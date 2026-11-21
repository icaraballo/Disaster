// ¿Hay varios caminos para ganar? Juega el listo y los tres bots de estrategia (muros, gente y
// sacrificio) en los cuatro pueblos y cuenta cuántas temporadas gana cada uno.
// Uso: npm run estrategias [-- partidas] [alcalde]     (por defecto 300 y la ingeniera)
import { cargarTextosDeDisco, listo, muros, gente, sacrificio, simular } from '../tests/bots.mjs';
import { TOWNS } from '../data/pueblos.js';

cargarTextosDeDisco();
const n = +(process.argv[2] || 300);
const alc = process.argv[3] || 'ingeniera';
const BOTS = {listo, muros, gente, sacrificio};

console.log(`\nAlcalde: ${alc} · ${n} partidas por casilla · % ganadas (vecinos finales mediana · moral mínima mediana)`);
console.log('pueblo       ' + Object.keys(BOTS).map(k => k.padEnd(20)).join(''));
for (const town of Object.keys(TOWNS)) {
  const fila = Object.values(BOTS).map(b => { const r = simular(b, {town, alc, n}); return `${r.pct.toFixed(0).padStart(3)} % (${r.vecMed} · ${r.moralMed})`.padEnd(20); });
  console.log(town.padEnd(12), fila.join(''));
}

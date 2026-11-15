// Simulador de bots: juega muchas partidas sin pantalla y cuenta cuántas se ganan.
// Uso: npm run simular [-- partidas]      (por defecto 300 por pueblo y alcalde ingeniera)
import { cargarTextosDeDisco, ingenuo, listo, simular } from '../tests/bots.mjs';
import { TOWNS } from '../data/pueblos.js';
import { ALCALDES } from '../data/alcaldes.js';

cargarTextosDeDisco();
const n = +(process.argv[2] || 300);
const alcaldes = process.argv[3] ? [process.argv[3]] : ['ingeniera'];

for (const alc of alcaldes) {
  console.log(`\nAlcalde: ${alc} · ${n} partidas por casilla`);
  console.log('pueblo       ingenuo (% ganadas · desastre medio)   listo (% ganadas · desastre medio)');
  for (const town of Object.keys(TOWNS)) {
    const a = simular(ingenuo, {town, alc, n});
    const b = simular(listo, {town, alc, n});
    console.log(town.padEnd(12), `${a.pct.toFixed(0).padStart(4)} % · ${a.medio.toFixed(1)}`.padEnd(38), `${b.pct.toFixed(0).padStart(4)} % · ${b.medio.toFixed(1)}`);
  }
}
if (!process.argv[3]) console.log('\n(Para otro alcalde: npm run simular -- 300 tesorero. Alcaldes: ' + ALCALDES.map(a => a.id).join(', ') + ')');

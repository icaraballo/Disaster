// Simulador de bots: juega muchas partidas sin pantalla y cuenta cuántas se ganan.
// Uso: npm run simular [-- partidas]      (por defecto 300 por pueblo y alcalde ingeniera)
import { cargarTextosDeDisco, ingenuo, medio, listo, simular } from '../tests/bots.mjs';
import { TOWNS } from '../data/pueblos.js';
import { ALCALDES } from '../data/alcaldes.js';

cargarTextosDeDisco();
const n = +(process.argv[2] || 300);
const alcaldes = process.argv[3] ? [process.argv[3]] : ['ingeniera'];

for (const alc of alcaldes) {
  console.log(`\nAlcalde: ${alc} · ${n} partidas por casilla`);
  console.log('(% ganadas · vecinos finales p10/mediana · moral mínima mediana · medallas del listo: plata o más / oro, sobre sus victorias)');
  console.log('pueblo       ingenuo                 medio                   listo                   medallas');
  for (const town of Object.keys(TOWNS)) {
    const a = simular(ingenuo, {town, alc, n});
    const m = simular(medio, {town, alc, n});
    const b = simular(listo, {town, alc, n});
    const f = (r) => `${r.pct.toFixed(0).padStart(3)} % · ${String(r.vecP10).padStart(2)}/${String(r.vecMed).padStart(2)} · ${String(r.moralMed).padStart(2)}`;
    console.log(town.padEnd(12), f(a).padEnd(23), f(m).padEnd(23), f(b).padEnd(23), `${b.plata.toFixed(0)} / ${b.oro.toFixed(0)} %`);
  }
}
if (!process.argv[3]) console.log('\n(Para otro alcalde: npm run simular -- 300 tesorero. Alcaldes: ' + ALCALDES.map(a => a.id).join(', ') + ')');

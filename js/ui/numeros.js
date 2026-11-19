// Pequeño detalle (T-10 §2.6): los números de la barra de recursos suben y bajan animados al cambiar.
// Sólo toca el texto que ya ha dibujado la vista; no calcula nada del juego.
import { TIEMPOS } from '../../data/escena3d.js';

const anteriores = new Map();
let corriendo = false;
const activas = [];

function paso(ahora) {
  for (let k = activas.length - 1; k >= 0; k--) {
    const a = activas[k], p = Math.min(1, (ahora - a.t0) / (TIEMPOS.recurso * 1000));
    if (!a.nodo.isConnected) { activas.splice(k, 1); continue; }
    a.nodo.data = Math.round(a.de + (a.a - a.de) * (1 - Math.pow(1 - p, 3))) + a.resto;
    if (p >= 1) activas.splice(k, 1);
  }
  if (activas.length) requestAnimationFrame(paso); else corriendo = false;
}

export function animarNumeros() {
  const celdas = document.querySelectorAll('.res > div');
  if (!celdas.length) { anteriores.clear(); return; }
  celdas.forEach((c) => {
    const k = c.querySelector('.k'), v = c.querySelector('.v');
    if (!k || !v || !v.firstChild || v.firstChild.nodeType !== 3) return;
    const m = /^(-?\d+)(%?)\s*$/.exec(v.firstChild.data);
    if (!m) return;
    const clave = k.textContent, nuevo = +m[1], antes = anteriores.get(clave);
    anteriores.set(clave, nuevo);
    if (antes === undefined || antes === nuevo) return;
    v.firstChild.data = antes + m[2];
    activas.push({ nodo: v.firstChild, de: antes, a: nuevo, resto: m[2], t0: performance.now() });
  });
  if (activas.length && !corriendo) { corriendo = true; requestAnimationFrame(paso); }
}

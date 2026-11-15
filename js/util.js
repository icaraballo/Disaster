// Utilidades sin estado ni pantalla.
import { COLS, FILAS } from '../data/casillas.js';

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Casillas vecinas (arriba, abajo, izquierda, derecha) de la casilla i.
export const nb4 = (i) => {
  const r = Math.floor(i / COLS), c = i % COLS, o = [];
  if (r > 0) o.push(i - COLS);
  if (r < FILAS - 1) o.push(i + COLS);
  if (c > 0) o.push(i - 1);
  if (c < COLS - 1) o.push(i + 1);
  return o;
};
// Distancia en casillas contando diagonales.
export const cheb = (a, b) => Math.max(Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS)), Math.abs(a % COLS - b % COLS));
export const todayKey = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
export const esc = (s) => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// Vocal de género para los textos («herid{a}»): «a» para ellas, «o» para ellos.
export const ao = (w) => w.g === 'f' ? 'a' : 'o';
// «s» de plural para los textos («casilla{s}»).
export const pl = (n) => n > 1 ? 's' : '';

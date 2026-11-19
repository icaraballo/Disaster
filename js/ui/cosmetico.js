// Azar cosmético: el único que puede usar el dibujo (adornos, lluvia, relámpagos, gestos).
// NUNCA importa ni toca RS/RI de ../azar.js: si lo hiciera, el reto diario dejaría de ser igual para todos
// y el simulador daría otros resultados (T-10, regla 1). Es un generador propio, con su propia semilla.
let estado = 0x9E3779B9;
export function semillaCosmetica(n) { estado = (n >>> 0) || 1; }
export function C() {            // número en [0, 1)
  estado = (estado + 0x6D2B79F5) >>> 0;
  let t = estado;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const entre = (a, b) => a + (b - a) * C();
export const elige = (lista) => lista[Math.floor(C() * lista.length)];
// Generador con semilla propia, para que el mapa se vea igual cada vez que se dibuja (adornos fijos).
export function conSemilla(n) {
  let s = (n >>> 0) || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

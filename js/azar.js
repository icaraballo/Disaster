// Azar con semilla. Hay dos generadores separados:
//   RS: calendario de desastres, previsión, eventos, mejoras y nombres (lo que no depende del jugador)
//   RI: impactos (lo que sí se desvía según lo que haga el jugador)
// En el reto diario los dos nacen de la semilla de la fecha; así el calendario es igual para todos.
// Los módulos que los importan ven siempre el generador vigente (enlaces vivos).
export let RS = Math.random;
export let RI = Math.random;

export function mulberry32(a) {
  a |= 0;
  const fn = function () {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  fn.estado = () => a | 0;
  return fn;
}
export function hashStr(s) {
  let h = 1779033703;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  return h >>> 0;
}

export function azarLibre() {
  const s1 = (Math.random() * 0x100000000) >>> 0;
  const s2 = (Math.random() * 0x100000000) >>> 0;
  RS = mulberry32(s1);
  RI = mulberry32(s2 ^ 0x9e3779b9);
}
export function azarConSemilla(texto) {
  const seed = hashStr(texto);
  RS = mulberry32(seed);
  RI = mulberry32(seed ^ 0x9e3779b9);
}
// Estado actual de los dos generadores, para guardar y restaurar una partida en curso sin repetir tiradas.
export function estadoAzar() {
  return RS && RI && RS.estado && RI.estado ? {rs: RS.estado(), ri: RI.estado()} : null;
}
export function restaurarAzar(est) {
  if (est && typeof est.rs === 'number' && typeof est.ri === 'number') {
    RS = mulberry32(est.rs);
    RI = mulberry32(est.ri);
  }
}
// Para tests y simulaciones: dos generadores cualesquiera (funciones que devuelven [0,1)).
export function inyectarAzar(rs, ri) { RS = rs; RI = ri; }

export const rnd = (a, b, f) => a + Math.floor((f || RS)() * (b - a + 1));
export const pick = (a, f) => a[Math.floor((f || RS)() * a.length)];
export const shuffle = (a, f) => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor((f || RS)() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
export const wpick = (obj, f) => {
  const ks = Object.keys(obj); let tot = 0; ks.forEach(k => tot += obj[k]);
  let x = (f || RS)() * tot;
  for (const k of ks) { x -= obj[k]; if (x < 0) return k; }
  return ks[ks.length - 1];
};

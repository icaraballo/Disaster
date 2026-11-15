// Números del equilibrio compartidos por los desastres (js/desastres.js) y por el mapa de
// riesgo (js/riesgo.js): si cambia uno aquí, cambian los dos a la vez.
import { clamp } from '../js/util.js';

export const TEMPORADA = 8;          // desastres por temporada
export const VECINOS_MINIMOS = 15;   // por debajo, el pueblo se vacía
export const DIQUE_ARRASTRE = 0.6;   // parte de la riada que un dique empuja río abajo
export const DIQUE_BARATO_CEDE = 0.35;
export const SEMILLA_RETO = 'villarrio-'; // prefijo de la semilla del reto diario (no cambiarlo: cambiaría los retos)

export const riadaP = (I, riadaMult, bomba) => (0.12 + 0.1*I) * riadaMult - (bomba ? 0.08 : 0);
export const temporalP = (I, bomba) => 0.15 + 0.12*I - (bomba ? 0.05 : 0);
export const aludP = (I, riesgo) => clamp(0.12*I + riesgo/250, 0, 0.8);
export const deslizamientoP = (riesgo, mult, I) => (riesgo/100) * mult * (0.6 + 0.2*I);
export const deslizamientoCasillas = (I) => I >= 2 ? 2 : 1;

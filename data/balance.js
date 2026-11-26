// Números del equilibrio compartidos por los desastres (js/desastres.js) y por el mapa de
// riesgo (js/riesgo.js): si cambia uno aquí, cambian los dos a la vez.
import { clamp } from '../js/util.js';

export const TEMPORADA = 8;          // desastres por temporada
export const VECINOS_MINIMOS = 30;   // por debajo, el pueblo se vacía (22 en la v3; 30 desde T-12)
export const DIQUE_ARRASTRE = 0.6;   // parte de la riada que un dique empuja río abajo
export const DIQUE_BARATO_CEDE = 0.35;
export const TERRAPLEN_ARRASTRE = 0.3; // parte del agua que un terraplén junto al río empuja río abajo
// El agua que llega a unas ruinas o a un solar pasa a la casilla de detrás con esta probabilidad.
export const PASA_AGUA = {U: 0.5, V: 1};

// Casas y familias (T-12, revisado con Iñigo el 21-11): los vecinos sólo bajan cuando una familia se
// va del pueblo; dañarse o caer en ruinas pesa en la moral.
export const FAMILIAS_POR_CASA = 2;
export const VECINOS_FAMILIA_SE_VA = 5;  // una familia que se va del pueblo para siempre
export const MORAL_DANO_CASA = 6;        // la casa se daña (la familia sigue en ella)
export const VECINOS_CASA_DANADA = 2;    // parte de la familia se marcha si se daña su casa sin evacuar (decidido el 21-11)
export const MORAL_DANO_EDIFICIO = 6;    // se daña otro edificio (ayuntamiento, granja, observatorio, aljibe, refugio)
export const MORAL_RUINAS = 10;           // la casa cae en ruinas y la familia tiene que irse de ella
export const MORAL_FAMILIA_SE_VA = 6;    // además de los vecinos, cuando una familia se va del pueblo
// El refugio (21-11): plazas (familias) y comida por desastre allí: 1, 2, 3… por familia.
export const REFUGIO_PLAZAS = 3;
export const MORAL_REFUGIO_LLENO = 4;    // decir que no a una familia que pide entrar
// La previsión se afina en cada turno (T-12 §B.6): rango del % que se da al desastre real, por nivel
// de precisión (1-3, obsLevel) y por turno de la preparación (1-3). Con menos turnos se pierden los primeros.
export const PREVISION = {
  1: [[40, 60], [50, 70], [60, 80]],
  2: [[55, 75], [65, 85], [75, 90]],
  3: [[70, 85], [80, 95], [88, 98]]
};

// Medallas (T-12 §B.7), al acabar la temporada. No cambian la puntuación ni el ranking.
export const MEDALLAS = ['bronce', 'plata', 'oro'];
export const MEDALLA_PLATA = {vecinos: 34, moral: 40};
export const MEDALLA_ORO = {vecinos: 40, moral: 45}; // y ninguna casa en ruinas ni solar

// La moral pesa poco a poco (T-12 §B.5): personas desanimadas al empezar la preparación.
export const DESANIMO = [{desde: 50, n: 0}, {desde: 30, n: 1}, {desde: 0, n: 2}];
export const desanimados = (moral) => DESANIMO.find(d => moral >= d.desde).n;
// Escalada (T-12): intensidad 1 en los desastres 1-2, 2 en el 3-5 y 3 en el 6-8 (índices desde 0).
export const INTENSIDAD = (idx) => idx < 2 ? 1 : (idx < 5 ? 2 : 3);
// Desastres dobles: probabilidad desde el desastre COMBO_DESDE (índice) y en el último.
export const COMBO_DESDE = 4;
export const COMBO_P = 0.4;
export const COMBO_P_ULTIMO = 1;
export const SEMILLA_RETO = 'villarrio-'; // prefijo de la semilla del reto diario (no cambiarlo: cambiaría los retos)

// pg = peligro del pueblo (data/pueblos.js, 1 si no tiene): la dificultad de cada pueblo (T-12 §B.8).
export const riadaP = (I, riadaMult, bomba, pg = 1) => (0.12 + 0.1*I) * riadaMult * pg - (bomba ? 0.08 : 0);
export const temporalP = (I, bomba, pg = 1) => (0.15 + 0.12*I) * pg - (bomba ? 0.05 : 0);
export const aludP = (I, riesgo, pg = 1) => clamp((0.12*I + riesgo/250) * pg, 0, 0.8);
export const deslizamientoP = (riesgo, mult, I, pg = 1) => (riesgo/100) * mult * (0.6 + 0.2*I) * pg;
export const rayosTormenta = (I, pg = 1) => 3 + I + Math.round(3 * (pg - 1)); // edificios que alcanza una tormenta
export const focosIncendio = (I, pg = 1) => I + Math.round(2 * (pg - 1));     // focos de un incendio
export const deslizamientoCasillas = (I) => I >= 2 ? 2 : 1;

// Alcaldes con identidad propia (pasiva + acción exclusiva + defecto direccional).
export const INGENIERA_PIEDRA_INI = 2;
export const INGENIERA_REPARAR_EXTRA = 1;       // reparar edificio dañado cuesta +1 madera (defecto)
export const INGENIERA_RUINAS_EXTRA = 1;        // reparar ruinas cuesta +1 madera (defecto)
export const CONTRAFUERTE_COSTE = {piedra: 2, madera: 1};

export const ENFERMERA_MURO_EXTRA = 1;          // diques, escolleras y muros cuestan +1 piedra (defecto)
export const ENFERMERA_RAYO_EXTRA = 5;          // pararrayos +5 dinero (defecto)
export const ENFERMERA_REFUGIO_COSTE = {madera: 3, piedra: 1};
export const EVAC_RAPIDA_DINERO = 8;            // evacuar sin gastar trabajador (además de la comida de entrada)

export const AGRICULTOR_COMIDA_INI = 20;
export const AGRICULTOR_GRANJA_BONUS = 3;
export const AGRICULTOR_TALAR_MENOS = 1;        // talar da −1 madera por persona (defecto)
export const GRANJA_REFORZADA_COSTE = {piedra: 1, dinero: 12};
export const GRANJA_REFORZADA_COMIDA = 2;       // +2 comida por trabajador por cada granja reforzada sana
export const GRANJA_REFORZADA_MORAL = 2;        // +2 moral tras cada desastre por cada granja reforzada sana
export const GRANJA_REFORZADA_SEQUIA = 3;       // comida que salva cada granja reforzada en una sequía
export const GRANJA_REFORZADA_PLAGA = 0.5;      // multiplicador de pérdidas de plaga por cada granja reforzada

export const METEOROLOGA_OBRA_EXTRA = 1;        // diques, escolleras, muros y refugio cuestan +1 material (defecto)
export const SONDEO_DINERO = 14;                // confirmar al 100 % el desastre real (sin observatorio)
export const SONDEO_DINERO_OBS = 6;             // con observatorio sano cuesta menos de la mitad

export const TESORERO_MORAL_INI = 62;           // arranca con moral más baja (defecto)
export const TESORERO_DINERO_INI = 35;
export const TESORERO_RECAUDAR_BONUS = 8;
export const TESORERO_MORAL_RECAUDAR = 4;       // recaudar quita el doble de moral (defecto)
export const TESORERO_MORAL_COMERCIANTE = 2;
export const TESORERO_SACOS_DINERO = 5;
export const TESORERO_RAYO_DINERO = 10;
export const SUBCONTRATA_COSTE = {reparar: 18, ruinas: 32, solar: 46, terraplen: 22};

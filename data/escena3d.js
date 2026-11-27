// Los números del mapa en 3D (T-10): alturas, colores, cámara, ambientes y tiempos de animación.
// Todo lo que se ajusta probando está aquí y no en el código del dibujo (js/ui/mapa3d.js).
// Aquí no hay reglas del juego: sólo aspecto. Los textos nuevos están en i18n/es.json, bajo «mapa3d».

// Altura de cada tipo de casilla (el lado de una casilla mide 1).
export const ALTURA = {B:0.38, X:0.30, Q:0.30, L:0.62, P:0.24, R:0.06, M:0.04, S:0.50, C:0.24, A:0.24, G:0.24, O:0.24, W:0.24, U:0.24, V:0.22, E:0.24, H:0.24};

// Color de la parte de arriba de cada casilla (hex).
export const COLOR_SUELO = {B:0x4E7A4F, X:0xB7C48F, Q:0x3A3631, L:0xA89478, P:0xA9C285, R:0xCBB88E, M:0x2F6FA6, S:0xE3E9EE, C:0xD9C9A3, A:0xD9C9A3, G:0xC9B57E, O:0xD9C9A3, W:0xD9C9A3, U:0xB9A88A, V:0xBDB08F, E:0x8E7F63, H:0xD9C9A3};
export const COLOR_AGUA = {R:0x5E9BD1, M:0x3C7DB8};
// Colores de piezas que cambia cada tema (data/temas.js): árboles, tejados, paredes, hierba, cultivo y la peana.
export const PALETA = {
  hojas: [0x2F5A33, 0x36673A, 0x3E7440],
  tejados: [0xB5502E, 0xA8442B, 0xC25A33],
  pared: 0xF1E6CE,
  hierba: 0x7FA05E,
  cultivo: 0x6FA14A,
  tierra: 0x6B5237,       // la peana
  bordePeana: 0x4A3A27
};
export const COLOR_OFICIO_DANO = 0x6E4A32;

// Cámara: ángulos en grados (0 = a ras de suelo, 90 = desde arriba), distancias en casillas.
export const CAMARA = {
  distMin: 4.5, distMax: 28, distInicial: 14.5,
  inclMin: 12, inclMax: 86, inclInicial: 50,   // nunca por debajo del horizonte
  giroInicial: 35,
  fov: 38,
  velGiro: 0.35, velZoom: 0.0012, amortiguacion: 0.12
};

// Ambiente de cada fase. luz: color e intensidad del sol; amb: luz de relleno; fondo y niebla.
// «viento» y «lluvia» etc. son efectos que se encienden en js/ui/efectos3d.js.
export const AMBIENTE = {
  prep:     {fondo:0xF2E3C6, niebla:[0xF2E3C6, 30, 70], sol:[0xFFE2B0, 2.2], amb:[0xFFF0DC, 1.5], solPos:[7, 10, 5], expo:1.0},
  riada:    {fondo:0x56606B, niebla:[0x56606B, 14, 40], sol:[0xB9C8D8, 1.1], amb:[0x9AA7B6, 1.15], solPos:[3, 10, 4], expo:0.95},
  temporal: {fondo:0x6F7478, niebla:[0x6F7478, 10, 32], sol:[0xC8CED2, 1.0], amb:[0xAAB0B4, 1.1], solPos:[5, 9, 3], expo:0.95},
  incendio: {fondo:0x120907, niebla:[0x120907, 12, 36], sol:[0x442218, 0.15], amb:[0x3A1E18, 0.7], solPos:[4, 9, 4], expo:1.1},
  tormenta: {fondo:0x2B3038, niebla:[0x2B3038, 12, 34], sol:[0x9BA7B4, 0.8], amb:[0x6B7582, 1.0], solPos:[2, 10, 3], expo:1.0},
  alud:     {fondo:0xDDE8F2, niebla:[0xDDE8F2, 12, 36], sol:[0xEAF2FF, 1.5], amb:[0xCFE0F2, 1.0], solPos:[6, 10, 6], expo:1.05},
  sequia:   {fondo:0xE6CC86, niebla:[0xE6CC86, 12, 38], sol:[0xFFD27A, 1.9], amb:[0xF2DC9C, 0.9], solPos:[7, 10, 5], expo:1.0},
  ola:      {fondo:0xE9A079, niebla:[0xE9A079, 14, 42], sol:[0xFF9A62, 2.1], amb:[0xFFC9A6, 0.9], solPos:[7, 10, 5], expo:1.0},
  plaga:    {fondo:0xDCD3AE, niebla:[0xDCD3AE, 14, 44], sol:[0xFFE9B0, 1.7], amb:[0xEFE3BF, 0.95], solPos:[6, 10, 5], expo:1.0},
  deslizamiento: {fondo:0xB9AE9C, niebla:[0xB9AE9C, 14, 44], sol:[0xE8D9BD, 1.4], amb:[0xCDBFA7, 0.95], solPos:[6, 10, 5], expo:1.0}
};

// Quién manda en la luz cuando caen dos desastres a la vez (gana el número más alto).
export const FUERZA_AMBIENTE = {incendio:9, tormenta:8, temporal:7, alud:6, riada:5, ola:4, sequia:3, deslizamiento:2, plaga:1};

// Qué efectos se encienden con cada desastre (js/ui/efectos3d.js) y se SUMAN cuando hay dos.
export const EFECTOS = {
  riada:    ['lluvia', 'relampagos', 'ventanas'],
  temporal: ['olas', 'espuma'],
  incendio: ['humo', 'brasas', 'fuego'],
  tormenta: ['lluviaLigera', 'rayos', 'ventanas'],
  alud:     ['nieve', 'viento'],
  sequia:   ['calima', 'secado'],
  ola:      ['calor', 'sombra'],
  plaga:    ['enjambre'],
  deslizamiento: ['rocas']
};

// Riesgo: umbrales y colores planos con el porcentaje encima.
export const RIESGO = {ambar: 0.15, rojo: 0.35, verde: 0x3E9B4A, colorAmbar: 0xE0A030, colorRojo: 0xC2391F, minimo: 0.02};

// Tiempos de las animaciones, en segundos.
export const TIEMPOS = {
  ritmoImpacto: 1000,        // ms entre sucesos del impacto (antes 700 en el mapa plano)
  transicionAmbiente: 0.9,
  subidaAgua: 0.8, escalonRio: 0.14,
  propagarFuego: 0.12, anuncioRayo: 0.35, rayo: 0.18,
  bajadaAlud: 0.9, rocas: 1.1,
  temblor: 0.35, temblorFuerza: 0.06,
  recurso: 0.6,
  caminarCasilla: 0.32, gestoPeriodo: 0.7
};

// Los muñequitos.
export const MUNECO = {radio: 0.075, alto: 0.22, tamanoCabeza: 0.07};

// Cuántas partículas como máximo (el móvil tiene que ir fluido).
export const PARTICULAS = {lluvia: 450, nieve: 350, brasas: 160, humo: 40, espuma: 90, enjambre: 70, polvo: 50};

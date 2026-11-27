// Temas (pieles) del juego (T-15): cambian sólo el aspecto, nunca una regla ni un número.
// Los colores de la interfaz viven en css/estilos.css (body[data-tema="…"]); aquí van el orden, si
// es principal o cómo se desbloquea (ver cumple() en js/progreso.js), las fuentes que hay que cargar,
// la muestra de color del menú y los colores del mapa 3D que cambian respecto a data/escena3d.js.
// Nombre, descripción y condición de desbloqueo: i18n/es.json, «temas».
//
// escena (todo opcional): suelo (COLOR_SUELO por tipo), agua (COLOR_AGUA), paleta (PALETA) y
// prep (el ambiente de la preparación: fondo, niebla, sol y amb, como en AMBIENTE.prep).
// Los ambientes de cada desastre no cambian con el tema (pendiente de revisar jugando: T-16).

// Casillas con suelo de pueblo (casas, ayuntamiento, observatorio, aljibe, refugio).
const PUEBLO = ['C', 'A', 'O', 'W', 'H'];
const suelos = (color, tipos = PUEBLO) => Object.fromEntries(tipos.map(t => [t, color]));
const prep = (fondo, sol, amb, niebla = [30, 70]) => ({fondo, niebla: [fondo, niebla[0], niebla[1]], sol, amb});

export const TEMA_POR_DEFECTO = 'papel';
export const TEMA_OSCURO = 'noche';

export const TEMAS = [
  // ---------- principales ----------
  {id: 'papel', principal: true, muestra: ['#F3ECDD', '#23262B', '#A3C273'],
    fuentes: 'family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700',
    escena: {}},
  {id: 'diorama', principal: true, muestra: ['#CFE6F0', '#E8684A', '#BADC9C'],
    fuentes: 'family=Baloo+2:wght@600;700;800&family=Nunito:wght@500;600;700;800',
    escena: {
      suelo: {P: 0xBADC9C, B: 0x82B981, X: 0xCFE3B2, G: 0xF2DA8C, ...suelos(0xEDE3CC)},
      agua: {R: 0x8FCDE7, M: 0x7DB8DE},
      paleta: {hojas: [0x5E9E68, 0x6AAE72, 0x75B97C], tejados: [0xE8684A, 0xF07C5E, 0xD95B40], pared: 0xFFF7EA, hierba: 0x9CCB82, cultivo: 0x8CC46A, tierra: 0x9C8466, bordePeana: 0x7E6A52},
      prep: prep(0xCFE6F0, [0xFFF4E0, 2.0], [0xEAF4FF, 1.6])}},
  {id: 'mesa', principal: true, muestra: ['#BDE7F7', '#5DBB4A', '#FFD23F'],
    fuentes: 'family=Lilita+One&family=Nunito:wght@600;700;800',
    escena: {
      suelo: {P: 0x8CCB4F, B: 0x4FA34A, X: 0xB5D98A, G: 0xF4C542, ...suelos(0xE8D4A8)},
      agua: {R: 0x3FA9E0, M: 0x2F8FD0},
      paleta: {hojas: [0x2F7D3A, 0x3A8F44, 0x44A04E], tejados: [0xE2533A, 0xF06A4A, 0xD04A30], pared: 0xFFF1D6, hierba: 0x6FB83A, cultivo: 0x7CC24A, tierra: 0x8B5A2B, bordePeana: 0x5E3A1A},
      prep: prep(0xBDE7F7, [0xFFF0C8, 2.3], [0xFFFFFF, 1.5])}},
  {id: 'noche', principal: true, oscuro: true, muestra: ['#10141B', '#F2B544', '#4B6246'],
    fuentes: 'family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600;700',
    escena: {
      suelo: {P: 0x4B6246, B: 0x304A3A, X: 0x5E6A4C, L: 0x5E534A, S: 0xC7D0DC, G: 0x7D6C3B, ...suelos(0x6B6050)},
      agua: {R: 0x2F5F88, M: 0x22405E},
      paleta: {hojas: [0x22392B, 0x26412F, 0x2C4A35], tejados: [0x8A3D2C, 0x7A3526, 0x963F2E], pared: 0xCDBD9C, hierba: 0x3E5A3A, cultivo: 0x4A6A3A, tierra: 0x2A2018, bordePeana: 0x18120D},
      prep: prep(0x1A2231, [0xFFC98A, 1.4], [0x8090B0, 1.1])}},

  // ---------- para desbloquear ----------
  {id: 'protocolo', unlock: {tipo: 'victoriasAlcalde', alcalde: 'ingeniera', n: 1}, oscuro: true, muestra: ['#111518', '#FF7A1A', '#4D5B49'],
    fuentes: 'family=JetBrains+Mono:wght@400;600;700&family=Inter+Tight:wght@400;600;700',
    escena: {
      suelo: {P: 0x4D5B49, B: 0x3E5446, X: 0x5A6450, L: 0x5C5852, S: 0xB8BEC4, G: 0x6E6747, ...suelos(0x5E6266)},
      agua: {R: 0x2E5674, M: 0x223E55},
      paleta: {hojas: [0x2B3B31, 0x314437, 0x384C3E], tejados: [0x5A626B, 0x525A62, 0x626A73], pared: 0x9AA2AA, hierba: 0x44523F, cultivo: 0x56623F, tierra: 0x22282D, bordePeana: 0x15191C},
      prep: prep(0x0C1013, [0xC8D4DC, 1.6], [0x8A96A0, 1.2])}},
  {id: 'cuaderno', unlock: {tipo: 'victoriasAlcalde', alcalde: 'agricultor', n: 1}, muestra: ['#F7F1E3', '#2E4A6B', '#B9CFA0'],
    fuentes: 'family=Kalam:wght@400;700&family=Crimson+Pro:ital,wght@0,400;0,600;1,400',
    escena: {
      suelo: {P: 0xB9CFA0, B: 0x7E9F78, X: 0xCADBB4, G: 0xE2CB86, ...suelos(0xE6DCC4)},
      agua: {R: 0x7FAFD0, M: 0x6E9FC6},
      paleta: {hojas: [0x5D8460, 0x6A9068, 0x76A072], tejados: [0xC46A4E, 0xB85F45, 0xCF7656], pared: 0xFBF5E8, hierba: 0x9CB886, cultivo: 0x8DB07A, tierra: 0x9C8C70, bordePeana: 0x7A6C54},
      prep: prep(0xF7F1E3, [0xFFF1D6, 2.0], [0xFFF8EC, 1.6])}},
  {id: 'carta', unlock: {tipo: 'victoriasAlcalde', alcalde: 'meteorologa', n: 1}, muestra: ['#E4D3AC', '#3B2A18', '#9E2B1E'],
    fuentes: 'family=IM+Fell+English+SC&family=EB+Garamond:ital,wght@0,400;0,600;1,400',
    escena: {
      suelo: {P: 0xC9B98C, B: 0x7A7350, X: 0xD2C49A, L: 0xA88B62, S: 0xF3EAD6, G: 0xD9BE7A, ...suelos(0xD8C59C)},
      agua: {R: 0x6E8FA0, M: 0x5E7F92},
      paleta: {hojas: [0x5A5638, 0x65603F, 0x6F6A46], tejados: [0x8C4A2F, 0x7E4129, 0x985336], pared: 0xEFE3C8, hierba: 0xA89A6A, cultivo: 0x9A8E5A, tierra: 0x6B4E2E, bordePeana: 0x4A3420},
      prep: prep(0xE4D3AC, [0xFFE0B0, 1.9], [0xF0E0C0, 1.4])}},
  {id: 'caserio', unlock: {tipo: 'victoriasAlcalde', alcalde: 'tesorero', n: 1}, muestra: ['#2F5D3A', '#A63A2A', '#F4F0E6'],
    fuentes: 'family=Alegreya+Sans+SC:wght@700;800&family=Alegreya+Sans:wght@400;500;700',
    escena: {
      suelo: {P: 0x6FAE4E, B: 0x2F6B3A, X: 0x8EBF6A, L: 0x8E8A80, G: 0xC9B04A, ...suelos(0xC9C2B0)},
      agua: {R: 0x4C8FB0, M: 0x3E7CA0},
      paleta: {hojas: [0x1F4F2A, 0x255A31, 0x2C6538], tejados: [0xA63A2A, 0xB0432F, 0x983224], pared: 0xFAF7F0, hierba: 0x5E9A40, cultivo: 0x7AA845, tierra: 0x3B2A20, bordePeana: 0x2A1F18},
      prep: prep(0xDCEBEE, [0xFFF0D8, 2.1], [0xF0F6FF, 1.5])}},
  {id: 'boletin', unlock: {tipo: 'victoriasAlcalde', alcalde: 'enfermera', n: 1}, muestra: ['#F2EFE8', '#111111', '#C8102E'],
    fuentes: 'family=Playfair+Display:wght@700;900&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=Oswald:wght@500;600',
    escena: {
      suelo: {P: 0xC4C4C0, B: 0x6E6E6E, X: 0xBDBDB8, Q: 0x3A3A3A, L: 0x9A9A9A, S: 0xF4F4F4, G: 0xB0ADA4, U: 0xA8A8A4, V: 0xB4B4B0, E: 0x7E7E7A, ...suelos(0xD8D6D0)},
      agua: {R: 0x5A5A5A, M: 0x3A3A3A},
      paleta: {hojas: [0x3E3E3E, 0x484848, 0x525252], tejados: [0x2A2A2A, 0x333333, 0x3C3C3C], pared: 0xF6F6F3, hierba: 0x8A8A86, cultivo: 0x7A7A74, tierra: 0x2A2A2A, bordePeana: 0x111111},
      prep: prep(0xE9E5DC, [0xFFFFFF, 2.0], [0xFFFFFF, 1.4])}},
  {id: 'comic', unlock: {tipo: 'victorias', pueblo: 'errekalde', n: 1}, muestra: ['#FFE45C', '#E63946', '#2F9BEA'],
    fuentes: 'family=Bangers&family=Comic+Neue:wght@400;700',
    escena: {
      suelo: {P: 0x9BD447, B: 0x3FAE49, X: 0xC2E07A, G: 0xFFC93C, ...suelos(0xF2DDA8)},
      agua: {R: 0x2F9BEA, M: 0x1F7DD6},
      paleta: {hojas: [0x1F7A33, 0x2A8C3C, 0x35A046], tejados: [0xE63946, 0xF05060, 0xD02A38], pared: 0xFFF8E1, hierba: 0x7CC23A, cultivo: 0x8AD04A, tierra: 0x3A2A1A, bordePeana: 0x111111},
      prep: prep(0x8ED6F5, [0xFFFFFF, 2.4], [0xFFFFFF, 1.6])}},
  {id: 'nordico', unlock: {tipo: 'retoOro', n: 1}, muestra: ['#F3F5F6', '#1E2A33', '#B5452F'],
    fuentes: 'family=Manrope:wght@300;500;700',
    escena: {
      suelo: {P: 0xD9E2E0, B: 0x4E6B5E, X: 0xCFD8D4, L: 0x9AA3A6, G: 0xC9CCB8, ...suelos(0xE8EDEE)},
      agua: {R: 0x7E9BB0, M: 0x6E8CA3},
      paleta: {hojas: [0x3E5A4E, 0x48665A, 0x527264], tejados: [0x2E3B45, 0x37454F, 0x404F5A], pared: 0xFFFFFF, hierba: 0xC5D0CC, cultivo: 0xB4C2B0, tierra: 0x9AA3A6, bordePeana: 0x6B7A85},
      prep: prep(0xE6ECEF, [0xEAF2FF, 1.8], [0xDDE8F2, 1.5], [22, 60])}}
];

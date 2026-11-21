// Casillas del mapa: tamaño, cuáles se pueden construir, color de fondo e icono de cada tipo.
// (Los nombres y las descripciones están en i18n/es.json, bajo «casillas».)
export const COLS = 7;
export const FILAS = 8;
export const N = COLS * FILAS;

// Casillas con edificio: las que pueden dañarse, protegerse y repararse.
export const BUILD = new Set(['C','A','G','O','W']);

// Ruinas (U), solar vacío (V) y terraplén (E): T-12. No son edificios.
export const BG = {B:'#4E7A4F',X:'#B7C48F',Q:'#5B544C',L:'#C4A97F',P:'#A9C285',R:'#5E9BD1',C:'#D9C9A3',A:'#D9C9A3',G:'#C9B57E',O:'#D9C9A3',W:'#D9C9A3',M:'#3C7DB8',S:'#E3E9EE',U:'#B9A88A',V:'#BDB08F',E:'#8E7F63'};

export const ICON = {
  B:'<circle cx="10" cy="12" r="6" fill="#2F5A33"/><circle cx="18" cy="15" r="6" fill="#36673A"/><rect x="13" y="19" width="2" height="5" fill="#5A4027"/>',
  X:'<rect x="6" y="15" width="5" height="6" rx="1" fill="#7A5A3A"/><rect x="16" y="13" width="5" height="8" rx="1" fill="#7A5A3A"/><ellipse cx="8.5" cy="15" rx="2.5" ry="1" fill="#C9A77A"/><ellipse cx="18.5" cy="13" rx="2.5" ry="1" fill="#C9A77A"/>',
  Q:'<path d="M6 21 L9 9 M13 22 L14 7 M20 21 L21 10" stroke="#2B2724" stroke-width="2.5" stroke-linecap="round"/>',
  L:'<path d="M4 22 L24 6 M4 14 L16 4 M12 24 L24 14" stroke="#8C7350" stroke-width="2"/>',
  P:'<path d="M7 19 l2-4 l2 4 M16 12 l2-4 l2 4" stroke="#7FA05E" stroke-width="1.6" fill="none"/>',
  R:'<path d="M3 11 Q8 7 14 11 T25 11 M3 18 Q8 14 14 18 T25 18" fill="none" stroke="#DDEBF7" stroke-width="2"/>',
  M:'<path d="M2 9 Q6 5 10 9 T18 9 T26 9 M2 16 Q6 12 10 16 T18 16 T26 16 M2 23 Q6 19 10 23 T18 23 T26 23" fill="none" stroke="#CFE2F3" stroke-width="2"/>',
  S:'<path d="M3 23 L11 8 L15 14 L18 10 L25 23 Z" fill="#9AA8B5"/><path d="M8.5 13 L11 8 L13.5 12 L12 13 L10.5 12 Z M16.5 12.5 L18 10 L20 14 Z" fill="#FFFFFF"/>',
  C:'<path d="M5 13 L14 5 L23 13 Z" fill="#B5502E"/><rect x="8" y="13" width="12" height="9" fill="#F7EEDC" stroke="#6B5B45"/><rect x="12" y="16" width="4" height="6" fill="#6B5B45"/>',
  A:'<rect x="4" y="11" width="20" height="12" fill="#F7EEDC" stroke="#6B5B45"/><path d="M3 11 L14 4 L25 11 Z" fill="#7A5A9E"/><rect x="8" y="15" width="3" height="8" fill="#6B5B45"/><rect x="17" y="15" width="3" height="8" fill="#6B5B45"/>',
  G:'<path d="M4 12 L14 5 L24 12 L24 23 L4 23 Z" fill="#A9452B"/><path d="M11 23 L11 16 L17 16 L17 23" fill="#F7EEDC"/>',
  O:'<rect x="6" y="15" width="16" height="8" fill="#F7EEDC" stroke="#6B5B45"/><path d="M6 15 A8 8 0 0 1 22 15 Z" fill="#7C8FA6"/><path d="M16 9 L23 5" stroke="#3B4A5C" stroke-width="2"/>',
  U:'<path d="M5 22 L5 15 L9 12 L9 22 Z" fill="#E8DCC2" stroke="#6B5B45"/><path d="M12 22 L14 17 L18 18 L21 22 Z" fill="#8C7A60"/><path d="M15 13 L19 9 L22 12" stroke="#B5502E" stroke-width="2" fill="none"/><rect x="9" y="20" width="12" height="2" fill="#6B5B45"/>',
  V:'<rect x="5" y="9" width="18" height="13" fill="none" stroke="#6B5B45" stroke-dasharray="2 2"/><path d="M9 18 l1-2 l1 2 M16 15 l1-2 l1 2" stroke="#7FA05E" stroke-width="1.4" fill="none"/>',
  E:'<path d="M3 22 L9 10 L19 10 L25 22 Z" fill="#7A6A50"/><path d="M9 10 L19 10" stroke="#C9B58E" stroke-width="2"/><path d="M6 17 H22" stroke="#5E5240" stroke-width="1"/>',
  W:'<rect x="7" y="9" width="14" height="14" rx="2" fill="#7C9DB8" stroke="#3B5468"/><path d="M7 15 H21" stroke="#CFE2F3" stroke-width="2"/><rect x="11" y="5" width="6" height="4" fill="#3B5468"/>'
};

// Temas (T-15) y ajustes de pantalla: qué tema se ve, si la Noche entra sola con el modo oscuro del
// móvil y a qué altura queda el panel de la partida. Sólo aspecto: no toca ni las reglas ni el azar.
// Se guarda aparte del progreso (en este navegador), porque es una preferencia de pantalla.
import { TEMAS, TEMA_POR_DEFECTO, TEMA_OSCURO } from '../../data/temas.js';
import { COLOR_SUELO, COLOR_AGUA, PALETA, AMBIENTE } from '../../data/escena3d.js';
import { unlockedTema } from '../progreso.js';

const CLAVE = 'disaster-ajustes';
export const ALTURAS_PANEL = ['plegado', 'normal', 'grande'];
export const AJUSTES = {tema: TEMA_POR_DEFECTO, nocheAuto: true, panel: 'normal'};

export function cargarAjustes() {
  try {
    const s = typeof localStorage !== 'undefined' && localStorage.getItem(CLAVE);
    if (s) Object.assign(AJUSTES, JSON.parse(s));
  } catch (e) { /* sin almacenamiento: se usan los de siempre */ }
  if (!ALTURAS_PANEL.includes(AJUSTES.panel)) AJUSTES.panel = 'normal';
  if (!TEMAS.some(m => m.id === AJUSTES.tema)) AJUSTES.tema = TEMA_POR_DEFECTO;
}
export function guardarAjustes() {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(CLAVE, JSON.stringify(AJUSTES)); } catch (e) { /* idem */ }
}

const movilOscuro = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;

// El tema que se ve: el elegido si está desbloqueado (si no, el de por defecto); con «Noche automática»
// y el móvil en modo oscuro, la Noche, salvo que el elegido ya sea oscuro.
export function temaVisible() {
  const elegido = unlockedTema(AJUSTES.tema) ? AJUSTES.tema : TEMA_POR_DEFECTO;
  const m = TEMAS.find(x => x.id === elegido);
  if (AJUSTES.nocheAuto && movilOscuro() && !m.oscuro) return TEMA_OSCURO;
  return elegido;
}

// Copia de los colores del 3D de siempre, para volver a ellos antes de aplicar otro tema.
const BASE = {suelo: {...COLOR_SUELO}, agua: {...COLOR_AGUA}, paleta: JSON.parse(JSON.stringify(PALETA)), prep: JSON.parse(JSON.stringify(AMBIENTE.prep))};

// Pone los colores del 3D del tema encima de los de siempre (data/escena3d.js). El mapa los lee al
// construir las casillas, así que después hay que pedirle que las rehaga (mapa3d.refrescarTema).
export function aplicarEscena(id) {
  const e = (TEMAS.find(x => x.id === id) || {}).escena || {};
  Object.assign(COLOR_SUELO, BASE.suelo, e.suelo || {});
  Object.assign(COLOR_AGUA, BASE.agua, e.agua || {});
  Object.assign(PALETA, JSON.parse(JSON.stringify(BASE.paleta)), e.paleta || {});
  Object.assign(AMBIENTE.prep, JSON.parse(JSON.stringify(BASE.prep)), e.prep || {});
}

let ultimo = null;
// Aplica el tema visible a la página (atributo data-tema y fuentes) y a los colores del 3D.
// Devuelve true si ha cambiado, para que el mapa se rehaga.
export function aplicarTema() {
  const id = temaVisible();
  if (id === ultimo) return false;
  ultimo = id;
  aplicarEscena(id);
  if (typeof document === 'undefined' || !document.body) return true;
  document.body.dataset.tema = id;
  const m = TEMAS.find(x => x.id === id);
  if (m.fuentes && !document.querySelector('link[data-fuentes="' + id + '"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.dataset.fuentes = id;
    l.href = 'https://fonts.googleapis.com/css2?' + m.fuentes + '&display=swap';
    document.head.appendChild(l);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = m.muestra[0];
  return true;
}

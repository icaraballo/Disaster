// Guardado de la partida en curso en localStorage, con versión de esquema y estado del azar (RS y RI).
// Sin pantalla: sólo lee y escribe en localStorage si está disponible.
import { TOWNS } from '../data/pueblos.js';
import { ALCALDES } from '../data/alcaldes.js';
import { estadoAzar, restaurarAzar } from './azar.js';
import { G, setG, computeGeo } from './estado.js';
import { PERKS, EVENTS } from './mejoras.js';

export const ESQUEMA_GUARDADO = 1;
export const CLAVE_PARTIDA = 'disaster-partida';

export let falloGuardado = null;
export function limpiarFalloGuardado() { falloGuardado = null; }

// Migra un sobre guardado al esquema actual. Devuelve null si está dañado o es de una versión incompatible.
export function migrarGuardado(sobre) {
  if (!sobre || typeof sobre !== 'object' || typeof sobre.v !== 'number') return null;
  if (sobre.v < 1 || sobre.v > ESQUEMA_GUARDADO) return null;
  const g = sobre.G;
  if (!g || !TOWNS[g.town] || !ALCALDES.some(a => a.id === g.alc) || !Array.isArray(g.tiles) || !Array.isArray(g.schedule)) return null;
  g.tiles.forEach(x => {
    if (x.contra === undefined) x.contra = false;
    if (x.reforzada === undefined) x.reforzada = false;
  });
  if (g.sondeoHecho === undefined) g.sondeoHecho = false;
  if (g.eventCtx === undefined) g.eventCtx = g.lastEvent ? {id: g.lastEvent} : null;
  sobre.v = ESQUEMA_GUARDADO;
  return sobre;
}

export function borrarPartidaGuardada() {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(CLAVE_PARTIDA); } catch (e) { /* sin almacenamiento */ }
}

// Comprueba al arrancar si había una partida guardada dañada o de otra versión incompatible.
export function verificarGuardadoInicial() {
  if (typeof localStorage === 'undefined') return;
  let crudo;
  try { crudo = localStorage.getItem(CLAVE_PARTIDA); } catch (e) { return; }
  if (!crudo) return;
  try {
    const sobre = migrarGuardado(JSON.parse(crudo));
    if (!sobre || sobre.G.phase === 'end') { borrarPartidaGuardada(); if (!sobre) falloGuardado = 'incompatible'; }
  } catch (e) {
    borrarPartidaGuardada();
    falloGuardado = 'incompatible';
  }
}

export function guardarPartida() {
  if (!G || G.phase === 'end') { borrarPartidaGuardada(); return true; }
  if (typeof localStorage === 'undefined') return false;
  try {
    const copia = JSON.parse(JSON.stringify(G));
    copia.event = null;
    if (copia.result && Array.isArray(copia.result.offers)) copia.result.offers = copia.result.offers.map(o => ({id: o.id}));
    const sobre = {v: ESQUEMA_GUARDADO, G: copia, azar: estadoAzar()};
    localStorage.setItem(CLAVE_PARTIDA, JSON.stringify(sobre));
    falloGuardado = null;
    return true;
  } catch (e) {
    falloGuardado = 'guardar';
    return false;
  }
}

// Resumen ligero para el botón «Continuar temporada» del menú (sin mutar G ni el azar).
export function leerResumenGuardado() {
  if (typeof localStorage === 'undefined') return null;
  let crudo;
  try { crudo = localStorage.getItem(CLAVE_PARTIDA); } catch (e) { return null; }
  if (!crudo) return null;
  try {
    const sobre = migrarGuardado(JSON.parse(crudo));
    if (!sobre || sobre.G.phase === 'end') return null;
    const g = sobre.G;
    return {town: g.town, alc: g.alc, idx: g.idx, daily: g.daily || null, phase: g.phase};
  } catch (e) {
    return null;
  }
}

// Carga y restaura la partida guardada en G y en RS/RI.
export function continuarPartida() {
  if (typeof localStorage === 'undefined') return false;
  let crudo;
  try { crudo = localStorage.getItem(CLAVE_PARTIDA); } catch (e) { falloGuardado = 'cargar'; return false; }
  if (!crudo) return false;
  try {
    const sobre = migrarGuardado(JSON.parse(crudo));
    if (!sobre || sobre.G.phase === 'end') { borrarPartidaGuardada(); falloGuardado = 'incompatible'; return false; }
    const g = sobre.G;
    setG(g);
    computeGeo();
    if (sobre.azar) restaurarAzar(sobre.azar);
    if (g.result && Array.isArray(g.result.offers)) {
      g.result.offers = g.result.offers.map(o => PERKS.find(p => p.id === o.id)).filter(Boolean);
    }
    if (g.phase === 'event') {
      const id = (g.eventCtx && g.eventCtx.id) || g.lastEvent;
      const ev = EVENTS.find(e => e.id === id);
      if (ev) g.event = ev.mk(g.eventCtx || {id});
      else g.phase = 'forecast';
    }
    falloGuardado = null;
    return true;
  } catch (e) {
    borrarPartidaGuardada();
    falloGuardado = 'cargar';
    return false;
  }
}

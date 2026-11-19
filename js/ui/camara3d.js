// Cámara libre del mapa 3D: gira 360°, se inclina hasta justo por encima del horizonte, zoom y desplazamiento.
// Sólo mueve la cámara: no sabe nada del juego. Límites en data/escena3d.js.
import { CAMARA } from '../../data/escena3d.js';

const rad = (g) => g * Math.PI / 180;

export function crearCamara(THREE, camara, elemento, { alTocar, limiteX = 4.5, limiteZ = 5 } = {}) {
  const e = { giro: CAMARA.giroInicial, incl: CAMARA.inclInicial, dist: CAMARA.distInicial, x: 0, z: 0 };
  const meta = { ...e };
  const punteros = new Map();
  let inicio = null, hayCambios = true, pidiendo = null;
  const pedir = () => { hayCambios = true; if (pidiendo) pidiendo(); };

  const limitar = () => {
    meta.incl = Math.min(CAMARA.inclMax, Math.max(CAMARA.inclMin, meta.incl));
    meta.dist = Math.min(CAMARA.distMax, Math.max(CAMARA.distMin, meta.dist));
    meta.x = Math.min(limiteX, Math.max(-limiteX, meta.x));
    meta.z = Math.min(limiteZ, Math.max(-limiteZ, meta.z));
  };
  function colocar() {
    const a = rad(e.giro), i = rad(e.incl);
    camara.position.set(e.x + e.dist * Math.cos(i) * Math.sin(a), e.dist * Math.sin(i), e.z + e.dist * Math.cos(i) * Math.cos(a));
    camara.lookAt(e.x, 0.2, e.z);
  }
  function paneo(dx, dy) {
    const k = e.dist * 0.0021, a = rad(meta.giro);
    // derecha y «adelante» de la cámara sobre el suelo
    meta.x += (-Math.cos(a) * dx + Math.sin(a) * dy) * k;
    meta.z += (Math.sin(a) * dx + Math.cos(a) * dy) * k;
    limitar();
  }
  const dist2 = () => { const p = [...punteros.values()]; return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };
  const medio = () => { const p = [...punteros.values()]; return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }; };

  let anteriorDist = 0, anteriorMedio = null;
  function abajo(ev) {
    elemento.setPointerCapture && elemento.setPointerCapture(ev.pointerId);
    punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, boton: ev.button });
    if (punteros.size === 1) inicio = { x: ev.clientX, y: ev.clientY, t: performance.now(), mov: 0 };
    else { inicio = null; anteriorDist = dist2(); anteriorMedio = medio(); }
  }
  function mover(ev) {
    const p = punteros.get(ev.pointerId); if (!p) return;
    const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
    p.x = ev.clientX; p.y = ev.clientY;
    if (punteros.size === 1) {
      if (inicio) inicio.mov += Math.abs(dx) + Math.abs(dy);
      if (p.boton === 2 || ev.shiftKey) paneo(dx, dy);
      else { meta.giro -= dx * CAMARA.velGiro; meta.incl += dy * CAMARA.velGiro; limitar(); }
    } else if (punteros.size === 2) {
      const d = dist2(), m = medio();
      meta.dist *= anteriorDist / Math.max(1, d);
      paneo(m.x - anteriorMedio.x, m.y - anteriorMedio.y);
      anteriorDist = d; anteriorMedio = m; limitar();
    }
    pedir();
  }
  function arriba(ev) {
    const eraUno = punteros.size === 1;
    punteros.delete(ev.pointerId);
    if (eraUno && inicio && inicio.mov < 8 && performance.now() - inicio.t < 450 && alTocar) alTocar(ev.clientX, ev.clientY);
    inicio = null;
    if (punteros.size === 1) { anteriorMedio = null; }
  }
  function rueda(ev) { ev.preventDefault(); meta.dist *= Math.exp(ev.deltaY * CAMARA.velZoom * (ev.deltaMode === 1 ? 30 : 1)); limitar(); pedir(); }

  elemento.style.touchAction = 'none';
  elemento.addEventListener('pointerdown', abajo);
  elemento.addEventListener('pointermove', mover);
  elemento.addEventListener('pointerup', arriba);
  elemento.addEventListener('pointercancel', arriba);
  elemento.addEventListener('wheel', rueda, { passive: false });
  elemento.addEventListener('contextmenu', (ev) => ev.preventDefault());

  colocar();
  return {
    estado: e, meta,
    alPedir(f) { pidiendo = f; },
    recolocar() { meta.giro = CAMARA.giroInicial; meta.incl = CAMARA.inclInicial; meta.dist = CAMARA.distInicial; meta.x = 0; meta.z = 0; pedir(); },
    // Avanza la suavización. Devuelve true mientras la cámara sigue moviéndose.
    actualizar() {
      const k = CAMARA.amortiguacion;
      let mueve = false;
      for (const c of ['giro', 'incl', 'dist', 'x', 'z']) {
        const d = meta[c] - e[c];
        if (Math.abs(d) > 0.002) { e[c] += d * k; mueve = true; } else e[c] = meta[c];
      }
      if (mueve || hayCambios) colocar();
      hayCambios = false;
      return mueve;
    },
    liberar() {
      elemento.removeEventListener('pointerdown', abajo); elemento.removeEventListener('pointermove', mover);
      elemento.removeEventListener('pointerup', arriba); elemento.removeEventListener('pointercancel', arriba);
      elemento.removeEventListener('wheel', rueda);
    }
  };
}

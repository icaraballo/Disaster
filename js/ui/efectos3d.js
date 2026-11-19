// Efectos de partículas y luces del mapa 3D: lluvia, nieve, brasas, humo, espuma, enjambre, polvo, rayos y fuego.
// Sólo es dibujo: todo el azar sale de ./cosmetico.js (nunca de RS/RI del juego).
import { C, entre } from './cosmetico.js';
import { PARTICULAS, TIEMPOS } from '../../data/escena3d.js';

export function crearEfectos(THREE, escena) {
  const grupo = new THREE.Group(); escena.add(grupo);

  // textura redonda y suave para las partículas
  const tex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 1, 16, 16, 15);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  })();

  // sistema genérico de puntos: reaparecen al salir de la caja
  function puntos(n, { color, tam, opacidad = 1, caja = [14, 9, 14], mezcla = THREE.NormalBlending, alto = 0 }) {
    const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { pos[k * 3] = (C() - 0.5) * caja[0]; pos[k * 3 + 1] = alto + C() * caja[1]; pos[k * 3 + 2] = (C() - 0.5) * caja[2]; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color, size: tam, map: tex, transparent: true, opacity: opacidad, depthWrite: false, blending: mezcla, sizeAttenuation: true });
    const p = new THREE.Points(g, m); p.frustumCulled = false; p.visible = false; grupo.add(p);
    return { p, pos, vel, n, caja, alto, m, activo: false };
  }

  const S = {
    lluvia: puntos(PARTICULAS.lluvia, { color: 0xD8E8F6, tam: 0.14, opacidad: 0.9 }),
    lluviaLigera: puntos(Math.floor(PARTICULAS.lluvia * 0.45), { color: 0xD8E8F6, tam: 0.12, opacidad: 0.8 }),
    nieve: puntos(PARTICULAS.nieve, { color: 0xFFFFFF, tam: 0.12, opacidad: 0.95 }),
    brasas: puntos(PARTICULAS.brasas, { color: 0xFF8A3A, tam: 0.1, opacidad: 0.95, mezcla: THREE.AdditiveBlending, caja: [9, 4, 9] }),
    humo: puntos(PARTICULAS.humo, { color: 0x8A8480, tam: 0.9, opacidad: 0.35, caja: [8, 3, 8] }),
    espuma: puntos(PARTICULAS.espuma, { color: 0xFFFFFF, tam: 0.14, opacidad: 0.9, caja: [6, 1.2, 1.2] }),
    enjambre: puntos(PARTICULAS.enjambre, { color: 0x2B2418, tam: 0.1, opacidad: 0.95, caja: [3, 1.4, 3] }),
    polvo: puntos(PARTICULAS.polvo, { color: 0xE8C97A, tam: 0.5, opacidad: 0.25, caja: [16, 3, 16] })
  };
  const veloc = { lluvia: [0, -9, 0], lluviaLigera: [0, -7, 0], nieve: [0, -0.9, 0], brasas: [0, 0.8, 0], humo: [0, 0.35, 0], espuma: [0, 0.4, 0], enjambre: [0, 0, 0], polvo: [0.3, 0, 0.1] };
  let viento = 0;
  const costa = { z: 3.4, x0: -3.2, x1: 3.2 };   // dónde nace la espuma (lo fija mapa3d)
  let tEnjambre = 0, enjambreMeta = null;

  function encender(lista) {
    Object.entries(S).forEach(([k, s]) => { s.activo = lista.includes(k); s.p.visible = s.activo; });
    viento = lista.includes('viento') ? 1 : 0;
  }
  function fijarCosta(z, x0, x1) { costa.z = z; costa.x0 = x0; costa.x1 = x1; }
  function fijarEnjambre(destinos) { enjambreMeta = destinos && destinos.length ? destinos : null; tEnjambre = 0; }

  function actualizar(dt, t) {
    for (const k in S) {
      const s = S[k]; if (!s.activo) continue;
      const v = veloc[k], a = s.pos, n = s.n, [bx, by, bz] = s.caja;
      if (k === 'enjambre') {
        tEnjambre += dt;
        const d = enjambreMeta || [[0, 0.5, 0]];
        for (let i = 0; i < n; i++) {
          const tg = d[i % d.length], f = Math.min(1, tEnjambre / 5);
          const ang = t * (1.5 + (i % 5) * 0.3) + i;
          const cx = -7 + (tg[0] + 7) * f + Math.sin(ang) * 0.5, cz = tg[2] + (1 - f) * 3 + Math.cos(ang * 1.3) * 0.5;
          a[i * 3] += (cx - a[i * 3]) * Math.min(1, dt * 3); a[i * 3 + 1] += ((tg[1] + 0.3 + Math.sin(ang * 2) * 0.25) - a[i * 3 + 1]) * Math.min(1, dt * 3); a[i * 3 + 2] += (cz - a[i * 3 + 2]) * Math.min(1, dt * 3);
        }
        s.p.geometry.attributes.position.needsUpdate = true; continue;
      }
      for (let i = 0; i < n; i++) {
        const o = i * 3;
        a[o] += (v[0] + (k === 'nieve' || k === 'lluvia' || k === 'lluviaLigera' ? viento * 2.2 + (k === 'lluvia' ? 1.3 : 0) : 0) + Math.sin(t + i) * (k === 'brasas' || k === 'humo' ? 0.25 : 0)) * dt;
        a[o + 1] += v[1] * dt * (k === 'brasas' ? 0.6 + (i % 5) * 0.2 : 1);
        a[o + 2] += (v[2] + (k === 'brasas' ? Math.cos(t + i) * 0.2 : 0)) * dt;
        const arriba = k === 'brasas' || k === 'humo' || k === 'espuma';
        const fuera = arriba ? a[o + 1] > s.alto + by : a[o + 1] < 0 || Math.abs(a[o]) > bx / 2 + 1;
        if (fuera) {
          if (k === 'espuma') { a[o] = costa.x0 + C() * (costa.x1 - costa.x0); a[o + 1] = 0.12; a[o + 2] = costa.z + (C() - 0.5) * 0.8; }
          else { a[o] = (C() - 0.5) * bx; a[o + 1] = arriba ? (k === 'humo' ? 0.4 : 0.1) : by; a[o + 2] = (C() - 0.5) * bz; }
        }
      }
      s.p.geometry.attributes.position.needsUpdate = true;
    }
    actualizarRayos(dt); actualizarFuego(dt, t);
  }

  // ---------- rayos ----------
  const rayos = [];
  let flashLuz = 0;
  const luzFlash = new THREE.PointLight(0xDDE8FF, 0, 30); luzFlash.position.set(0, 8, 0); grupo.add(luzFlash);
  function rayo(x, y, z) {
    const pts = [new THREE.Vector3(x + entre(-0.4, 0.4), 9, z + entre(-0.4, 0.4))];
    for (let k = 1; k < 7; k++) pts.push(new THREE.Vector3(x + entre(-0.3, 0.3), 9 - (9 - y) * k / 7, z + entre(-0.3, 0.3)));
    pts.push(new THREE.Vector3(x, y, z));
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 1 }));
    l.frustumCulled = false; grupo.add(l);
    rayos.push({ l, vida: TIEMPOS.rayo }); flashLuz = 1;
    chispas(x, y, z);
  }
  const chispasL = [];
  function chispas(x, y, z) {
    const n = 14, pos = new Float32Array(n * 3), vel = [];
    for (let k = 0; k < n; k++) { pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; vel.push([entre(-1.6, 1.6), entre(0.8, 2.6), entre(-1.6, 1.6)]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xFFE9A0, size: 0.14, map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    p.frustumCulled = false; grupo.add(p); chispasL.push({ p, pos, vel, vida: 0.6 });
  }
  function relampago() { flashLuz = Math.max(flashLuz, 0.7); }
  function actualizarRayos(dt) {
    for (let k = rayos.length - 1; k >= 0; k--) { const r = rayos[k]; r.vida -= dt; r.l.material.opacity = Math.max(0, r.vida / TIEMPOS.rayo); if (r.vida <= 0) { grupo.remove(r.l); r.l.geometry.dispose(); rayos.splice(k, 1); } }
    for (let k = chispasL.length - 1; k >= 0; k--) {
      const c = chispasL[k]; c.vida -= dt;
      for (let i = 0; i < c.vel.length; i++) { c.pos[i * 3] += c.vel[i][0] * dt; c.pos[i * 3 + 1] += c.vel[i][1] * dt; c.vel[i][1] -= 6 * dt; c.pos[i * 3 + 2] += c.vel[i][2] * dt; }
      c.p.geometry.attributes.position.needsUpdate = true; c.p.material.opacity = Math.max(0, c.vida / 0.6);
      if (c.vida <= 0) { grupo.remove(c.p); c.p.geometry.dispose(); c.p.material.dispose(); chispasL.splice(k, 1); }
    }
    flashLuz = Math.max(0, flashLuz - dt * 4.5); luzFlash.intensity = flashLuz * 14;
  }

  // ---------- fuego: llamas en las casillas que arden, con luz parpadeante ----------
  const llamas = [], luces = [];
  for (let k = 0; k < 4; k++) { const l = new THREE.PointLight(0xFF7A2A, 0, 7, 1.6); l.visible = false; grupo.add(l); luces.push(l); }
  const matLlama = new THREE.MeshBasicMaterial({ color: 0xFF8A2A, transparent: true, opacity: 0.9 });
  const matLlama2 = new THREE.MeshBasicMaterial({ color: 0xFFD060, transparent: true, opacity: 0.95 });
  function encenderFuego(x, y, z, retraso = 0) {
    const g = new THREE.Group(); g.position.set(x, y, z);
    for (let k = 0; k < 3; k++) {
      const a = new THREE.Mesh(new THREE.ConeGeometry(0.1 + C() * 0.05, 0.3 + C() * 0.15, 5), k ? matLlama2 : matLlama);
      a.position.set(entre(-0.2, 0.2), 0.15, entre(-0.2, 0.2)); g.add(a);
    }
    g.scale.setScalar(0.0001); grupo.add(g);
    llamas.push({ g, t: -retraso, x, y, z });
  }
  function apagarFuego() { llamas.forEach(l => { grupo.remove(l.g); l.g.children.forEach(m => m.geometry.dispose()); }); llamas.length = 0; luces.forEach(l => { l.visible = false; l.intensity = 0; }); }
  function actualizarFuego(dt, t) {
    llamas.forEach((l, i) => {
      l.t += dt; const e = Math.max(0, Math.min(1, l.t / 0.5));
      l.g.scale.setScalar(e * (0.9 + Math.sin(t * 14 + i) * 0.12));
      l.g.children.forEach((m, j) => { m.scale.y = 0.85 + Math.sin(t * 11 + i * 3 + j) * 0.25; });
    });
    luces.forEach((lz, k) => {
      const l = llamas[k * Math.max(1, Math.floor(llamas.length / 4))];
      if (!l || l.t < 0) { lz.visible = false; return; }
      lz.visible = true; lz.position.set(l.x, l.y + 0.6, l.z); lz.intensity = (2.6 + Math.sin(t * 17 + k * 2) * 0.9 + C() * 0.6) * Math.min(1, l.t);
    });
  }

  function liberar() { escena.remove(grupo); }
  return { encender, actualizar, rayo, relampago, chispas, encenderFuego, apagarFuego, fijarCosta, fijarEnjambre, liberar, grupo, hayFuego: () => llamas.length > 0 };
}

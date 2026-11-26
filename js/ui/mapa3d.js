// El mapa en 3D (T-10): sustituye al mapa plano de vista.js. Sólo DIBUJA: lee el estado (G) y los sucesos que
// la lógica ya ha calculado, y los reproduce en orden. No decide qué se inunda, se quema o se daña, y no toca
// el azar del juego (los adornos y efectos usan ./cosmetico.js). El resto de la interfaz sigue siendo HTML encima.
import * as THREE from '../vendor/three.module.min.js';
import { TOWNS } from '../../data/pueblos.js';
import { OFICIOS } from '../../data/gente.js';
import { BUILD, COLS, FILAS, N } from '../../data/casillas.js';
import { ALTURA, AMBIENTE, FUERZA_AMBIENTE, EFECTOS, RIESGO, TIEMPOS, CAMARA } from '../../data/escena3d.js';
import { G, T, W } from '../estado.js';
import { ACTIONS } from '../acciones.js';
import { riskMap } from '../riesgo.js';
import { t } from '../i18n.js';
import { crearModelos } from './modelos3d.js';
import { crearCamara } from './camara3d.js';
import { crearEfectos } from './efectos3d.js';
import { C, entre, semillaCosmetica } from './cosmetico.js';
import { familias, plazasUsadas } from '../casas.js';

const ancho = COLS, alto = FILAS;
const posX = (i) => (i % COLS) - (COLS - 1) / 2;
const posZ = (i) => Math.floor(i / COLS) - (FILAS - 1) / 2;
const lim = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const suave = (p) => p * p * (3 - 2 * p);

let M = null;                 // todo lo del 3D, cuando está iniciado
export const hooks = { alTocarCasilla: null };

export function hayWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}

// ---------------------------------------------------------------- inicio
export function iniciar() {
  if (M) return true;
  if (!hayWebGL()) return false;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'm3d-canvas'; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', t('ui.mapa3d.aria'));

  const host = document.createElement('div'); host.className = 'm3d-host';
  host.appendChild(canvas);
  const botonReset = document.createElement('button'); botonReset.type = 'button'; botonReset.className = 'm3d-reset';
  botonReset.textContent = t('ui.mapa3d.recolocar'); botonReset.setAttribute('aria-label', t('ui.mapa3d.recolocarAria'));
  host.appendChild(botonReset);
  const calor = document.createElement('div'); calor.className = 'm3d-calor'; host.appendChild(calor);

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(AMBIENTE.prep.fondo);
  escena.fog = new THREE.Fog(AMBIENTE.prep.niebla[0], AMBIENTE.prep.niebla[1], AMBIENTE.prep.niebla[2]);
  const camara = new THREE.PerspectiveCamera(CAMARA.fov, 7 / 8, 0.1, 90);

  const sol = new THREE.DirectionalLight(AMBIENTE.prep.sol[0], AMBIENTE.prep.sol[1]);
  sol.position.set(...AMBIENTE.prep.solPos); sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024); sol.shadow.camera.left = -6; sol.shadow.camera.right = 6; sol.shadow.camera.top = 6; sol.shadow.camera.bottom = -6;
  sol.shadow.camera.near = 1; sol.shadow.camera.far = 30; sol.shadow.bias = -0.0008;
  escena.add(sol);
  const amb = new THREE.AmbientLight(AMBIENTE.prep.amb[0], AMBIENTE.prep.amb[1]); escena.add(amb);

  const modelos = crearModelos(THREE);
  const grupoCasillas = new THREE.Group(), grupoMunecos = new THREE.Group(), grupoEtiquetas = new THREE.Group(), grupoMarcas = new THREE.Group(), grupoFx = new THREE.Group();
  escena.add(modelos.peana(ancho, alto), grupoCasillas, grupoMunecos, grupoEtiquetas, grupoMarcas, grupoFx);
  const efectos = crearEfectos(THREE, escena);

  const ray = new THREE.Raycaster(), p2 = new THREE.Vector2();
  const camCtl = crearCamara(THREE, camara, canvas, {
    alTocar(cx, cy) {
      if (!M.modo || M.modo === 'impact' || !hooks.alTocarCasilla) return;
      const r = canvas.getBoundingClientRect();
      p2.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(p2, camara);
      const hit = ray.intersectObjects(grupoCasillas.children, true)[0];
      if (!hit) return;
      let o = hit.object; while (o && o.userData.tile === undefined) o = o.parent;
      if (o) hooks.alTocarCasilla(o.userData.tile);
    }
  });
  botonReset.addEventListener('click', () => { camCtl.recolocar(); pedir(); });
  camCtl.alPedir(() => pedir());

  M = {
    renderer, canvas, host, botonReset, calor, escena, camara, sol, amb, modelos, grupoCasillas, grupoMunecos, grupoEtiquetas, grupoMarcas, grupoFx, efectos, camCtl,
    tiles: [], fx: [], munecos: new Map(), marcas: [], etiquetas: [], anims: [], rocas: [], destinos: new Map(),
    amb_actual: { fondo: new THREE.Color(AMBIENTE.prep.fondo), nc: new THREE.Color(AMBIENTE.prep.niebla[0]), nn: AMBIENTE.prep.niebla[1], nf: AMBIENTE.prep.niebla[2], sc: new THREE.Color(AMBIENTE.prep.sol[0]), si: AMBIENTE.prep.sol[1], ac: new THREE.Color(AMBIENTE.prep.amb[0]), ai: AMBIENTE.prep.amb[1], sp: new THREE.Vector3(...AMBIENTE.prep.solPos) },
    objetivo: AMBIENTE.prep, tipoImpacto: null, modo: null, montado: false, sucio: true, ultimoT: 0, tiempo: 0, ultimoG: null, claveCasillas: [], impactoRef: null, procesados: 0,
    olas: false, calorOn: false, secado: 0, seco: 0, heat: false, ventanas: 0, enjambre: null, sacudida: 0, grupoOwner: [], frame: 0
  };
  const ro = new ResizeObserver(() => ajustarTamano());
  ro.observe(host); M.ro = ro;
  window.addEventListener('resize', ajustarTamano);
  return true;
}

function ajustarTamano() {
  if (!M) return;
  const w = M.host.clientWidth, h = M.host.clientHeight;
  if (!w || !h) return;
  M.renderer.setSize(w, h, false);
  M.camara.aspect = w / h;
  // en pantallas anchas hay que alejar la cámara para que quepa el mapa entero
  M.camara.fov = CAMARA.fov * (M.camara.aspect < 0.82 ? 1 + (0.82 - M.camara.aspect) * 0.9 : 1);
  M.camara.updateProjectionMatrix(); pedir();
}

export function pedir() { if (M) M.sucio = true; if (M && M.montado && !M.corriendo) { M.corriendo = true; requestAnimationFrame(bucle); } }

// ---------------------------------------------------------------- montaje: se llama tras cada render() del HTML
export function alDibujar() {
  if (!M) return;
  const sitio = document.querySelector('.mapa3d');
  if (!sitio) { M.montado = false; if (M.host.parentNode) M.host.remove(); return; }
  const modo = sitio.dataset.modo || 'view';
  if (M.host.parentNode !== sitio) sitio.appendChild(M.host);
  M.montado = true; M.modo = modo;
  ajustarTamano();
  sincronizar(modo);
  pedir();
}

// ---------------------------------------------------------------- sincronizar con el estado
function firmaCasilla(e) { return [e.t, e.dmg ? 1 : 0, e.dique ? 1 : 0, e.cheap ? 1 : 0, e.muro ? 1 : 0, e.sacos ? 1 : 0, e.rayo ? 1 : 0, e.evac ? 1 : 0, e.contra ? 1 : 0, e.reforzada ? 1 : 0, e.fam >= 2 ? 1 : 0, e.evacN || 0].join(''); }

function overlays() {
  const ov = {};
  if (!G.impact) return ov;
  G.impact.events.slice(0, G.impact.shown).forEach(e => (e.tiles || []).forEach(([i, k]) => { (ov[i] = ov[i] || new Set()).add(k); }));
  return ov;
}
function estadoCasilla(i, modo, ov) {
  const x = T(i);
  if (modo === 'impact' && G.snapTiles) {
    // T-12: lo que cae en ruinas o se queda en solar durante el impacto cambia en ese suceso
    const b = G.snapTiles[i], o = ov[i] || new Set();
    const tt = o.has('solar') ? 'V' : (o.has('ruinas') ? 'U' : b.t);
    return { t: tt, dmg: tt === b.t && !!(b.dmg || o.has('dmg')), dique: x.dique, cheap: x.cheap, muro: x.muro, sacos: false, rayo: x.rayo, evac: false, contra: !!(b.contra && (x.contra || !o.has('ok'))), reforzada: !!x.reforzada, fam: (b.fam || 0) + (o.has('acogida') ? 1 : 0) };
  }
  return { t: x.t, dmg: x.dmg, dique: x.dique, cheap: x.cheap, muro: x.muro, sacos: x.sacos, rayo: x.rayo, evac: x.evac, contra: !!x.contra, reforzada: !!x.reforzada, fam: familias(x), evacN: x.t === 'H' ? plazasUsadas() : 0 };
}

function reiniciarJuego() {
  M.grupoCasillas.clear(); M.tiles = []; M.claveCasillas = [];
  M.fx = Array.from({ length: N }, () => ({ agua: null, fuego: 0, quemado: 0, nieve: 0, plaga: 0, aviso: 0, sucio: true }));
  M.munecos.forEach(m => M.grupoMunecos.remove(m.o.raiz)); M.munecos.clear(); M.destinos.clear();
  M.grupoEtiquetas.clear(); M.etiquetas = [];
  limpiarImpacto();
  semillaCosmetica(1234);
  M.efectos.fijarCosta(((FILAS - 1) / 2) - 0.9, -3, 3);
}

function limpiarImpacto() {
  M.anims = []; M.rocas.forEach(r => M.grupoFx.remove(r.m)); M.rocas = [];
  M.efectos.apagarFuego(); M.efectos.fijarEnjambre(null);
  M.olas = false; M.calorOn = false; M.secado = 0;
  M.impactoRef = null; M.procesados = 0; M.tipoImpacto = null;
  if (M.fx) M.fx.forEach(f => { f.agua = null; f.fuego = 0; f.quemado = 0; f.nieve = 0; f.plaga = 0; f.aviso = 0; f.sucio = true; });
}

function sincronizar(modo) {
  if (M.ultimoG !== G) { M.ultimoG = G; reiniciarJuego(); }
  const ov = modo === 'impact' ? overlays() : {};
  // 1. casillas
  for (let i = 0; i < N; i++) {
    const e = estadoCasilla(i, modo, ov), f = firmaCasilla(e);
    if (M.claveCasillas[i] !== f) {
      if (M.tiles[i]) M.grupoCasillas.remove(M.tiles[i].grupo);
      const tt = M.modelos.casilla(i, e, i % COLS, Math.floor(i / COLS));
      M.grupoCasillas.add(tt.grupo); M.tiles[i] = tt; M.claveCasillas[i] = f; M.fx[i].sucio = true;
    }
  }
  // 2. impacto: ambiente y sucesos
  if (modo === 'impact' && G.impact) {
    if (M.impactoRef !== G.impact) { limpiarImpacto(); M.impactoRef = G.impact; M.tipoImpacto = G.fc.real.slice(); asignarDuenos(); empezarImpacto(); }
    const n = Math.min(G.impact.shown, G.impact.events.length), instantaneo = (n - M.procesados) > 1;
    for (let k = M.procesados; k < n; k++) aplicarEvento(G.impact.events[k], M.grupoOwner[k], !instantaneo || k === n - 1 ? !instantaneo : false);
    M.procesados = n;
  } else {
    if (M.impactoRef) limpiarImpacto();
    M.tipoImpacto = null;
  }
  // 3. el estado «seco» de la partida (sequía u ola de calor anteriores) se nota en la preparación
  M.seco = modo === 'impact' ? M.seco : (G.dry ? 0.65 : 0);
  // 4. muñecos, marcas, riesgo
  sincronizarMunecos(modo);
  sincronizarMarcas(modo);
  M.heat = !!(G.heat && modo !== 'impact' && G.fc);
  sincronizarRiesgo();
  M.ventanas = 0;
  elegirAmbiente(modo);
  M.fx.forEach(f => { f.sucio = true; });
}

// ---------------------------------------------------------------- ambiente
function elegirAmbiente(modo) {
  let clave = 'prep', efectos = [];
  if (modo === 'impact' && M.tipoImpacto) {
    clave = M.tipoImpacto.slice().sort((a, b) => FUERZA_AMBIENTE[b] - FUERZA_AMBIENTE[a])[0];
    M.tipoImpacto.forEach(k => EFECTOS[k].forEach(e => { if (!efectos.includes(e)) efectos.push(e); }));
    // en un impacto con lluvia la polvareda de la calima sobra si hay otra luz más fuerte
  }
  M.objetivo = AMBIENTE[clave];
  M.efectos.encender(efectos);
  M.ventanas = efectos.includes('ventanas') || clave === 'incendio' ? 1 : 0;
  M.olas = efectos.includes('olas'); M.calorOn = efectos.includes('calor');
  M.host.classList.toggle('m3d-calor-on', M.calorOn);
  M.host.dataset.ambiente = clave;
}

function actualizarAmbiente(dt) {
  const a = M.amb_actual, o = M.objetivo, k = 1 - Math.exp(-dt / (TIEMPOS.transicionAmbiente / 3));
  a.fondo.lerp(new THREE.Color(o.fondo), k); a.nc.lerp(new THREE.Color(o.niebla[0]), k);
  a.nn += (o.niebla[1] - a.nn) * k; a.nf += (o.niebla[2] - a.nf) * k;
  a.sc.lerp(new THREE.Color(o.sol[0]), k); a.si += (o.sol[1] - a.si) * k;
  a.ac.lerp(new THREE.Color(o.amb[0]), k); a.ai += (o.amb[1] - a.ai) * k;
  a.sp.lerp(new THREE.Vector3(...o.solPos), k);
  M.escena.background.copy(a.fondo); M.escena.fog.color.copy(a.nc); M.escena.fog.near = a.nn; M.escena.fog.far = a.nf;
  M.sol.color.copy(a.sc); M.sol.intensity = a.si; M.amb.color.copy(a.ac); M.amb.intensity = a.ai; M.sol.position.copy(a.sp);
  const v = M.ventanas, obj = v ? 1.3 : 0;
  M.tiles.forEach(tt => tt.ventanas.forEach(m => { m.emissiveIntensity += (obj - m.emissiveIntensity) * Math.min(1, dt * 3); }));
}

// ---------------------------------------------------------------- impacto: a qué desastre pertenece cada suceso
function asignarDuenos() {
  M.grupoOwner = []; let g = -1;
  G.impact.events.forEach(e => {
    if (e.kind === 'title') g++;
    const esDesliz = (e.tiles || []).some(([, k]) => k === 'slide');
    M.grupoOwner.push(esDesliz ? 'deslizamiento' : (G.fc.real[Math.max(0, g)] || null));
  });
  // los daños que vienen tras un deslizamiento también son del deslizamiento
  let desliz = false;
  G.impact.events.forEach((e, k) => { if (M.grupoOwner[k] === 'deslizamiento') desliz = true; else if (desliz && e.kind !== 'title') M.grupoOwner[k] = 'deslizamiento'; });
}
function empezarImpacto() {
  semillaCosmetica(777 + (G.idx || 0));
  M.seco = G.dry ? 0.65 : 0;
}

const tween = (obj, prop, a, b, dur, delay = 0, ease = suave, fin) => {
  M.anims.push({ t: -delay, dur, paso(p) { obj[prop] = a + (b - a) * ease(p); }, fin });
};
const marcar = (i) => { if (M.fx[i]) M.fx[i].sucio = true; };
const centro = (i) => ({ x: posX(i), y: M.tiles[i] ? M.tiles[i].altura : ALTURA[T(i).t], z: posZ(i) });
function brillo(i, color = 0x6CFF8F) {      // destello al salvarse algo
  const c = centro(i), m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.28, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(c.x, c.y + 0.5, c.z); M.grupoFx.add(m);
  M.anims.push({ t: 0, dur: 0.7, paso(p) { m.scale.setScalar(1 + p * 2.2); m.material.opacity = 0.9 * (1 - p); }, fin() { M.grupoFx.remove(m); m.geometry.dispose(); m.material.dispose(); } });
}
function sacudir() { M.sacudida = TIEMPOS.temblor; }

// Reproduce UN suceso de la lógica. «anim» = false cuando se salta a un punto ya avanzado (sin animaciones).
function aplicarEvento(e, dueno, anim) {
  const tiles = e.tiles || [], d = (a) => (anim ? a : 0);
  const tipos = (k) => tiles.filter(([, kk]) => kk === k).map(([i]) => i);
  const rio = TOWNS[G.town].river;
  const flood = tipos('flood'), fire = tipos('fire'), snow = tipos('snow'), bolt = tipos('bolt'), ok = tipos('ok'), dmg = tipos('dmg'), slide = tipos('slide');

  if (dueno === 'riada' || dueno === 'temporal') {
    if (e.kind === 'title') {
      if (dueno === 'riada') flood.forEach(i => {
        const orden = rio.indexOf(i), f = M.fx[i]; if (f.agua === null) f.agua = { v: M.tiles[i].nivelBase };
        if (anim) tween(f.agua, 'v', f.agua.v, 0.5, TIEMPOS.subidaAgua, Math.max(0, orden) * TIEMPOS.escalonRio); else f.agua.v = 0.5;
        marcar(i);
      });
    } else if (flood.length) {
      flood.forEach(i => {
        if (M.tiles[i].tipo === 'R' || M.tiles[i].tipo === 'M') return;
        const f = M.fx[i]; if (f.agua === null) f.agua = { v: 0 };
        const dist = Math.min(...(dueno === 'riada' ? rio : idxMar()).map(r => Math.abs(posX(r) - posX(i)) + Math.abs(posZ(r) - posZ(i))));
        const lento = dueno === 'temporal' ? 1.6 : 1;
        if (anim) tween(f.agua, 'v', 0, 0.17, TIEMPOS.subidaAgua * lento, (dist - 1) * 0.12); else f.agua.v = 0.17;
        marcar(i);
      });
    }
  }
  if (dueno === 'incendio') {
    if (fire.length) {
      const orden = ordenDesdeFuego(fire, e.kind === 'title' ? fire : M.fuegoInicio || fire);
      if (e.kind === 'title') M.fuegoInicio = fire.slice();
      fire.forEach(i => {
        const f = M.fx[i], r = orden.get(i) || 0, tt = M.tiles[i];
        const retraso = d(r * TIEMPOS.propagarFuego * 1.4);
        const c = centro(i); M.efectos.encenderFuego(c.x, c.y + (tt.tipo === 'B' ? 0.25 : 0.1), c.z, retraso);
        if (anim) { tween(f, 'fuego', f.fuego, 1, 0.5, retraso); tween(f, 'quemado', f.quemado, 1, 1.6, retraso + 0.5); } else { f.fuego = 1; f.quemado = 1; }
        marcar(i);
      });
    }
    ok.forEach(i => { if (anim) brillo(i); });
  }
  if (dueno === 'tormenta') {
    const objetivos = [...bolt, ...ok];
    objetivos.forEach(i => {
      const f = M.fx[i], c = centro(i);
      if (anim) {
        tween(f, 'aviso', 0, 1, TIEMPOS.anuncioRayo, 0, (p) => p, () => { f.aviso = 0; marcar(i); M.efectos.rayo(c.x, c.y + 0.1, c.z); sacudirSi(!ok.includes(i)); });
        if (ok.includes(i)) M.anims.push({ t: -TIEMPOS.anuncioRayo, dur: 0.01, paso() {}, fin() { brillo(i); } });
      } else if (!ok.includes(i)) { /* el daño ya se ve en el estado de la casilla */ }
    });
  }
  if (dueno === 'alud') {
    if (e.kind === 'title') { /* nieve y viento ya están en el ambiente */ }
    snow.forEach((i, k) => {
      const f = M.fx[i];
      if (anim) tween(f, 'nieve', f.nieve, 1, 0.5, k * 0.1); else f.nieve = 1;
      marcar(i);
    });
    ok.forEach(i => { if (anim) brillo(i, 0xFFFFFF); });
  }
  if (dueno === 'sequia') {
    if (e.kind === 'title') { if (anim) tween(M, 'secado', 0, 1, 3.2); else M.secado = 1; }
  }
  if (dueno === 'plaga' && e.kind === 'title') {
    const gs = tipos('bolt');
    M.efectos.fijarEnjambre(gs.map(i => [posX(i), ALTURA.G, posZ(i)]));
    gs.forEach((i, k) => { const f = M.fx[i]; if (anim) tween(f, 'plaga', f.plaga, 1, 2.2, 1.6 + k * 0.3); else f.plaga = 1; marcar(i); });
  }
  if (dueno === 'deslizamiento') {
    if (slide.length) {
      // rocas desde la ladera hasta donde llegan los daños de este mismo suceso (si hay) o dos filas abajo
      slide.forEach((i, k) => { if (anim && k < 4) lanzarRoca(i, Math.min(N - 1, i + COLS * 2), k * 0.2); });
      if (anim) sacudir();
    }
  }
  // lo que se ha dañado: temblor y polvo
  if (dmg.length && anim) { sacudir(); dmg.forEach(i => { marcar(i); if (dueno === 'deslizamiento') { const col = i % COLS; const lad = M.tiles.findIndex((tt, j) => j % COLS === col && tt.tipo === 'L' && j < i); if (lad >= 0) lanzarRoca(lad, i, 0); } }); }
  if (ok.length && anim && dueno !== 'tormenta' && dueno !== 'alud' && dueno !== 'incendio') ok.forEach(i => brillo(i));
}
const sacudirSi = (b) => { if (b) sacudir(); };
function idxMar() { const r = []; for (let i = 0; i < N; i++) if (T(i).t === 'M') r.push(i); return r; }
function ordenDesdeFuego(todas, inicio) {
  const m = new Map();
  todas.forEach(i => { m.set(i, inicio.includes(i) ? 0 : Math.min(...inicio.map(s => Math.abs(posX(s) - posX(i)) + Math.abs(posZ(s) - posZ(i))))); });
  return m;
}
function lanzarRoca(desde, hasta, retraso) {
  const a = centro(desde), b = centro(hasta);
  const m = new THREE.Mesh(M.modelos.roca(0.12 + C() * 0.06), M.modelos.mat(0x7E7A74)); m.castShadow = true; m.visible = false;
  M.grupoFx.add(m);
  const r = { m }; M.rocas.push(r);
  M.anims.push({ t: -retraso, dur: TIEMPOS.rocas, paso(p) {
    m.visible = true;
    m.position.set(a.x + (b.x - a.x) * p, a.y + 0.2 + (b.y - a.y) * p + Math.abs(Math.sin(p * Math.PI * 3.5)) * 0.25 * (1 - p), a.z + (b.z - a.z) * p);
    m.rotation.x += 0.35; m.rotation.z += 0.22;
  } });
}

// ---------------------------------------------------------------- muñequitos
function sincronizarMunecos(modo) {
  const vivos = G.workers.filter(w => !w.gone);
  const ids = new Set(vivos.map(w => w.id));
  M.munecos.forEach((m, id) => { if (!ids.has(id)) { M.grupoMunecos.remove(m.o.raiz); M.munecos.delete(id); } });
  // destinos de obra: se olvidan los de quien ya no está ocupado
  M.destinos.forEach((_, id) => { if (!G.busy.includes(id)) M.destinos.delete(id); });
  const ocupacion = new Map();
  vivos.forEach(w => {
    let m = M.munecos.get(w.id);
    if (!m) {
      const o = M.modelos.muneco(OFICIOS[w.of].color);
      M.grupoMunecos.add(o.raiz);
      m = { o, tile: w.home, ruta: [], pos: new THREE.Vector3(posX(w.home) + 0.2, 0, posZ(w.home) + 0.25), tarea: null, tramo: 0 };
      m.pos.y = (M.tiles[w.home] ? M.tiles[w.home].altura : 0.24);
      M.munecos.set(w.id, m);
    }
    // qué hace ahora (sólo lo que ya decidió la lógica)
    let tarea = null, destino = w.home;
    if (modo !== 'impact') {
      for (const k in G.alloc) if (G.alloc[k].includes(w.id)) { tarea = k; destino = G.WORK[k] >= 0 ? G.WORK[k] : w.home; }
      if (!tarea && G.busy.includes(w.id)) { tarea = 'obra'; destino = M.destinos.has(w.id) ? M.destinos.get(w.id) : w.home; }
      if (w.inj || G.desanimados.includes(w.id)) { tarea = null; destino = w.home; }
    }
    const n = ocupacion.get(destino) || 0; ocupacion.set(destino, n + 1);
    m.tarea = tarea; m.destino = destino; m.slot = n; m.herido = !!w.inj && modo !== 'impact';
    m.o.herida.visible = m.herido;
    if (m.destinoActual !== destino) { m.destinoActual = destino; m.ruta = rutaEntre(m.tile, destino); m.tramo = 0; }
  });
}
function rutaEntre(a, b) {
  const r = []; let c = a % COLS, f = Math.floor(a / COLS); const cb = b % COLS, fb = Math.floor(b / COLS);
  while (f !== fb) { f += Math.sign(fb - f); r.push(f * COLS + c); }
  while (c !== cb) { c += Math.sign(cb - c); r.push(f * COLS + c); }
  return r;
}
export function enviarA(ids, tile) { if (!M) return; ids.forEach(id => M.destinos.set(id, tile)); }

const OFFS = [[0.22, 0.22], [-0.22, 0.22], [0.22, -0.22], [-0.22, -0.22], [0, 0.3], [0, -0.3]];
function actualizarMunecos(dt, t) {
  M.munecos.forEach((m) => {
    const cuerpo = m.o.cuerpoG;
    // andar: casilla a casilla
    const final = m.ruta.length === 0;
    const off = OFFS[(m.slot || 0) % OFFS.length];
    let objetivoX, objetivoZ, objetivoY;
    if (!final) {
      const i = m.ruta[0]; objetivoX = posX(i); objetivoZ = posZ(i); objetivoY = (M.tiles[i] ? M.tiles[i].altura : 0.24);
    } else {
      const i = m.destino; objetivoX = posX(i) + off[0]; objetivoZ = posZ(i) + off[1]; objetivoY = (M.tiles[i] ? M.tiles[i].altura : 0.24);
    }
    const dx = objetivoX - m.pos.x, dz = objetivoZ - m.pos.z, dist = Math.hypot(dx, dz), v = 1 / TIEMPOS.caminarCasilla;
    const paso = v * dt;
    let anda = false;
    if (dist > 0.01) { const s = Math.min(1, paso / dist); m.pos.x += dx * s; m.pos.z += dz * s; m.pos.y += (objetivoY - m.pos.y) * Math.min(1, dt * 10); anda = true; m.o.raiz.rotation.y = Math.atan2(dx, dz); }
    else { if (!final) { m.tile = m.ruta.shift(); } m.pos.y += (objetivoY - m.pos.y) * Math.min(1, dt * 10); }
    if (final && !anda) m.tile = m.destino;
    m.o.raiz.position.copy(m.pos);
    // gestos
    const b = m.o.brazo; let sent = M.calorOn && !anda;
    cuerpo.scale.y += ((sent ? 0.6 : 1) - cuerpo.scale.y) * Math.min(1, dt * 6);
    cuerpo.rotation.x = 0; b.rotation.x = 0; b.rotation.z = 0; cuerpo.position.y = 0;
    if (anda) { cuerpo.position.y = Math.abs(Math.sin(t * 14)) * 0.025; b.rotation.x = Math.sin(t * 14) * 0.5; }
    else if (m.tarea && !sent) {
      const w = t * (Math.PI * 2 / TIEMPOS.gestoPeriodo) + m.slot;
      if (m.tarea === 'talar') { b.rotation.z = -0.6 + Math.sin(w * 1.4) * 0.9; }
      else if (m.tarea === 'cantera' || m.tarea === 'obra') { b.rotation.z = -0.3 + Math.abs(Math.sin(w * 1.6)) * -1.1; cuerpo.position.y = Math.abs(Math.sin(w * 1.6)) * 0.01; }
      else if (m.tarea === 'granja') { cuerpo.rotation.x = 0.4 + Math.sin(w) * 0.15; b.rotation.x = Math.sin(w) * 0.4; }
      else if (m.tarea === 'recaudar') { b.rotation.z = -1.2; cuerpo.position.y = Math.abs(Math.sin(w)) * 0.03; }
    }
    m.o.herramienta.visible = !!m.tarea && !anda && m.tarea !== 'recaudar';
    m.o.raiz.visible = true;
  });
}

// ---------------------------------------------------------------- marcas: selección, casillas válidas
function marco(color, tam) {
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false });
  const e = tam / 2, w = 0.05;
  [[0, e, tam, w], [0, -e, tam, w], [e, 0, w, tam], [-e, 0, w, tam]].forEach(([x, z, a, b]) => { const q = new THREE.Mesh(new THREE.BoxGeometry(a, 0.04, b), m); q.position.set(x, 0, z); g.add(q); });
  g.userData.mat = m; return g;
}
function sincronizarMarcas(modo) {
  M.grupoMarcas.clear(); M.marcas = [];
  if (modo === 'impact') return;
  if (G.insp != null && M.tiles[G.insp]) {
    const m = marco(0x23262B, 0.99), c = centro(G.insp); m.position.set(c.x, c.y + 0.03, c.z); M.grupoMarcas.add(m);
    const m2 = marco(0xFFFFFF, 0.92); m2.position.set(c.x, c.y + 0.032, c.z); M.grupoMarcas.add(m2);
  }
  if (modo === 'prep' && G.sel && ACTIONS[G.sel]) {
    const a = ACTIONS[G.sel];
    for (let i = 0; i < N; i++) if (a.valid(T(i), i)) {
      const m = marco(0x2F9E4F, 0.86), c = centro(i); m.position.set(c.x, c.y + 0.04, c.z); M.grupoMarcas.add(m); M.marcas.push(m);
    }
  }
}

// ---------------------------------------------------------------- riesgo (verde, ámbar y rojo, con el porcentaje encima)
function sincronizarRiesgo() {
  M.grupoEtiquetas.clear(); M.etiquetas = [];
  M.riesgo = null;
  if (!M.heat) return;
  const r = riskMap(); M.riesgo = r;
  for (let i = 0; i < N; i++) {
    if (!BUILD.has(T(i).t) || r[i] < RIESGO.minimo) continue;
    const col = r[i] < RIESGO.ambar ? RIESGO.verde : (r[i] < RIESGO.rojo ? RIESGO.colorAmbar : RIESGO.colorRojo);
    const s = M.modelos.etiqueta(Math.round(r[i] * 100) + '%', col); const c = centro(i);
    s.position.set(c.x, c.y + 1.05, c.z); M.grupoEtiquetas.add(s);
  }
}
const colorRiesgo = (p) => p < RIESGO.ambar ? RIESGO.verde : (p < RIESGO.rojo ? RIESGO.colorAmbar : RIESGO.colorRojo);

// ---------------------------------------------------------------- aplicar el estado visual transitorio a cada casilla
const cTmp = new THREE.Color(), cSeco = new THREE.Color(0x9A7B45), cRojo = new THREE.Color(0xD2381B), cNegro = new THREE.Color(0x16110E), cPlaga = new THREE.Color(0x6B4A2A), cGris = new THREE.Color(0xA09A8E);
function aplicarFx(i, seco) {
  const T_ = M.tiles[i], f = M.fx[i]; if (!T_) return;
  // agua
  const niv = f.agua ? f.agua.v : T_.nivelBase;
  let nivel = niv;
  if (T_.tipo === 'R') nivel = niv * (1 - 0.5 * M.secado) + 0.001;
  if (T_.tipo === 'M' && M.olas) { const fila = Math.floor(i / COLS); nivel = niv + 0.22 * (0.5 + 0.5 * Math.sin(M.tiempo * 1.1 - fila * 0.9 + (i % COLS) * 0.3)) * (0.4 + fila / FILAS); }
  T_.agua.scale.y = Math.max(0.0001, nivel); T_.agua.visible = nivel > 0.003;
  // colores
  T_.tintes.forEach((q, k) => {
    cTmp.copy(q.base);
    const s = Math.min(1, seco * q.peso); if (s > 0) cTmp.lerp(cSeco, s * 0.75);
    if (q.arbol) { if (f.fuego > 0) cTmp.lerp(cRojo, f.fuego * 0.8); if (f.quemado > 0) cTmp.lerp(cNegro, f.quemado); }
    if (q.cultivo && f.plaga > 0) cTmp.lerp(cPlaga, f.plaga);
    if (k === 0) {                          // el suelo
      if (T_.tipo === 'B' && f.quemado > 0) cTmp.lerp(cNegro, f.quemado * 0.6);
      if (T_.tipo === 'G' && f.plaga > 0) cTmp.lerp(cPlaga, f.plaga * 0.35);
      if (M.heat) {
        if (BUILD.has(T_.tipo)) cTmp.setHex(colorRiesgo(M.riesgo ? M.riesgo[i] || 0 : 0));
        else cTmp.lerp(cGris, 0.35);
      }
    }
    q.m.color.copy(cTmp);
  });
  if (T_.suelo) { const m = T_.suelo.material; if (f.aviso > 0) { m.emissive.setHex(0xFFFFFF); m.emissiveIntensity = f.aviso * 0.9; } else if (m.emissiveIntensity) { m.emissiveIntensity = 0; } }
  // nieve que baja
  if (f.nieve > 0 && !T_.nieveMesh) { const o = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.1, 0.97), new THREE.MeshStandardMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0, flatShading: true })); o.position.y = T_.altura + 0.05; T_.grupo.add(o); T_.nieveMesh = o; }
  if (T_.nieveMesh) { T_.nieveMesh.material.opacity = f.nieve * 0.92; T_.nieveMesh.visible = f.nieve > 0.01; }
  f.sucio = false;
}

// ---------------------------------------------------------------- bucle
function bucle(ahora) {
  if (!M || !M.montado) { if (M) M.corriendo = false; return; }
  const t = ahora / 1000, dt = Math.min(0.05, M.ultimoT ? t - M.ultimoT : 0.016); M.ultimoT = t; M.tiempo = t;
  // animaciones por tramos
  let hay = M.anims.length > 0;
  for (let k = M.anims.length - 1; k >= 0; k--) {
    const a = M.anims[k]; a.t += dt;
    if (a.t >= 0) { const p = lim(a.t / a.dur); a.paso(p); if (p >= 1) { M.anims.splice(k, 1); a.fin && a.fin(); } }
  }
  const seco = M.modo === 'impact' ? Math.max(M.seco, M.secado * 0.7) : M.seco;
  const trabajando = [...M.munecos.values()].some(m => m.ruta.length || (m.tarea && m.ruta.length === 0));
  const continuo = M.modo === 'impact' || hay || trabajando || M.calorOn;
  const camMueve = M.camCtl.actualizar();
  actualizarAmbiente(dt);
  M.efectos.actualizar(dt, t);
  actualizarMunecos(dt, t);
  // temblor
  if (M.sacudida > 0) { M.sacudida -= dt; const k = TIEMPOS.temblorFuerza * (M.sacudida / TIEMPOS.temblor); M.camara.position.x += (C() - 0.5) * k * 2; M.camara.position.y += (C() - 0.5) * k; }
  if (M.calorOn) { M.camara.position.y += Math.sin(t * 17) * 0.004; M.camara.position.x += Math.sin(t * 11) * 0.003; }
  // marcas pulsantes
  M.marcas.forEach((m, k) => { m.userData.mat.opacity = 0.55 + 0.4 * Math.sin(t * 4 + k * 0.5); });
  // casillas con estado transitorio
  M.fx.forEach((f, i) => { if (f.sucio || M.modo === 'impact' || seco > 0 || M.olas) aplicarFx(i, seco); });
  // las etiquetas miran siempre a la cámara (los sprites ya lo hacen)
  const ligero = M.modo !== 'impact' && !camMueve && !M.anims.length && !M.sucio;
  if (!(ligero && (M.frame & 1)) && (M.sucio || continuo || camMueve || M.anims.length || M.efectos.hayFuego())) {
    M.renderer.render(M.escena, M.camara); M.sucio = false;
  }
  M.frame++;
  if (M.montado && (continuo || camMueve || M.sucio || M.anims.length)) requestAnimationFrame(bucle);
  else M.corriendo = false;
}

export function recolocarCamara() { if (M) M.camCtl.recolocar(); }
export const estaListo = () => !!M;
export function liberar() { if (!M) return; M.ro.disconnect(); M.camCtl.liberar(); M.renderer.dispose(); M.host.remove(); M = null; }

// Sólo para pruebas a mano: estado interno resumido.
export function info() {
  if (!M) return null;
  const r = M.riesgo ? [...M.riesgo].map((v, i) => [i, +v.toFixed(2)]).filter(x => x[1] > 0) : null;
  return { modo: M.modo, heat: M.heat, etiquetas: M.grupoEtiquetas.children.length, riesgo: r, anims: M.anims.length, rocas: M.rocas.length, camara: { ...M.camCtl.estado }, meta: { ...M.camCtl.meta }, munecos: M.munecos.size, corriendo: M.corriendo, montado: M.montado };
}

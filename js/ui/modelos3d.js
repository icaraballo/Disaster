// Los modelos low-poly del mapa 3D, generados por código: una casilla por tipo y estado, las obras que se
// construyen, los muñequitos y las etiquetas del mapa de riesgo. Sólo dibuja: no sabe nada de las reglas.
// Los adornos (árboles, rocas, hierba) usan el azar cosmético con semilla fija por casilla.
import { ALTURA, COLOR_SUELO, COLOR_AGUA, COLOR_TIERRA, MUNECO } from '../../data/escena3d.js';
import { conSemilla } from './cosmetico.js';

export function crearModelos(THREE) {
  const geos = new Map(), mats = new Map();
  const geo = (clave, f) => { if (!geos.has(clave)) geos.set(clave, f()); return geos.get(clave); };
  const mat = (color, extra = {}) => {
    const k = color + JSON.stringify(extra);
    if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.92, metalness: 0, ...extra }));
    return mats.get(k);
  };
  // Material propio de una casilla (para poder teñirlo: seco, quemado, plaga…).
  const matUnico = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.92, metalness: 0, ...extra });

  const caja = (w, h, d) => geo('c' + w + ',' + h + ',' + d, () => new THREE.BoxGeometry(w, h, d));
  const cono = (r, h, n) => geo('k' + r + ',' + h + ',' + n, () => new THREE.ConeGeometry(r, h, n));
  const cil = (r1, r2, h, n) => geo('y' + r1 + ',' + r2 + ',' + h + ',' + n, () => new THREE.CylinderGeometry(r1, r2, h, n));
  const esfera = (r, a = 8, b = 6) => geo('s' + r + ',' + a + ',' + b, () => new THREE.SphereGeometry(r, a, b));
  const roca = (r) => geo('r' + r, () => new THREE.DodecahedronGeometry(r, 0));

  function malla(g, m, x, y, z, opc = {}) {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    if (opc.rx) o.rotation.x = opc.rx; if (opc.ry) o.rotation.y = opc.ry; if (opc.rz) o.rotation.z = opc.rz;
    if (opc.sx) o.scale.set(opc.sx, opc.sy ?? opc.sx, opc.sz ?? opc.sx);
    o.castShadow = opc.sombra !== false; o.receiveShadow = true;
    return o;
  }

  // ---------- casillas ----------
  // e = {t, dmg, dique, cheap, muro, sacos, rayo, evac, fam}. Devuelve el objeto de la casilla con sus piezas teñibles.
  function casilla(i, e, col, fila) {
    const r = conSemilla(i * 7919 + 13);
    const g = new THREE.Group();
    g.position.set(col - 3, 0, fila - 3.5);
    g.userData.tile = i;
    const t = e.t, h = ALTURA[t];
    const T = { i, grupo: g, tipo: t, tintes: [], ventanas: [], agua: null, nivelAgua: 0, llama: null, altura: h, dano: !!e.dmg };

    // suelo
    const sueloMat = matUnico(COLOR_SUELO[t]);
    const suelo = malla(caja(0.97, h, 0.97), sueloMat, 0, h / 2, 0, { sombra: false });
    g.add(suelo); T.suelo = suelo; T.tintes.push({ m: sueloMat, base: new THREE.Color(COLOR_SUELO[t]), peso: t === 'P' || t === 'X' ? 1 : 0.5 });

    // agua (río, mar y desbordamientos): un prisma translúcido que sube y baja
    const aguaMat = new THREE.MeshStandardMaterial({ color: COLOR_AGUA[t] || COLOR_AGUA.R, transparent: true, opacity: 0.92, roughness: 0.25, emissive: 0x1B3550, emissiveIntensity: 0.35, flatShading: true });
    const agua = new THREE.Mesh(geo('agua', () => { const q = new THREE.BoxGeometry(0.97, 1, 0.97); q.translate(0, 0.5, 0); return q; }), aguaMat);
    const nivel0 = t === 'R' ? 0.1 : (t === 'M' ? 0.12 : 0);
    agua.position.y = h; agua.scale.y = Math.max(0.0001, nivel0); agua.visible = nivel0 > 0; agua.receiveShadow = true;
    g.add(agua); T.agua = agua; T.nivelAgua = nivel0; T.nivelBase = nivel0; T.aguaMat = aguaMat;

    const add = (o) => { g.add(o); return o; };
    const dano = e.dmg;

    if (t === 'B') {
      const n = 3 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const x = (r() - 0.5) * 0.7, z = (r() - 0.5) * 0.7, s = 0.75 + r() * 0.55;
        const hoja = matUnico([0x2F5A33, 0x36673A, 0x3E7440][Math.floor(r() * 3)]);
        T.tintes.push({ m: hoja, base: hoja.color.clone(), peso: 1, arbol: true });
        add(malla(cil(0.03, 0.04, 0.16 * s, 5), mat(0x5A4027), x, h + 0.08 * s, z));
        add(malla(cono(0.2 * s, 0.34 * s, 6), hoja, x, h + 0.28 * s, z));
        add(malla(cono(0.15 * s, 0.28 * s, 6), hoja, x, h + 0.46 * s, z));
      }
    } else if (t === 'X') {
      for (let k = 0; k < 3; k++) add(malla(cil(0.07, 0.08, 0.1, 6), mat(0x7A5A3A), (r() - 0.5) * 0.6, h + 0.05, (r() - 0.5) * 0.6));
      add(malla(cil(0.04, 0.04, 0.34, 6), mat(0x8E6B45), 0.12, h + 0.04, 0.18, { rz: Math.PI / 2, ry: 0.5 }));
    } else if (t === 'Q') {
      for (let k = 0; k < 5; k++) add(malla(cil(0.015, 0.03, 0.3 + r() * 0.2, 4), mat(0x1F1B18), (r() - 0.5) * 0.7, h + 0.15, (r() - 0.5) * 0.7, { rz: (r() - 0.5) * 0.35 }));
    } else if (t === 'L') {
      for (let k = 0; k < 4; k++) add(malla(roca(0.09 + r() * 0.08), mat(0x8C7350), (r() - 0.5) * 0.7, h + 0.06, (r() - 0.5) * 0.7, { sx: 1, sy: 0.7, sz: 1 }));
      add(malla(caja(0.97, 0.05, 0.97), mat(0x8C7350), 0, h * 0.55, 0, { sx: 1.0, sombra: false }));
    } else if (t === 'P') {
      for (let k = 0; k < 6; k++) {
        const hierba = matUnico(0x7FA05E); T.tintes.push({ m: hierba, base: hierba.color.clone(), peso: 1 });
        add(malla(cono(0.035, 0.12, 4), hierba, (r() - 0.5) * 0.8, h + 0.06, (r() - 0.5) * 0.8, { sombra: false }));
      }
      if (r() > 0.6) add(malla(esfera(0.025, 6, 4), mat([0xE8B730, 0xF0F0E8, 0xD66A8A][Math.floor(r() * 3)]), (r() - 0.5) * 0.6, h + 0.05, (r() - 0.5) * 0.6, { sombra: false }));
    } else if (t === 'S') {
      add(malla(roca(0.3), mat(0xFFFFFF), 0, h + 0.14, 0, { sx: 1.1, sy: 0.9, sz: 1 }));
      add(malla(roca(0.1), mat(0x9AA8B5), 0.25, h + 0.05, -0.2));
    } else if (t === 'C') {
      const pared = dano ? matUnico(0x9B8466) : matUnico(0xF1E6CE), tejado = matUnico(dano ? 0x6E3B27 : [0xB5502E, 0xA8442B, 0xC25A33][Math.floor(r() * 3)]);
      T.tintes.push({ m: tejado, base: tejado.color.clone(), peso: 0.15 });
      const rot = (Math.floor(r() * 4)) * Math.PI / 2;
      const casa = new THREE.Group(); casa.rotation.y = rot; add(casa);
      casa.add(malla(caja(0.5, 0.3, 0.4), pared, 0, h + 0.15, 0));
      const tej = malla(cono(0.43, 0.26, 4), tejado, 0, h + 0.43, 0, { ry: Math.PI / 4, sx: 1, sy: 1, sz: 0.8 });
      if (dano) { tej.rotation.z = 0.28; tej.position.y -= 0.04; tej.position.x += 0.03; }
      casa.add(tej);
      casa.add(malla(caja(0.1, 0.17, 0.02), mat(0x6B5B45), 0.1, h + 0.085, 0.205, { sombra: false }));
      const vent = new THREE.MeshStandardMaterial({ color: 0x3A3F4A, emissive: 0xFFD27A, emissiveIntensity: 0, flatShading: true });
      T.ventanas.push(vent);
      casa.add(malla(caja(0.08, 0.08, 0.02), vent, -0.12, h + 0.18, 0.205, { sombra: false }));
      if (dano) {
        casa.add(malla(caja(0.16, 0.1, 0.02), mat(0x1F1B18), -0.05, h + 0.3, 0.205, { sombra: false }));
        for (let k = 0; k < 3; k++) add(malla(caja(0.07, 0.05, 0.07), mat(0x6E4A32), (r() - 0.5) * 0.8, h + 0.03, 0.3 + r() * 0.12, { ry: r() * 3 }));
      }
      if (e.fam >= 2) {   // casa llena: un anexo con toldo azul para la familia acogida
        casa.add(malla(caja(0.22, 0.2, 0.26), matUnico(0xE4D6BA), 0.34, h + 0.1, -0.02));
        casa.add(malla(caja(0.28, 0.03, 0.32), mat(0x2F6B9A), 0.35, h + 0.215, -0.02, { rz: -0.18 }));
      }
    } else if (t === 'U') {   // ruinas: dos trozos de pared, el tejado hundido y escombros
      const rot = (Math.floor(r() * 4)) * Math.PI / 2;
      const ruina = new THREE.Group(); ruina.rotation.y = rot; add(ruina);
      ruina.add(malla(caja(0.07, 0.24, 0.4), matUnico(0xCDBFA4), -0.22, h + 0.12, 0));
      ruina.add(malla(caja(0.26, 0.15, 0.07), matUnico(0xCDBFA4), -0.08, h + 0.075, -0.19));
      ruina.add(malla(cono(0.3, 0.12, 4), matUnico(0x6E3B27), 0.08, h + 0.07, 0.05, { ry: Math.PI / 4, rz: 0.35 }));
      for (let k = 0; k < 6; k++) add(malla(caja(0.06 + r() * 0.05, 0.04, 0.06 + r() * 0.04), mat([0x8C7A60, 0x6E4A32, 0xB5A58A][k % 3]), (r() - 0.5) * 0.75, h + 0.02, (r() - 0.5) * 0.75, { ry: r() * 3 }));
    } else if (t === 'V') {   // solar vacío: los cimientos marcados y algo de hierba
      [[0, -0.3, 0.62, 0.05], [0, 0.3, 0.62, 0.05], [-0.3, 0, 0.05, 0.62], [0.3, 0, 0.05, 0.62]].forEach(([x, z, a, b]) => add(malla(caja(a, 0.04, b), mat(0x8C7A60), x, h + 0.02, z, { sombra: false })));
      for (let k = 0; k < 4; k++) add(malla(cono(0.03, 0.1, 4), mat(0x7FA05E), (r() - 0.5) * 0.5, h + 0.05, (r() - 0.5) * 0.5, { sombra: false }));
    } else if (t === 'E') {   // terraplén: un talud de tierra y escombros
      const talud = malla(cil(0.001, 0.48, 0.97, 3), matUnico(0x7A6A50), 0, h + 0.17, 0, { rz: Math.PI / 2 });
      talud.scale.set(0.7, 1, 1); add(talud);
      add(malla(caja(0.97, 0.05, 0.22), mat(0xC9B58E), 0, h + 0.3, 0, { sombra: false }));
      for (let k = 0; k < 4; k++) add(malla(roca(0.05 + r() * 0.03), mat(0x6E5E48), (r() - 0.5) * 0.8, h + 0.06, 0.3 + (r() - 0.5) * 0.1));
    } else if (t === 'H') {   // refugio: una nave baja con tejado a dos aguas y una cruz roja
      const pared = dano ? matUnico(0x9B8466) : matUnico(0xF1E6CE);
      add(malla(caja(0.74, 0.28, 0.46), pared, 0, h + 0.14, 0));
      const tej = malla(cil(0.27, 0.27, 0.78, 3), matUnico(dano ? 0x5B5246 : 0x8E8A84), 0, h + 0.36, 0, { rz: Math.PI / 2 }); tej.scale.set(0.5, 1, 1); if (dano) tej.rotation.x = 0.25;
      add(tej);
      add(malla(caja(0.05, 0.16, 0.02), mat(0xC2391F, { emissive: 0x5A1408 }), 0, h + 0.15, 0.235, { sombra: false }));
      add(malla(caja(0.16, 0.05, 0.02), mat(0xC2391F, { emissive: 0x5A1408 }), 0, h + 0.15, 0.235, { sombra: false }));
      if (e.evacN) for (let k = 0; k < Math.min(3, e.evacN); k++) add(malla(cono(0.07, 0.12, 4), mat(0x2F6B9A), -0.3 + k * 0.12, h + 0.06, 0.34, { sombra: false }));
    } else if (t === 'A') {
      const pared = dano ? matUnico(0x9B8466) : matUnico(0xF1E6CE), tejado = matUnico(dano ? 0x4A3560 : 0x7A5A9E);
      add(malla(caja(0.72, 0.34, 0.5), pared, 0, h + 0.17, 0.05));
      const tej = malla(cono(0.55, 0.28, 4), tejado, 0, h + 0.48, 0.05, { ry: Math.PI / 4, sx: 1, sy: 1, sz: 0.7 }); if (dano) { tej.rotation.z = 0.25; tej.position.y -= 0.05; }
      add(tej);
      add(malla(caja(0.15, 0.32, 0.15), pared, -0.26, h + 0.5, -0.12));
      add(malla(cono(0.12, 0.14, 4), tejado, -0.26, h + 0.73, -0.12, { ry: Math.PI / 4 }));
      add(malla(caja(0.12, 0.2, 0.02), mat(0x6B5B45), 0, h + 0.1, 0.31, { sombra: false }));
      const vent = new THREE.MeshStandardMaterial({ color: 0x3A3F4A, emissive: 0xFFD27A, emissiveIntensity: 0, flatShading: true }); T.ventanas.push(vent);
      add(malla(caja(0.1, 0.09, 0.02), vent, -0.22, h + 0.22, 0.31, { sombra: false }));
      add(malla(caja(0.1, 0.09, 0.02), vent, 0.22, h + 0.22, 0.31, { sombra: false }));
    } else if (t === 'G') {
      const pared = dano ? matUnico(0x7A3A24) : matUnico(0xA9452B);
      add(malla(caja(0.5, 0.26, 0.38), pared, -0.18, h + 0.13, -0.1));
      const prisma = malla(cil(0.26, 0.26, 0.5, 3), matUnico(dano ? 0x5B3A2A : 0x6B3A2A), -0.18, h + 0.34, -0.1, { rz: Math.PI / 2, ry: Math.PI / 2 }); prisma.rotation.set(0, 0, Math.PI / 2);
      prisma.scale.set(0.55, 1, 1); if (dano) prisma.rotation.x = 0.3;
      add(prisma);
      add(malla(caja(0.11, 0.16, 0.02), mat(0xF1E6CE), -0.18, h + 0.08, 0.1, { sombra: false }));
      for (let k = 0; k < 4; k++) {
        const cultivo = matUnico(0x6FA14A); T.tintes.push({ m: cultivo, base: cultivo.color.clone(), peso: 1, cultivo: true });
        add(malla(caja(0.62, 0.05, 0.07), cultivo, 0.0, h + 0.03, 0.2 + k * 0.1 - 0.0, { sombra: false })).position.z = 0.17 + k * 0.1;
      }
      if (e.reforzada) {   // granja reforzada: un silo metálico junto al granero y valla de protección
        add(malla(cil(0.11, 0.11, 0.34, 8), mat(0xC8B894), 0.24, h + 0.17, -0.14));
        add(malla(cono(0.12, 0.1, 8), mat(0x7C8FA6), 0.24, h + 0.39, -0.14));
        add(malla(caja(0.7, 0.06, 0.03), mat(0x6B5B45), 0, h + 0.06, 0.44, { sombra: false }));
      }
    } else if (t === 'O') {
      add(malla(caja(0.5, 0.26, 0.5), dano ? matUnico(0x9B8466) : matUnico(0xF1E6CE), 0, h + 0.13, 0));
      const cupula = malla(esfera(0.26, 10, 5), matUnico(dano ? 0x55606C : 0x7C8FA6), 0, h + 0.26, 0, { sy: 0.9 }); cupula.geometry = geo('semiesfera', () => new THREE.SphereGeometry(0.26, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2)); if (dano) cupula.rotation.z = 0.2;
      add(cupula);
      add(malla(cil(0.025, 0.025, 0.3, 5), mat(0x3B4A5C), 0.12, h + 0.46, 0, { rz: -0.8 }));
    } else if (t === 'W') {
      add(malla(cil(0.26, 0.28, 0.34, 10), dano ? matUnico(0x5C7388) : matUnico(0x7C9DB8), 0, h + 0.17, 0));
      add(malla(cil(0.28, 0.28, 0.04, 10), mat(0x3B5468), 0, h + 0.36, 0));
      add(malla(cil(0.04, 0.04, 0.12, 6), mat(0x3B5468), 0, h + 0.44, 0));
      if (dano) add(malla(caja(0.1, 0.18, 0.03), mat(0x1F1B18), 0.22, h + 0.18, 0.12, { sombra: false }));
    }

    // obras y protecciones
    if (e.dique) {
      if (t === 'M') {  // escollera: un montón de rocas contra el mar
        for (let k = 0; k < 6; k++) add(malla(roca(0.12 + r() * 0.05), mat(0x7E7A74), -0.35 + k * 0.14, h + 0.1, 0.25 + (r() - 0.5) * 0.12, { sy: 0.8 }));
      } else {
        const m = e.cheap ? 0xC9B48F : 0x6B5B45;
        add(malla(caja(0.97, 0.32, 0.18), mat(m), 0, h + 0.16, 0));
        if (e.cheap) add(malla(caja(0.97, 0.06, 0.2), mat(0x8E6B45), 0, h + 0.22, 0));
      }
    }
    if (e.muro) add(malla(caja(0.9, 0.26, 0.13), mat(0x8E8A84), 0, h + 0.13, 0.22));
    if (e.contra) {   // contrafuertes de piedra adosados a las esquinas del edificio
      [[-0.31, -0.27, 0.22], [0.31, -0.27, -0.22], [-0.31, 0.27, 0.22], [0.31, 0.27, -0.22]].forEach(([x, z, rz]) => {
        add(malla(caja(0.1, 0.24, 0.1), mat(0x5E6E7E), x, h + 0.11, z, { rz }));
      });
    }
    if (e.sacos) for (let k = 0; k < 4; k++) add(malla(esfera(0.07, 6, 4), mat(0xB99662), -0.3 + k * 0.2, h + 0.04 + (k % 2) * 0.06, 0.36 - (k % 2) * 0.05, { sy: 0.7, sz: 1.2 }));
    if (e.rayo) {
      add(malla(cil(0.012, 0.012, 0.6, 5), mat(0x555B63), 0.38, h + 0.3, -0.38));
      add(malla(cono(0.035, 0.08, 4), mat(0xE8B730, { emissive: 0x6B4A00 }), 0.38, h + 0.63, -0.38));
    }
    if (e.evac) {
      add(malla(cil(0.01, 0.01, 0.4, 4), mat(0x6B5B45), -0.38, h + 0.2, 0.38, { sombra: false }));
      add(malla(caja(0.16, 0.1, 0.01), mat(0x2F6B37, { emissive: 0x0F3A15 }), -0.3, h + 0.34, 0.38, { sombra: false }));
    }
    return T;
  }

  // ---------- el pueblo (peana) ----------
  function peana(cols, filas) {
    const g = new THREE.Group();
    g.add(malla(caja(cols + 0.5, 0.34, filas + 0.5), mat(COLOR_TIERRA), 0, -0.17, 0, { sombra: false }));
    g.add(malla(caja(cols + 0.62, 0.05, filas + 0.62), mat(0x4A3A27), 0, -0.36, 0, { sombra: false }));
    return g;
  }

  // ---------- muñequitos ----------
  // Un cuerpo, una cabeza y un brazo con herramienta; el gesto se anima en mapa3d.
  function muneco(color) {
    const r = MUNECO.radio, a = MUNECO.alto;
    const raiz = new THREE.Group(), cuerpoG = new THREE.Group(); raiz.add(cuerpoG);
    const cuerpo = malla(cil(r * 0.85, r, a * 0.65, 8), matUnico(color), 0, a * 0.33, 0);
    cuerpoG.add(cuerpo);
    cuerpoG.add(malla(esfera(MUNECO.tamanoCabeza, 8, 6), mat(0xE8C8A0), 0, a * 0.78, 0));
    const brazo = new THREE.Group(); brazo.position.set(r * 0.9, a * 0.58, 0); cuerpoG.add(brazo);
    const herramienta = malla(caja(0.02, 0.14, 0.02), mat(0x6B5B45), 0.0, -0.05, 0.05, { sombra: false }); brazo.add(herramienta);
    const cabeza = malla(caja(0.07, 0.04, 0.03), mat(0x6B5B45), 0, 0.1, 0, { sombra: false }); brazo.add(cabeza);
    // marca de herida (cruz roja sobre la cabeza)
    const herida = new THREE.Group();
    herida.add(malla(caja(0.1, 0.03, 0.03), mat(0xC2391F, { emissive: 0x6B1A0A }), 0, 0, 0, { sombra: false }));
    herida.add(malla(caja(0.03, 0.1, 0.03), mat(0xC2391F, { emissive: 0x6B1A0A }), 0, 0, 0, { sombra: false }));
    herida.position.y = a * 1.12; herida.visible = false; raiz.add(herida);
    return { raiz, cuerpoG, brazo, herramienta, herida };
  }

  // ---------- etiquetas ----------
  const texturas = new Map();
  function etiqueta(texto, colorHex) {
    const k = texto + colorHex;
    if (!texturas.has(k)) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64;
      const x = c.getContext('2d');
      x.fillStyle = '#' + colorHex.toString(16).padStart(6, '0');
      x.beginPath(); x.roundRect ? x.roundRect(4, 6, 120, 52, 16) : x.rect(4, 6, 120, 52); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 4; x.stroke();
      x.fillStyle = '#fff'; x.font = '700 34px Rubik, Inter, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(texto, 64, 33);
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      texturas.set(k, tx);
    }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturas.get(k), depthTest: false, transparent: true }));
    s.scale.set(0.8, 0.4, 1); s.renderOrder = 10;
    return s;
  }

  return { casilla, peana, muneco, etiqueta, mat, matUnico, caja, cono, cil, esfera, roca, malla, geo };
}

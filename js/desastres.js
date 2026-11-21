// Los desastres y su impacto sobre el mapa. Sin pantalla: cada desastre añade «sucesos»
// ({text, kind, tiles}) a una lista que la vista va enseñando poco a poco.
import { BUILD } from '../data/casillas.js';
import { SLIDE_MULT } from '../data/desastres.js';
import { DIQUE_ARRASTRE, DIQUE_BARATO_CEDE, TERRAPLEN_ARRASTRE, PASA_AGUA, VECINOS_CASA_DANADA, VECINOS_EVACUADA, MORAL_SIN_REPARAR, riadaP, temporalP, aludP, deslizamientoP, deslizamientoCasillas, rayosTormenta, focosIncendio } from '../data/balance.js';
import { RI, shuffle, pick } from './azar.js';
import { cap, clamp, nb4, cheb, ao, pl } from './util.js';
import { COLS, N } from '../data/casillas.js';
import { RUINAS, SOLAR, TERRAPLEN, familias, aRuinas, seVanAcogidas, finDeImpacto, fotoInicio, nombreCasa } from './casas.js';
import { G, T, town, peligro, aytoIdx, aytoDown, aljibeOk, healthy, ofName } from './estado.js';
import { t } from './i18n.js';

function tileName(i) {
  const x = T(i);
  if (x.t === 'C') return nombreCasa(i);
  if (x.t === RUINAS) return t('nombres.U');
  if (x.t === SOLAR) return t('nombres.V');
  return ['A','G','O','W'].includes(x.t) ? t('nombres.' + x.t) : t('nombres.otra');
}
const save = (k, n) => { G.stats.saves[k] = (G.stats.saves[k] || 0) + (n || 1); };

// Daña la casilla i. Devuelve los sucesos que cuenta el parte.
function damage(i, cause, ctx) {
  const x = T(i), r = G.res, nm = tileName(i), out = [];
  if ((cause === 'agua' || cause === 'mar') && x.sacos) { x.sacos = false; save('sacos'); return [{text:t('log.sacos', {lugar: nm}), kind:'good', tiles:[[i,'ok']]}]; }
  const already = x.dmg; x.dmg = true; ctx.dmg++; G.stats.cause[cause] = (G.stats.cause[cause] || 0) + 1;
  r.moral = clamp(r.moral - 6, 0, 100);
  if (x.t === 'C') {
    const fam = familias(x);
    if (x.evac) {
      // evacuada: nadie herido y la familia acogida no se va, pero alguien de la casa se marcha igual
      save('evacuar');
      const pierde = !already && x.propia ? VECINOS_EVACUADA : 0; r.pop -= pierde;
      out.push({text:t(pierde ? 'log.evacuadaPierde' : 'log.evacuada', {lugar: cap(nm), n: pierde, s: pl(pierde)}), kind:'warn', tiles:[[i,'dmg']]});
    } else {
      if (!already) {
        const her = fam ? Math.max(0, 2 - (healthy('medico') ? 1 : 0) - (G.alc === 'enfermera' ? 1 : 0)) : 0;
        const pierde = x.propia ? VECINOS_CASA_DANADA : 0;
        r.pop -= pierde; r.heridos += her;
        out.push({text:t(pierde ? 'log.casaDanada' : 'log.casaDanadaVacia', {lugar: cap(nm), heridos: her ? t('log.heridosY', {n: her, s: pl(her)}) : '', n: pierde}), kind:'bad', tiles:[[i,'dmg']]});
        seVanAcogidas(i, out);
      }
      G.workers.filter(w => w.home === i && !w.gone && !w.temp).forEach(w => {
        if (healthy('medico') && w.of !== 'medico' && RI() < 0.5) { out.push({text:t('log.medicoEvita', {nombre: w.name, a: ao(w)}), kind:'good'}); return; }
        if (w.inj) { w.gone = true; out.push({text:t('log.heridoOtraVez', {nombre: w.name, oficio: ofName(w), a: ao(w)}), kind:'bad'}); }
        else { w.inj = 1; out.push({text:t('log.heridoCasa', {nombre: w.name, oficio: ofName(w), a: ao(w)}), kind:'bad'}); }
      });
    }
    // dañada y golpeada otra vez: pasa a ruinas (un solo escalón)
    if (already) aRuinas(i, out);
    return out;
  }
  if (x.t === 'A') return [{text:t('log.aytoSinLuz'), kind:'cascade', tiles:[[i,'dmg']]}];
  if (x.t === 'G') return [{text:t('log.granjaDanada'), kind:'cascade', tiles:[[i,'dmg']]}];
  if (x.t === 'W') return [{text:t('log.aljibeDanado'), kind:'cascade', tiles:[[i,'dmg']]}];
  return [{text:t('log.obsDanado'), kind:'cascade', tiles:[[i,'dmg']]}];
}

// La casilla de detrás de n, siguiendo la dirección del agua (de s a n). null si se sale del mapa
// o si es río o mar.
export function detras(s, n) {
  const d = n - s, j = n + d;
  if (j < 0 || j >= N) return null;
  if ((d === 1 || d === -1) && Math.floor(j / COLS) !== Math.floor(n / COLS)) return null;
  const tt = G.tiles[j].t;
  return tt === 'R' || tt === 'M' ? null : j;
}

// Agua que sale del cauce (río) o de la costa (mar) hacia las casillas de al lado. Las ruinas y los
// solares dejan pasar el agua a la casilla de detrás (T-12 §B.3); el terraplén la frena.
function waterFlood(srcList, p0, cause, ev, ctx, isRiver) {
  let carry = 0; const flooded = new Set(), held = [], failed = [], tapados = [], frena = new Set(), pasa = [];
  // el agua llega a la casilla n desde s: se inunda y, si son ruinas o un solar, puede seguir
  const llega = (s, n) => {
    flooded.add(n);
    let de = s, cur = n;
    while (T(cur).t === RUINAS || T(cur).t === SOLAR) {
      if (T(cur).sacos) { T(cur).sacos = false; tapados.push(cur); return; }
      if (RI() >= PASA_AGUA[T(cur).t]) return;
      const j = detras(de, cur);
      if (j == null) return;
      if (T(j).t === TERRAPLEN) { frena.add(j); return; }
      pasa.push([cur, j]); flooded.add(j);
      de = cur; cur = j;
    }
  };
  for (const s of srcList) {
    const x = T(s);
    if (x.dique && x.cheap && RI() < DIQUE_BARATO_CEDE) { x.dique = false; x.cheap = false; failed.push(s); }
    if (x.dique) { if (isRiver) carry += p0 * DIQUE_ARRASTRE; held.push(s); continue; }
    const pt = Math.min(0.9, p0 + carry); if (isRiver) carry *= 0.5;
    nb4(s).forEach(n => {
      const tt = T(n).t;
      if (tt === 'R' || tt === 'M') return;
      if (tt === TERRAPLEN) { frena.add(n); if (isRiver) carry += p0 * TERRAPLEN_ARRASTRE; return; }
      if (RI() < pt) llega(s, n);
    });
  }
  if (failed.length) ev.push({text:failed.length === 1 ? t('log.diqueCede1') : t('log.diqueCedeN', {n: failed.length}), kind:'bad', tiles:failed.map(i => [i,'dmg'])});
  if (held.length) {
    save(isRiver ? 'dique' : 'escollera', held.length);
    const clave = (isRiver ? 'log.dique' : 'log.escollera') + (held.length === 1 ? '1' : 'N');
    ev.push({text:t(clave, {n: held.length}), kind:'good', tiles:held.map(i => [i,'ok'])});
  }
  if (frena.size) { save('terraplen', frena.size); ev.push({text:t('log.terraplenFrena'), kind:'good', tiles:[...frena].map(i => [i,'ok'])}); }
  if (flooded.size) ev.push({text:t(isRiver ? 'log.inundaRio' : 'log.inundaMar', {n: flooded.size, s: pl(flooded.size)}), kind:'warn', tiles:[...flooded].map(i => [i,'flood'])});
  else ev.push({text:t(isRiver ? 'log.noInundaRio' : 'log.noInundaMar'), kind:'good'});
  tapados.forEach(i => { save('sacos'); ev.push({text:t('log.sacosAgujero', {lugar: tileName(i)}), kind:'good', tiles:[[i,'ok']]}); });
  pasa.forEach(([a, b]) => ev.push({text:t('log.aguaPasa', {lugar: tileName(a), destino: tileName(b)}), kind:'warn', tiles:[[a,'flood'],[b,'flood']]}));
  [...flooded].filter(i => BUILD.has(T(i).t)).forEach(i => damage(i, cause, ctx).forEach(e => ev.push(e)));
}

const idxDe = (tipo) => G.tiles.map((x, i) => x.t === tipo ? i : -1).filter(i => i >= 0);

// Una función por desastre. I = intensidad (1-3); ev = lista de sucesos; ctx = {dmg, dry}.
export const RESOLVE = {
  riada(I, ev, ctx) {
    ev.push({text:t('log.riada'), kind:'title', tiles:town().river.map(i => [i,'flood'])});
    waterFlood(town().river, riadaP(I, town().riadaMult, G.perks.bomba, peligro()), 'agua', ev, ctx, true);
  },
  temporal(I, ev, ctx) {
    const sea = idxDe('M');
    ev.push({text:t('log.temporal'), kind:'title', tiles:sea.map(i => [i,'flood'])});
    waterFlood(sea, temporalP(I, G.perks.bomba, peligro()), 'mar', ev, ctx, false);
  },
  incendio(I, ev, ctx) {
    let src = idxDe('B');
    if (!src.length) src = idxDe('P');
    const starts = shuffle(src, RI).slice(0, focosIncendio(I, peligro()));
    const PR = {B:.7, P:.3, L:.15, C:.45, A:.45, G:.45, O:.45, W:.2, U:.3, V:.3, E:.3}; // ruinas, solar y terraplén arden como un prado, sin dañarse
    const mod = (ctx.dry ? 0.15 : 0) - (G.perks.bomberos ? 0.2 : 0) - (healthy('bombero') ? 0.12 : 0);
    const burned = new Set(starts), blocked = new Set(), q = starts.slice();
    while (q.length && burned.size < 26) {
      const c = q.shift();
      for (const n of nb4(c)) {
        if (burned.has(n)) continue;
        const tt = T(n).t;
        if (tt === 'X') { blocked.add(n); continue; }
        const pr = (PR[tt] || 0) + ((PR[tt] || 0) > 0 ? mod : 0);
        if (RI() < pr) { burned.add(n); q.push(n); }
      }
    }
    ev.push({text:t(ctx.dry ? 'log.incendioSeco' : 'log.incendio'), kind:'title', tiles:starts.map(i => [i,'fire'])});
    if (healthy('bombero')) { const b = G.workers.find(w => w.of === 'bombero' && !w.gone && !w.inj); ev.push({text:t('log.bombero', {nombre: b.name, oficio: ofName(b)}), kind:'good'}); }
    ev.push({text:t('log.llamas', {n: burned.size}), kind:'warn', tiles:[...burned].map(i => [i,'fire'])});
    if (blocked.size) { save('cortafuegos'); ev.push({text:t('log.cortafuegos'), kind:'good', tiles:[...blocked].map(i => [i,'ok'])}); }
    let trees = 0;
    [...burned].forEach(i => { if (T(i).t === 'B') { T(i).t = 'Q'; trees++; } });
    [...burned].filter(i => BUILD.has(T(i).t)).forEach(i => damage(i, 'fuego', ctx).forEach(e => ev.push(e)));
    if (trees) {
      const add = 3 * trees; G.res.riesgo = clamp(G.res.riesgo + add, 0, 95);
      ev.push({text:t('log.sinArboles', {n: add}), kind:'cascade'});
    }
  },
  tormenta(I, ev, ctx) {
    ev.push({text:t('log.tormenta'), kind:'title'});
    const builds = G.tiles.map((x, i) => BUILD.has(x.t) ? i : -1).filter(i => i >= 0);
    shuffle(builds, RI).slice(0, rayosTormenta(I, peligro())).forEach(i => {
      const prot = G.tiles.some((x, j) => x.rayo && cheb(i, j) <= 1);
      if (prot) { save('pararrayos'); ev.push({text:t('log.pararrayos', {lugar: tileName(i)}), kind:'good', tiles:[[i,'ok']]}); return; }
      ev.push({text:t('log.rayo', {lugar: tileName(i)}), kind:'warn', tiles:[[i,'bolt']]});
      damage(i, 'rayo', ctx).forEach(e => ev.push(e));
    });
  },
  alud(I, ev, ctx) {
    ev.push({text:t('log.alud'), kind:'title', tiles:G.NIEVE.map(i => [i,'snow'])});
    const pTrig = aludP(I, G.res.riesgo, peligro());
    const cols = {};
    G.NIEVE.forEach(i => { const c = i % 7; if (cols[c] === undefined || i < cols[c]) cols[c] = i; });
    let any = false;
    Object.values(cols).forEach(s => {
      if (RI() >= pTrig) return;
      any = true;
      if (T(s).muro) { save('muro'); ev.push({text:t('log.muroNevero'), kind:'good', tiles:[[s,'ok']]}); return; }
      const path = [s];
      for (let j = s + 7; j < 56; j += 7) {
        const x = T(j);
        if (x.t === 'S') { path.push(j); if (x.muro) { save('muro'); ev.push({text:t('log.muroMedio'), kind:'good', tiles:path.map(p => [p,'snow']).concat([[j,'ok']])}); return; } continue; }
        if (x.muro) { save('muro'); ev.push({text:t('log.muroLadera'), kind:'good', tiles:path.map(p => [p,'snow']).concat([[j,'ok']])}); return; }
        if (x.t === 'B') { save('bosque'); ev.push({text:t('log.aludBosque'), kind:'good', tiles:path.map(p => [p,'snow']).concat([[j,'ok']])}); return; }
        if (BUILD.has(x.t)) { ev.push({text:t('log.aludLlega', {lugar: tileName(j)}), kind:'warn', tiles:path.map(p => [p,'snow']).concat([[j,'snow']])}); damage(j, 'nieve', ctx).forEach(e => ev.push(e)); return; }
        path.push(j);
      }
      ev.push({text:t('log.aludValle'), kind:'info', tiles:path.map(p => [p,'snow'])});
    });
    if (!any) ev.push({text:t('log.aludAguanta'), kind:'good'});
  },
  sequia(I, ev, ctx) {
    ev.push({text:t('log.sequia'), kind:'title'});
    let need = 3 * I; const al = aljibeOk();
    if (al) { need = Math.ceil(need / 2); save('aljibe'); ev.push({text:t('log.aljibe'), kind:'good', tiles:[[G.tiles.findIndex(x => x.t === 'W'),'ok']]}); }
    const lost = Math.min(need, G.res.comida); G.res.comida -= lost;
    ev.push({text:t('log.comidaPerdida', {n: lost}), kind:'warn'});
    if (lost < need) { G.res.moral = clamp(G.res.moral - 8, 0, 100); G.stats.cause.hambre = (G.stats.cause.hambre || 0) + 1; ev.push({text:t('log.sinReservas'), kind:'bad'}); }
    G.res.moral = clamp(G.res.moral - 3, 0, 100);
    ctx.dry = true; G.dry = true;
    if (!al) { G.dryFarm = true; ev.push({text:t('log.camposSecos'), kind:'cascade'}); }
    ev.push({text:t('log.tierraSeca'), kind:'cascade'});
  },
  ola(I, ev, ctx) {
    ev.push({text:t('log.ola'), kind:'title'});
    const luz = !aytoDown();
    let her = (luz ? I : 2 * I) - (healthy('medico') ? 1 : 0);
    her = Math.max(0, her);
    if (luz) { save('refugio'); ev.push({text:t('log.refugio'), kind:'good', tiles:[[aytoIdx(),'ok']]}); }
    else ev.push({text:t('log.sinRefugio'), kind:'cascade', tiles:[[aytoIdx(),'dmg']]});
    G.res.heridos += her; G.res.moral = clamp(G.res.moral - 4, 0, 100);
    if (her) { G.stats.cause.calor = (G.stats.cause.calor || 0) + 1; ev.push({text:t('log.golpesCalor', {n: her, s: pl(her)}), kind:'bad'}); }
    if (I >= 2 && !luz) {
      const av = G.workers.filter(w => !w.gone && !w.inj && !w.temp);
      if (av.length) { const w = pick(av, RI); w.inj = 1; ev.push({text:t('log.golpeVecino', {nombre: w.name, oficio: ofName(w)}), kind:'bad'}); }
    }
    ctx.dry = true; G.dry = true;
    ev.push({text:t('log.todoSeco'), kind:'cascade'});
  },
  plaga(I, ev, ctx) {
    ev.push({text:t('log.plaga'), kind:'title', tiles:G.tiles.map((x, i) => x.t === 'G' ? [i,'bolt'] : null).filter(Boolean)});
    let frac = 0.2 + 0.1 * I; const half = G.lastAgri || G.alc === 'agricultor';
    if (half) { frac /= 2; ev.push({text:t(G.lastAgri ? 'log.plagaAgricultor' : 'log.plagaAlcalde'), kind:'good'}); }
    const lost = Math.round(G.res.comida * frac);
    G.res.comida -= lost; G.res.moral = clamp(G.res.moral - 3, 0, 100);
    ev.push({text:t('log.plagaPierde', {n: lost}), kind:lost > 0 ? 'warn' : 'good'});
  }
};

// Resuelve el desastre previsto: lo calcula todo de golpe y deja los sucesos en G.impact
// para que la vista los vaya contando. G.phase pasa a 'impact'.
export function startImpact() {
  G.snap = JSON.parse(JSON.stringify(G.res));
  G.snapTiles = G.tiles.map(x => ({t:x.t, dmg:x.dmg, fam:familias(x)}));
  const inicio = fotoInicio();
  G.res.heridos = 0;
  G.workers.forEach(w => { if (w.inj) w.inj = 0; });
  G.dryFarm = false;
  const ev = [], ctx = {dmg:0, dry:G.dry}, I = G.fc.I, types = G.fc.real;
  G.dry = false;
  types.forEach(k => RESOLVE[k](I, ev, ctx));
  const slide = G.SLIDE.filter(i => BUILD.has(T(i).t)); // ruinas y solares no se dañan
  if (slide.length) {
    const mult = Math.max(...types.map(k => SLIDE_MULT[k]));
    const chance = deslizamientoP(G.res.riesgo, mult, I, peligro());
    if (mult > 0 && RI() < chance) {
      ev.push({text:t('log.deslizamiento'), kind:'cascade', tiles:G.LADERA.map(i => [i,'slide'])});
      shuffle(slide, RI).slice(0, deslizamientoCasillas(I)).forEach(i => damage(i, 'tierra', ctx).forEach(e => ev.push(e)));
    } else if (mult > 0 && G.res.riesgo >= 30) {
      ev.push({text:t('log.laderaCruje'), kind:'info', tiles:G.LADERA.map(i => [i,'ok'])});
    }
  }
  finDeImpacto(inicio, ev, MORAL_SIN_REPARAR);
  const need = Math.ceil(G.res.pop / 6);
  if (G.res.comida >= need) { G.res.comida -= need; G.res.moral = clamp(G.res.moral + 1, 0, 100); ev.push({text:t('log.consume', {n: need}), kind:'info'}); }
  else { G.res.comida = 0; G.res.moral = clamp(G.res.moral - 15, 0, 100); G.stats.cause.hambre = (G.stats.cause.hambre || 0) + 1; ev.push({text:t('log.hambre'), kind:'bad'}); }
  if (ctx.dmg === 0) { G.res.moral = clamp(G.res.moral + 5, 0, 100); ev.push({text:t('log.alivio'), kind:'good'}); }
  G.tiles.forEach(x => { x.evac = false; x.cheap = false; });
  G.cheapDique = false;
  G.workers = G.workers.filter(w => !w.temp);
  for (const k in G.alloc) G.alloc[k] = G.alloc[k].filter(id => G.workers.some(w => w.id === id));
  G.lastDmg = ctx.dmg;
  G.insp = null; G.heat = false;
  G.impact = {events:ev, shown:1};
  G.phase = 'impact'; G.msg = '';
}

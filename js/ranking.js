// Ranking del reto diario y copia del progreso en la nube. Sólo funciona dentro de Claude.ai
// (capacidad `db`); en la web normal no hay servidor y esto no hace nada.
// Cuando algo cambia pide redibujar con ganchos.alCambiar (lo pone js/main.js).
import { todayKey } from './util.js';
import { G } from './estado.js';
import { PROG, setProg, mergeProg } from './progreso.js';

export const ganchos = { alCambiar() {} };
export const CAPS = {db:null, user:null, uid:null, board:null, boardState:'idle', writing:Promise.resolve()};

export function subirProgreso(prog) {
  if (CAPS.db && CAPS.uid) {
    const data = JSON.parse(JSON.stringify(prog));
    CAPS.writing = CAPS.writing.then(() => CAPS.db.doc('data/users/' + CAPS.uid + '/progress').set(data)).catch(() => {});
  }
}

export async function initCaps() {
  try {
    if (typeof window === 'undefined' || !window.claude || !window.claude.use) return;
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    CAPS.db = db; CAPS.user = user;
    if (db && user) CAPS.uid = await user.id();
    if (db && CAPS.uid) {
      try { const s = await db.doc('data/users/' + CAPS.uid + '/progress').get(); if (s.exists) setProg(mergeProg(PROG, s.data())); } catch (e) { /* sin progreso en la nube */ }
    }
    loadBoard();
    ganchos.alCambiar();
  } catch (e) { /* no estamos en Claude.ai */ }
}

export async function loadBoard() {
  if (!CAPS.db) return;
  CAPS.boardState = 'loading'; ganchos.alCambiar();
  const timer = setTimeout(() => { if (CAPS.boardState === 'loading') { CAPS.boardState = 'timeout'; ganchos.alCambiar(); } }, 10000);
  try {
    const snap = await CAPS.db.collection('scores').where('date', '==', todayKey()).limit(200).get();
    clearTimeout(timer);
    const rows = snap.docs.map(d => Object.assign({id:d.id}, d.data())).filter(r => typeof r.score === 'number').sort((a, b) => b.score - a.score).slice(0, 10);
    const names = {};
    if (CAPS.user && rows.length) {
      try { const ps = await CAPS.user.profiles(rows.map(r => r.id)); rows.forEach(r => names[r.id] = (ps[r.id] && ps[r.id].name) || ''); } catch (e) { /* sin nombres */ }
    }
    rows.forEach(r => r.name = names[r.id] || '');   // vacío: la vista pone «Alguien»
    CAPS.board = rows; CAPS.boardState = 'ok';
  } catch (e) { clearTimeout(timer); CAPS.boardState = 'error'; }
  ganchos.alCambiar();
}

export async function submitDaily(score) {
  if (!CAPS.db || !CAPS.uid) return;
  const ref = CAPS.db.doc('scores/' + CAPS.uid);
  try {
    const s = await ref.get();
    const prev = s.exists ? s.data() : null;
    if (prev && prev.date === todayKey() && prev.score >= score) { loadBoard(); return; }
    await ref.set({date:todayKey(), score, idx:G.idx, won:!G.lost, town:G.town, alc:G.alc});
    G.submitted = true;
  } catch (e) { G.submitFail = true; }
  loadBoard();
}

// Textos del juego. Todo lo que ve el jugador está en i18n/es.json; el código sólo pide claves.
//   t('log.riada')            → texto tal cual
//   t('log.sacos', {lugar: '…'})     → sustituye {lugar} en el texto
// Si falta una clave devuelve «[clave]», para que se note al jugar y lo detecte el test.
let textos = {};

export function cargarTextos(obj) { textos = obj; }
export async function cargarTextosWeb(url = 'i18n/es.json') {
  const r = await fetch(url);
  if (!r.ok) throw new Error('No se han podido cargar los textos (' + r.status + ')');
  cargarTextos(await r.json());
}

function buscar(clave) {
  return clave.split('.').reduce((o, k) => (o == null ? o : o[k]), textos);
}
export const existe = (clave) => typeof buscar(clave) === 'string';
export function t(clave, vars) {
  const v = buscar(clave);
  if (typeof v !== 'string') return '[' + clave + ']';
  return vars ? v.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : v;
}

// Gráficas del informe final (SVG a mano, sin librerías).
import { t } from '../i18n.js';

export function lineChart(vals, color, label, max) {
  const w = 360, h = 120, pl = 30, pr = 10, pt = 12, pb = 22;
  const n = vals.length, x = (i) => pl + (n <= 1 ? 0 : (w - pl - pr) * i / (n - 1)), y = (v) => pt + (h - pt - pb) * (1 - v / max);
  let s = '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + t('ui.grafica.aria', {nombre: label}) + '">';
  [0, max / 2, max].forEach(g => { s += '<line x1="' + pl + '" x2="' + (w - pr) + '" y1="' + y(g) + '" y2="' + y(g) + '" stroke="#E6DFCF" stroke-width="1"/><text x="' + (pl - 6) + '" y="' + (y(g) + 4) + '" font-size="10" text-anchor="end" fill="#5E5A52">' + Math.round(g) + '</text>'; });
  s += '<polyline fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" points="' + vals.map((v, i) => x(i) + ',' + y(v)).join(' ') + '"/>';
  vals.forEach((v, i) => {
    s += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="4" fill="' + color + '" stroke="#fff" stroke-width="2"><title>' + (i === 0 ? t('ui.grafica.inicio') : t('ui.grafica.tras', {n: i})) + ': ' + v + '</title></circle>';
    s += '<text x="' + x(i) + '" y="' + (h - 6) + '" font-size="10" text-anchor="middle" fill="#5E5A52">' + (i === 0 ? t('ui.grafica.ini') : i) + '</text>';
  });
  return s + '</svg>';
}

export function barChart(vals) {
  const w = 360, h = 110, pl = 30, pb = 22, pt = 10, max = Math.max(3, ...vals);
  const bw = (w - pl - 10) / Math.max(vals.length, 1);
  let s = '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + t('ui.grafica.danados') + '">';
  [0, max].forEach(g => { const yy = pt + (h - pt - pb) * (1 - g / max); s += '<line x1="' + pl + '" x2="' + (w - 10) + '" y1="' + yy + '" y2="' + yy + '" stroke="#E6DFCF"/><text x="' + (pl - 6) + '" y="' + (yy + 4) + '" font-size="10" text-anchor="end" fill="#5E5A52">' + g + '</text>'; });
  vals.forEach((v, i) => {
    const bh = (h - pt - pb) * v / max, xx = pl + i * bw + 4;
    s += '<rect x="' + xx + '" y="' + (h - pb - bh) + '" width="' + (bw - 8) + '" height="' + Math.max(bh, 0) + '" rx="4" fill="#C2531F"><title>' + t('ui.grafica.barra', {n: i + 1, dm: v}) + '</title></rect><text x="' + (xx + (bw - 8) / 2) + '" y="' + (h - 6) + '" font-size="10" text-anchor="middle" fill="#5E5A52">' + (i + 1) + '</text>';
  });
  return s + '</svg>';
}

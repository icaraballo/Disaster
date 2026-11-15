// Alcaldes y condición para desbloquearlos (ver cumple() en js/progreso.js).
// Nombre, título y descripción: i18n/es.json, «alcaldes».
export const ALCALDES = [
  {id:'ingeniera',   color:'#5E6E7E', unlock:null},
  {id:'agricultor',  color:'#C9A23A', unlock:null},
  {id:'meteorologa', color:'#7A5A9E', unlock:{tipo:'total', n:10}},
  {id:'tesorero',    color:'#D99A2B', unlock:{tipo:'victoriasTotales', n:1}},
  {id:'enfermera',   color:'#2F6B9A', unlock:{tipo:'temporadas', n:3}}
];

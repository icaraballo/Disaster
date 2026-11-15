// Desastres: color, parejas que pueden llegar a la vez y cuánto empuja cada uno a la ladera.
// Nombre y texto del aviso: i18n/es.json, «desastres».
export const DIS = {
  riada:{color:'#1F4F85'},
  incendio:{color:'#A8441A'},
  tormenta:{color:'#5E4A0E'},
  sequia:{color:'#7A5C14'},
  ola:{color:'#9C3A16'},
  plaga:{color:'#4F6B2A'},
  temporal:{color:'#1E5670'},
  alud:{color:'#475A6C'}
};
export const PAIRS = [['tormenta','riada'],['sequia','incendio'],['ola','incendio'],['temporal','riada'],['alud','tormenta'],['plaga','sequia'],['temporal','tormenta']];
export const SLIDE_MULT = {riada:1, tormenta:.5, temporal:.5, alud:.6, incendio:.3, sequia:0, ola:0, plaga:0};

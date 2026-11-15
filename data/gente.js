// Vecinos: nombres posibles, oficios (trabajo en el que son mejores y color) y trabajos de producción.
// Nombres de oficio y descripciones: i18n/es.json, «oficios».
export const NAMES = [['Miren','f'],['Joseba','m'],['Ane','f'],['Iker','m'],['Itziar','f'],['Mikel','m'],['Nerea','f'],['Aitor','m'],['Leire','f'],['Unai','m'],['Maite','f'],['Koldo','m'],['Edurne','f'],['Gorka','m'],['Amaia','f'],['Xabier','m'],['Lucía','f'],['Paco','m'],['Rosa','f'],['Andoni','m'],['Irati','f'],['Peio','m'],['Josune','f'],['Txema','m']];
export const OFICIOS = {
  lenador:{job:'talar',color:'#4E7A4F'},
  cantero:{job:'cantera',color:'#7E7A74'},
  agricultor:{job:'granja',color:'#A88420'},
  albanil:{job:null,color:'#B5502E'},
  comerciante:{job:'recaudar',color:'#B07A12'},
  bombero:{job:null,color:'#C2531F'},
  medico:{job:null,color:'#2F6B9A'},
  peon:{job:null,color:'#8A8478'}
};
// Oficios con los que empieza el pueblo (uno de cada).
export const OFICIOS_INICIALES = ['lenador','cantero','agricultor','albanil','comerciante','bombero','medico','peon'];
export const JOBS = ['talar','cantera','granja','recaudar'];

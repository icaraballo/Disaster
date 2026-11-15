// Las mejoras (1 de 3 tras cada desastre) y los eventos del pueblo. Son reglas con efectos,
// así que viven en código; sus nombres y textos están en i18n/es.json («mejoras» y «eventos»).
import { clamp, ao } from './util.js';
import { pick } from './azar.js';
import { G, T, newWorker, ofName, obsLevel, aliveWorkers } from './estado.js';
import { t } from './i18n.js';

// ok() dice si la mejora tiene sentido ahora (para no ofrecer lo que no sirve).
export const PERKS = [
  {id:'voluntarios', sw:'#4E7A4F', ok:()=>true, apply:()=>{ const w = newWorker(); G.msg = t('msg.seUne', {nombre: w.name, oficio: ofName(w)}); }},
  {id:'radar', sw:'#7A5A9E', ok:()=>obsLevel()<3, apply:()=>G.perks.radar++},
  {id:'bomba', sw:'#2A62A0', ok:()=>!G.perks.bomba, apply:()=>G.perks.bomba=true},
  {id:'bomberos', sw:'#C2531F', ok:()=>!G.perks.bomberos, apply:()=>G.perks.bomberos=true},
  {id:'carpinteros', sw:'#7A5A3A', ok:()=>!G.perks.carpinteros, apply:()=>G.perks.carpinteros=true},
  {id:'muros', sw:'#8E8A84', ok:()=>!G.perks.muros, apply:()=>G.perks.muros=true},
  {id:'ayuda', sw:'#D99A2B', ok:()=>true, apply:()=>G.res.dinero+=50},
  {id:'fiesta', sw:'#B5502E', ok:()=>G.res.moral<90, apply:()=>G.res.moral=clamp(G.res.moral+20,0,100)},
  {id:'silos', sw:'#C9B57E', ok:()=>true, apply:()=>G.res.comida+=10},
  {id:'obras', sw:'#5E5A52', ok:()=>G.tiles.some(x=>x.dmg), apply:()=>G.tiles.forEach(x=>x.dmg=false)},
  {id:'reforestar', sw:'#36673A', ok:()=>G.tiles.some(x=>x.t==='Q') || G.res.riesgo>=25, apply:()=>{ G.tiles.forEach(x=>{ if (x.t==='Q') x.t='B'; }); G.res.riesgo=clamp(G.res.riesgo-15,0,95); }}
];

const op = (ev, k, vars) => ({l: t('eventos.' + ev + '.' + k + '.l', vars), d: t('eventos.' + ev + '.' + k + '.d', vars)});
const cabecera = (ev, vars) => ({titulo: t('eventos.' + ev + '.titulo'), texto: t('eventos.' + ev + '.texto', vars)});

// cond() dice si el evento puede salir; mk() lo monta con sus opciones (l = título, d = qué hace, ok = si se puede elegir, a = efecto).
export const EVENTS = [
  {id:'constructor', cond:()=>true, mk:()=>({...cabecera('constructor'),
    opts:[{...op('constructor','aceptar'), a:()=>{G.cheapDique=true;}},{...op('constructor','no'), a:()=>{}}]})},
  {id:'fiestas', cond:()=>true, mk:()=>({...cabecera('fiestas', {pueblo: t('pueblos.' + G.town + '.nombre')}),
    opts:[{...op('fiestas','celebrar'), a:()=>{G.res.moral=clamp(G.res.moral+15,0,100); G.lostTurn=1;}},{...op('fiestas','no'), a:()=>{G.res.moral=clamp(G.res.moral-5,0,100);}}]})},
  {id:'refugiados', cond:()=>G.res.comida>=6, mk:()=>({...cabecera('refugiados'),
    opts:[{...op('refugiados','acoger'), a:()=>{G.res.pop+=4; G.res.comida-=6; newWorker();}},{...op('refugiados','no'), a:()=>{G.res.moral=clamp(G.res.moral-8,0,100);}}]})},
  {id:'mercado', cond:()=>true, mk:()=>({...cabecera('mercado'),
    opts:[{...op('mercado','piedra'), ok:()=>G.res.dinero>=25, a:()=>{G.res.dinero-=25; G.res.piedra+=4;}},
          {...op('mercado','comida'), ok:()=>G.res.dinero>=20, a:()=>{G.res.dinero-=20; G.res.comida+=6;}},
          {...op('mercado','madera'), ok:()=>G.res.madera>=4, a:()=>{G.res.madera-=4; G.res.dinero+=30;}},
          {...op('mercado','nada'), a:()=>{}}]})},
  {id:'bosqueviejo', cond:()=>G.tiles.filter(x=>x.t==='B').length>=2, mk:()=>({...cabecera('bosqueviejo'),
    opts:[{...op('bosqueviejo','vender'), a:()=>{ const b = G.tiles.map((x,i)=>x.t==='B'?i:-1).filter(i=>i>=0); T(pick(b)).t='X'; G.res.dinero+=40; G.res.madera+=3; G.res.riesgo=clamp(G.res.riesgo+8,0,95);}},
          {...op('bosqueviejo','proteger'), a:()=>{G.res.moral=clamp(G.res.moral+5,0,100);}}]})},
  {id:'periodista', cond:()=>G.lastDmg>0, mk:()=>({...cabecera('periodista'),
    opts:[{...op('periodista','entrevista'), a:()=>{G.res.dinero+=35;}},{...op('periodista','no'), a:()=>{G.res.moral=clamp(G.res.moral+4,0,100);}}]})},
  {id:'hospital', cond:()=>G.workers.some(w=>w.inj && !w.gone), mk:()=>{
    const w = pick(G.workers.filter(x=>x.inj && !x.gone)); const v = {nombre: w.name, oficio: ofName(w), a: ao(w)};
    return {...cabecera('hospital', v),
      opts:[{...op('hospital','llevar', v), ok:()=>G.res.dinero>=20, a:()=>{G.res.dinero-=20; w.inj=0;}},{...op('hospital','quedar', v), a:()=>{}}]}; }},
  {id:'miedo', cond:()=>aliveWorkers().length>=5, mk:()=>{
    const w = pick(aliveWorkers().filter(x=>!x.inj)); const v = {nombre: w.name, oficio: ofName(w), a: ao(w)};
    return {...cabecera('miedo', v),
      opts:[{...op('miedo','convencer', v), ok:()=>G.res.dinero>=15, a:()=>{G.res.dinero-=15;}},{...op('miedo','irse', v), a:()=>{w.gone=true; G.res.comida+=3; G.res.pop-=1;}}]}; }},
  {id:'montaneros', cond:()=>G.res.comida>=3, mk:()=>({...cabecera('montaneros'),
    opts:[{...op('montaneros','aceptar'), a:()=>{G.res.comida-=3; newWorker('peon',true); newWorker('peon',true);}},{...op('montaneros','no'), a:()=>{}}]})},
  {id:'subvencion', cond:()=>true, mk:()=>({...cabecera('subvencion'),
    opts:[{...op('subvencion','pedir'), a:()=>{G.res.dinero+=50; G.paperwork=true;}},{...op('subvencion','no'), a:()=>{}}]})}
];

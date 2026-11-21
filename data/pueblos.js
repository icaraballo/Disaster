// Los pueblos: mapa de 7 × 8 casillas (una letra por casilla, ver data/casillas.js),
// casillas del río de arriba abajo, multiplicador de riadas, pesos de cada desastre y
// condición para desbloquearlo (ver cumple() en js/progreso.js).
// peligro (T-12): la dificultad del pueblo. Multiplica riadas, temporales, aludes y deslizamientos y
// suma rayos a las tormentas y focos a los incendios (data/balance.js). Se ajusta con el simulador.
// Nombre, tipo y descripción: i18n/es.json, «pueblos».
export const TOWNS = {
  villarrio:{color:'#4E7A4F',
    map:["BBBLLPP","BBLLPPP","BLPCCPR","PPCACRR","PCCCRRP","PPCRRPG","PPRRPPG","PRRPPPP"],
    river:[20,27,26,33,32,39,38,45,44,51,50], riadaMult:1, peligro:1.3,
    pool:{riada:3,incendio:3,tormenta:3,sequia:2,ola:2,plaga:2}, unlock:null},
  arrieta:{color:'#2A62A0',
    map:["LLBBRBB","LBBPRPP","BCCCRCP","PCACRCG","PCCPRPG","PPCPRCP","MCCPRCM","MMMMMMM"],
    river:[4,11,18,25,32,39,46], riadaMult:0.8, peligro:1.4,
    pool:{temporal:4,tormenta:3,riada:2,incendio:2,ola:2,plaga:1},
    unlock:{tipo:'victorias', pueblo:'villarrio', n:1}},
  altuzarra:{color:'#5E6E7E',
    map:["SSSLSSL","LSLLLSL","BLBBRBB","PCCARCP","PCCPRCG","BPPRPPG","BPRPPPP","PRPPPPB"],
    river:[18,25,32,38,44,50], riadaMult:0.9, peligro:1.5,
    pool:{alud:4,tormenta:3,incendio:2,riada:2,sequia:1,plaga:1},
    unlock:{tipo:'alcance', pueblo:'arrieta', n:5}},
  errekalde:{color:'#1F4F85',
    map:["BBPRRPL","BPCRRCL","PCCRRCC","PCARRCP","GPCRRCP","GPPRRPB","PPCRRCB","PPPRRMM"],
    river:[3,4,10,11,17,18,24,25,31,32,38,39,45,46,52,53], riadaMult:0.85, peligro:1.6,
    pool:{riada:5,temporal:2,tormenta:3,ola:2,plaga:1,incendio:1},
    unlock:{tipo:'victorias', pueblo:'altuzarra', n:1}}
};

# Disaster — documento de traspaso para Claude Code

> Este documento recoge todo lo decidido en la fase de diseño. Es la fuente de verdad para
> construir el juego. Lo acompaña `reference/disaster-prototipo-v1.html`: el prototipo jugable
> de un solo archivo (HTML, CSS y JavaScript sin dependencias). Se abre con doble clic.

---

## 1. Qué es el juego

Juego de **gestión y supervivencia por turnos** con estructura de roguelike: eres el alcalde de
un pueblo pequeño y tienes que conseguir que sobreviva a una **temporada de 8 desastres** cada
vez más fuertes. Entre desastre y desastre hay poco tiempo para prepararse y nunca sabes del
todo qué va a venir.

- El núcleo es **gestión de riesgo con incertidumbre**: recursos limitados, previsiones que
  pueden fallar y decisiones donde **nada sale gratis** (un dique protege un barrio pero empuja
  el agua al de abajo; talar da madera pero debilita la ladera).
- Cada partida dura 15-25 minutos. Si el pueblo cae, se empieza otra temporada.
- Proyecto personal de portfolio (se presentará en LinkedIn). Encaja con el perfil de Iñigo:
  datos, logística y riesgo, disfrazados de juego.
- **Nombre de trabajo: Disaster.** El nombre final está sin decidir (favorito: *Kontuz*,
  «¡cuidado!» en euskera, con subtítulo traducido). No llevará la palabra «roguelike».

## 2. Decisiones cerradas

| Tema | Decisión |
|---|---|
| Papel del jugador | Alcalde de un pueblo que se prepara entre desastres (de las tres opciones de partida, la «3»: ni coordinador de emergencias en tiempo real ni superviviente individual). |
| Estructura | Turnos → desastres → temporada. 3 turnos de preparación por desastre; 8 desastres por temporada. |
| Mapa | Rejilla de 7 × 8 casillas con geografía: bosque, ladera, prado, río, casas, ayuntamiento, granja, y según el pueblo mar o neveros. Dónde construyes importa. |
| Incertidumbre | Previsión con dos opciones y probabilidades que pueden fallar; su precisión mejora con el observatorio, el radar o la meteoróloga. |
| Contrapartidas | Toda acción útil tiene un coste o un efecto secundario. Es lo que da sentido al juego y no se pierde. |
| Cascadas | Un desastre deja consecuencias para el siguiente (ayuntamiento sin luz, tierra seca, ladera débil…). |
| Vecinos | Personas con nombre y oficio, no «cuadrillas» anónimas. Pueden resultar heridas o marcharse. |
| Progresión | Alcaldes con habilidades y pueblos que se desbloquean; reto diario con la misma semilla para todos. |
| Datos a la vista | Mapa de riesgo por casilla e informe con gráficas al final. Es parte de la identidad del juego. |
| Tono visual | Punto intermedio: colores cálidos de pueblo con un poco de tensión, sin llegar a oscuro (no tipo Frostpunk). Abierto a revisar. |
| Idiomas | Una sola app con varios idiomas dentro y ficha de tienda traducida. Se empieza en español, pero la estructura de idiomas va **desde el primer día**. |
| Plataforma | Como los otros juegos: web sin servidor (GitHub Pages) y app de Android. |
| Acabado | El «punto 5» (animaciones, sonido, mapa más bonito) queda **para más adelante**. |

## 3. El ciclo de un desastre

```
AVISO           el observatorio da 2 opciones con %: «Lluvias intensas 60% · Calor y viento 40%»
  │             + intensidad (●○○ a ●●●) + precisión (baja / media / alta)
  ▼
PREPARACIÓN     3 turnos (2 si el ayuntamiento está sin luz; −1 si se celebran fiestas)
  │             cada turno: reparto de la gente entre PRODUCIR y CONSTRUIR sobre el mapa
  ▼
IMPACTO         el desastre se resuelve paso a paso sobre el mapa, con un registro de lo que pasa
  ▼
CONSECUENCIAS   balance + elegir 1 mejora de 3
  ▼
EVENTO (70 %)   una situación con 2-4 opciones que obliga a decidir
  ▼
siguiente AVISO … hasta el desastre 8 → INFORME FINAL
```

## 4. Recursos y condiciones de derrota

| Recurso | Inicio | Para qué |
|---|---|---|
| Vecinos (población) | 40 | Si baja de 15, se pierde. Cada casa dañada: −3. |
| Moral | 70 % | Si llega a 0, se pierde. Por debajo de 35, alguien se desanima y no trabaja. |
| Dinero | 60 | Sacos, pararrayos, observatorio, eventos. |
| Madera | 4 | Reparar, pararrayos, muros, observatorio, aljibe. |
| Piedra | 3 | Diques, escolleras, muros, aljibe. |
| Comida | 12 | Tras cada desastre se consumen ⌈vecinos / 6⌉. Si falta: −15 moral. |
| Riesgo de ladera | 10 % | Probabilidad base de deslizamiento (y de aludes). Sube al talar, sacar piedra o perder bosque. |
| Tu gente | 8 personas | Una por oficio + una sin oficio. Son quienes trabajan cada turno. |

**Se pierde** si quedan menos de 22 vecinos (15 en la v1; ver DS-DESIGN), si la moral llega a 0 o si no queda nadie para
trabajar. **La moral es lo que más partidas tumba** (ver §12).

## 5. Tu gente: vecinos con nombre y oficio

Cada persona tiene nombre (vascos y castellanos), oficio y una casa en el mapa.

| Oficio | Efecto |
|---|---|
| Leñador/a | +2 madera extra al talar |
| Cantero/a | +1 piedra extra y la ladera sube +3 % en vez de +6 % |
| Agricultor/a | +2 comida extra en la granja; si trabajó en la granja, la plaga hace la mitad |
| Albañil | Cuando construye, la obra cuesta 1 material menos |
| Comerciante | +10 dinero extra al recaudar; la moral baja 1 en vez de 2 |
| Bombero/a | Mientras esté sano, el fuego se propaga menos (−0,12) |
| Médico/a | Mientras esté sano, las casas dañadas causan 1 herido menos y salva al 50 % de quienes viven ahí |
| Sin oficio | Hace de todo, sin bonificación |

- Al poner a alguien a producir o construir, el juego elige **a quien mejor encaja** (el
  leñador a talar, el albañil a construir).
- Si se daña la casa de alguien (y no estaba evacuada), queda **herido** y no trabaja en la
  siguiente preparación. Si le vuelve a pasar estando herido, **se marcha** del pueblo.
- Los heridos se curan al empezar el siguiente impacto.

## 6. Producción (por persona y turno)

| Trabajo | Da | Contrapartida |
|---|---|---|
| Talar | 2 madera (+2 leñador, +1 Serrería) | +4 % riesgo de ladera |
| Cantera | 1 piedra (+1 cantero) | +6 % riesgo (+3 % si es cantero) |
| Granja | 1 comida por granja sana (máx. 2) (+2 agricultor, +2 alcalde agricultor); la mitad tras sequía sin aljibe | Las granjas están junto al río |
| Recaudar | 15 dinero (+10 comerciante, +5 tesorero) | −2 moral (−1 comerciante o tesorero) |

## 7. Construir y proteger (se elige la acción y se toca el mapa)

| Acción | Dónde | Coste | Efecto |
|---|---|---|---|
| Dique / escollera | Río / mar | 3 piedra · 1 persona (−1 ingeniera, −1 Cantería; mín. 1) | Frena el agua en esa casilla. **En el río empuja el 60 % de la presión río abajo.** |
| Sacos | Edificio | 8 dinero · 1 | Protege de una inundación; se gastan |
| Cortafuegos | Bosque | 1 persona | Tala la casilla: el fuego no pasa, +2 madera, +5 % riesgo de ladera |
| Pararrayos | Edificio | 2 madera + 15 dinero · 1 | Protege de rayos esa casilla y las de alrededor (radio 1) |
| Muro | Ladera / nevero | 2 piedra + 2 madera · 2 (−1 piedra ingeniera) | Ladera: −15 % riesgo. Nevero: frena los aludes |
| Evacuar | Casa | 2 comida · 1 | Si le pasa algo en este desastre, nadie resulta herido |
| Reparar | Edificio dañado | 2 madera · 1 | Lo arregla |
| Observatorio | Prado | 4 madera + 30 dinero · 2 | +1 nivel de precisión. Solo uno |
| Aljibe | Prado | 3 piedra + 2 madera · 2 | Sequía: se pierde la mitad y las granjas siguen produciendo. Solo uno |

## 8. Los desastres

La intensidad *I* va de 1 a 3: desastres 1-3 → 1; 4-6 → 2; 7-8 → 3. Desde el desastre 6 pueden
llegar **dos a la vez** (40 %; en el último, 70 %).

| Desastre | Qué hace | Cómo se protege |
|---|---|---|
| **Riada** | Recorre el río de arriba abajo; cada tramo sin dique inunda las casillas de al lado con *p* = (0,12 + 0,1·*I*) × factor del pueblo, más lo que empujan los diques de arriba (la presión arrastrada se reduce a la mitad en cada tramo). | Diques, sacos, Bombas de achique |
| **Temporal marítimo** | Cada casilla de mar inunda las de la costa con *p* = 0,15 + 0,12·*I*. | Escolleras, sacos |
| **Incendio forestal** | Prende en *I* bosques y se propaga: bosque 0,7 · prado 0,3 · ladera 0,15 · edificio 0,45 · aljibe 0,2. Tierra seca +0,15; bombero −0,12; Brigada de bomberos −0,2. Cada bosque quemado: +3 % riesgo de ladera. | Cortafuegos, bombero |
| **Tormenta eléctrica** | 2 + *I* rayos sobre edificios al azar. | Pararrayos |
| **Alud** | Cada columna con nevero se suelta con *p* = 0,12·*I* + riesgo / 250 (máx. 0,8) y baja hasta chocar con bosque, un muro o un edificio. | Muros, **no talar** el bosque que hace de barrera |
| **Sequía** | −3·*I* comida (la mitad con aljibe), −3 moral, la tierra queda seca y las granjas dan la mitad en la siguiente preparación. | Aljibe, reservas de comida |
| **Ola de calor** | Heridos: *I* si el ayuntamiento tiene luz (refugio), 2·*I* si no; −1 con médico. −4 moral. Con *I* ≥ 2 y sin luz, alguien de tu gente cae. Deja la tierra seca. | Mantener el ayuntamiento reparado |
| **Plaga** | Se pierde el (20 + 10·*I*) % de la comida; la mitad si un agricultor trabajó en la granja o con el alcalde agricultor. −3 moral. | Agricultor en la granja |

**Deslizamiento** (cascada, tras el desastre): probabilidad = riesgo de ladera × factor del
desastre (riada 1 · tormenta y temporal 0,5 · alud 0,6 · incendio 0,3 · el resto 0) ×
(0,6 + 0,2·*I*). Daña 1 edificio (2 si *I* ≥ 2) de los que están hasta dos casillas por debajo de
una ladera.

**Daños**: cada edificio dañado, −6 moral. Una casa dañada: −3 vecinos y 2 heridos (−1 con
médico, −1 con la enfermera), más su gente herida. El ayuntamiento sin luz quita un turno de
preparación; la granja dañada da menos; el observatorio dañado no mejora la previsión.

**Al final de cada impacto**: se consume la comida (y si alcanza, +1 moral); sin ningún edificio
dañado, +5 moral.

## 9. Pueblos y alcaldes

| Pueblo | Tipo | Desastres más probables | Se desbloquea |
|---|---|---|---|
| Villarrío | Valle con río | Riada, incendio, tormenta, sequía, ola de calor, plaga | Desde el inicio |
| Arrieta | Costa | Temporal, tormenta, riada | Ganando en Villarrío |
| Altuzarra | Alta montaña | Alud, tormenta, incendio | Llegando al desastre 6 en Arrieta |
| Errekalde | Ría | Riada (muy dura, 16 tramos), tormenta, temporal | Ganando en Altuzarra |

| Alcalde | Habilidad | Se desbloquea |
|---|---|---|
| Begoña, la ingeniera | Diques, escolleras y muros −1 piedra; +3 piedra al empezar | Desde el inicio |
| Patxi, el agricultor | +2 comida por persona en la granja; +8 comida; plagas a la mitad | Desde el inicio |
| Garazi, la meteoróloga | +1 nivel de precisión y ve el desastre siguiente | 10 desastres superados en total |
| Txomin, el tesorero | +40 dinero; recaudar +5 y solo −1 moral | Ganar una temporada |
| Arantxa, la enfermera | Los heridos vuelven en el turno 2; las casas dañadas causan 1 herido menos | Terminar 3 temporadas |

En el menú hay un **modo prueba** que lo desbloquea todo.

## 10. Mejoras (1 de 3 tras cada desastre) y eventos

**Mejoras**: Voluntarios del monte (llega una persona), Radar meteorológico (+precisión), Bombas
de achique, Brigada de bomberos, Serrería, Cantería, Ayuda de la diputación (+50 dinero),
Romería (+20 moral), Silos llenos (+10 comida), Brigada de obras (repara todo), Repoblación (los
bosques quemados vuelven y −15 % riesgo).

**Eventos** (70 % tras cada desastre; nunca el mismo dos veces seguidas): constructor ambulante
(diques a 1 piedra que pueden ceder un 35 %), fiestas del pueblo (+15 moral y un turno menos),
familia sin hogar (+4 vecinos y una persona, −6 comida), día de mercado (comprar piedra o comida,
vender madera), el bosque viejo (venderlo a un aserradero), sales en las noticias (donaciones),
un herido grave (hospital), alguien quiere irse, montañeros voluntarios (+2 personas temporales)
y una subvención con papeleo (alguien pierde el primer turno).

## 11. Interfaz (todo presente en el prototipo)

1. **Menú**: nueva temporada (elegir pueblo y alcalde), reto diario, cómo se juega, progreso y
   modo prueba.
2. **Botón «Menú»** en todas las pantallas de partida, para saltar libremente al probar.
3. **Ficha de casilla**: tocar cualquier casilla dice qué es, su estado, qué se puede hacer ahí
   (con botones en la preparación), qué le puede pasar según dónde está y su riesgo estimado.
4. **Mapa de riesgo**: pinta cada edificio con la probabilidad de daño en el próximo desastre,
   según la previsión.
5. **Tu gente**: tira de personas con oficio y estado (libre, talando, herida, desanimada…).
6. **Impacto paso a paso**: los efectos aparecen uno a uno sobre el mapa con un registro.
7. **Informe final**: puntuación, gráficas de vecinos y moral, daños por desastre, qué hizo más
   daño, qué salvó más y qué se construyó más.
8. **Reto diario**: misma semilla para todos (pueblo, alcalde, calendario de desastres). En
   Claude.ai guarda progreso y ranking con la capacidad `db` de los artefactos; fuera de ahí, el
   progreso va a `localStorage` y **el ranking necesita un servidor** (ver §13).

**Puntuación**: desastres superados × 100 + vecinos × 10 + moral × 3 + gente que queda × 20
+ 500 si se gana.

## 12. Equilibrio (simulado)

Con un simulador de bots sobre el propio código (cientos de partidas por combinación):

- **Jugando sin pensar**: ~30 % de victorias en Villarrío, casi 0 % en Arrieta y Errekalde.
- **Jugando con cabeza** (mapa de riesgo, proteger según la previsión, no recaudar sin control):
  ~85-95 % en todos los pueblos.
- **La moral es muy sensible**: con +2 de recuperación tras cada desastre ganaba casi todo; con 0,
  casi nada. Se dejó en +1. Cualquier cambio en la moral hay que volver a simularlo.
- El tesorero llegó a estar roto (recaudar sin perder moral): ahora pierde 1.

## 13. Pendiente / ideas (no hacer sin que Iñigo lo pida)

- **Acabado («punto 5»)**: animaciones del agua y el fuego avanzando, sonido, mapa más bonito
  (quizá isométrico), textos con más gracia.
- **Ranking fuera de Claude.ai**: necesita un servidor. Encaja con el plan de servidor compartido
  de rankings que Iñigo tiene para sus juegos.
- **Nombre final** y si el público principal es español o internacional.
- Tono visual: revisar el punto intermedio cuando haya arte.
- Más pueblos, alcaldes, desastres y eventos.

## 14. Estructura propuesta

### Repo de código (`Disaster`, en `Desktop/Proyectos/` y en GitHub)

La arquitectura la decide Claude Code mirando los otros juegos (Chromalchemy es JavaScript sin
compilación; La Última Gota tiene compilación y `npm run apk`). Lo que no cambia:

- **Datos fuera del código**: pueblos, desastres, acciones, oficios, alcaldes, mejoras y eventos
  en ficheros de datos, para equilibrar sin tocar la lógica.
- **Textos en ficheros de idioma** (`i18n/es.json` primero) desde el primer día.
- **Lógica separada del dibujo**, para que el simulador de bots juegue sin pantalla.
- **Azar con semilla** inyectable (reto diario y simulación reproducible).
- `reference/disaster-prototipo-v1.html` se queda como referencia y no se edita.

### Documentación (carpeta `Disaster` de `Vault_Proyectos`, prefijo `DS-`)

Ya creada, con la misma estructura que el resto: puerta de entrada `Disaster.md`, `Código/`,
`Diseño/`, `QA/`, `Tareas/`, `Versiones/` y este documento en `Juego-Original/`.

## 15. Orden de trabajo sugerido para Claude Code

1. Leer este documento y jugar el prototipo para ver el comportamiento esperado.
2. Crear la estructura del repo y portar el prototipo a módulos **sin cambiar cómo se juega**:
   datos aparte, textos en `i18n/es.json`, lógica separada del dibujo.
3. Portar el simulador de bots como test y comprobar que el equilibrio coincide con §12.
4. Activar GitHub Pages y los ajustes comunes del repo (sin wiki ni projects, `main` protegido).
5. Actualizar la documentación del vault (`DS-Arquitectura`, `DS-2026-11-v0` y la siguiente
   versión).
6. Más adelante, la app de Android como en los otros juegos.

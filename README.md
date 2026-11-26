# Disaster

### ▶ [Jugar](https://icaraballo.github.io/Disaster/)

Juego de gestión y supervivencia por turnos: eres el alcalde de un pueblo pequeño y tienes que
conseguir que aguante una **temporada de 8 desastres** cada vez más fuertes. Entre desastre y
desastre hay poco tiempo para prepararse y nunca sabes del todo qué va a venir.

**Estado:** jugable en la web. El prototipo de la fase de diseño (noviembre de 2026) está portado a
módulos, con textos aparte, lógica sin pantalla y tests de equilibrio con bots. Desde el 19-11 el
pueblo se ve en un **mapa en 3D**, desde el 21-11 la temporada suma casas que caen en ruinas,
familias acogidas, previsión que se afina turno a turno, medallas y **refugio**, y desde el 26-11
(v6) **cada alcalde tiene su propia forma de ganar** (pasiva, acción exclusiva y punto débil), hay
**autoguardado de partida en curso** y control de velocidad en los impactos (`×1 / ×2 / Saltar`).

## Cómo se juega

1. **Aviso.** El observatorio da una previsión con probabilidades que pueden fallar y que se
   afinan en cada turno: esperar da certeza, pero quita tiempo para preparar.
2. **Preparación.** Tres turnos para repartir a tu gente entre **producir** (madera, piedra,
   comida, dinero) y **construir** sobre el mapa (diques, cortafuegos, pararrayos, muros…).
3. **Impacto.** El desastre se resuelve paso a paso sobre el mapa (puedes acelerarlo a `×2` o
   saltarlo).
4. **Consecuencias.** Eliges una mejora y, a veces, el pueblo te pone ante una decisión.

Nada sale gratis: un dique protege un barrio pero empuja el agua al de abajo, y talar da madera
pero debilita la ladera. Cada desastre deja consecuencias para el siguiente: una casa que no
reparas a tiempo cae en ruinas, su familia se muda a casa de otra y las ruinas dejan pasar el agua.
Aguantar los 8 desastres da el bronce; la plata y el oro piden acabar con el pueblo entero.

## Lo que lo hace distinto

- **El pueblo en 3D.** Mapa con [Three.js](https://threejs.org), modelos low-poly hechos por
  código, un ambiente por desastre, el impacto animado y vecinos que caminan hasta su tarea.
- **Riesgo a la vista.** Un mapa de riesgo calcula la probabilidad de daño de cada edificio
  según la previsión, y al final hay un informe con gráficas de lo que pasó.
- **Vecinos con nombre y oficio** que pueden resultar heridos o marcharse.
- **Cuatro pueblos** (valle, costa, alta montaña y ría), cada uno más difícil que el anterior, y
  **cinco alcaldes asimétricos**, cada uno con su pasiva, su obra o acción exclusiva y su punto débil.
- **Autoguardado de temporada** (incluyendo el estado del azar) para retomar la partida en cualquier momento.
- **Reto diario** con los mismos desastres para todo el mundo.
- **Equilibrado con simulación**: un simulador de bots juega miles de partidas para ajustar la
  dificultad y comprobar que cada estrategia y alcalde funciona.

## Jugar y probar

- **En la web:** https://icaraballo.github.io/Disaster/
- **En local:** `npm run serve` y abre http://127.0.0.1:8765/ (los módulos de JavaScript no
  funcionan abriendo `index.html` con doble clic).
- **Tests:** `npm test` (textos, lógica, pantallas, guardado y equilibrio con bots). No hace falta
  `npm install`: el juego no tiene dependencias.
- **Estrategias:** `npm run estrategias` enfrenta al bot listo con tres estrategias puras y mide la
  tabla Alcalde × Pueblo (jugando a su manera frente a jugar genérico).
- **Simulador de bots:** `npm run simular` cuenta cuántas partidas gana cada bot (ingenuo, medio y
  listo) en cada pueblo, con los vecinos finales, la moral mínima y las medallas.
- El prototipo original de un solo archivo sigue en `reference/disaster-prototipo-v1.html`
  (referencia, no se edita).

## Estructura

```
index.html        la página (sólo carga css/ y js/main.js)
css/              estilos
data/             pueblos, desastres, alcaldes, oficios, casillas y números del equilibrio
i18n/es.json      todos los textos que ve el jugador
js/               la lógica del juego, sin pantalla (estado, partida, turnos, desastres, riesgo…)
js/ui/            el dibujo: lee el estado y genera el HTML; el mapa en 3D (mapa3d, modelos3d…)
js/vendor/        Three.js (MIT), tal cual, sin compilar
tests/            tests y los bots (ingenuo, medio y listo)
tools/            simulador de bots
reference/        el prototipo v1, tal cual salió del diseño
```

## Documentación

- [`DISASTER-HANDOFF.md`](DISASTER-HANDOFF.md): todo lo decidido en la fase de diseño, con las
  reglas y los números.
- El diseño vivo, las tareas y el QA están en el vault de proyectos (privado).

## Cómo está hecho

Diseñado conversando con Claude en Claude.ai e implementado con Claude Code. La dirección del
proyecto, las decisiones de diseño y las pruebas son de Iñigo.

## Licencia

© 2026 icaraballo. Todos los derechos reservados. Ver [LICENSE](LICENSE). Incluye
[Three.js](https://threejs.org) con licencia MIT ([`js/vendor/LICENSE-three.txt`](js/vendor/LICENSE-three.txt)).

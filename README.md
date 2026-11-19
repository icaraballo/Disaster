# Disaster

### ▶ [Jugar](https://icaraballo.github.io/Disaster/)

> Nombre de trabajo. El nombre final está por decidir.

Juego de gestión y supervivencia por turnos: eres el alcalde de un pueblo pequeño y tienes que
conseguir que aguante una **temporada de 8 desastres** cada vez más fuertes. Entre desastre y
desastre hay poco tiempo para prepararse y nunca sabes del todo qué va a venir.

**Estado:** jugable en la web. El prototipo de la fase de diseño (noviembre de 2026) está portado a
módulos, con textos aparte, lógica sin pantalla y tests de equilibrio con bots. Desde el 19-11 el
pueblo se ve en un **mapa en 3D**.

## Cómo se juega

1. **Aviso.** El observatorio da una previsión con probabilidades que pueden fallar.
2. **Preparación.** Tres turnos para repartir a tu gente entre **producir** (madera, piedra,
   comida, dinero) y **construir** sobre el mapa (diques, cortafuegos, pararrayos, muros…).
3. **Impacto.** El desastre se resuelve paso a paso sobre el mapa.
4. **Consecuencias.** Eliges una mejora y, a veces, el pueblo te pone ante una decisión.

Nada sale gratis: un dique protege un barrio pero empuja el agua al de abajo, y talar da madera
pero debilita la ladera. Cada desastre deja consecuencias para el siguiente.

## Lo que lo hace distinto

- **El pueblo en 3D.** Mapa con [Three.js](https://threejs.org), modelos low-poly hechos por
  código, un ambiente por desastre, el impacto animado y vecinos que caminan hasta su tarea.
- **Riesgo a la vista.** Un mapa de riesgo calcula la probabilidad de daño de cada edificio
  según la previsión, y al final hay un informe con gráficas de lo que pasó.
- **Vecinos con nombre y oficio** que pueden resultar heridos o marcharse.
- **Cuatro pueblos** (valle, costa, alta montaña y ría) y **cinco alcaldes** con habilidades.
- **Reto diario** con los mismos desastres para todo el mundo.
- **Equilibrado con simulación**: un simulador de bots juega miles de partidas para ajustar la
  dificultad.

## Jugar y probar

- **En la web:** https://icaraballo.github.io/Disaster/
- **En local:** `npm run serve` y abre http://127.0.0.1:8765/ (los módulos de JavaScript no
  funcionan abriendo `index.html` con doble clic).
- **Tests:** `npm test` (textos, lógica, pantallas y equilibrio con bots). No hace falta
  `npm install`: el juego no tiene dependencias.
- **Simulador de bots:** `npm run simular` cuenta cuántas partidas gana cada bot (ingenuo, medio y
  listo) en cada pueblo.
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

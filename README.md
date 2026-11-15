# Disaster

### ▶ [Jugar](https://icaraballo.github.io/Disaster/)

> Nombre de trabajo. El nombre final está por decidir.

Juego de gestión y supervivencia por turnos: eres el alcalde de un pueblo pequeño y tienes que
conseguir que aguante una **temporada de 8 desastres** cada vez más fuertes. Entre desastre y
desastre hay poco tiempo para prepararse y nunca sabes del todo qué va a venir.

**Estado:** prototipo jugable cerrado en la fase de diseño (noviembre de 2026). Siguiente paso:
portarlo a módulos.

## Cómo se juega

1. **Aviso.** El observatorio da una previsión con probabilidades que pueden fallar.
2. **Preparación.** Tres turnos para repartir a tu gente entre **producir** (madera, piedra,
   comida, dinero) y **construir** sobre el mapa (diques, cortafuegos, pararrayos, muros…).
3. **Impacto.** El desastre se resuelve paso a paso sobre el mapa.
4. **Consecuencias.** Eliges una mejora y, a veces, el pueblo te pone ante una decisión.

Nada sale gratis: un dique protege un barrio pero empuja el agua al de abajo, y talar da madera
pero debilita la ladera. Cada desastre deja consecuencias para el siguiente.

## Lo que lo hace distinto

- **Riesgo a la vista.** Un mapa de riesgo calcula la probabilidad de daño de cada edificio
  según la previsión, y al final hay un informe con gráficas de lo que pasó.
- **Vecinos con nombre y oficio** que pueden resultar heridos o marcharse.
- **Cuatro pueblos** (valle, costa, alta montaña y ría) y **cinco alcaldes** con habilidades.
- **Reto diario** con los mismos desastres para todo el mundo.
- **Equilibrado con simulación**: un simulador de bots juega miles de partidas para ajustar la
  dificultad.

## Probar el prototipo

Abre `reference/disaster-prototipo-v1.html` en el navegador. Es un solo archivo, sin dependencias.

## Documentación

- [`DISASTER-HANDOFF.md`](DISASTER-HANDOFF.md): todo lo decidido en la fase de diseño, con las
  reglas y los números.
- El diseño vivo, las tareas y el QA están en el vault de proyectos (privado).

## Cómo está hecho

Diseñado conversando con Claude en Claude.ai e implementado con Claude Code. La dirección del
proyecto, las decisiones de diseño y las pruebas son de Iñigo.

## Licencia

© 2026 icaraballo. Todos los derechos reservados. Ver [LICENSE](LICENSE).

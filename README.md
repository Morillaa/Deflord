# Deflord

Citybuilder 2D con oleadas de defensa nocturnas, pensado para jugarse desde el navegador (incluido móvil).

Construido con [Phaser 3](https://phaser.io/) + [Vite](https://vitejs.dev/).

## Estado actual: Fase 5 — Torre de vigilancia (primera defensa)

- **Torre de vigilancia** (20 🪵 + 15 💰): solo se puede colocar en una casilla junto al camino de entrada (no encima, para no bloquear el paso). De noche, dispara sola cada 1.5s contra el enemigo más cercano dentro de 2 casillas de radio, sin necesitar interacción del jugador. De día no hace nada.
- Los enemigos ahora tienen una pequeña barra de vida (3 puntos) sobre su icono; cada impacto de torre resta 1 punto y dibuja una línea breve entre la torre y el enemigo. Si llegan a 0, el enemigo desaparece antes de alcanzar el pueblo.
- Sin torres (o si un enemigo consigue pasar sin ser destruido), todo sigue igual que antes: el enemigo daña temporalmente el edificio que alcance.
- Ciclo de tiempo visible en el HUD ("☀️ Día · 42s" / "🌙 Noche · 8s"): 60s de día y 20s de noche, alternándose sin parar.
- Al caer la noche: mensaje "¡Cae la noche!", el grid se oscurece, y aparecen 2-4 enemigos (👹) siempre en el mismo punto de entrada (borde superior, centrado), avanzando por un camino de tierra fijo hasta el centro del pueblo y desde ahí hacia el edificio más cercano.
- El camino de tierra es fijo y visible (no se puede construir sobre él); las casillas junto a él son, además, las únicas donde se puede colocar la torre.
- Si un enemigo llega a un edificio, lo deja "dañado" (se tiñe de rojo con un 💥): mientras dura el daño, ese edificio deja de generar recursos. Se repara solo pasados 15s.
- Al amanecer: mensaje "Amanece", el grid recupera su brillo y los enemigos restantes desaparecen.
- Durante el día, todo funciona igual que en fases anteriores (construir, generar recursos, asignar aldeanos); de noche también se puede seguir jugando con normalidad salvo por los edificios dañados.
- Cuadrícula (grid) 2D top-down; solo un bloque central de 5×5 casillas es edificable de inicio (menos el camino de entrada) — el resto se ve más oscuro con algún 🔒 suelto.
- La partida empieza con recursos limitados: 30 madera, 20 comida, 15 oro.
- Cada edificio tiene un coste fijo en recursos, visible en su botón del panel inferior:
  - **Vivienda**: 20 🪵 — sube el límite de población en +3 aldeanos.
  - **Almacén de madera**: 15 🪵 — genera madera (más rápido con aldeanos asignados).
  - **Granja**: 15 🪵 + 10 💰 — genera comida (más rápido con aldeanos asignados).
  - **Mercado**: 20 🪵 + 15 💰 — genera oro cada 8s (5s con 1 aldeano, 3s con 2), más lento que los otros dos pero alcanzable.
  - **Torre de vigilancia**: 20 🪵 + 15 💰 — no genera recursos; defiende el camino.
- Si no hay recursos suficientes, la casilla está fuera de la zona edificable, o (para la torre) no está junto al camino, no se coloca el edificio: aparece un mensaje breve y, si es por falta de recursos, el botón del edificio parpadea en rojo.
- Los aldeanos son unidades independientes del grid (iconos 🧍 libres junto al mapa, o asignados sobre su edificio). El HUD muestra "🧑 Aldeanos: libres/total"; tocar un edificio generador abre su panel de asignación (+/-, máximo 2 por edificio) y desde ahí también se puede quitar. La torre, como la Vivienda, se quita tocándola de nuevo.
- Si se quita una Vivienda y el nuevo límite de población es menor que los aldeanos ya asignados, se liberan automáticamente los asignados más recientemente.

No incluye todavía: héroe, mejoras de nivel de la torre, distintos tipos de torre, ni consecuencias permanentes de los ataques (game over, pérdida real de edificios), coste creciente por edificio repetido, mejoras de nivel ni desbloqueo de nuevas zonas. Eso llegará en fases posteriores.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre la URL que muestre Vite (por defecto http://localhost:5173).

## Build de producción

```bash
npm run build
npm run preview
```

## Despliegue

Cada push a la rama por defecto del repo (`claude/deflord-phaser-setup-pnciya`) dispara el workflow `.github/workflows/deploy.yml`, que compila el proyecto con Vite y lo publica en GitHub Pages.

Jugable en: https://morillaa.github.io/Deflord/

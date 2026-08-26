# Deflord

Citybuilder 2D con oleadas de defensa nocturnas, pensado para jugarse desde el navegador (incluido móvil).

Construido con [Phaser 3](https://phaser.io/) + [Vite](https://vitejs.dev/).

## Estado actual: Fase 3 — Costes y límites

- Cuadrícula (grid) 2D top-down; solo un bloque central de 5×5 casillas es edificable de inicio — el resto se ve más oscuro con algún 🔒 suelto, marcando la zona sin desbloquear (todavía no hay forma de expandirla).
- La partida empieza con recursos limitados: 30 madera, 20 comida, 10 oro (antes de esta fase eran infinitos).
- Cada edificio tiene un coste fijo en recursos, visible en su botón del panel inferior:
  - **Vivienda**: 20 🪵 — sube el límite de población en +3 aldeanos.
  - **Almacén de madera**: 15 🪵 — genera madera (más rápido con aldeanos asignados).
  - **Granja**: 15 🪵 + 10 💰 — genera comida (más rápido con aldeanos asignados).
  - **Mercado**: 20 🪵 + 15 💰 — genera oro, a ritmo más lento que los otros dos.
- Si no hay recursos suficientes o la casilla está fuera de la zona edificable, no se coloca el edificio: aparece un mensaje breve y, si es por falta de recursos, el botón del edificio parpadea en rojo.
- Los aldeanos siguen siendo unidades independientes del grid (iconos 🧍 libres junto al mapa, o asignados sobre su edificio). El HUD muestra "🧑 Aldeanos: libres/total"; tocar un edificio generador abre su panel de asignación (+/-, máximo 2 por edificio) y desde ahí también se puede quitar.
- Si se quita una Vivienda y el nuevo límite de población es menor que los aldeanos ya asignados, se liberan automáticamente los asignados más recientemente.

No incluye todavía: coste creciente por edificio repetido, mejoras de nivel, desbloqueo de nuevas zonas, ciclo día/noche, oleadas de monstruos ni héroe. Eso llegará en fases posteriores.

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

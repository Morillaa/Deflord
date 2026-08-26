# Deflord

Citybuilder 2D con oleadas de defensa nocturnas, pensado para jugarse desde el navegador (incluido móvil).

Construido con [Phaser 3](https://phaser.io/) + [Vite](https://vitejs.dev/).

## Estado actual: Fase 2 — Aldeanos con roles

- Cuadrícula (grid) 2D top-down que representa las parcelas del pueblo.
- Tres recursos con contador en el HUD superior: madera, comida y oro.
- Panel inferior para elegir uno de 4 edificios y colocarlo tocando una casilla vacía:
  - **Vivienda**: no genera recursos, sube el límite de población en +3 aldeanos. Tocarla la quita.
  - **Almacén de madera**: genera madera (más rápido con aldeanos asignados).
  - **Granja**: genera comida (más rápido con aldeanos asignados).
  - **Mercado**: genera oro, a ritmo más lento que los otros dos.
- Los aldeanos son unidades independientes del grid (iconos 🧍 junto al grid cuando están libres, o junto al edificio al que están asignados). El HUD muestra "🧑 Aldeanos: libres/total".
- Tocar un edificio generador abre un panel para asignar/quitar aldeanos (+/-, máximo 2 por edificio): cada aldeano asignado acelera su producción (5s → 3s → 2s, proporcional en el Mercado). Desde ahí también se puede quitar el edificio.
- Si se quita una Vivienda y el nuevo límite de población es menor que los aldeanos ya asignados, se liberan automáticamente los asignados más recientemente.

No incluye todavía: nombres/personalidades de aldeanos, mejoras de edificios, ciclo día/noche, oleadas de monstruos ni héroe. Eso llegará en fases posteriores.

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

# Deflord

Citybuilder 2D con oleadas de defensa nocturnas, pensado para jugarse desde el navegador (incluido móvil).

Construido con [Phaser 3](https://phaser.io/) + [Vite](https://vitejs.dev/).

## Estado actual: Fase 1 — Recursos y edificios básicos

- Cuadrícula (grid) 2D top-down que representa las parcelas del pueblo.
- Tres recursos con contador en el HUD superior: madera, comida y oro.
- Panel inferior para elegir uno de 4 edificios y colocarlo tocando una casilla vacía; tocar un edificio ya colocado lo quita:
  - **Vivienda**: no genera recursos, sube el límite de población (aún sin aldeanos).
  - **Almacén de madera**: genera +1 madera cada 5s.
  - **Granja**: genera +1 comida cada 5s.
  - **Mercado**: genera +1 oro cada 12s (más lento que los otros dos).

No incluye todavía: aldeanos con roles, mejoras de edificios, ciclo día/noche, oleadas de monstruos ni héroe. Eso llegará en fases posteriores.

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

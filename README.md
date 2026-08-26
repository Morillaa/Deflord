# Deflord

Citybuilder 2D con oleadas de defensa nocturnas, pensado para jugarse desde el navegador (incluido móvil).

Construido con [Phaser 3](https://phaser.io/) + [Vite](https://vitejs.dev/).

## Estado actual: Fase 0 — Núcleo visual

Esta primera fase solo incluye lo mínimo para validar el motor y el pipeline de despliegue:

- Escena con una cuadrícula (grid) 2D top-down que representa las parcelas del pueblo.
- Una casa de ejemplo: toca/haz clic en una casilla para colocarla, vuelve a tocar para quitarla.

No incluye todavía: recursos, aldeanos, ciclo día/noche, oleadas de monstruos, héroe ni menús. Eso llegará en fases posteriores.

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

Cada push a `main` dispara el workflow `.github/workflows/deploy.yml`, que compila el proyecto con Vite y lo publica en GitHub Pages.

Jugable en: https://morillaa.github.io/deflord/

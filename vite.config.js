import { defineConfig } from 'vite';

// GitHub Pages serves paths case-sensitively; el repo es "Deflord" (D mayúscula):
// https://morillaa.github.io/Deflord/
export default defineConfig({
  base: '/Deflord/',
});

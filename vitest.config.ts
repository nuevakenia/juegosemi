import { defineConfig } from 'vitest/config';

// Un solo runner para todo el monorepo.
// Regla del proyecto: la logica pura (motor, contenido, personajes, reglas del
// juego) se prueba sin navegador. Lo que necesita DOM anota
// `// @vitest-environment jsdom` en la primera linea del archivo.
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    environment: 'node',
    reporters: ['default'],
    testTimeout: 5000,
  },
});

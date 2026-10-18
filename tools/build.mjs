#!/usr/bin/env node
/**
 * Constructor del proyecto. Sin frameworks: esbuild hace el trabajo.
 *
 * Uso:
 *   node tools/build.mjs combo                 → dist/ (el estudio + los juegos)
 *   node tools/build.mjs apps/juego-autos      → apps/juego-autos/dist/
 *   node tools/build.mjs apps/estudio          → apps/estudio/dist/
 *
 * Por qué así: el APK es un envoltorio de archivos web. "combo" arma el paquete
 * completo que se mete en el APK (el menú y sus juegos adentro), y cada app se
 * puede construir y probar sola en el navegador.
 */
import { build } from 'esbuild';
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function existe(ruta) {
  try {
    await stat(ruta);
    return true;
  } catch {
    return false;
  }
}

async function construirApp(appRelativa, salidaRelativa) {
  const appDir = join(RAIZ, appRelativa);
  const salida = join(RAIZ, salidaRelativa);
  await rm(salida, { recursive: true, force: true });
  await mkdir(salida, { recursive: true });

  await build({
    entryPoints: [join(appDir, 'src/main.ts')],
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2019',
    outfile: join(salida, 'main.js'),
    legalComments: 'none',
    logLevel: 'warning',
    absWorkingDir: RAIZ,
  });

  await cp(join(appDir, 'index.html'), join(salida, 'index.html'));

  // contenido: los datos del juego viajan con la app
  const contenido = join(RAIZ, 'packages/contenido/data');
  if (await existe(contenido)) {
    await cp(contenido, join(salida, 'contenido'), { recursive: true });
  }
  // assets propios de la app (fotos, sonidos)
  const assetsApp = join(appDir, 'assets');
  if (await existe(assetsApp)) {
    await cp(assetsApp, join(salida, 'assets'), { recursive: true });
  }

  const peso = await pesoDe(salida);
  console.log(`  ${appRelativa} → ${salidaRelativa}  (${(peso / 1024).toFixed(0)} KB)`);
  return salida;
}

async function pesoDe(ruta) {
  const { readdir } = await import('node:fs/promises');
  let total = 0;
  for (const entrada of await readdir(ruta, { withFileTypes: true })) {
    const hijo = join(ruta, entrada.name);
    if (entrada.isDirectory()) total += await pesoDe(hijo);
    else total += (await stat(hijo)).size;
  }
  return total;
}

async function principal() {
  const objetivo = process.argv[2] ?? 'combo';
  console.log(`construyendo: ${objetivo}`);
  if (objetivo === 'combo') {
    await construirApp('apps/estudio', 'dist');
    await construirApp('apps/juego-autos', 'dist/juegos/autos');
    await construirApp('apps/taller', 'dist/taller');
    const peso = await pesoDe(join(RAIZ, 'dist'));
    console.log(`combo listo: dist/ (${(peso / 1024 / 1024).toFixed(2)} MB en total)`);
    return;
  }
  const app = objetivo.replace(/\/$/, '');
  await construirApp(app, join(app, 'dist'));
}

principal().catch((error) => {
  console.error('falló la construcción:', error);
  process.exit(1);
});

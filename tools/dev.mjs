#!/usr/bin/env node
/**
 * Servidor de desarrollo para probar en el navegador del PC (sin emulador).
 *
 * Uso:
 *   node tools/dev.mjs combo                 → el menú + el juego + el taller
 *   node tools/dev.mjs apps/taller           → sólo una app
 *   node tools/dev.mjs apps/juego-autos --puerto 5180 --host=0.0.0.0
 *
 * `combo` es lo que se usa para probar como si fuera la tablet: arma las tres apps
 * en dist/ (igual que el APK) y sirve todo junto, con recarga al guardar.
 * Es también la forma de verlo desde el celular o la tablet en la misma red
 * (--host=0.0.0.0).
 */
import { context } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** El combo: cada app con la carpeta de dist/ donde va dentro del APK. */
const COMBO = [
  { app: 'apps/estudio', salida: 'dist', url: '/' },
  { app: 'apps/juego-autos', salida: 'dist/juegos/autos', url: '/juegos/autos/' },
  { app: 'apps/juego-gestos', salida: 'dist/juegos/gestos', url: '/juegos/gestos/' },
  { app: 'apps/taller', salida: 'dist/taller', url: '/taller/' },
];

const args = process.argv.slice(2);
const objetivo = args.find((a) => !a.startsWith('--')) ?? 'combo';
const puerto = Number((args.find((a) => a.startsWith('--puerto=')) ?? '').split('=')[1] ?? 5180);
const host = (args.find((a) => a.startsWith('--host=')) ?? '').split('=')[1] ?? '127.0.0.1';

/** Deja en la carpeta de salida lo que no pasa por el empaquetador: HTML y datos. */
async function preparar(app, salida) {
  const destino = join(RAIZ, salida);
  await mkdir(destino, { recursive: true });
  await cp(join(RAIZ, app, 'index.html'), join(destino, 'index.html'));
  const contenido = join(RAIZ, 'packages/contenido/data');
  if (existsSync(contenido)) await cp(contenido, join(destino, 'contenido'), { recursive: true });
  if (existsSync(join(RAIZ, app, 'assets'))) {
    await cp(join(RAIZ, app, 'assets'), join(destino, 'assets'), { recursive: true });
  }
  return destino;
}

/** Un contexto de esbuild con recarga, apuntando a la salida que se va a servir. */
async function contextoDe(app, salida) {
  const destino = await preparar(app, salida);
  const ctx = await context({
    entryPoints: [join(RAIZ, app, 'src/main.ts')],
    bundle: true,
    format: 'esm',
    target: 'es2019',
    outfile: join(destino, 'main.js'),
    sourcemap: true,
    absWorkingDir: RAIZ,
    logLevel: 'warning',
  });
  await ctx.watch();
  return ctx;
}

if (objetivo === 'combo') {
  await rm(join(RAIZ, 'dist'), { recursive: true, force: true });
  let primero = null;
  for (const { app, salida } of COMBO) {
    const ctx = await contextoDe(app, salida);
    if (!primero) primero = ctx;
  }
  // sirve el dist/ entero (menú y juegos juntos): un solo servidor, como el APK
  const { port } = await primero.serve({ servedir: join(RAIZ, 'dist'), host, port: puerto });
  const base = `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`;
  console.log('\n  juegosemi listo — abrí esto en el navegador:\n');
  for (const { url } of COMBO) console.log(`    ${base}${url}`);
  console.log(
    `\n  (desde la tablet o el celular de la misma red: ${
      host === '0.0.0.0' ? 'usá la IP de este PC' : 'volvé a correrlo con --host=0.0.0.0'
    })\n`,
  );
} else {
  const app = objetivo.replace(/\/$/, '');
  if (!existsSync(join(RAIZ, app, 'src/main.ts'))) {
    console.error(`No existe ${app}/src/main.ts. Probá con: combo | apps/estudio | apps/juego-autos | apps/taller`);
    process.exit(1);
  }
  const ctx = await contextoDe(app, join(app, 'dist'));
  const servidor = await ctx.serve({ servedir: join(RAIZ, app, 'dist'), host, port: puerto });
  console.log(`\n  ${app} en http://${host === '0.0.0.0' ? 'localhost' : host}:${servidor.port}\n`);
}

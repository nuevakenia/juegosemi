#!/usr/bin/env node
/**
 * Servidor de desarrollo para probar en el navegador del PC (sin emulador).
 *
 * Uso:
 *   node tools/dev.mjs apps/juego-autos
 *   node tools/dev.mjs apps/estudio --puerto 5180
 *
 * Construye la app y sirve su `dist/` con recarga automática (esbuild watch).
 * Es la forma de ver rápido lo que se está tocando, también desde el celular o
 * la tablet en la misma red (`--host 0.0.0.0`).
 */
import { context } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const app = args.find((a) => !a.startsWith('--')) ?? 'apps/juego-autos';
const puerto = Number((args.find((a) => a.startsWith('--puerto=')) ?? '').split('=')[1] ?? 5180);
const host = (args.find((a) => a.startsWith('--host=')) ?? '').split('=')[1] ?? '127.0.0.1';

const appDir = join(RAIZ, app);
const salida = join(appDir, 'dist');

await rm(salida, { recursive: true, force: true });
await mkdir(salida, { recursive: true });
await cp(join(appDir, 'index.html'), join(salida, 'index.html'));
const contenido = join(RAIZ, 'packages/contenido/data');
if (existsSync(contenido)) await cp(contenido, join(salida, 'contenido'), { recursive: true });
if (existsSync(join(appDir, 'assets'))) await cp(join(appDir, 'assets'), join(salida, 'assets'), { recursive: true });

const ctx = await context({
  entryPoints: [join(appDir, 'src/main.ts')],
  bundle: true,
  format: 'esm',
  target: 'es2019',
  outfile: join(salida, 'main.js'),
  sourcemap: true,
  absWorkingDir: RAIZ,
  logLevel: 'info',
});
await ctx.watch();
const servidor = await ctx.serve({ servedir: salida, host, port: puerto });
console.log(`\n  ${app} en http://${host === '0.0.0.0' ? 'localhost' : host}:${servidor.port}`);
console.log('  (para verlo desde el celular/tablet de la misma red, usá --host=0.0.0.0)\n');

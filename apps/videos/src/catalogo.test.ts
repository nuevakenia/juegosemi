/**
 * El catálogo, probado sin navegador.
 *
 * Tres cosas tienen que ser ciertas: que la lista salga de DATOS (`videos.json`),
 * que cada archivo exista de verdad en `assets/videos/` (si no, la galería
 * mentiría) y que una línea mal escrita NUNCA rompa la app.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CARPETA_VIDEOS, VIDEOS, normalizarVideos, urlDeVideo, videoPorId } from './catalogo.ts';

const AQUI = dirname(fileURLToPath(import.meta.url));
const CARPETA = join(AQUI, '..', 'assets', 'videos');

describe('la lista de videos sale de los datos', () => {
  it('trae los tres videos de muestra, con id, título y archivo', () => {
    expect(VIDEOS.length).toBe(3);
    expect(VIDEOS.map((v) => v.id)).toEqual(['casa-de-la-tia', 'video-de-la-prima', 'video-del-verano']);
    for (const video of VIDEOS) {
      expect(video.titulo.length).toBeGreaterThan(0);
      expect(video.archivo.endsWith('.mp4')).toBe(true);
    }
  });

  it('cada archivo del catálogo existe de verdad en assets/videos/', () => {
    for (const video of VIDEOS) {
      expect(existsSync(join(CARPETA, video.archivo)), `falta ${video.archivo}`).toBe(true);
    }
  });

  it('la ruta que se le pasa al reproductor es la del paquete web', () => {
    expect(urlDeVideo(VIDEOS[0]!)).toBe(`${CARPETA_VIDEOS}/casa-de-la-tia.mp4`);
    expect(CARPETA_VIDEOS).toBe('assets/videos');
  });

  it('encuentra un video por su id y devuelve null si no está', () => {
    expect(videoPorId('video-de-la-prima')?.titulo).toBe('El video de la prima');
    expect(videoPorId('no-existe')).toBeNull();
  });
});

describe('una línea mal escrita no rompe la app', () => {
  it('salta las entradas que no sirven, sin fallar', () => {
    const sucios = normalizarVideos([
      { id: 'bueno', titulo: 'Bueno', archivo: 'bueno.mp4' },
      { id: '', titulo: 'Sin id', archivo: 'x.mp4' },
      { id: 'sin-titulo', titulo: '   ', archivo: 'x.mp4' },
      { id: 'sin-archivo', titulo: 'Sin archivo' },
      'esto no es un objeto',
      null,
      42,
    ]);

    expect(sucios.length).toBe(1);
    expect(sucios[0]?.id).toBe('bueno');
  });

  it('no repite el mismo id dos veces', () => {
    const repetidos = normalizarVideos([
      { id: 'uno', titulo: 'Uno', archivo: 'uno.mp4' },
      { id: 'uno', titulo: 'Uno otra vez', archivo: 'uno-2.mp4' },
    ]);

    expect(repetidos.length).toBe(1);
    expect(repetidos[0]?.titulo).toBe('Uno');
  });

  it('si los datos no son una lista, devuelve una lista vacía (nunca explota)', () => {
    expect(normalizarVideos(undefined)).toEqual([]);
    expect(normalizarVideos({ videos: [] })).toEqual([]);
    expect(normalizarVideos('cualquier cosa')).toEqual([]);
  });

  it('recorta los espacios de lo que se escribe apurado', () => {
    const recortado = normalizarVideos([
      { id: '  con-espacios  ', titulo: '  Con espacios  ', archivo: '  x.mp4  ' },
    ]);

    expect(recortado[0]).toEqual({ id: 'con-espacios', titulo: 'Con espacios', archivo: 'x.mp4' });
  });
});

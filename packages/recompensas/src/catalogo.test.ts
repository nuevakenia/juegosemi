/**
 * El catálogo de premios, probado sin navegador.
 *
 * Cuatro cosas tienen que ser ciertas: que la lista salga de DATOS
 * (`recompensas.json`), que cada archivo de video exista de verdad en el
 * episodio (si no, el selector mentiría), que los premios estén separados por
 * episodio, y que una línea mal escrita NUNCA rompa la app.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CARPETA_POR_TIPO,
  RECOMPENSAS,
  normalizarRecompensas,
  primerVideoDeEpisodio,
  recompensaPorId,
  recompensasDeEpisodio,
  respaldosDeVideo,
  urlDeRecompensa,
} from './catalogo.ts';

const AQUI = dirname(fileURLToPath(import.meta.url));
const VIDEOS_DEL_EPISODIO = join(AQUI, '..', '..', '..', 'apps', 'episodio-viaje', 'assets', 'videos');

describe('el catálogo sale de los datos', () => {
  it('trae premios del episodio del viaje, con id, título y tipo', () => {
    const delViaje = recompensasDeEpisodio('viaje-casa-tia');
    expect(delViaje.length).toBeGreaterThanOrEqual(3);
    expect(delViaje.map((p) => p.id)).toContain('casa-de-la-tia');
    expect(delViaje.map((p) => p.id)).toContain('video-de-la-prima');
    for (const premio of delViaje) {
      expect(premio.titulo.length).toBeGreaterThan(0);
      expect(['video', 'frase', 'sonido']).toContain(premio.tipo);
    }
  });

  it('los tres tipos de premio están representados', () => {
    const tipos = new Set(RECOMPENSAS.map((p) => p.tipo));
    expect(tipos.has('video')).toBe(true);
    expect(tipos.has('frase')).toBe(true);
    expect(tipos.has('sonido')).toBe(true);
  });

  it('cada video del catálogo existe de verdad en el episodio', () => {
    for (const premio of recompensasDeEpisodio('viaje-casa-tia')) {
      if (premio.tipo !== 'video') continue;
      expect(existsSync(join(VIDEOS_DEL_EPISODIO, premio.archivo ?? '')), `falta ${premio.archivo}`).toBe(true);
    }
  });

  it('la ruta que se le pasa al reproductor es la del paquete web', () => {
    const casa = recompensaPorId('casa-de-la-tia');
    expect(casa).not.toBeNull();
    if (casa !== null) {
      expect(urlDeRecompensa(casa)).toBe(`${CARPETA_POR_TIPO.video}/casa-de-la-tia.mp4`);
    }
  });

  it('una frase no tiene archivo: su contenido es el texto', () => {
    const frase = RECOMPENSAS.find((p) => p.tipo === 'frase');
    expect(frase).toBeDefined();
    if (frase !== undefined) {
      expect(frase.archivo).toBeNull();
      expect(urlDeRecompensa(frase)).toBeNull();
      expect((frase.texto ?? '').length).toBeGreaterThan(0);
    }
  });

  it('encuentra un premio por su id y devuelve null si no está', () => {
    expect(recompensaPorId('video-de-la-prima')?.titulo.length).toBeGreaterThan(0);
    expect(recompensaPorId('no-existe')).toBeNull();
  });

  it('los premios no se mezclan entre episodios', () => {
    expect(recompensasDeEpisodio('otro-episodio')).toEqual([]);
    expect(primerVideoDeEpisodio('otro-episodio')).toBeNull();
  });

  it('los respaldos son los otros videos del mismo episodio', () => {
    const casa = recompensaPorId('casa-de-la-tia');
    expect(casa).not.toBeNull();
    if (casa === null) return;
    const respaldos = respaldosDeVideo(casa, 'viaje-casa-tia');
    expect(respaldos.map((p) => p.id)).not.toContain('casa-de-la-tia');
    expect(respaldos.every((p) => p.tipo === 'video')).toBe(true);
    expect(respaldos.every((p) => p.episodio === 'viaje-casa-tia')).toBe(true);
  });
});

describe('una línea mal escrita no rompe la app', () => {
  it('salta las entradas que no sirven, sin fallar', () => {
    const sucios = normalizarRecompensas([
      { id: 'bueno', episodio: 'x', tipo: 'video', titulo: 'Bueno', archivo: 'bueno.mp4' },
      { id: '', episodio: 'x', tipo: 'video', titulo: 'Sin id', archivo: 'a.mp4' },
      { id: 'sin-titulo', episodio: 'x', tipo: 'video', titulo: '   ', archivo: 'a.mp4' },
      { id: 'sin-episodio', tipo: 'video', titulo: 'Sin episodio', archivo: 'a.mp4' },
      { id: 'tipo-raro', episodio: 'x', tipo: 'holograma', titulo: 'Raro', archivo: 'a.mp4' },
      { id: 'video-sin-archivo', episodio: 'x', tipo: 'video', titulo: 'Sin archivo' },
      { id: 'frase-sin-texto', episodio: 'x', tipo: 'frase', titulo: 'Frase vacía' },
      'esto no es un objeto',
      null,
      42,
    ]);

    expect(sucios.length).toBe(1);
    expect(sucios[0]?.id).toBe('bueno');
  });

  it('no repite el mismo id dos veces', () => {
    const repetidos = normalizarRecompensas([
      { id: 'uno', episodio: 'x', tipo: 'video', titulo: 'Uno', archivo: 'uno.mp4' },
      { id: 'uno', episodio: 'x', tipo: 'video', titulo: 'Uno otra vez', archivo: 'uno-2.mp4' },
    ]);

    expect(repetidos.length).toBe(1);
    expect(repetidos[0]?.titulo).toBe('Uno');
  });

  it('si los datos no son una lista, devuelve una lista vacía (nunca explota)', () => {
    expect(normalizarRecompensas(undefined)).toEqual([]);
    expect(normalizarRecompensas({ recompensas: [] })).toEqual([]);
    expect(normalizarRecompensas('cualquier cosa')).toEqual([]);
  });

  it('recorta los espacios de lo que se escribe apurado', () => {
    const recortado = normalizarRecompensas([
      { id: '  con-espacios  ', episodio: '  x  ', tipo: 'video', titulo: '  Con espacios  ', archivo: '  x.mp4  ' },
    ]);

    expect(recortado[0]).toEqual({
      id: 'con-espacios',
      episodio: 'x',
      tipo: 'video',
      titulo: 'Con espacios',
      archivo: 'x.mp4',
      texto: null,
    });
  });
});

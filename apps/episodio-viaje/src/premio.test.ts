/**
 * El premio del día, probado sin navegador.
 *
 * Dos cosas que tienen que ser ciertas: que el video salga de la VARIABLE del
 * nivel (cambiarla cambia el video, sin tocar una línea de código) y que un premio
 * mal escrito NUNCA deje al niño sin video (cae al de por defecto, sin error).
 */
import { describe, expect, it } from 'vitest';
import type { Nivel } from '@juegosemi/logica';
import type { CodecVideo, OpcionesVideo, PuertoVideo } from '@juegosemi/puertos';
import { NIVEL } from './nivel.ts';
import {
  CARPETA_VIDEOS,
  PREMIO_POR_DEFECTO,
  VIDEOS_DE_MUESTRA,
  crearPuertoVideo,
  premioDelNivel,
  urlDeVideo,
  videoDeMuestra,
} from './premio.ts';

/** Un puerto de video de mentira que anota lo que le piden. */
function videoDeMentira(): { puerto: PuertoVideo; reproducidos: string[]; opciones: OpcionesVideo[] } {
  const reproducidos: string[] = [];
  const opciones: OpcionesVideo[] = [];
  return {
    reproducidos,
    opciones,
    puerto: {
      soporta: async (_codec: CodecVideo) => true,
      reproducir: async (url: string, opcionesVideo?: OpcionesVideo) => {
        reproducidos.push(url);
        opciones.push(opcionesVideo ?? {});
        return { ok: true };
      },
      detener: () => {},
    },
  };
}

describe('el premio sale de los datos del nivel', () => {
  it('el nivel del viaje pide el video de la casa de la tía', () => {
    expect(premioDelNivel(NIVEL)).toBe('casa-de-la-tia');
    expect(urlDeVideo(premioDelNivel(NIVEL))).toBe(`${CARPETA_VIDEOS}/casa-de-la-tia.mp4`);
  });

  it('cambiando la variable cambia el video, sin tocar nada más', () => {
    const otro: Nivel = JSON.parse(JSON.stringify(NIVEL)) as Nivel;
    otro.mundo = { ...otro.mundo, variables: { 'premio-del-dia': 'video-de-la-prima' } };
    expect(premioDelNivel(otro)).toBe('video-de-la-prima');
    expect(urlDeVideo(premioDelNivel(otro))).toBe(`${CARPETA_VIDEOS}/video-de-la-prima.mp4`);
  });

  it('sin variable (o con una basura) cae al video por defecto: nadie se queda sin premio', () => {
    expect(premioDelNivel({ id: 'x', reglas: [] })).toBe(PREMIO_POR_DEFECTO);
    expect(premioDelNivel({ id: 'x', reglas: [], mundo: { variables: { 'premio-del-dia': '' } } })).toBe(PREMIO_POR_DEFECTO);
    expect(premioDelNivel({ id: 'x', reglas: [], mundo: { variables: { 'premio-del-dia': 7 } } })).toBe(PREMIO_POR_DEFECTO);
    expect(urlDeVideo('un-premio-que-no-existe')).toBe(urlDeVideo(PREMIO_POR_DEFECTO));
  });

  it('los videos de muestra son dos H.264 y uno H.265 (el caso que no decodifica)', () => {
    const codecs = VIDEOS_DE_MUESTRA.map((v) => v.codec);
    expect(codecs.filter((c) => c === 'h264').length).toBe(2);
    expect(codecs.filter((c) => c === 'h265').length).toBe(1);
    const raro = videoDeMuestra('no-existe');
    expect(raro.id).toBe(PREMIO_POR_DEFECTO);
  });
});

describe('el puerto de video traduce el id lógico a una ruta de verdad', () => {
  it('reproducir("casa-de-la-tia") le pasa al navegador assets/videos/casa-de-la-tia.mp4', async () => {
    const falso = videoDeMentira();
    const puerto = crearPuertoVideo(falso.puerto);
    const resultado = await puerto.reproducir('casa-de-la-tia', { pantallaCompleta: true });
    expect(resultado.ok).toBe(true);
    expect(falso.reproducidos).toEqual([`${CARPETA_VIDEOS}/casa-de-la-tia.mp4`]);
    expect(falso.opciones[0]?.pantallaCompleta).toBe(true);
  });

  it('un premio desconocido igual reproduce algo (el de por defecto)', async () => {
    const falso = videoDeMentira();
    const puerto = crearPuertoVideo(falso.puerto);
    await puerto.reproducir('premio-inventado');
    expect(falso.reproducidos).toEqual([`${CARPETA_VIDEOS}/casa-de-la-tia.mp4`]);
  });
});

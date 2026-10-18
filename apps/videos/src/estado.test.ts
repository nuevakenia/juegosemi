/**
 * El estado del lector, probado sin navegador.
 *
 * Lo que importa acá es la REGLA DE ORO: cuando un video no se puede ver, el
 * estado no dice "error" ni "falló" — dice un aviso amable en castellano claro,
 * y de ahí se vuelve a la galería con todo limpio.
 */
import { describe, expect, it } from 'vitest';
import {
  ESPERA_AVISO_MS,
  abrirVideo,
  avisarQueNoSePuedeVer,
  estadoInicial,
  textoDeNoSePuedeVer,
  volverALaGaleria,
} from './estado.ts';

describe('el estado del lector de videos', () => {
  it('arranca en la galería, sin video y sin aviso', () => {
    expect(estadoInicial()).toEqual({ pantalla: 'galeria', video: null, aviso: null });
  });

  it('elegir un video lleva a la pantalla de reproducción con ese id', () => {
    const estado = abrirVideo(estadoInicial(), 'casa-de-la-tia');

    expect(estado.pantalla).toBe('reproduciendo');
    expect(estado.video).toBe('casa-de-la-tia');
    expect(estado.aviso).toBeNull();
  });

  it('volver deja todo limpio otra vez', () => {
    const viendo = abrirVideo(estadoInicial(), 'casa-de-la-tia');
    const vuelta = volverALaGaleria();

    expect(vuelta).toEqual(estadoInicial());
    expect(viendo.pantalla).toBe('reproduciendo');
  });

  it('avisar que no se puede ver deja un mensaje claro y SIN cara de error', () => {
    const viendo = abrirVideo(estadoInicial(), 'video-del-verano');
    const aviso = avisarQueNoSePuedeVer(viendo, 'El video del verano');

    expect(aviso.pantalla).toBe('aviso');
    expect(aviso.video).toBe('video-del-verano');
    expect(aviso.aviso).toContain('El video del verano');
    expect(aviso.aviso).toContain('No pasa nada');
    for (const fea of ['error', 'Error', 'falló', 'falla', 'ERROR']) {
      expect(aviso.aviso).not.toContain(fea);
    }
  });

  it('el texto del aviso nombra el video y, si no hay título, igual se entiende', () => {
    expect(textoDeNoSePuedeVer('El video de la prima')).toBe(
      'El video "El video de la prima" no se puede ver acá. No pasa nada: volvamos a elegir otro.',
    );
    expect(textoDeNoSePuedeVer('   ')).toContain('Este video');
  });

  it('dejar el aviso en pantalla no es una espera eterna', () => {
    expect(ESPERA_AVISO_MS).toBeGreaterThan(0);
    expect(ESPERA_AVISO_MS).toBeLessThanOrEqual(15000);
  });

  it('volver de un aviso tampoco deja rastro', () => {
    const aviso = avisarQueNoSePuedeVer(abrirVideo(estadoInicial(), 'x'), 'X');

    expect(volverALaGaleria()).toEqual(estadoInicial());
    expect(aviso.pantalla).toBe('aviso');
  });
});

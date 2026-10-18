/**
 * El premio del día, probado sin navegador.
 *
 * Lo que tiene que ser cierto: que se guarde y se lea, que lo guardado mande
 * MIENTRAS sea un premio del episodio, y que cualquier cosa rara (un id viejo,
 * un valor que no es texto, un premio de otro juego) caiga al primero del
 * episodio. El niño nunca se queda sin premio.
 */
import { describe, expect, it } from 'vitest';
import type { Nivel } from '@juegosemi/logica';
import type { PuertoAlmacenamiento } from '@juegosemi/puertos';
import {
  CLAVE_PREMIO_DEL_DIA,
  VARIABLE_PREMIO_DEL_DIA,
  borrarPremioDelDia,
  elegirPremioDelDia,
  guardarPremioDelDia,
  leerPremioDelDia,
  premioDelDia,
} from './premio-del-dia.ts';
import { RECOMPENSAS, recompensaPorId, recompensasDeEpisodio } from './catalogo.ts';
import { conPremioDelDia } from './nivel.ts';

/** Un almacén de mentira, igual de tonto que localStorage. */
function almacenDeMentira(inicial: Record<string, unknown> = {}): PuertoAlmacenamiento {
  const datos: Record<string, unknown> = { ...inicial };
  return {
    guardar(clave: string, valor: unknown): void {
      datos[clave] = valor;
    },
    leer<T>(clave: string): T | null {
      return clave in datos ? (datos[clave] as T) : null;
    },
    borrar(clave: string): void {
      delete datos[clave];
    },
    claves(): string[] {
      return Object.keys(datos);
    },
  };
}

const EPISODIO = 'viaje-casa-tia';

describe('el premio del día se guarda y se lee', () => {
  it('escribe el id en texto plano y lo vuelve a leer', () => {
    const almacen = almacenDeMentira();
    guardarPremioDelDia(almacen, 'video-de-la-prima');
    expect(almacen.leer(CLAVE_PREMIO_DEL_DIA)).toBe('video-de-la-prima');
    expect(leerPremioDelDia(almacen)).toBe('video-de-la-prima');
  });

  it('la primera vez no hay nada guardado', () => {
    expect(leerPremioDelDia(almacenDeMentira())).toBeNull();
  });

  it('un valor que no es texto se ignora (no rompe la pantalla)', () => {
    expect(leerPremioDelDia(almacenDeMentira({ [CLAVE_PREMIO_DEL_DIA]: 7 }))).toBeNull();
    expect(leerPremioDelDia(almacenDeMentira({ [CLAVE_PREMIO_DEL_DIA]: '' }))).toBeNull();
    expect(leerPremioDelDia(almacenDeMentira({ [CLAVE_PREMIO_DEL_DIA]: '   ' }))).toBeNull();
  });

  it('borrar deja el almacén limpio', () => {
    const almacen = almacenDeMentira();
    guardarPremioDelDia(almacen, 'casa-de-la-tia');
    borrarPremioDelDia(almacen);
    expect(leerPremioDelDia(almacen)).toBeNull();
  });
});

describe('cuál es el premio del día', () => {
  it('sin nada guardado, el primero del episodio', () => {
    const primero = recompensasDeEpisodio(EPISODIO)[0];
    expect(premioDelDia(almacenDeMentira(), EPISODIO).id).toBe(primero?.id);
  });

  it('con algo guardado y válido, ese manda', () => {
    const almacen = almacenDeMentira();
    elegirPremioDelDia(almacen, recompensaPorId('video-de-la-prima')!);
    expect(premioDelDia(almacen, EPISODIO).id).toBe('video-de-la-prima');
  });

  it('un id que ya no está en el catálogo cae al primero (nunca se queda sin premio)', () => {
    const almacen = almacenDeMentira({ [CLAVE_PREMIO_DEL_DIA]: 'premio-que-ya-no-existe' });
    expect(premioDelDia(almacen, EPISODIO).id).toBe(recompensasDeEpisodio(EPISODIO)[0]?.id);
  });

  it('un premio de OTRO episodio no se cuela', () => {
    const almacen = almacenDeMentira({ [CLAVE_PREMIO_DEL_DIA]: 'casa-de-la-tia' });
    const otro = premioDelDia(almacen, 'otro-episodio');
    // No hay premios de ese episodio: cae al de por defecto, no al del viaje.
    expect(otro.episodio).toBe('viaje-casa-tia');
  });

  it('si el catálogo viene vacío, devuelve el de por defecto (nunca null)', () => {
    expect(premioDelDia(almacenDeMentira(), EPISODIO, []).id.length).toBeGreaterThan(0);
  });
});

describe('el premio entra en el nivel sin tocar el código', () => {
  it('deja el id del premio en la variable del mundo que ya usa el nivel', () => {
    const nivel: Nivel = { id: EPISODIO, reglas: [], mundo: { variables: { otra: 'x' } } };
    const premio = recompensaPorId('video-de-la-prima')!;
    const conPremio = conPremioDelDia(nivel, premio);

    expect(conPremio.mundo?.variables?.[VARIABLE_PREMIO_DEL_DIA]).toBe('video-de-la-prima');
    // Lo demás del mundo y del nivel no se toca.
    expect(conPremio.mundo?.variables?.['otra']).toBe('x');
    expect(conPremio.id).toBe(EPISODIO);
    // El nivel original queda intacto (se devuelve una copia).
    expect(nivel.mundo?.variables?.[VARIABLE_PREMIO_DEL_DIA]).toBeUndefined();
  });
});

describe('el catálogo de datos del proyecto', () => {
  it('todos los premios tienen un episodio con contenido', () => {
    for (const premio of RECOMPENSAS) {
      expect(premio.episodio.length).toBeGreaterThan(0);
    }
  });
});

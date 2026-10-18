/**
 * Guardar y abrir niveles en el dispositivo: se usa un almacén de mentira, así
 * que es lógica pura. Lo que se prueba acá es que varios niveles conviven, que
 * guardar dos veces el mismo nombre no llena de copias y que un guardado viejo o
 * mal escrito no rompe la lista.
 */
import { describe, expect, it } from 'vitest';
import type { PuertoAlmacenamiento } from '@juegosemi/puertos';
import type { NivelEnConstruccion } from './estado.ts';
import { conCosa, conTitulo, crearNivelEnConstruccion } from './estado.ts';
import {
  borrarNivel,
  CLAVE_NIVELES,
  guardarNivel,
  idDeGuardado,
  leerNiveles,
  nivelGuardado,
} from './guardado.ts';

/** Un almacén en memoria que cumple el puerto (sin tocar localStorage). */
function almacenFalso(): PuertoAlmacenamiento {
  const datos = new Map<string, unknown>();
  return {
    guardar(clave: string, valor: unknown): void {
      datos.set(clave, valor);
    },
    leer<T>(clave: string): T | null {
      return datos.has(clave) ? (datos.get(clave) as T) : null;
    },
    borrar(clave: string): void {
      datos.delete(clave);
    },
    claves(): string[] {
      return [...datos.keys()];
    },
  };
}

function unNivel(nombreEntidad: string): NivelEnConstruccion {
  return conCosa(conTitulo(crearNivelEnConstruccion(), 'Mi juego'), 'entidades', nombreEntidad);
}

describe('guardado de los niveles del editor', () => {
  it('guarda y recupera un nivel con su nombre', () => {
    const almacen = almacenFalso();
    guardarNivel(almacen, 'El viaje', unNivel('la maleta'));

    const guardados = leerNiveles(almacen);
    expect(guardados.length).toBe(1);
    expect(guardados[0]?.nombre).toBe('El viaje');
    expect(guardados[0]?.nivel.entidades.map((c) => c.nombre)).toEqual(['la maleta']);
  });

  it('usa la clave propia del editor, no la de otros juegos', () => {
    const almacen = almacenFalso();
    guardarNivel(almacen, 'El viaje', unNivel('la maleta'));
    expect(almacen.claves()).toEqual([CLAVE_NIVELES]);
  });

  it('guarda VARIOS niveles con nombre y los devuelve en orden', () => {
    const almacen = almacenFalso();
    guardarNivel(almacen, 'El viaje', unNivel('la maleta'));
    guardarNivel(almacen, 'La casa', unNivel('la pelota'));

    expect(leerNiveles(almacen).map((g) => g.nombre)).toEqual(['El viaje', 'La casa']);
  });

  it('guardar el mismo nombre otra vez pisa el anterior (no llena de copias)', () => {
    const almacen = almacenFalso();
    guardarNivel(almacen, 'El viaje', unNivel('la maleta'));
    guardarNivel(almacen, 'El viaje', unNivel('el auto'));

    const guardados = leerNiveles(almacen);
    expect(guardados.length).toBe(1);
    expect(guardados[0]?.nivel.entidades.map((c) => c.nombre)).toEqual(['el auto']);
  });

  it('abre un nivel guardado por su id', () => {
    const almacen = almacenFalso();
    guardarNivel(almacen, 'El viaje', unNivel('la maleta'));
    const id = leerNiveles(almacen)[0]?.id ?? '';
    expect(nivelGuardado(almacen, id)?.nombre).toBe('El viaje');
    expect(nivelGuardado(almacen, 'no-esta')).toBeNull();
  });

  it('borra un nivel guardado', () => {
    const almacen = almacenFalso();
    guardarNivel(almacen, 'El viaje', unNivel('la maleta'));
    const id = leerNiveles(almacen)[0]?.id ?? '';
    const quedan = borrarNivel(almacen, id);
    expect(quedan).toEqual([]);
    expect(leerNiveles(almacen)).toEqual([]);
  });

  it('la primera vez no hay nada guardado', () => {
    expect(leerNiveles(almacenFalso())).toEqual([]);
  });

  it('saltea lo que está mal escrito y deja los buenos', () => {
    const almacen = almacenFalso();
    guardarNivel(almacen, 'El viaje', unNivel('la maleta'));
    const guardados = leerNiveles(almacen);
    almacen.guardar(CLAVE_NIVELES, [{ cualquiera: true }, ...guardados]);

    expect(leerNiveles(almacen).map((g) => g.nombre)).toEqual(['El viaje']);
  });

  it('un almacén con basura devuelve la lista vacía', () => {
    const almacen = almacenFalso();
    almacen.guardar(CLAVE_NIVELES, 'no es una lista');
    expect(leerNiveles(almacen)).toEqual([]);
  });

  it('el id del guardado sale del nombre y no se repite', () => {
    expect(idDeGuardado('El viaje', [])).toBe('el-viaje');
    expect(idDeGuardado('El viaje', ['el-viaje'])).toBe('el-viaje-2');
    expect(idDeGuardado('   ', [])).toBe('mi-juego');
  });
});

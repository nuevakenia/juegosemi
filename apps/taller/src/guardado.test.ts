// Pruebas del guardado: se usa un almacén de mentira, así que es lógica pura.
import { describe, expect, it } from 'vitest';
import type { PuertoAlmacenamiento } from '@juegosemi/puertos';
import { CLAVE_SELECCION, borrarSeleccion, guardarSeleccion, leerSeleccion } from './guardado.ts';
import { seleccionInicial, type Seleccion } from './estado.ts';

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

function muestra(): Seleccion {
  return { ...seleccionInicial('noche', 'familia'), indices: { ojos: 1, cejas: 2, nariz: 0, pelo: 3 } };
}

describe('guardado del taller', () => {
  it('guarda y recupera la misma selección', () => {
    const almacen = almacenFalso();
    const original = muestra();

    guardarSeleccion(almacen, original);

    expect(leerSeleccion(almacen)).toEqual(original);
  });

  it('usa la clave propia del taller', () => {
    const almacen = almacenFalso();

    guardarSeleccion(almacen, muestra());

    expect(almacen.claves()).toEqual([CLAVE_SELECCION]);
  });

  it('devuelve null cuando no hay nada guardado', () => {
    expect(leerSeleccion(almacenFalso())).toBeNull();
  });

  it('devuelve null si lo guardado está corrupto', () => {
    const almacen = almacenFalso();
    almacen.guardar(CLAVE_SELECCION, { idPaleta: 'x' });

    expect(leerSeleccion(almacen)).toBeNull();
  });

  it('borra la selección guardada', () => {
    const almacen = almacenFalso();
    guardarSeleccion(almacen, muestra());

    borrarSeleccion(almacen);

    expect(leerSeleccion(almacen)).toBeNull();
  });
});

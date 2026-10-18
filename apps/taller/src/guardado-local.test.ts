// @vitest-environment jsdom
// Pruebas del guardado sobre el adaptador REAL: acá sí se toca localStorage.
import { beforeEach, describe, expect, it } from 'vitest';
import { crearAlmacenTaller, guardarSeleccion, leerSeleccion } from './guardado.ts';
import { seleccionInicial } from './estado.ts';

describe('guardado sobre localStorage (adaptador real)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('escribe bajo el espacio "taller" del adaptador', () => {
    guardarSeleccion(crearAlmacenTaller(), seleccionInicial('familia', 'familia'));

    const bruto = localStorage.getItem('taller:seleccion');
    expect(bruto).not.toBeNull();
    expect(JSON.parse(bruto ?? '{}')).toMatchObject({ idPaleta: 'familia', idCara: 'familia' });
  });

  it('hace el viaje completo guardar → leer', () => {
    const almacen = crearAlmacenTaller();
    const original = seleccionInicial('noche', 'familia');

    guardarSeleccion(almacen, original);

    expect(leerSeleccion(almacen)).toEqual(original);
  });

  it('no encuentra nada la primera vez', () => {
    expect(leerSeleccion(crearAlmacenTaller())).toBeNull();
  });
});

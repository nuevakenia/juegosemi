// @vitest-environment jsdom
// Pruebas del guardado sobre el adaptador REAL: acá sí se toca localStorage.
// Es el mismo camino que `apps/taller/src/guardado-local.test.ts`.
import { beforeEach, describe, expect, it } from 'vitest';
import { crearAlmacenRecompensas, elegirPremioDelDia, leerPremioDelDia } from './premio-del-dia.ts';
import { recompensaPorId } from './catalogo.ts';

describe('el premio del día sobre localStorage (adaptador real)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('escribe bajo el espacio "recompensas" del adaptador', () => {
    elegirPremioDelDia(crearAlmacenRecompensas(), recompensaPorId('video-de-la-prima')!);

    const bruto = localStorage.getItem('recompensas:premio-del-dia');
    expect(bruto).not.toBeNull();
    expect(JSON.parse(bruto ?? '""')).toBe('video-de-la-prima');
  });

  it('hace el viaje completo guardar → leer', () => {
    const almacen = crearAlmacenRecompensas();
    elegirPremioDelDia(almacen, recompensaPorId('casa-de-la-tia')!);
    expect(leerPremioDelDia(almacen)).toBe('casa-de-la-tia');
  });

  it('no encuentra nada la primera vez', () => {
    expect(leerPremioDelDia(crearAlmacenRecompensas())).toBeNull();
  });
});

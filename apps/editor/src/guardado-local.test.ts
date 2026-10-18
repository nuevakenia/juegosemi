// @vitest-environment jsdom
/**
 * El guardado sobre el adaptador REAL: acá sí se toca localStorage.
 *
 * Lo que importa: que el nivel quede bajo la clave propia del editor y que, al
 * "recargar" (leer con un almacén nuevo), siga ahí. Es el pedido de que al
 * recargar la página los niveles sigan estando.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { conCosa, conTitulo, crearNivelEnConstruccion } from './estado.ts';
import { borrarNivel, crearAlmacenEditor, guardarNivel, leerNiveles } from './guardado.ts';

function unNivel(): ReturnType<typeof crearNivelEnConstruccion> {
  return conCosa(conTitulo(crearNivelEnConstruccion(), 'El viaje'), 'entidades', 'la maleta');
}

describe('guardado sobre localStorage (adaptador real)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('escribe bajo el espacio "editor" del adaptador', () => {
    guardarNivel(crearAlmacenEditor(), 'El viaje', unNivel());
    const bruto = localStorage.getItem('editor:niveles');
    expect(bruto).not.toBeNull();
    expect(JSON.parse(bruto ?? '[]')).toHaveLength(1);
  });

  it('al recargar (otro almacén, mismo navegador) los niveles siguen ahí', () => {
    guardarNivel(crearAlmacenEditor(), 'El viaje', unNivel());

    const despuesDeRecargar = leerNiveles(crearAlmacenEditor());
    expect(despuesDeRecargar.map((g) => g.nombre)).toEqual(['El viaje']);
    expect(despuesDeRecargar[0]?.nivel.entidades.map((c) => c.nombre)).toEqual(['la maleta']);
  });

  it('borrar deja el almacén sin niveles', () => {
    const almacen = crearAlmacenEditor();
    guardarNivel(almacen, 'El viaje', unNivel());
    const id = leerNiveles(almacen)[0]?.id ?? '';
    borrarNivel(almacen, id);
    expect(leerNiveles(crearAlmacenEditor())).toEqual([]);
  });

  it('la primera vez no encuentra nada', () => {
    expect(leerNiveles(crearAlmacenEditor())).toEqual([]);
  });
});

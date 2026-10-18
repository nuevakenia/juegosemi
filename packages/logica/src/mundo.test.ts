import { describe, expect, it } from 'vitest';
import { Mundo } from './mundo.ts';

describe('Mundo: lo que el juego recuerda', () => {
  it('arranca con los datos iniciales y en cero lo que no se dijo', () => {
    const mundo = new Mundo({ variables: { nombre: 'Emiliano' }, contadores: { maletas: 1 }, objetos: { puerta: true } });
    expect(mundo.variable('nombre')).toBe('Emiliano');
    expect(mundo.variable('no-existe')).toBeUndefined();
    expect(mundo.contador('maletas')).toBe(1);
    expect(mundo.contador('otra')).toBe(0);
    expect(mundo.activo('puerta')).toBe(true);
    expect(mundo.activo('otra')).toBe(false);
  });

  it('marcar cambia la variable y anota el cambio', () => {
    const mundo = new Mundo();
    mundo.marcar('prisa', 3);
    expect(mundo.variable('prisa')).toBe(3);
    expect(mundo.tomarCambios()).toEqual([{ nombre: 'prisa', valor: 3 }]);
  });

  it('marcar el MISMO valor no anota cambio (no dispara reglas de más)', () => {
    const mundo = new Mundo({ variables: { prisa: 3 } });
    mundo.marcar('prisa', 3);
    expect(mundo.tomarCambios()).toEqual([]);
  });

  it('tomarCambios se vacía al leerlos', () => {
    const mundo = new Mundo();
    mundo.marcar('a', 1);
    mundo.tomarCambios();
    expect(mundo.tomarCambios()).toEqual([]);
  });

  it('sumar acumula y devuelve el total', () => {
    const mundo = new Mundo();
    expect(mundo.sumar('maletas')).toBe(1);
    expect(mundo.sumar('maletas', 2)).toBe(3);
    expect(mundo.contador('maletas')).toBe(3);
  });

  it('activar avisa SÓLO la primera vez (para no repetir el evento)', () => {
    const mundo = new Mundo();
    expect(mundo.activar('viaje-activo')).toBe(true);
    expect(mundo.activar('viaje-activo')).toBe(false);
    expect(mundo.activo('viaje-activo')).toBe(true);
    expect(mundo.desactivar('viaje-activo')).toBe(true);
    expect(mundo.desactivar('viaje-activo')).toBe(false);
    expect(mundo.activo('viaje-activo')).toBe(false);
  });

  it('guardar y cargar conserva todo (la partida sobrevive a cerrar la app)', () => {
    const mundo = new Mundo({ variables: { premio: 'casa' }, contadores: { maletas: 2 }, objetos: { viaje: true } });
    const guardado = mundo.instantanea();
    const otro = new Mundo();
    otro.cargar(guardado);
    expect(otro.instantanea()).toEqual(guardado);
  });

  it('cargar reemplaza lo anterior (no mezcla dos partidas)', () => {
    const mundo = new Mundo({ contadores: { viejo: 9 } });
    mundo.cargar({ contadores: { nuevo: 1 } });
    expect(mundo.contador('viejo')).toBe(0);
    expect(mundo.contador('nuevo')).toBe(1);
    expect(mundo.tomarCambios()).toEqual([]);
  });
});

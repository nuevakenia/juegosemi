import { describe, expect, it } from 'vitest';
import { ACCIONES_LOCALES, aplicarAccionLocal, esLocal, parsearAccion, resolverAccion } from './acciones.ts';
import { ColaEventos } from './eventos.ts';
import { Misiones } from './misiones.ts';
import { Mundo } from './mundo.ts';

describe('parsearAccion: el texto legible', () => {
  it('separa nombre y argumentos', () => {
    expect(parsearAccion('ocultar(maleta-1)')).toEqual({ nombre: 'ocultar', args: ['maleta-1'] });
    expect(parsearAccion('sumar(maletas_en_auto, 1)')).toEqual({ nombre: 'sumar', args: ['maletas_en_auto', '1'] });
  });

  it('respeta las comillas (frases con coma adentro)', () => {
    expect(parsearAccion('decir(abuelo, "hola, ¿vamos?")')).toEqual({
      nombre: 'decir',
      args: ['abuelo', 'hola, ¿vamos?'],
    });
  });

  it('sin paréntesis no hay argumentos', () => {
    expect(parsearAccion('celebrar')).toEqual({ nombre: 'celebrar', args: [] });
    expect(parsearAccion('celebrar()')).toEqual({ nombre: 'celebrar', args: [] });
  });

  it('aguanta espacios de más', () => {
    expect(parsearAccion('  mostrar( manivela )  ')).toEqual({ nombre: 'mostrar', args: ['manivela'] });
  });
});

describe('resolverAccion: texto y objeto salen igual', () => {
  it('pone nombre a los argumentos del texto', () => {
    expect(resolverAccion('pedir_gesto(circulo, 3, manivela)', (t) => t)).toEqual({
      nombre: 'pedir_gesto',
      args: { gesto: 'circulo', veces: 3, objetivo: 'manivela' },
    });
  });

  it('los números quedan como números (no como texto)', () => {
    const resuelta = resolverAccion('sumar(maletas, 2)', (t) => t);
    expect(resuelta.args['cuanto']).toBe(2);
  });

  it('la forma de objeto (la que arma el editor) también sirve', () => {
    expect(resolverAccion({ tipo: 'sumar', contador: 'maletas', cuanto: 2 }, (t) => t)).toEqual({
      nombre: 'sumar',
      args: { contador: 'maletas', cuanto: 2 },
    });
  });

  it('aplica la sustitución de comodines', () => {
    const sustituir = (t: string): string => (t === '$entidad' ? 'maleta-1' : t);
    expect(resolverAccion('ocultar($entidad)', sustituir).args['objetivo']).toBe('maleta-1');
    expect(resolverAccion({ tipo: 'ocultar', objetivo: '$entidad' }, sustituir).args['objetivo']).toBe('maleta-1');
  });
});

describe('esLocal: quién resuelve cada acción', () => {
  it('las del mundo las resuelve la lógica', () => {
    for (const nombre of ACCIONES_LOCALES) expect(esLocal(nombre)).toBe(true);
  });

  it('las de pantalla y sonido las resuelve el juego', () => {
    for (const nombre of ['mostrar', 'sonar', 'decir', 'reproducir_video', 'celebrar', 'mover']) {
      expect(esLocal(nombre)).toBe(false);
    }
  });
});

describe('aplicarAccionLocal: lo que hace sola', () => {
  it('sumar mueve el contador del mundo', () => {
    const mundo = new Mundo();
    const r = aplicarAccionLocal({ nombre: 'sumar', args: { contador: 'maletas', cuanto: 1 } }, mundo, new ColaEventos());
    expect(r.resuelta).toBe(true);
    expect(mundo.contador('maletas')).toBe(1);
  });

  it('marcar deja la variable (y acepta texto y números)', () => {
    const mundo = new Mundo();
    aplicarAccionLocal({ nombre: 'marcar', args: { variable: 'premio', valor: 'casa' } }, mundo, new ColaEventos());
    aplicarAccionLocal({ nombre: 'marcar', args: { variable: 'nivel', valor: 3 } }, mundo, new ColaEventos());
    expect(mundo.variable('premio')).toBe('casa');
    expect(mundo.variable('nivel')).toBe(3);
  });

  it('activar y desactivar mueven los interruptores', () => {
    const mundo = new Mundo();
    aplicarAccionLocal({ nombre: 'activar', args: { objeto: 'viaje-activo' } }, mundo, new ColaEventos());
    expect(mundo.activo('viaje-activo')).toBe(true);
    aplicarAccionLocal({ nombre: 'desactivar', args: { objeto: 'viaje-activo' } }, mundo, new ColaEventos());
    expect(mundo.activo('viaje-activo')).toBe(false);
  });

  it('pedir_gesto queda anotado (y nunca con 0 veces)', () => {
    const eventos = new ColaEventos();
    aplicarAccionLocal({ nombre: 'pedir_gesto', args: { gesto: 'circulo', objetivo: 'manivela', veces: 3 } }, new Mundo(), eventos);
    expect(eventos.gestoPedido('circulo', 'manivela')?.veces).toBe(3);
    aplicarAccionLocal({ nombre: 'pedir_gesto', args: { gesto: 'circulo', objetivo: 'o', veces: 0 } }, new Mundo(), eventos);
    expect(eventos.gestoPedido('circulo', 'o')?.veces).toBe(1);
  });

  it('terminar_nivel avisa sin tocar la pantalla', () => {
    const r = aplicarAccionLocal({ nombre: 'terminar_nivel', args: {} }, new Mundo(), new ColaEventos());
    expect(r.resuelta).toBe(true);
    expect(r.aviso).toBe('nivel_terminado');
  });

  it('lo de pantalla y sonido NO lo resuelve (se lo deja al juego)', () => {
    const mundo = new Mundo();
    for (const nombre of ['mostrar', 'sonar', 'decir', 'reproducir_video', 'celebrar']) {
      expect(aplicarAccionLocal({ nombre, args: {} }, mundo, new ColaEventos()).resuelta).toBe(false);
    }
    expect(mundo.instantanea()).toEqual({ variables: {}, contadores: {}, objetos: {} });
  });

  it('completar deja la misión hecha (y sin misión no inventa nada)', () => {
    const misiones = new Misiones([{ id: 'llegar', cumple: { activo: 'x' } }]);
    const r = aplicarAccionLocal({ nombre: 'completar', args: { mision: 'llegar' } }, new Mundo(), new ColaEventos(), misiones);
    expect(r.resuelta).toBe(true);
    expect(r.misionCumplida).toBe('llegar');
    expect(misiones.estadoDe('llegar')).toBe('hecha');

    const fantasma = aplicarAccionLocal({ nombre: 'completar', args: { mision: 'otra' } }, new Mundo(), new ColaEventos(), misiones);
    expect(fantasma.resuelta).toBe(true);
    expect(fantasma.misionCumplida).toBeUndefined();
    // Sin misiones (el juego no se las dio) tampoco revienta.
    expect(aplicarAccionLocal({ nombre: 'completar', args: { mision: 'x' } }, new Mundo(), new ColaEventos()).misionCumplida).toBeUndefined();
  });

  it('activar y marcar avisan su evento, para que otra regla pueda reaccionar', () => {
    const eventos = new ColaEventos();
    const mundo = new Mundo();
    aplicarAccionLocal({ nombre: 'activar', args: { objeto: 'viaje' } }, mundo, eventos);
    expect(eventos.buscar('objeto_activado', { objeto: 'viaje' })).not.toBeNull();
    // Volver a activar lo que ya estaba prendido no avisa de nuevo.
    eventos.limpiarPaso();
    aplicarAccionLocal({ nombre: 'activar', args: { objeto: 'viaje' } }, mundo, eventos);
    expect(eventos.todos()).toHaveLength(0);

    aplicarAccionLocal({ nombre: 'marcar', args: { variable: 'color', valor: 'rojo' } }, mundo, eventos);
    expect(eventos.buscar('variable_cambiada', { variable: 'color' })).not.toBeNull();
    // Marcar el mismo valor no avisa nada.
    eventos.limpiarPaso();
    aplicarAccionLocal({ nombre: 'marcar', args: { variable: 'color', valor: 'rojo' } }, mundo, eventos);
    expect(eventos.todos()).toHaveLength(0);
  });
});

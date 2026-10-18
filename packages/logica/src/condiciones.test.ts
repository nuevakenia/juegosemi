import { describe, expect, it } from 'vitest';
import type { Condicion, Mision } from './tipo.ts';
import { evaluarCondicion, type ContextoCondicion } from './condiciones.ts';
import { ColaEventos } from './eventos.ts';
import { Misiones } from './misiones.ts';
import { Mundo } from './mundo.ts';

function contexto(opciones: { mundo?: Mundo; misiones?: Mision[]; pasos?: Map<string, number>; sustituir?: (t: string) => string } = {}): {
  ctx: ContextoCondicion;
  mundo: Mundo;
  eventos: ColaEventos;
} {
  const mundo = opciones.mundo ?? new Mundo();
  const eventos = new ColaEventos();
  const misiones = new Misiones(opciones.misiones ?? []);
  const ctx: ContextoCondicion = {
    mundo,
    eventos,
    misiones,
    pasos: opciones.pasos ?? new Map(),
    sustituir: opciones.sustituir ?? ((t) => t),
  };
  return { ctx, mundo, eventos };
}

describe('condiciones: sin condición se cumple siempre', () => {
  it('undefined es sí', () => {
    expect(evaluarCondicion(undefined, contexto().ctx)).toBe(true);
  });
});

describe('combinadores y / o / no', () => {
  it('y exige todas', () => {
    const { ctx, mundo } = contexto();
    mundo.sumar('maletas', 3);
    mundo.activar('viaje');
    const si: Condicion = { y: [{ activo: 'viaje' }, { contador: 'maletas', al_menos: 3 }] };
    expect(evaluarCondicion(si, ctx)).toBe(true);
    mundo.desactivar('viaje');
    expect(evaluarCondicion(si, ctx)).toBe(false);
  });

  it('o pide al menos una', () => {
    const { ctx, mundo } = contexto();
    const si: Condicion = { o: [{ activo: 'viaje' }, { contador: 'maletas', al_menos: 1 }] };
    expect(evaluarCondicion(si, ctx)).toBe(false);
    mundo.sumar('maletas', 1);
    expect(evaluarCondicion(si, ctx)).toBe(true);
  });

  it('no invierte', () => {
    const { ctx } = contexto();
    expect(evaluarCondicion({ no: { activo: 'viaje' } }, ctx)).toBe(true);
  });
});

describe('interruptores', () => {
  it('activo / inactivo', () => {
    const { ctx, mundo } = contexto();
    expect(evaluarCondicion({ activo: 'puerta' }, ctx)).toBe(false);
    mundo.activar('puerta');
    expect(evaluarCondicion({ activo: 'puerta' }, ctx)).toBe(true);
    expect(evaluarCondicion({ activo: 'puerta', es: false }, ctx)).toBe(false);
    expect(evaluarCondicion({ activo: 'otra', es: false }, ctx)).toBe(true);
  });
});

describe('variables', () => {
  it('es / distinto (texto, número y sí-no)', () => {
    const { ctx, mundo } = contexto();
    mundo.marcar('premio', 'casa');
    mundo.marcar('vidas', 3);
    mundo.marcar('listo', true);
    expect(evaluarCondicion({ variable: 'premio', es: 'casa' }, ctx)).toBe(true);
    expect(evaluarCondicion({ variable: 'premio', distinto: 'casa' }, ctx)).toBe(false);
    expect(evaluarCondicion({ variable: 'vidas', es: 3 }, ctx)).toBe(true);
    expect(evaluarCondicion({ variable: 'listo', es: true }, ctx)).toBe(true);
  });

  it('mayor / menor / igual_a sólo con números', () => {
    const { ctx, mundo } = contexto();
    mundo.marcar('vidas', 3);
    mundo.marcar('nombre', 'Emi');
    expect(evaluarCondicion({ variable: 'vidas', mayor: 2 }, ctx)).toBe(true);
    expect(evaluarCondicion({ variable: 'vidas', menor: 4 }, ctx)).toBe(true);
    expect(evaluarCondicion({ variable: 'vidas', igual_a: 3 }, ctx)).toBe(true);
    // Con texto no se cumple (y no revienta)
    expect(evaluarCondicion({ variable: 'nombre', mayor: 2 }, ctx)).toBe(false);
  });

  it('una variable que no existe no cumple (en vez de reventar)', () => {
    const { ctx } = contexto();
    expect(evaluarCondicion({ variable: 'fantasma', es: 1 }, ctx)).toBe(false);
  });
});

describe('contadores', () => {
  it('es / al_menos / a_lo_mas', () => {
    const { ctx, mundo } = contexto();
    mundo.sumar('maletas', 2);
    expect(evaluarCondicion({ contador: 'maletas', es: 2 }, ctx)).toBe(true);
    expect(evaluarCondicion({ contador: 'maletas', al_menos: 2 }, ctx)).toBe(true);
    expect(evaluarCondicion({ contador: 'maletas', a_lo_mas: 2 }, ctx)).toBe(true);
    expect(evaluarCondicion({ contador: 'maletas', al_menos: 3 }, ctx)).toBe(false);
    expect(evaluarCondicion({ contador: 'vacia', es: 0 }, ctx)).toBe(true);
  });
});

describe('eventos del paso', () => {
  it('reacciona al evento que acaba de pasar', () => {
    const { ctx, eventos } = contexto();
    expect(evaluarCondicion({ evento: 'entidad_soltada', destino: 'auto' }, ctx)).toBe(false);
    eventos.empujar({ tipo: 'entidad_soltada', entidad: 'maleta-1', destino: 'auto' });
    expect(evaluarCondicion({ evento: 'entidad_soltada', destino: 'auto' }, ctx)).toBe(true);
    expect(evaluarCondicion({ evento: 'entidad_soltada', destino: 'basurero' }, ctx)).toBe(false);
  });

  it('exige cantidad cuando se pide (machacar 5 veces)', () => {
    const { ctx, eventos } = contexto();
    eventos.empujar({ tipo: 'entidad_tocada', entidad: 'boca', veces: 3 });
    expect(evaluarCondicion({ evento: 'entidad_tocada', entidad: 'boca', veces: 5 }, ctx)).toBe(false);
    eventos.limpiarPaso();
    eventos.empujar({ tipo: 'entidad_tocada', entidad: 'boca', veces: 5 });
    expect(evaluarCondicion({ evento: 'entidad_tocada', entidad: 'boca', veces: 5 }, ctx)).toBe(true);
  });
});

describe('gestos y toques', () => {
  it('pregunta por un gesto pedido y su avance', () => {
    const { ctx, eventos } = contexto();
    expect(evaluarCondicion({ gesto: 'circulo', objetivo: 'manivela' }, ctx)).toBe(false);
    eventos.pedirGesto('circulo', 'manivela', 3);
    expect(evaluarCondicion({ gesto: 'circulo', objetivo: 'manivela' }, ctx)).toBe(true);
    expect(evaluarCondicion({ gesto: 'circulo', objetivo: 'manivela', veces: 1 }, ctx)).toBe(false);
    eventos.completarGesto('circulo', 'manivela');
    expect(evaluarCondicion({ gesto: 'circulo', objetivo: 'manivela', veces: 1 }, ctx)).toBe(true);
    expect(evaluarCondicion({ gesto: 'circulo', objetivo: 'manivela', faltan: 1 }, ctx)).toBe(true);
  });

  it('toco pregunta por toques repetidos', () => {
    const { ctx, eventos } = contexto();
    expect(evaluarCondicion({ toco: 'boca' }, ctx)).toBe(false);
    eventos.empujar({ tipo: 'entidad_tocada', entidad: 'boca', veces: 2 });
    expect(evaluarCondicion({ toco: 'boca' }, ctx)).toBe(true);
    expect(evaluarCondicion({ toco: 'boca', veces: 5 }, ctx)).toBe(false);
  });
});

describe('zonas', () => {
  it('quién llegó a la zona', () => {
    const { ctx, eventos } = contexto();
    eventos.empujar({ tipo: 'zona_entrada', zona: 'casa-de-la-tia', entidad: 'auto' });
    expect(evaluarCondicion({ zona: 'casa-de-la-tia' }, ctx)).toBe(true);
    expect(evaluarCondicion({ zona: 'casa-de-la-tia', ocupada_por: 'auto' }, ctx)).toBe(true);
    expect(evaluarCondicion({ zona: 'casa-de-la-tia', ocupada_por: 'bici' }, ctx)).toBe(false);
    expect(evaluarCondicion({ zona: 'playa', vacia: true }, ctx)).toBe(true);
  });
});

describe('misiones', () => {
  const misiones = [
    { id: 'a', cumple: { activo: 'x' } },
    { id: 'b', cumple: { activo: 'y' }, requiere: ['a'] },
  ];

  it('hecha / pendiente / disponible', () => {
    const { ctx, mundo } = contexto({ misiones });
    // "a" está disponible (no tiene requisitos) pero todavía no hecha.
    expect(evaluarCondicion({ mision: 'a', disponible: true }, ctx)).toBe(true);
    expect(evaluarCondicion({ mision: 'a', hecha: true }, ctx)).toBe(false);
    // "b" no está disponible: le falta "a".
    expect(evaluarCondicion({ mision: 'b', disponible: true }, ctx)).toBe(false);
    void mundo;
  });

  it('una misión que no existe no cumple nada', () => {
    const { ctx } = contexto({ misiones });
    expect(evaluarCondicion({ mision: 'fantasma', hecha: true }, ctx)).toBe(false);
  });
});

describe('pasos de una secuencia', () => {
  it('al_menos / hecho', () => {
    const pasos = new Map([['rutina-manana', 2]]);
    const { ctx } = contexto({ pasos });
    expect(evaluarCondicion({ paso: 'rutina-manana', al_menos: 2 }, ctx)).toBe(true);
    expect(evaluarCondicion({ paso: 'rutina-manana', al_menos: 3 }, ctx)).toBe(false);
    expect(evaluarCondicion({ paso: 'rutina-manana', hecho: 2 }, ctx)).toBe(true);
    expect(evaluarCondicion({ paso: 'otra', al_menos: 1 }, ctx)).toBe(false);
  });
});

describe('comodines', () => {
  it('$entidad en un filtro de evento se sustituye', () => {
    const { ctx, eventos } = contexto({ sustituir: (t) => (t === '$entidad' ? 'maleta-1' : t) });
    eventos.empujar({ tipo: 'entidad_soltada', entidad: 'maleta-1', destino: 'auto' });
    expect(evaluarCondicion({ evento: 'entidad_soltada', entidad: '$entidad', destino: 'auto' }, ctx)).toBe(true);
  });
});

describe('condición con forma desconocida', () => {
  it('no cumple y no revienta (el validador la reporta aparte)', () => {
    const { ctx } = contexto();
    expect(evaluarCondicion({ color: 'rojo' } as unknown as Condicion, ctx)).toBe(false);
  });
});

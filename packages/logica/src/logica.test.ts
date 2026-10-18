import { describe, expect, it } from 'vitest';
import type { AccionResuelta, Evento, Nivel } from './tipo.ts';
import { Logica } from './logica.ts';

/** Un espía: guarda todo lo que la lógica le pide al juego (pantalla, sonido, video). */
function espia(): { efectos: AccionResuelta[]; terminos: string[]; logica: (nivel: Nivel) => Logica } {
  const efectos: AccionResuelta[] = [];
  const terminos: string[] = [];
  return {
    efectos,
    terminos,
    logica: (nivel: Nivel) =>
      new Logica(nivel, {
        aplicar: (accion) => efectos.push(accion),
        termino: (motivo) => terminos.push(motivo),
      }),
  };
}

const nivelMaletas: Nivel = {
  id: 'maletas',
  mundo: { contadores: { maletas: 0 }, objetos: { viaje: false } },
  reglas: [
    {
      id: 'subir',
      si: { evento: 'entidad_soltada', destino: 'auto' },
      hacer: ['ocultar($entidad)', 'sumar(maletas, 1)'],
    },
    { id: 'listo', si: { contador: 'maletas', al_menos: 3 }, hacer: ['activar(viaje)'] },
    { id: 'avisar', si: { activo: 'viaje' }, hacer: ['decir(abuelo, "¡vamos!")'] },
  ],
  misiones: [{ id: 'subir-todo', texto: 'Subir las maletas', cumple: { contador: 'maletas', al_menos: 3 } }],
};

describe('Logica: el paso', () => {
  it('reacciona al evento del paso y aplica la acción local (sumar)', () => {
    const e = espia();
    const logica = e.logica(nivelMaletas);
    logica.paso([{ tipo: 'entidad_soltada', entidad: 'maleta-1', destino: 'auto' }]);
    expect(logica.mundo.contador('maletas')).toBe(1);
  });

  it('las acciones de pantalla se avisan al juego, no se comen', () => {
    const e = espia();
    const logica = e.logica(nivelMaletas);
    logica.paso([{ tipo: 'entidad_soltada', entidad: 'maleta-1', destino: 'auto' }]);
    // ocultar($entidad) se avisa, y el comodín ya viene resuelto al id real.
    expect(e.efectos).toContainEqual({ nombre: 'ocultar', args: { objetivo: 'maleta-1' } });
  });

  it('ENCADENA: la tercera maleta activa el viaje y eso dispara el aviso, en el MISMO paso', () => {
    const e = espia();
    const logica = e.logica(nivelMaletas);
    const suelta = (id: string): Evento[] => [{ tipo: 'entidad_soltada', entidad: id, destino: 'auto' }];
    logica.paso(suelta('maleta-1'));
    logica.paso(suelta('maleta-2'));
    expect(logica.mundo.activo('viaje')).toBe(false);
    logica.paso(suelta('maleta-3'));
    expect(logica.mundo.activo('viaje')).toBe(true); // se activó en la vuelta 2
    expect(e.efectos).toContainEqual({ nombre: 'decir', args: { entidad: 'abuelo', frase: '¡vamos!' } });
  });

  it('las reglas se evalúan en el orden que se pide (orden)', () => {
    const e = espia();
    const nivel: Nivel = {
      id: 'orden',
      reglas: [
        { id: 'b', orden: 20, si: { activo: 'x' }, hacer: ['mostrar(b)'] },
        { id: 'a', orden: 10, si: { activo: 'x' }, hacer: ['mostrar(a)'] },
      ],
      mundo: { objetos: { x: true } },
    };
    const logica = e.logica(nivel);
    logica.paso([]);
    expect(e.efectos.map((x) => x.nombre)).toEqual(['mostrar', 'mostrar']);
    expect(e.efectos.map((x) => String(x.args['objetivo']))).toEqual(['a', 'b']);
  });

  it('una regla común dispara UNA sola vez en toda la partida', () => {
    const e = espia();
    const nivel: Nivel = { id: 'una', mundo: { objetos: { x: true } }, reglas: [{ id: 'r', si: { activo: 'x' }, hacer: ['celebrar'] }] };
    const logica = e.logica(nivel);
    logica.paso([]);
    logica.paso([]);
    logica.paso([]);
    expect(e.efectos).toHaveLength(1);
  });

  it('con una_vez:false se repite cada paso (mientras se cumpla)', () => {
    const e = espia();
    const nivel: Nivel = {
      id: 'repite',
      mundo: { objetos: { x: true } },
      reglas: [{ id: 'r', si: { activo: 'x' }, hacer: ['mostrar(luz)'], una_vez: false }],
    };
    const logica = e.logica(nivel);
    logica.paso([]);
    logica.paso([]);
    expect(e.efectos).toHaveLength(2);
  });

  it('los eventos NO sobreviven al paso (no reacciona tarde)', () => {
    const e = espia();
    const logica = e.logica(nivelMaletas);
    logica.paso([{ tipo: 'entidad_soltada', entidad: 'm1', destino: 'auto' }]);
    const antes = logica.mundo.contador('maletas');
    logica.paso([]);
    expect(logica.mundo.contador('maletas')).toBe(antes);
  });

  it('el encadenamiento se corta si algo se muerde la cola (no cuelga)', () => {
    const e = espia();
    const nivel: Nivel = {
      id: 'bucle',
      reglas: [
        { id: 'siempre', hacer: ['sumar(contador, 1)'], una_vez: false },
      ],
    };
    const logica = e.logica(nivel);
    logica.paso([]);
    // Una sola regla local sin condición: se ejecuta una vez por vuelta... se corta a 8.
    expect(logica.mundo.contador('contador')).toBeLessThanOrEqual(8);
  });
});

describe('Logica: misiones y fin de nivel', () => {
  it('cumple la misión y emite el evento (una sola vez)', () => {
    const e = espia();
    const logica = e.logica(nivelMaletas);
    logica.paso([{ tipo: 'entidad_soltada', entidad: 'm1', destino: 'auto' }]);
    expect(logica.misiones.estadoDe('subir-todo')).toBe('en_curso');
    logica.paso([{ tipo: 'entidad_soltada', entidad: 'm2', destino: 'auto' }]);
    logica.paso([{ tipo: 'entidad_soltada', entidad: 'm3', destino: 'auto' }]);
    expect(logica.misiones.estadoDe('subir-todo')).toBe('hecha');
    expect(logica.terminadoNivel()).toBe(true);
    expect(e.terminos).toContain('misiones');
  });

  it('la recompensa de una misión se aplica al cumplirse', () => {
    const e = espia();
    const nivel: Nivel = {
      id: 'premio',
      mundo: { variables: { premio: 'casa-de-la-tia' } },
      reglas: [],
      misiones: [{ id: 'llegar', cumple: { activo: 'llegue' }, recompensa: ['reproducir_video($premio)', 'celebrar'] }],
    };
    const logica = e.logica(nivel);
    // "llegar" no tiene requisitos → disponible; se cumple cuando el mundo lo diga.
    logica.mundo.activar('llegue');
    logica.paso([]);
    expect(logica.misiones.estadoDe('llegar')).toBe('hecha');
    expect(e.efectos).toContainEqual({ nombre: 'reproducir_video', args: { video: 'casa-de-la-tia' } });
    expect(e.efectos).toContainEqual({ nombre: 'celebrar', args: {} });
  });

  it('no se puede terminar sin cumplir los requisitos (el orden manda)', () => {
    const e = espia();
    const nivel: Nivel = {
      id: 'orden-misiones',
      reglas: [],
      misiones: [
        { id: 'a', cumple: { activo: 'a' } },
        { id: 'b', cumple: { activo: 'b' }, requiere: ['a'] },
      ],
    };
    const logica = e.logica(nivel);
    logica.mundo.activar('b'); // cumple la condición de "b", pero le falta "a"
    logica.paso([]);
    expect(logica.misiones.estadoDe('b')).toBe('pendiente');
    expect(logica.terminadoNivel()).toBe(false);
    logica.mundo.activar('a');
    logica.paso([]);
    expect(logica.misiones.estadoDe('a')).toBe('hecha');
    logica.paso([]);
    expect(logica.misiones.estadoDe('b')).toBe('hecha');
    expect(logica.terminadoNivel()).toBe(true);
  });

  it('terminar_nivel como acción corta todo', () => {
    const e = espia();
    const nivel: Nivel = {
      id: 'corte',
      reglas: [{ id: 'fin', si: { activo: 'listo' }, hacer: ['terminar_nivel'] }],
      mundo: { objetos: { listo: true } },
    };
    const logica = e.logica(nivel);
    const paso = logica.paso([]);
    expect(paso.nivelTerminado).toBe(true);
    expect(e.terminos).toContain('accion');
    // Terminado: los pasos siguientes no hacen nada.
    const siguiente = logica.paso([]);
    expect(siguiente.acciones).toHaveLength(0);
  });
});

describe('Logica: una_vez se rearma cuando la condición se apaga', () => {
  it('una regla de evento dispara una vez por evento (sirve para las tres maletas)', () => {
    const e = espia();
    const nivel: Nivel = {
      id: 'rearmado',
      mundo: { contadores: { piezas: 0 } },
      reglas: [{ id: 'guardar', si: { evento: 'entidad_soltada', destino: 'caja' }, hacer: ['sumar(piezas, 1)'] }],
    };
    const logica = e.logica(nivel);
    for (const id of ['p1', 'p2', 'p3']) {
      logica.paso([{ tipo: 'entidad_soltada', entidad: id, destino: 'caja' }]);
    }
    expect(logica.mundo.contador('piezas')).toBe(3);
    // Un paso sin evento no vuelve a disparar (no se queda pegado al evento viejo).
    logica.paso([]);
    expect(logica.mundo.contador('piezas')).toBe(3);
  });

  it('se rearma cuando la condición se apaga y vuelve a encenderse', () => {
    const e = espia();
    const nivel: Nivel = {
      id: 'rearme',
      mundo: { objetos: { alarma: false } },
      reglas: [{ id: 'avisar', si: { activo: 'alarma' }, hacer: ['celebrar'] }],
    };
    const logica = e.logica(nivel);
    logica.mundo.activar('alarma');
    logica.paso([]);
    logica.paso([]);
    expect(e.efectos).toHaveLength(1); // prendida: dispara una sola vez

    logica.mundo.desactivar('alarma');
    logica.paso([]);
    logica.mundo.activar('alarma');
    logica.paso([]);
    expect(e.efectos).toHaveLength(2); // se apagó: quedó lista otra vez
  });

  it('una regla reacciona a una variable que cambió otra regla (en el mismo paso)', () => {
    const e = espia();
    const nivel: Nivel = {
      id: 'variable-encadenada',
      mundo: { objetos: { boton: true } },
      reglas: [
        { id: 'marcar', si: { activo: 'boton' }, hacer: ['marcar(color, rojo)'] },
        { id: 'pintar', si: { evento: 'variable_cambiada', variable: 'color' }, hacer: ['mostrar(pintura)'] },
      ],
    };
    const logica = e.logica(nivel);
    logica.paso([]);
    expect(e.efectos).toContainEqual({ nombre: 'mostrar', args: { objetivo: 'pintura' } });
  });
});

describe('Logica: completar una misión desde una acción', () => {
  it('la da por hecha, la informa y paga la recompensa', () => {
    const e = espia();
    const nivel: Nivel = {
      id: 'completar',
      mundo: { objetos: { listo: false } },
      reglas: [{ id: 'fin', si: { activo: 'listo' }, hacer: ['completar(recojer)'] }],
      misiones: [{ id: 'recojer', cumple: { activo: 'nunca' }, recompensa: ['celebrar'] }],
    };
    const logica = e.logica(nivel);
    logica.mundo.activar('listo');
    const paso = logica.paso([]);
    expect(paso.cumplidas).toEqual(['recojer']);
    expect(logica.misiones.estadoDe('recojer')).toBe('hecha');
    expect(e.efectos).toContainEqual({ nombre: 'celebrar', args: {} });
  });

  it('NO se salta los prerrequisitos (el orden manda también acá)', () => {
    const e = espia();
    const nivel: Nivel = {
      id: 'completar-orden',
      mundo: { objetos: { listo: false } },
      reglas: [{ id: 'saltar', si: { activo: 'listo' }, hacer: ['completar(b)'] }],
      misiones: [
        { id: 'a', cumple: { activo: 'a' } },
        { id: 'b', cumple: { activo: 'b' }, requiere: ['a'] },
      ],
    };
    const logica = e.logica(nivel);
    logica.mundo.activar('listo');
    const paso = logica.paso([]);
    expect(paso.cumplidas).toEqual([]);
    expect(logica.misiones.estadoDe('b')).toBe('pendiente');
  });
});

describe('Logica: la condición de fin de nivel manda', () => {
  it('con `nivel_terminado` propio no alcanza con cumplir las misiones', () => {
    const e = espia();
    const nivel: Nivel = {
      id: 'fin-condicional',
      reglas: [],
      misiones: [{ id: 'a', cumple: { activo: 'a' } }],
      nivel_terminado: { y: [{ activo: 'trofeo' }] },
    };
    const logica = e.logica(nivel);
    logica.mundo.activar('a');
    logica.paso([]);
    expect(logica.misiones.estadoDe('a')).toBe('hecha');
    expect(logica.terminadoNivel()).toBe(false);

    logica.mundo.activar('trofeo');
    logica.paso([]);
    expect(logica.terminadoNivel()).toBe(true);
  });
});

describe('Logica: los datos rotos no revientan el juego', () => {
  it('un nivel con basura en los campos igual se puede correr (el validador avisa aparte)', () => {
    const e = espia();
    const roto = {
      id: 'roto',
      reglas: undefined,
      misiones: 'nada',
      mundo: { contadores: { x: 5 } },
    } as unknown as Nivel;
    const logica = e.logica(roto);
    const paso = logica.paso([]);
    expect(paso.acciones).toEqual([]);
    expect(paso.nivelTerminado).toBe(false);
    expect(logica.mundo.contador('x')).toBe(5);
  });

  it('una regla con una condición que no se entiende simplemente no dispara', () => {
    const e = espia();
    const nivel: Nivel = {
      id: 'basura',
      reglas: [
        { id: 'rara', si: { color: 'rojo' } as never, hacer: ['celebrar'] },
        { id: 'accion-rara', hacer: ['volar(alto)'] },
      ],
    };
    const logica = e.logica(nivel);
    logica.paso([]);
    expect(e.efectos.map((a) => a.nombre)).toEqual(['volar']);
    expect(e.efectos[0]?.args).toEqual({ arg0: 'alto' });
  });
});

describe('Logica: estado para guardar la partida', () => {
  it('instantánea con mundo y misiones', () => {
    const e = espia();
    const logica = e.logica(nivelMaletas);
    logica.paso([{ tipo: 'entidad_soltada', entidad: 'm1', destino: 'auto' }]);
    const estado = logica.estado();
    expect(estado.mundo.contadores?.['maletas']).toBe(1);
    expect(estado.misiones['subir-todo']).toBe('en_curso');
    expect(estado.terminado).toBe(false);
  });
});

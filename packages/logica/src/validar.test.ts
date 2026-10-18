import { describe, expect, it } from 'vitest';
import type { Nivel } from './tipo.ts';
import { GESTOS_CONOCIDOS, validarNivel } from './validar.ts';

const bueno: Nivel = {
  id: 'prueba',
  mundo: { contadores: { maletas: 0 } },
  reglas: [
    { id: 'subir', si: { evento: 'entidad_soltada', destino: 'auto' }, hacer: ['ocultar($entidad)', 'sumar(maletas, 1)'] },
    { id: 'manivela', si: { activo: 'viaje' }, hacer: ['pedir_gesto(circulo, 3, manivela)'] },
  ],
  misiones: [
    { id: 'a', cumple: { contador: 'maletas', al_menos: 3 } },
    { id: 'b', cumple: { activo: 'casa' }, requiere: ['a'], recompensa: ['celebrar'] },
  ],
  nivel_terminado: { y: [{ mision: 'b', hecha: true }] },
};

describe('validarNivel: un nivel sano pasa limpio', () => {
  it('no reporta nada', () => {
    const r = validarNivel(bueno);
    expect(r.errores).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('acepta todas las condiciones conocidas anidadas', () => {
    const nivel: Nivel = {
      id: 'condiciones',
      reglas: [
        {
          id: 'r',
          si: {
            y: [
              { activo: 'x' },
              { variable: 'v', es: 1 },
              { contador: 'c', al_menos: 1 },
              { evento: 'gesto_completado', gesto: 'circulo' },
              { gesto: 'circulo', objetivo: 'm' },
              { toco: 'boca', veces: 5 },
              { zona: 'z' },
              { mision: 'a', hecha: true },
              { paso: 'secuencia', al_menos: 2 },
              { o: [{ activo: 'a' }, { activo: 'b' }] },
              { no: { activo: 'c' } },
            ],
          },
          hacer: ['celebrar'],
        },
      ],
    };
    expect(validarNivel(nivel).errores).toEqual([]);
  });
});

describe('validarNivel: los datos malos se dicen con nombre y valor', () => {
  it('el nivel sin id', () => {
    const r = validarNivel({ id: '  ', reglas: [] });
    expect(r.ok).toBe(false);
    expect(r.errores[0]).toContain('id');
  });

  it('regla sin id', () => {
    const r = validarNivel({ id: 'x', reglas: [{ id: '', hacer: ['celebrar'] }] });
    expect(r.errores.some((e) => e.includes('reglas[0]') && e.includes('id'))).toBe(true);
  });

  it('regla que no hace nada', () => {
    const r = validarNivel({ id: 'x', reglas: [{ id: 'r', hacer: [] }] });
    expect(r.errores.some((e) => e.includes('no hace nada'))).toBe(true);
  });

  it('acción desconocida (dice cuál)', () => {
    const r = validarNivel({ id: 'x', reglas: [{ id: 'r', hacer: ['volar(alto)'] }] });
    expect(r.errores.some((e) => e.includes('volar') && e.includes('desconocida'))).toBe(true);
  });

  it('gesto desconocido (muestra los que hay)', () => {
    const r = validarNivel({ id: 'x', reglas: [{ id: 'r', hacer: ['pedir_gesto(telepatia, 2, algo)'] }] });
    expect(r.errores.some((e) => e.includes('telepatia') && e.includes(GESTOS_CONOCIDOS[0] ?? ''))).toBe(true);
  });

  it('condición que no se entiende (muestra los campos que traía)', () => {
    const r = validarNivel({ id: 'x', reglas: [{ id: 'r', si: { color: 'rojo' } as never, hacer: ['celebrar'] }] });
    expect(r.errores.some((e) => e.includes('color'))).toBe(true);
  });

  it('prerrequisito que no existe', () => {
    const r = validarNivel({
      id: 'x',
      reglas: [],
      misiones: [{ id: 'a', cumple: { activo: 'x' }, requiere: ['fantasma'] }],
    });
    expect(r.errores.some((e) => e.includes('fantasma') && e.includes('no existe'))).toBe(true);
  });

  it('ciclo de prerrequisitos (se piden entre ellas y nunca se puede empezar)', () => {
    const r = validarNivel({
      id: 'x',
      reglas: [],
      misiones: [
        { id: 'a', cumple: { activo: 'a' }, requiere: ['b'] },
        { id: 'b', cumple: { activo: 'b' }, requiere: ['a'] },
      ],
    });
    expect(r.errores.some((e) => e.includes('ciclo'))).toBe(true);
  });

  it('id de misión repetido', () => {
    const r = validarNivel({
      id: 'x',
      reglas: [],
      misiones: [
        { id: 'a', cumple: { activo: 'a' } },
        { id: 'a', cumple: { activo: 'b' } },
      ],
    });
    expect(r.errores.some((e) => e.includes('repetido'))).toBe(true);
  });

  it('recompensa con acción desconocida también se reporta', () => {
    const r = validarNivel({
      id: 'x',
      reglas: [],
      misiones: [{ id: 'a', cumple: { activo: 'x' }, recompensa: ['explotar(todo)'] }],
    });
    expect(r.errores.some((e) => e.includes('explotar'))).toBe(true);
  });
});

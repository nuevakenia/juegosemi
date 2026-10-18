import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validarFamilia, autoDePersona, paresCorrectos, type Familia } from './esquema.ts';

const familiaBase: Familia = {
  id: 'f1',
  titulo: 'Prueba',
  autos: [
    { id: 'a-papa', nombre: 'auto del papá' },
    { id: 'a-mama', nombre: 'auto de la mamá' },
  ],
  personas: [
    { id: 'papa', nombre: 'Papá', auto: 'a-papa' },
    { id: 'mama', nombre: 'Mamá', auto: 'a-mama' },
  ],
};

describe('validarFamilia', () => {
  it('acepta una familia bien formada', () => {
    const r = validarFamilia(familiaBase);
    expect(r.ok).toBe(true);
    expect(r.errores).toEqual([]);
    expect(r.valor?.personas.length).toBe(2);
  });

  it('rechaza una persona que apunta a un auto que no existe (y lo dice con nombre)', () => {
    const rota = {
      ...familiaBase,
      personas: [{ id: 'tio', nombre: 'el tío', auto: 'a-inexistente' }, familiaBase.personas[1]!],
    };
    const r = validarFamilia(rota);
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('a-inexistente');
    expect(r.errores.join(' | ')).toContain('el tío');
  });

  it('detecta ids repetidos', () => {
    const rota = {
      ...familiaBase,
      personas: [familiaBase.personas[0]!, { ...familiaBase.personas[0]!, auto: 'a-mama' }],
    };
    const r = validarFamilia(rota);
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('id repetido');
  });

  it('exige al menos 2 autos y 2 personas (sin eso no hay juego)', () => {
    const r = validarFamilia({ id: 'x', titulo: 'x', autos: [{ id: 'a', nombre: 'a' }], personas: [{ id: 'p', nombre: 'p', auto: 'a' }] });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('al menos 2 autos');
    expect(r.errores.join(' | ')).toContain('al menos 2 personas');
  });

  it('rechaza un nombre vacío', () => {
    const rota = { ...familiaBase, personas: [{ id: 'p', nombre: '   ', auto: 'a-papa' }, familiaBase.personas[1]!] };
    const r = validarFamilia(rota);
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('texto no vacío');
  });

  it('rechaza algo que no es un objeto', () => {
    expect(validarFamilia('hola').ok).toBe(false);
    expect(validarFamilia(null).ok).toBe(false);
    expect(validarFamilia([]).ok).toBe(false);
  });
});

describe('relaciones persona → auto', () => {
  it('encuentra el auto de una persona', () => {
    expect(autoDePersona(familiaBase, 'papa')?.id).toBe('a-papa');
  });

  it('devuelve null para una persona que no existe', () => {
    expect(autoDePersona(familiaBase, 'fantasma')).toBeNull();
  });

  it('arma los pares correctos en orden', () => {
    const pares = paresCorrectos(familiaBase);
    expect(pares.map((p) => `${p.persona.id}->${p.auto.id}`)).toEqual(['papa->a-papa', 'mama->a-mama']);
  });
});

describe('el contenido real de la familia es válido', () => {
  it('packages/contenido/data/familia.json pasa la validación', () => {
    const ruta = new URL('../data/familia.json', import.meta.url);
    const bruto: unknown = JSON.parse(readFileSync(ruta, 'utf8'));
    const r = validarFamilia(bruto);
    expect(r.errores).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.valor?.personas.length).toBeGreaterThanOrEqual(6);
  });
});

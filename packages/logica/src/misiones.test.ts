import { describe, expect, it } from 'vitest';
import type { Mision } from './tipo.ts';
import { Misiones } from './misiones.ts';

const tres: Mision[] = [
  { id: 'maletas', texto: 'Subir las maletas', cumple: { contador: 'maletas', al_menos: 3 } },
  { id: 'manejar', texto: 'Manejar', cumple: { activo: 'manejando' }, requiere: ['maletas'] },
  { id: 'llegar', texto: '¡Llegamos!', cumple: { activo: 'en-la-casa' }, requiere: ['manejar'], recompensa: ['celebrar'] },
];

describe('Misiones: qué hay que lograr y en qué orden', () => {
  it('todas arrancan pendientes', () => {
    const m = new Misiones(tres);
    expect(m.listado().map((x) => x.estado)).toEqual(['pendiente', 'pendiente', 'pendiente']);
  });

  it('sin los requisitos, una misión NUNCA puede completarse (el orden manda)', () => {
    const m = new Misiones(tres);
    // "llegar" cumple su condición al toque, pero le falta "manejar" → no se completa.
    const cumplidas = m.actualizar((mision) => (mision.id === 'llegar' ? true : false));
    expect(cumplidas).toEqual([]);
    expect(m.estadoDe('llegar')).toBe('pendiente');
  });

  it('se cumple en orden: maletas → manejar → llegar', () => {
    const m = new Misiones(tres);
    // Paso 1: se cumplen las maletas.
    expect(m.actualizar((mi) => mi.id === 'maletas').map((x) => x.id)).toEqual(['maletas']);
    expect(m.estadoDe('maletas')).toBe('hecha');
    // Ahora "manejar" queda en curso (requisitos listos) hasta que se cumpla.
    m.actualizar(() => false);
    expect(m.estadoDe('manejar')).toBe('en_curso');
    expect(m.estadoDe('llegar')).toBe('pendiente');
    // Paso 2: manejar.
    expect(m.actualizar((mi) => mi.id === 'manejar').map((x) => x.id)).toEqual(['manejar']);
    // Paso 3: llegar.
    expect(m.actualizar((mi) => mi.id === 'llegar').map((x) => x.id)).toEqual(['llegar']);
    expect(m.pendientes()).toHaveLength(0);
  });

  it('una misión ya cumplida no vuelve a avisar (la recompensa sale una vez)', () => {
    const m = new Misiones(tres);
    m.actualizar((mi) => mi.id === 'maletas');
    expect(m.actualizar((mi) => mi.id === 'maletas')).toEqual([]);
  });

  it('la recompensa viaja con la misión', () => {
    const m = new Misiones(tres);
    expect(m.recompensaDe('llegar')).toEqual(['celebrar']);
    expect(m.recompensaDe('maletas')).toEqual([]);
    expect(m.recompensaDe('fantasma')).toEqual([]);
  });

  it('un requisito que no está cumplido vuelve la misión a pendiente', () => {
    const m = new Misiones(tres);
    m.actualizar(() => true); // sin requisitos cumplidos, nada se completa
    expect(m.estadoDe('manejar')).toBe('pendiente');
  });

  it('guardar y cargar conserva los estados', () => {
    const m = new Misiones(tres);
    m.actualizar((mi) => mi.id === 'maletas');
    const guardado = m.instantanea();
    const otra = new Misiones(tres);
    otra.cargar(guardado);
    expect(otra.estadoDe('maletas')).toBe('hecha');
  });

  it('definicion y estadoDe de algo que no existe devuelven null (sin reventar)', () => {
    const m = new Misiones(tres);
    expect(m.definicion('fantasma')).toBeNull();
    expect(m.estadoDe('fantasma')).toBeNull();
  });
});

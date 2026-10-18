/**
 * El tablero de la prueba: que todo quede dentro de la pantalla y que nada se pise.
 * Es lo que evita el bug caro de un juego que se arrastra con el dedo.
 */
import { describe, expect, it } from 'vitest';
import { dentroDe, fichaEn, repartirEnGrilla, repartirZonas, type Ficha } from './tablero.ts';

const ANCHO = 800;
const ALTO = 600;

/** ¿La ficha entera cae dentro de la pantalla? */
function adentro(ficha: Ficha): boolean {
  return (
    ficha.x - ficha.ancho / 2 >= 0 &&
    ficha.x + ficha.ancho / 2 <= ANCHO &&
    ficha.y - ficha.alto / 2 >= 0 &&
    ficha.y + ficha.alto / 2 <= ALTO
  );
}

/** ¿Se tocan dos fichas? */
function sePisan(a: Ficha, b: Ficha): boolean {
  const separadosX = Math.abs(a.x - b.x) >= (a.ancho + b.ancho) / 2;
  const separadosY = Math.abs(a.y - b.y) >= (a.alto + b.alto) / 2;
  return !separadosX && !separadosY;
}

describe('el tablero de la prueba', () => {
  it('sin entidades no devuelve nada', () => {
    expect(repartirEnGrilla([], ANCHO, ALTO)).toEqual([]);
    expect(repartirZonas([], ANCHO, ALTO)).toEqual([]);
  });

  it('pone las entidades adentro y sin pisarse, para 1, 2, 4 y 9', () => {
    for (const cantidad of [1, 2, 4, 9]) {
      const ids = Array.from({ length: cantidad }, (_, i) => `e${i}`);
      const fichas = repartirEnGrilla(ids, ANCHO, ALTO);
      expect(fichas.length).toBe(cantidad);
      for (const ficha of fichas) expect(adentro(ficha)).toBe(true);
      for (let i = 0; i < fichas.length; i++) {
        for (let j = i + 1; j < fichas.length; j++) {
          const a = fichas[i];
          const b = fichas[j];
          if (a === undefined || b === undefined) continue;
          expect(sePisan(a, b)).toBe(false);
        }
      }
    }
  });

  it('pone las zonas en la franja de abajo, anchas', () => {
    const zonas = repartirZonas(['casa', 'parque'], ANCHO, ALTO);
    expect(zonas.length).toBe(2);
    for (const zona of zonas) {
      expect(adentro(zona)).toBe(true);
      expect(zona.y).toBeGreaterThan(ALTO * 0.6);
      expect(zona.ancho).toBeGreaterThan(zona.alto);
    }
  });

  it('sabe si un punto cayó dentro de una ficha', () => {
    const ficha: Ficha = { id: 'x', x: 100, y: 100, ancho: 80, alto: 60 };
    expect(dentroDe(ficha, 100, 100)).toBe(true);
    expect(dentroDe(ficha, 139, 129)).toBe(true);
    expect(dentroDe(ficha, 141, 100)).toBe(false);
    expect(fichaEn([ficha], 100, 100)?.id).toBe('x');
    expect(fichaEn([ficha], 400, 400)).toBeNull();
  });
});

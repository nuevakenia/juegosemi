import { describe, it, expect } from 'vitest';
import {
  identidad,
  multiplicar,
  trasladar,
  rotar,
  escalar,
  aplicar,
  rotacion,
  largoX,
  largoY,
  aRadianes,
  aGrados,
  casiIgual,
  puntoCasiIgual,
} from './matriz.ts';

describe('matriz afín', () => {
  it('la identidad no mueve nada', () => {
    expect(puntoCasiIgual(aplicar(identidad(), 7, -3), { x: 7, y: -3 })).toBe(true);
  });

  it('trasladar suma el desplazamiento', () => {
    const p = aplicar(trasladar(10, -5), 1, 1);
    expect(p.x).toBeCloseTo(11, 10);
    expect(p.y).toBeCloseTo(-4, 10);
  });

  it('rotar 90 grados lleva el eje X al eje Y (y va para abajo, como en pantalla)', () => {
    const p = aplicar(rotar(aRadianes(90)), 1, 0);
    expect(p.x).toBeCloseTo(0, 10);
    expect(p.y).toBeCloseTo(1, 10);
  });

  it('multiplicar aplica primero el de la derecha', () => {
    // gira y RECIÉN DESPUÉS traslada
    const m = multiplicar(trasladar(10, 0), rotar(aRadianes(90)));
    const p = aplicar(m, 1, 0);
    expect(p.x).toBeCloseTo(10, 10);
    expect(p.y).toBeCloseTo(1, 10);
  });

  it('rotacion() devuelve el giro acumulado', () => {
    const m = multiplicar(rotar(aRadianes(30)), rotar(aRadianes(15)));
    expect(aGrados(rotacion(m))).toBeCloseTo(45, 8);
  });

  it('largoY sale NEGATIVO cuando la pieza está espejada', () => {
    expect(largoX(escalar(-1, 1))).toBeCloseTo(1, 10);
    expect(largoY(escalar(-1, 1))).toBeLessThan(0);
    expect(largoY(escalar(1, 1))).toBeGreaterThan(0);
  });

  it('la escala se reporta en el largo de los ejes', () => {
    const m = escalar(2, 3);
    expect(largoX(m)).toBeCloseTo(2, 10);
    expect(largoY(m)).toBeCloseTo(3, 10);
  });

  it('aRadianes y aGrados son inversas', () => {
    expect(aGrados(aRadianes(123))).toBeCloseTo(123, 10);
  });

  it('casiIgual tiene tolerancia', () => {
    expect(casiIgual(1, 1 + 1e-12)).toBe(true);
    expect(casiIgual(1, 1.001)).toBe(false);
  });
});

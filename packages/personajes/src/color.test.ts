import { describe, it, expect } from 'vitest';
import { esHexValido, colorANumero, numeroAColor, mezclarColores, aclarar, oscurecer, contornoDe, aRgb, deRgb } from './color.ts';

describe('colores', () => {
  it('pasa un hex de 6 dígitos a número', () => {
    expect(colorANumero('#f2c79c')).toBe(0xf2c79c);
  });

  it('entiende el hex de 3 dígitos', () => {
    expect(colorANumero('#abc')).toBe(0xaabbcc);
    expect(colorANumero('#fff')).toBe(0xffffff);
  });

  it('devuelve null si el texto no es un hex válido (nunca inventa un color)', () => {
    expect(colorANumero('rojo')).toBeNull();
    expect(colorANumero('#12345')).toBeNull();
    expect(colorANumero('')).toBeNull();
    expect(esHexValido('rojo')).toBe(false);
    expect(esHexValido(123)).toBe(false);
    expect(esHexValido('#0a0')).toBe(true);
  });

  it('numeroAColor siempre deja 6 dígitos y da la vuelta', () => {
    expect(numeroAColor(0x0000ff)).toBe('#0000ff');
    expect(numeroAColor(0)).toBe('#000000');
    expect(colorANumero(numeroAColor(0x2f6fb3))).toBe(0x2f6fb3);
  });

  it('acota los valores fuera de rango', () => {
    expect(numeroAColor(-5)).toBe('#000000');
    expect(numeroAColor(0xffffff + 999)).toBe('#ffffff');
  });

  it('aRgb y deRgb dan la vuelta', () => {
    const rgb = aRgb(0x2f6fb3);
    expect(rgb).toEqual({ r: 0x2f, g: 0x6f, b: 0xb3 });
    expect(deRgb(rgb)).toBe(0x2f6fb3);
  });

  it('mezclarColores va de a a b', () => {
    expect(mezclarColores(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mezclarColores(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mezclarColores(0x000000, 0xffffff, 0.5)).toBe(0x808080);
  });

  it('aclarar y oscurecer llegan a los extremos', () => {
    expect(aclarar(0x2f6fb3, 1)).toBe(0xffffff);
    expect(oscurecer(0x2f6fb3, 1)).toBe(0x000000);
  });

  it('el contorno es más oscuro que el color', () => {
    const color = 0x2f6fb3;
    const contorno = contornoDe(color);
    const c = aRgb(color);
    const k = aRgb(contorno);
    expect(k.r).toBeLessThan(c.r);
    expect(k.g).toBeLessThan(c.g);
    expect(k.b).toBeLessThan(c.b);
  });
});

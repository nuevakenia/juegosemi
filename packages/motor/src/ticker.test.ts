import { describe, it, expect } from 'vitest';
import { Ticker } from './ticker.ts';

describe('Ticker: pasos fijos', () => {
  it('convierte el tiempo real en pasos fijos', () => {
    const ticker = new Ticker(1 / 60);
    let pasos = 0;
    pasos += ticker.avanzar(0.05, () => {});
    expect(pasos).toBe(3); // 0.05 s = 3 pasos de 1/60
    expect(ticker.pasos()).toBe(3);
  });

  it('el tiempo simulado avanza (y tiempo() es un número, no una función pisada)', () => {
    const ticker = new Ticker(1 / 60);
    ticker.avanzar(0.05, () => {});
    ticker.avanzar(0.05, () => {});
    expect(typeof ticker.tiempo()).toBe('number');
    expect(ticker.tiempo()).toBeCloseTo(0.1, 5);
  });

  it('respeta el tope de pasos por vuelta (100 ms ya son 6 pasos, entran 5)', () => {
    const ticker = new Ticker(1 / 60, 5);
    expect(ticker.avanzar(0.1, () => {})).toBe(5);
    expect(ticker.tiempo()).toBeCloseTo(5 / 60, 5);
  });

  it('el acumulador arrastra el resto entre llamadas (sin perder tiempo)', () => {
    const ticker = new Ticker(1 / 60);
    // 0.01 s no alcanza para un paso; dos veces 0.01 sí
    expect(ticker.avanzar(0.01, () => {})).toBe(0);
    expect(ticker.avanzar(0.01, () => {})).toBe(1);
  });

  it('un salto enorme (volver de segundo plano) NO dispara un diluvio de pasos', () => {
    const ticker = new Ticker(1 / 60, 5);
    const pasos = ticker.avanzar(10, () => {});
    expect(pasos).toBe(5); // el tope, no 600
  });

  it('el tiempo negativo se ignora', () => {
    const ticker = new Ticker(1 / 60);
    expect(ticker.avanzar(-1, () => {})).toBe(0);
    expect(ticker.tiempo()).toBe(0);
  });

  it('reiniciar deja todo en cero', () => {
    const ticker = new Ticker(1 / 60);
    ticker.avanzar(1, () => {});
    ticker.reiniciar();
    expect(ticker.tiempo()).toBe(0);
    expect(ticker.pasos()).toBe(0);
  });
});

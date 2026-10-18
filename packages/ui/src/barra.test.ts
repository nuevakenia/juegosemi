// @vitest-environment jsdom
// Prueba de la barra de progreso: se arma, se mueve y se anuncia accesible.
import { describe, expect, it } from 'vitest';
import { crearBarraProgreso } from './barra.ts';

describe('crearBarraProgreso', () => {
  it('arranca en el valor pedido y lo anuncia', () => {
    const barra = crearBarraProgreso({ etiqueta: 'Machacá el botón', valor: 0.2 });
    const pista = barra.elemento.querySelector<HTMLElement>('.js-barra__pista');
    const relleno = barra.elemento.querySelector<HTMLElement>('.js-barra__relleno');

    expect(barra.valor()).toBeCloseTo(0.2);
    expect(barra.elemento.querySelector('.js-barra__etiqueta')?.textContent).toBe('Machacá el botón');
    expect(pista?.getAttribute('role')).toBe('progressbar');
    expect(pista?.getAttribute('aria-valuenow')).toBe('20');
    expect(relleno?.style.width).toBe('20%');
  });

  it('mueve el relleno y el aria al actualizar', () => {
    const barra = crearBarraProgreso();
    barra.actualizar(0.75);
    const pista = barra.elemento.querySelector<HTMLElement>('.js-barra__pista');
    const relleno = barra.elemento.querySelector<HTMLElement>('.js-barra__relleno');

    expect(barra.valor()).toBeCloseTo(0.75);
    expect(pista?.getAttribute('aria-valuenow')).toBe('75');
    expect(relleno?.style.width).toBe('75%');
  });

  it('acota el valor entre 0 y 1', () => {
    const barra = crearBarraProgreso();
    barra.actualizar(3);
    expect(barra.valor()).toBe(1);
    barra.actualizar(-2);
    expect(barra.valor()).toBe(0);
  });

  it('crea la etiqueta si no la tenía', () => {
    const barra = crearBarraProgreso();
    expect(barra.elemento.querySelector('.js-barra__etiqueta')).toBeNull();
    barra.ponerEtiqueta('Girá la manivela');
    expect(barra.elemento.querySelector('.js-barra__etiqueta')?.textContent).toBe('Girá la manivela');
    barra.ponerEtiqueta('Otra cosa');
    expect(barra.elemento.querySelectorAll('.js-barra__etiqueta').length).toBe(1);
    expect(barra.elemento.querySelector('.js-barra__etiqueta')?.textContent).toBe('Otra cosa');
  });
});

// @vitest-environment jsdom
// Pruebas de la tarjeta grande: boton cuando es elegible, articulo cuando no.
import { describe, expect, it, vi } from 'vitest';
import { crearTarjeta } from './tarjeta';

describe('crearTarjeta', () => {
  it('es un <article> cuando no tiene accion', () => {
    const tarjeta = crearTarjeta({ titulo: 'Los animales' });

    expect(tarjeta.tagName).toBe('ARTICLE');
    expect(tarjeta.className).toContain('js-tarjeta');
    expect(tarjeta.className).not.toContain('js-tarjeta--elegible');
  });

  it('es un <button> de cuerpo completo cuando tiene accion', () => {
    const tarjeta = crearTarjeta({ titulo: 'Los animales', alElegir: () => undefined });

    expect(tarjeta.tagName).toBe('BUTTON');
    expect(tarjeta.getAttribute('type')).toBe('button');
    expect(tarjeta.className).toContain('js-tarjeta--elegible');
  });

  it('arma titulo, texto de apoyo y pictograma escondido', () => {
    const tarjeta = crearTarjeta({
      titulo: 'Los colores',
      texto: 'Toca para jugar',
      pictograma: '\uD83C\uDFA8',
    });

    expect(tarjeta.querySelector('.js-tarjeta__titulo')?.textContent).toBe('Los colores');
    expect(tarjeta.querySelector('.js-tarjeta__texto')?.textContent).toBe('Toca para jugar');
    expect(tarjeta.querySelector('.js-tarjeta__pictograma')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('no agrega el texto de apoyo si no viene', () => {
    const tarjeta = crearTarjeta({ titulo: 'Solita' });

    expect(tarjeta.querySelector('.js-tarjeta__texto')).toBeNull();
  });

  it('dispara alElegir al tocar la tarjeta entera', () => {
    const alElegir = vi.fn();
    const tarjeta = crearTarjeta({ titulo: 'Los animales', alElegir });

    tarjeta.click();

    expect(alElegir).toHaveBeenCalledTimes(1);
  });

  it('respeta el nombre accesible explicito solo cuando es elegible', () => {
    const elegible = crearTarjeta({
      titulo: 'ABC',
      nombreAccesible: 'Juego de letras',
      alElegir: () => undefined,
    });
    const lectura = crearTarjeta({
      titulo: 'ABC',
      nombreAccesible: 'Juego de letras',
    });

    expect(elegible.getAttribute('aria-label')).toBe('Juego de letras');
    expect(lectura.getAttribute('aria-label')).toBeNull();
  });

  it('suma las clases extra', () => {
    const tarjeta = crearTarjeta({ titulo: 'Doble', clasesExtra: 'destacada' });

    expect(tarjeta.className).toContain('js-tarjeta');
    expect(tarjeta.className).toContain('destacada');
  });
});

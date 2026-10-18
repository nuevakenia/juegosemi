// @vitest-environment jsdom
// Pruebas del boton grande: elemento nativo, nombre accesible, click y estado apagado.
import { describe, expect, it, vi } from 'vitest';
import { crearBoton } from './boton';

describe('crearBoton', () => {
  it('devuelve un <button> nativo de tipo button', () => {
    const boton = crearBoton({ etiqueta: 'Jugar' });

    expect(boton.tagName).toBe('BUTTON');
    expect(boton.getAttribute('type')).toBe('button');
    expect(boton.className).toContain('js-boton');
  });

  it('muestra la etiqueta en un texto grande y visible', () => {
    const boton = crearBoton({ etiqueta: 'Animales' });
    const texto = boton.querySelector('.js-boton__texto');

    expect(texto).not.toBeNull();
    expect(texto?.textContent).toBe('Animales');
  });

  it('esconde el pictograma de los lectores de pantalla', () => {
    const boton = crearBoton({ etiqueta: 'Animales', pictograma: '\uD83D\uDC36' });
    const pictograma = boton.querySelector('.js-boton__pictograma');

    expect(pictograma?.textContent).toBe('\uD83D\uDC36');
    expect(pictograma?.getAttribute('aria-hidden')).toBe('true');
  });

  it('deja la etiqueta visible como nombre accesible cuando no hay aria-label', () => {
    const boton = crearBoton({ etiqueta: 'Colores' });

    expect(boton.getAttribute('aria-label')).toBeNull();
    expect(boton.textContent).toContain('Colores');
  });

  it('respeta el nombre accesible explicito', () => {
    const boton = crearBoton({
      etiqueta: 'ABC',
      nombreAccesible: 'Juego de letras',
    });

    expect(boton.getAttribute('aria-label')).toBe('Juego de letras');
  });

  it('dispara alElegir cuando se le hace click', () => {
    const alElegir = vi.fn();
    const boton = crearBoton({ etiqueta: 'Jugar', alElegir });

    boton.click();

    expect(alElegir).toHaveBeenCalledTimes(1);
  });

  it('no dispara alElegir si nadie lo pidio', () => {
    const boton = crearBoton({ etiqueta: 'Decorativo' });

    expect(() => boton.click()).not.toThrow();
  });

  it('marca el boton como apagado y sin respuesta', () => {
    const alElegir = vi.fn();
    const boton = crearBoton({ etiqueta: 'Bloqueado', alElegir, deshabilitado: true });

    expect(boton.disabled).toBe(true);
    expect(boton.getAttribute('aria-disabled')).toBe('true');
  });

  it('suma las clases extra sin perder las propias', () => {
    const boton = crearBoton({ etiqueta: 'Volver', clasesExtra: 'js-boton--volver mi-clase' });

    expect(boton.className).toContain('js-boton');
    expect(boton.className).toContain('js-boton--volver');
    expect(boton.className).toContain('mi-clase');
  });
});

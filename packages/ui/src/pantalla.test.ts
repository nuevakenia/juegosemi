// @vitest-environment jsdom
// Pruebas del armazon de pantalla: titulo, subtitulo, boton de volver y cuerpo.
import { describe, expect, it, vi } from 'vitest';
import { crearElemento } from './accesibilidad';
import { crearMenu } from './menu';
import { crearPantalla } from './pantalla';

describe('crearPantalla', () => {
  it('pone el titulo como encabezado principal h1', () => {
    const pantalla = crearPantalla({
      titulo: 'Elige un juego',
      contenido: crearElemento('p'),
    });
    const titulo = pantalla.querySelector('.js-pantalla__titulo');

    expect(titulo?.tagName).toBe('H1');
    expect(titulo?.textContent).toBe('Elige un juego');
  });

  it('agrega el subtitulo solo si viene', () => {
    const conSubtitulo = crearPantalla({
      titulo: 'Elige',
      subtitulo: 'Toca una tarjeta',
      contenido: crearElemento('p'),
    });
    const sinSubtitulo = crearPantalla({ titulo: 'Elige', contenido: crearElemento('p') });

    expect(conSubtitulo.querySelector('.js-pantalla__subtitulo')?.textContent).toBe(
      'Toca una tarjeta',
    );
    expect(sinSubtitulo.querySelector('.js-pantalla__subtitulo')).toBeNull();
  });

  it('no muestra boton de volver si no hay a donde volver', () => {
    const pantalla = crearPantalla({ titulo: 'Inicio', contenido: crearElemento('p') });

    expect(pantalla.querySelector('.js-boton--volver')).toBeNull();
  });

  it('muestra el boton de volver y dispara su accion', () => {
    const alVolver = vi.fn();
    const pantalla = crearPantalla({
      titulo: 'Juego',
      contenido: crearElemento('p'),
      alVolver,
    });
    const volver = pantalla.querySelector<HTMLButtonElement>('.js-boton--volver');

    expect(volver?.textContent).toContain('Volver');
    volver?.click();
    expect(alVolver).toHaveBeenCalledTimes(1);
  });

  it('respeta un texto de volver a medida', () => {
    const pantalla = crearPantalla({
      titulo: 'Juego',
      contenido: crearElemento('p'),
      textoVolver: 'Al inicio',
      alVolver: () => undefined,
    });

    expect(pantalla.querySelector('.js-boton--volver')?.textContent).toContain('Al inicio');
  });

  it('mete el contenido dentro de un <main>', () => {
    const menu = crearMenu({ titulo: 'Juegos', opciones: [{ etiqueta: 'Animales' }] });
    const pantalla = crearPantalla({ titulo: 'Elige', contenido: menu });
    const cuerpo = pantalla.querySelector('.js-pantalla__cuerpo');

    expect(cuerpo?.tagName).toBe('MAIN');
    expect(cuerpo?.contains(menu)).toBe(true);
  });

  it('acepta varios elementos de contenido en orden', () => {
    const uno = crearElemento('p', { texto: 'uno' });
    const dos = crearElemento('p', { texto: 'dos' });
    const cuerpo = crearPantalla({ titulo: 'Elige', contenido: [uno, dos] }).querySelector(
      '.js-pantalla__cuerpo',
    );

    expect(cuerpo?.children.length).toBe(2);
    expect(cuerpo?.children[0]).toBe(uno);
    expect(cuerpo?.children[1]).toBe(dos);
  });
});

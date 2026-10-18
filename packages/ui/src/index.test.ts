// @vitest-environment jsdom
// Prueba del punto de entrada publico: lo que importa una app desde @juegosemi/ui.
import { describe, expect, it, vi } from 'vitest';
import {
  crearBoton,
  crearElemento,
  crearMenu,
  crearPantalla,
  crearTarjeta,
  idUnico,
  TOQUE_MINIMO_PX,
  unirClases,
} from './index';

describe('@juegosemi/ui (punto de entrada)', () => {
  it('expone todos los componentes de la interfaz', () => {
    expect(typeof crearBoton).toBe('function');
    expect(typeof crearTarjeta).toBe('function');
    expect(typeof crearMenu).toBe('function');
    expect(typeof crearPantalla).toBe('function');
  });

  it('expone las utilidades de accesibilidad', () => {
    expect(typeof crearElemento).toBe('function');
    expect(typeof idUnico).toBe('function');
    expect(typeof unirClases).toBe('function');
    expect(TOQUE_MINIMO_PX).toBe(88);
  });

  it('arma una pantalla completa con menu y tarjetas de verdad', () => {
    const alElegir = vi.fn();
    const pantalla = crearPantalla({
      titulo: 'Elige un juego',
      subtitulo: 'Toca una tarjeta grande',
      contenido: [
        crearMenu({
          titulo: 'Juegos',
          opciones: [{ etiqueta: 'Animales', pictograma: '\uD83D\uDC36', alElegir }],
        }),
        crearTarjeta({ titulo: 'Colores', pictograma: '\uD83C\uDFA8' }),
      ],
      alVolver: () => undefined,
    });

    expect(pantalla.querySelectorAll('.js-boton').length).toBe(2); // volver + animales
    expect(pantalla.querySelector('.js-menu')).not.toBeNull();
    expect(pantalla.querySelector('.js-tarjeta')).not.toBeNull();

    pantalla.querySelector<HTMLButtonElement>('.js-menu .js-boton')?.click();
    expect(alElegir).toHaveBeenCalledTimes(1);
  });
});

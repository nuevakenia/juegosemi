// @vitest-environment jsdom
// Pruebas del menu: titulo que etiqueta la seccion y un boton grande por opcion.
import { describe, expect, it, vi } from 'vitest';
import { crearMenu } from './menu';

describe('crearMenu', () => {
  it('envuelve todo en una <section>', () => {
    const menu = crearMenu({ titulo: 'Juegos', opciones: [] });

    expect(menu.tagName).toBe('SECTION');
    expect(menu.className).toContain('js-menu');
  });

  it('muestra el titulo como encabezado de nivel 2', () => {
    const menu = crearMenu({ titulo: 'Juegos', opciones: [] });
    const titulo = menu.querySelector('.js-menu__titulo');

    expect(titulo?.tagName).toBe('H2');
    expect(titulo?.textContent).toBe('Juegos');
  });

  it('deja la seccion etiquetada por su propio titulo', () => {
    const menu = crearMenu({ titulo: 'Juegos', opciones: [] });
    const id = menu.getAttribute('aria-labelledby');

    expect(id).not.toBeNull();
    expect(menu.querySelector('#' + String(id))?.textContent).toBe('Juegos');
  });

  it('crea un boton grande por cada opcion', () => {
    const menu = crearMenu({
      titulo: 'Juegos',
      opciones: [
        { etiqueta: 'Animales', pictograma: '\uD83D\uDC36' },
        { etiqueta: 'Colores', pictograma: '\uD83C\uDFA8' },
        { etiqueta: 'Numeros', pictograma: '\uD83D\uDD22' },
      ],
    });
    const botones = menu.querySelectorAll('.js-menu__opciones .js-boton');

    expect(botones.length).toBe(3);
  });

  it('dispara la accion de cada opcion por separado', () => {
    const animales = vi.fn();
    const colores = vi.fn();
    const menu = crearMenu({
      titulo: 'Juegos',
      opciones: [
        { etiqueta: 'Animales', alElegir: animales },
        { etiqueta: 'Colores', alElegir: colores },
      ],
    });
    const botones = menu.querySelectorAll<HTMLButtonElement>('.js-boton');

    botones[1]?.click();

    expect(colores).toHaveBeenCalledTimes(1);
    expect(animales).not.toHaveBeenCalled();
  });

  it('entrega ids distintos a menus distintos', () => {
    const primero = crearMenu({ titulo: 'Uno', opciones: [] });
    const segundo = crearMenu({ titulo: 'Dos', opciones: [] });

    expect(primero.getAttribute('aria-labelledby')).not.toBe(
      segundo.getAttribute('aria-labelledby'),
    );
  });

  it('suma las clases extra a la seccion', () => {
    const menu = crearMenu({ titulo: 'Juegos', opciones: [], clasesExtra: 'inicio' });

    expect(menu.className).toContain('js-menu');
    expect(menu.className).toContain('inicio');
  });
});

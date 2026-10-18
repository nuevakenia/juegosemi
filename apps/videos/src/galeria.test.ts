// @vitest-environment jsdom
/**
 * La galería, probada con DOM de verdad (jsdom): una tarjeta GRANDE por video,
 * toda la tarjeta es el botón, y la miniatura entra cuando está sin romper nada.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoDatos } from './catalogo.ts';
import { crearGaleria } from './galeria.ts';

const VIDEOS: VideoDatos[] = [
  { id: 'uno', titulo: 'La casa de la tía', archivo: 'uno.mp4' },
  { id: 'dos', titulo: 'El video de la prima', archivo: 'dos.mp4' },
];

beforeEach(() => {
  document.body.textContent = '';
});

describe('la galería de videos', () => {
  it('hace una tarjeta grande por video, con su título', () => {
    const galeria = crearGaleria({ videos: VIDEOS, alElegir: () => undefined });
    document.body.appendChild(galeria.elemento);
    const tarjetas = galeria.elemento.querySelectorAll('.js-video-tarjeta');

    expect(tarjetas.length).toBe(2);
    expect(tarjetas[0]?.querySelector('.js-tarjeta__titulo')?.textContent).toBe('La casa de la tía');
    expect(tarjetas[1]?.querySelector('.js-tarjeta__titulo')?.textContent).toBe('El video de la prima');
  });

  it('la tarjeta entera es el botón: se puede tocar en cualquier parte', () => {
    const galeria = crearGaleria({ videos: VIDEOS, alElegir: () => undefined });
    const tarjeta = galeria.elemento.querySelector('.js-video-tarjeta');

    expect(tarjeta?.tagName).toBe('BUTTON');
    expect(tarjeta?.className).toContain('js-tarjeta--elegible');
  });

  it('al tocar una tarjeta avisa qué video se eligió', () => {
    const alElegir = vi.fn();
    const galeria = crearGaleria({ videos: VIDEOS, alElegir });
    const tarjetas = galeria.elemento.querySelectorAll<HTMLButtonElement>('.js-video-tarjeta');

    tarjetas[1]?.click();

    expect(alElegir).toHaveBeenCalledTimes(1);
    expect(alElegir).toHaveBeenCalledWith(VIDEOS[1]);
  });

  it('cada tarjeta tiene su marco reservado para la miniatura', () => {
    const galeria = crearGaleria({ videos: VIDEOS, alElegir: () => undefined });
    const marcos = galeria.elemento.querySelectorAll('.js-video-tarjeta__marco');

    expect(marcos.length).toBe(2);
    // El marco va primero: arriba del título.
    expect(marcos[0]?.parentElement?.firstElementChild).toBe(marcos[0]);
  });

  it('cuando la miniatura llega, entra en el marco y el pictograma se va', () => {
    let pedidos = 0;
    const galeria = crearGaleria({
      videos: VIDEOS,
      alElegir: () => undefined,
      alPedirMiniatura: (_video, alTenerla) => {
        pedidos += 1;
        alTenerla('data:image/jpeg;base64,AAAA');
        return () => undefined;
      },
    });

    expect(pedidos).toBe(2);
    const cuadro = galeria.elemento.querySelector<HTMLImageElement>('.js-video-tarjeta__cuadro');
    expect(cuadro?.src).toContain('data:image/jpeg');
    expect(galeria.elemento.querySelectorAll('.js-tarjeta__pictograma').length).toBe(0);
  });

  it('si no hay miniatura, la tarjeta se queda con su pictograma (nunca un hueco)', () => {
    const galeria = crearGaleria({
      videos: VIDEOS,
      alElegir: () => undefined,
      alPedirMiniatura: () => () => undefined,
    });

    expect(galeria.elemento.querySelectorAll('.js-video-tarjeta__cuadro').length).toBe(0);
    expect(galeria.elemento.querySelectorAll('.js-tarjeta__pictograma').length).toBe(2);
  });

  it('al salir de la galería se cortan las esperas de miniatura', () => {
    const cancelar = vi.fn();
    const galeria = crearGaleria({
      videos: VIDEOS,
      alElegir: () => undefined,
      alPedirMiniatura: () => cancelar,
    });

    galeria.cancelar();

    expect(cancelar).toHaveBeenCalledTimes(2);
  });

  it('sin videos, lo dice en castellano claro y no rompe', () => {
    const galeria = crearGaleria({ videos: [], alElegir: () => undefined });
    document.body.appendChild(galeria.elemento);

    expect(galeria.elemento.querySelectorAll('.js-video-tarjeta').length).toBe(0);
    expect(galeria.elemento.querySelector('.js-galeria__vacia')?.textContent).toContain(
      'Todavía no hay videos',
    );
  });

  it('pone el título grande de la pantalla', () => {
    const galeria = crearGaleria({ videos: VIDEOS, alElegir: () => undefined });

    expect(galeria.elemento.querySelector('.js-pantalla__titulo')?.textContent).toBe('Los videos');
  });
});

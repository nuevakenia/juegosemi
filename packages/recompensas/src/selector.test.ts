// @vitest-environment jsdom
/**
 * El selector de premios, probado sin navegador de verdad.
 *
 * Lo que tiene que ser cierto: que arranque con un botón grande que dice
 * "Cambiar el premio", que al abrirlo salgan las opciones como tarjetas
 * grandes, que tocar una avise cuál se eligió y la marque, y que sin premios
 * diga algo claro en vez de romperse.
 */
import { describe, expect, it } from 'vitest';
import type { Recompensa } from './catalogo.ts';
import { crearSelectorDeRecompensas } from './selector.ts';

const PREMIOS: Recompensa[] = [
  { id: 'casa-de-la-tia', episodio: 'viaje-casa-tia', tipo: 'video', titulo: 'La casa de la tía', archivo: 'casa-de-la-tia.mp4', texto: null },
  { id: 'video-de-la-prima', episodio: 'viaje-casa-tia', tipo: 'video', titulo: 'El video de la prima', archivo: 'video-de-la-prima.mp4', texto: null },
  { id: 'felicitacion', episodio: 'viaje-casa-tia', tipo: 'frase', titulo: 'Una felicitación', archivo: null, texto: '¡Lo lograste!' },
];

describe('el selector de premios', () => {
  it('arranca con el botón grande y sin el panel a la vista', () => {
    const selector = crearSelectorDeRecompensas({ recompensas: PREMIOS, alElegir: () => undefined });
    const boton = selector.elemento.querySelector('.js-selector__abrir');
    expect(boton).not.toBeNull();
    expect((boton?.textContent ?? '')).toContain('Cambiar el premio');
    expect(selector.elemento.querySelector('.js-selector__panel')).toBeNull();
  });

  it('al abrirlo salen una tarjeta grande por premio', () => {
    const selector = crearSelectorDeRecompensas({ recompensas: PREMIOS, alElegir: () => undefined });
    selector.abrir();

    const panel = selector.elemento.querySelector('.js-selector__panel');
    expect(panel).not.toBeNull();
    const tarjetas = selector.elemento.querySelectorAll('.js-selector__tarjeta');
    expect(tarjetas.length).toBe(PREMIOS.length);
    expect((panel?.textContent ?? '')).toContain('La casa de la tía');
    expect((panel?.textContent ?? '')).toContain('Una felicitación');
  });

  it('tocar una tarjeta avisa cuál se eligió y la marca "Elegido"', () => {
    const elegidos: string[] = [];
    const selector = crearSelectorDeRecompensas({
      recompensas: PREMIOS,
      elegidoId: 'casa-de-la-tia',
      alElegir: (premio) => elegidos.push(premio.id),
    });
    selector.abrir();

    const tarjetas = Array.from(selector.elemento.querySelectorAll<HTMLElement>('.js-selector__tarjeta'));
    const prima = tarjetas.find((t) => (t.textContent ?? '').includes('El video de la prima'));
    expect(prima).toBeDefined();
    prima?.click();

    expect(elegidos).toEqual(['video-de-la-prima']);
    expect(prima?.getAttribute('aria-pressed')).toBe('true');
    expect((prima?.textContent ?? '')).toContain('Elegido');
    // La que estaba elegida deja de estarlo.
    const casa = tarjetas.find((t) => (t.textContent ?? '').includes('La casa de la tía'));
    expect(casa?.getAttribute('aria-pressed')).toBe('false');
  });

  it('marcar() deja marcado el premio del día actual', () => {
    const selector = crearSelectorDeRecompensas({ recompensas: PREMIOS, elegidoId: 'casa-de-la-tia', alElegir: () => undefined });
    selector.abrir();
    selector.marcar('felicitacion');

    const tarjetas = Array.from(selector.elemento.querySelectorAll<HTMLElement>('.js-selector__tarjeta'));
    const frase = tarjetas.find((t) => (t.textContent ?? '').includes('Una felicitación'));
    expect(frase?.getAttribute('aria-pressed')).toBe('true');
    expect(frase?.classList.contains('js-selector__tarjeta--elegida')).toBe(true);
  });

  it('cerrar deja el panel fuera de la vista', () => {
    const selector = crearSelectorDeRecompensas({ recompensas: PREMIOS, alElegir: () => undefined });
    selector.abrir();
    expect(selector.elemento.querySelector('.js-selector__panel')).not.toBeNull();
    selector.cerrar();
    expect(selector.elemento.querySelector('.js-selector__panel')).toBeNull();
  });

  it('sin premios, lo dice en castellano claro (nunca rompe)', () => {
    const selector = crearSelectorDeRecompensas({ recompensas: [], alElegir: () => undefined });
    selector.abrir();
    expect((selector.elemento.textContent ?? '')).toContain('No hay premios');
  });
});

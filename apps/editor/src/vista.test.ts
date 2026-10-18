// @vitest-environment jsdom
/**
 * La pantalla del editor, tocada como la va a tocar un chico.
 *
 * La prueba de verdad es esta: se arma una regla entera TOCANDO BOTONES (nueva
 * regla → cuándo → quién → entonces) y se comprueba que queda escrita en la lista,
 * que la frase sale en castellano, que el nivel cierra y que se puede borrar.
 */
import { describe, expect, it } from 'vitest';
import type { NivelEnConstruccion } from './estado.ts';
import { nivelDeArranque } from './estado.ts';
import { crearEditor } from './vista.ts';
import { revisar } from './validar-editor.ts';

/** El primer botón cuyo texto contiene lo que se busca (revienta si no está). */
function botonCon(raiz: HTMLElement, texto: string): HTMLButtonElement {
  for (const boton of Array.from(raiz.querySelectorAll('button'))) {
    if ((boton.textContent ?? '').includes(texto)) return boton;
  }
  const visibles = Array.from(raiz.querySelectorAll('button')).map((b) => b.textContent ?? '').join(' | ');
  throw new Error(`no encontré el botón "${texto}". Los que hay: ${visibles}`);
}

/** El bloque de una pregunta por el texto de su título (revienta si no está). */
function pregunta(raiz: HTMLElement, titulo: string): HTMLElement {
  for (const bloque of Array.from(raiz.querySelectorAll<HTMLElement>('.pregunta'))) {
    if ((bloque.querySelector('.pregunta__titulo')?.textContent ?? '').includes(titulo)) return bloque;
  }
  throw new Error(`no encontré la pregunta "${titulo}"`);
}

function editor() {
  let probado: NivelEnConstruccion | null = null;
  const creado = crearEditor({
    nivel: nivelDeArranque(),
    alProbar: (nivel) => {
      probado = nivel;
    },
  });
  return { creado, probado: () => probado };
}

describe('la pantalla del editor', () => {
  it('arranca sin reglas, con las cosas del juego a la vista y sin poder probar', () => {
    const { creado } = editor();
    expect(creado.elemento.querySelector('.reglas__vacio')).not.toBeNull();
    expect((creado.elemento.textContent ?? '')).toContain('Lo que tiene el juego');
    expect((creado.elemento.textContent ?? '')).toContain('la maleta');
    expect(botonCon(creado.elemento, 'Probar el juego').disabled).toBe(true);
    expect((creado.elemento.textContent ?? '')).toContain('Todavía falta algo');
  });

  it('arma una regla entera tocando botones y la ve escrita en castellano', () => {
    const { creado, probado } = editor();
    const raiz = creado.elemento;

    botonCon(raiz, 'Nueva regla').click();
    // El cuándo se abre solo; se elige "Suelta algo sobre algo".
    botonCon(raiz, 'Suelta algo sobre algo').click();
    // Se abre el quién: ¿sobre qué lo suelta? → el auto.
    botonCon(pregunta(raiz, '¿Sobre qué lo suelta?'), 'el auto').click();
    // Y ¿qué es lo que suelta? → la maleta (con la pantalla ya repintada).
    botonCon(pregunta(raiz, '¿Qué suelta?'), 'la maleta').click();
    // Se abre el entonces y se agregan dos cosas.
    botonCon(raiz, 'Elegir qué hace').click();
    botonCon(raiz, 'desaparece').click();
    botonCon(raiz, 'suma').click();
    botonCon(pregunta(raiz, '¿A qué contador?'), 'maletas').click();

    const frase = raiz.querySelector('.regla__frase')?.textContent ?? '';
    expect(frase).toBe('Cuando Emiliano suelta la maleta sobre el auto: desaparece lo que se suelta y suma 1 a maletas');

    const nivel = creado.nivel();
    expect(nivel.reglas.length).toBe(1);
    expect(nivel.reglas[0]?.cuandoId).toBe('suelta_sobre');
    expect(nivel.reglas[0]?.acciones.map((a) => a.entoncesId)).toEqual(['desaparece', 'suma']);

    // Con la regla completa, el nivel cierra y se puede probar.
    expect(revisar(nivel).ok).toBe(true);
    expect(botonCon(raiz, 'Probar el juego').disabled).toBe(false);
    botonCon(raiz, 'Probar el juego').click();
    expect(probado()?.reglas.length).toBe(1);
    expect(probado()?.reglas[0]?.acciones.length).toBe(2);
  });

  it('borra una regla con el botón grande', () => {
    const { creado } = editor();
    const raiz = creado.elemento;
    botonCon(raiz, 'Nueva regla').click();
    expect(creado.nivel().reglas.length).toBe(1);
    botonCon(raiz, 'Borrar la regla').click();
    expect(creado.nivel().reglas.length).toBe(0);
    expect(raiz.querySelector('.reglas__vacio')).not.toBeNull();
  });

  it('sólo ofrece las acciones que tienen sentido con el cuándo elegido', () => {
    const { creado } = editor();
    const raiz = creado.elemento;
    botonCon(raiz, 'Nueva regla').click();
    botonCon(raiz, 'Toca algo').click();
    botonCon(pregunta(raiz, '¿Qué toca?'), 'la maleta').click();
    botonCon(raiz, 'Elegir qué hace').click();

    // Cada botón trae su pictograma pegado al texto, así que se mira el contenido.
    const ofrecidas = Array.from(raiz.querySelectorAll('.panel .opcion')).map((b) => b.textContent ?? '').join(' | ');
    expect(ofrecidas).toContain('desaparece');
    expect(ofrecidas).not.toContain('video');
    expect(ofrecidas).not.toContain('termina el nivel');
  });

  it('agrega y saca cosas del juego desde la pantalla', () => {
    const { creado } = editor();
    const raiz = creado.elemento;
    const entradas = Array.from(raiz.querySelectorAll<HTMLInputElement>('.agregar .campo'));
    const entidad = entradas[0];
    expect(entidad).toBeDefined();
    if (entidad === undefined) return;
    entidad.value = 'La casa';
    botonCon(raiz, 'Agregar').click();
    expect(creado.nivel().entidades.map((c) => c.nombre)).toContain('La casa');
  });
});

// @vitest-environment jsdom
/**
 * La vista de misiones, tocada como la va a tocar un chico: se agrega una misión,
 * se elige cómo se cumple, se arman los prerrequisitos EN ORDEN con los botones
 * grandes, se le pone el premio con el selector y se avisa si hay una rueda.
 */
import { describe, expect, it } from 'vitest';
import { nivelDeArranque } from './estado.ts';
import { crearEditor } from './vista.ts';

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

/** La fila de un prerrequisito por el nombre que muestra. */
function filaAntes(raiz: HTMLElement, nombre: string): HTMLElement {
  for (const fila of Array.from(raiz.querySelectorAll<HTMLElement>('.antes__fila'))) {
    if ((fila.querySelector('.antes__nombre')?.textContent ?? '') === nombre) return fila;
  }
  throw new Error(`no encontré la fila de "${nombre}"`);
}

/** La tarjeta de una misión por su id (revienta si no está). */
function tarjetaDe(raiz: HTMLElement, id: string): HTMLElement {
  const tarjeta = raiz.querySelector<HTMLElement>(`[data-mision="${id}"]`);
  if (tarjeta === null) throw new Error(`no encontré la tarjeta de "${id}"`);
  return tarjeta;
}

function editor() {
  const creado = crearEditor({ nivel: nivelDeArranque(), alProbar: () => undefined });
  const raiz = creado.elemento;
  return { creado, raiz };
}

/** Agrega una misión con ese nombre y devuelve su id. */
function agregarMision(raiz: HTMLElement, nombre: string): void {
  const campo = raiz.querySelector<HTMLInputElement>('.misiones .agregar .campo');
  if (campo === null) throw new Error('no encontré el campo de misión nueva');
  campo.value = nombre;
  botonCon(raiz, 'Agregar misión').click();
}

/** Toca un botón grande DENTRO de la tarjeta de esa misión (el DOM se repinta). */
function toca(raiz: HTMLElement, misionId: string, texto: string): void {
  botonCon(tarjetaDe(raiz, misionId), texto).click();
}

/** Le elige el cómo-se-cumple: el contador «maletas» llega a 3. */
function cumpleConContador(raiz: HTMLElement, misionId: string): void {
  toca(raiz, misionId, 'Un contador llega a un número');
  botonCon(pregunta(tarjetaDe(raiz, misionId), '¿Cuál contador?'), 'maletas').click();
  const cuanto = pregunta(tarjetaDe(raiz, misionId), '¿Llega a cuántos?').querySelector<HTMLInputElement>('input');
  if (cuanto !== null) {
    cuanto.value = '3';
    cuanto.dispatchEvent(new Event('change'));
  }
}

describe('la vista de misiones', () => {
  it('lista las misiones en castellano y arranca vacía', () => {
    const { raiz } = editor();
    expect((raiz.textContent ?? '')).toContain('Las misiones');
    expect((raiz.textContent ?? '')).toContain('Todavía no hay misiones');
  });

  it('arma una misión entera tocando botones y la lee en castellano', () => {
    const { creado, raiz } = editor();
    agregarMision(raiz, 'subir las maletas');
    cumpleConContador(raiz, 'subir-las-maletas');

    const mision = creado.nivel().misiones[0];
    expect(mision?.id).toBe('subir-las-maletas');
    expect(mision?.cumpleId).toBe('contador');
    expect(mision?.cumpleValores['contador']).toBe('maletas');
    expect(mision?.cumpleValores['al_menos']).toBe(3);

    const frase = raiz.querySelector('.mision__frase')?.textContent ?? '';
    expect(frase).toContain('Cuando el contador maletas llega a 3');
    expect(frase).toContain('antes: nada antes');
    expect(frase).toContain('premio: sin premio');
  });

  it('ordena los prerrequisitos con los botones grandes (el orden manda)', () => {
    const { creado, raiz } = editor();
    agregarMision(raiz, 'alfa');
    cumpleConContador(raiz, 'alfa');
    agregarMision(raiz, 'beta');
    cumpleConContador(raiz, 'beta');
    agregarMision(raiz, 'gamma');
    cumpleConContador(raiz, 'gamma');

    // A la misión gamma le ponemos antes beta y alfa, en ese orden.
    toca(raiz, 'gamma', 'Elegir qué va antes');
    toca(raiz, 'gamma', 'beta');
    toca(raiz, 'gamma', 'alfa');
    let gamma = creado.nivel().misiones.find((m) => m.id === 'gamma');
    expect(gamma?.requiere).toEqual(['beta', 'alfa']);

    // Con el botón grande se cambia el orden: alfa pasa adelante.
    botonCon(filaAntes(raiz, 'alfa'), 'Subir').click();
    gamma = creado.nivel().misiones.find((m) => m.id === 'gamma');
    expect(gamma?.requiere).toEqual(['alfa', 'beta']);

    // Y con «Sacar» se va de la lista.
    const fila = filaAntes(raiz, 'beta');
    const sacar = Array.from(fila.querySelectorAll('button')).find((b) => (b.textContent ?? '').includes('Sacar'));
    expect(sacar).toBeDefined();
    sacar?.click();
    gamma = creado.nivel().misiones.find((m) => m.id === 'gamma');
    expect(gamma?.requiere).toEqual(['alfa']);
  });

  it('avisa en castellano si el orden se muerde la cola', () => {
    const { raiz } = editor();
    agregarMision(raiz, 'uno');
    cumpleConContador(raiz, 'uno');
    agregarMision(raiz, 'dos');
    cumpleConContador(raiz, 'dos');

    // Dos se pide después de uno…
    toca(raiz, 'dos', 'Elegir qué va antes');
    toca(raiz, 'dos', 'uno');
    // …y uno después de dos: rueda.
    toca(raiz, 'uno', 'Elegir qué va antes');
    toca(raiz, 'uno', 'dos');

    const aviso = raiz.querySelector('.aviso--ciclo');
    expect(aviso).not.toBeNull();
    expect(aviso?.textContent ?? '').toContain('rueda');
  });

  it('le pone el premio a una misión con el selector de premios', () => {
    const { creado, raiz } = editor();
    agregarMision(raiz, 'llegar');
    cumpleConContador(raiz, 'llegar');

    toca(raiz, 'llegar', 'Elegir el premio');
    toca(raiz, 'llegar', 'Ver los videos');
    toca(raiz, 'llegar', 'La casa de la tía');

    expect(creado.nivel().misiones[0]?.recompensa).toBe('casa-de-la-tia');
    expect(raiz.querySelector('.mision__frase')?.textContent ?? '').toContain('el video «La casa de la tía»');
  });

  it('borra una misión con el botón grande', () => {
    const { creado, raiz } = editor();
    agregarMision(raiz, 'llegar');
    toca(raiz, 'llegar', 'Borrar la misión');
    expect(creado.nivel().misiones.length).toBe(0);
  });
});

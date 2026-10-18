/**
 * El ESTADO del taller: qué eligió Emiliano hasta ahora.
 *
 * Es PURA a propósito: no toca el DOM, ni el almacenamiento, ni el render. Sólo
 * guarda la elección (paleta, catálogo de caras y un índice por parte de la cara)
 * y sabe traducirla a datos. Así el taller se puede probar sin navegador y la
 * pantalla (main.ts) queda como simple cableado.
 *
 * Las caras se eligen por ÍNDICE, como los Miis ("Ojos 1", "Ojos 2"...): el niño
 * no necesita saber el id de la textura, sólo que hay varias y puede probarlas.
 * Cuando exista el arte, las texturas entran por el render sin tocar esta capa.
 */

import type { CatalogoCaras, RasgoPieza } from '@juegosemi/personajes';
import { rasgosDeCara } from '@juegosemi/personajes';

/** Las partes de la cara que el taller deja elegir (las que arma `rasgosDeCara`). */
export type Parte = 'ojos' | 'cejas' | 'nariz' | 'pelo';

/** El orden en que se muestran las partes. */
export const PARTES: readonly Parte[] = ['ojos', 'cejas', 'nariz', 'pelo'];

/**
 * La clave del catálogo de caras para cada parte.
 * Ojo: el catálogo usa plural para algunas ("narices", "pelos"); acá se traduce
 * para que el resto del código hable de la parte, no de cómo se llama la lista.
 */
const CLAVE_EN_CATALOGO: Record<Parte, 'ojos' | 'cejas' | 'narices' | 'pelos'> = {
  ojos: 'ojos',
  cejas: 'cejas',
  nariz: 'narices',
  pelo: 'pelos',
};

/** La elección completa del taller. */
export interface Seleccion {
  /** Id real de la paleta del catálogo. */
  idPaleta: string;
  /** Id real del catálogo de caras. */
  idCara: string;
  /** Un índice por parte de la cara (dentro de la lista que trae el catálogo). */
  indices: Record<Parte, number>;
  /** Borde oscuro estilo South Park. Encendido de fábrica: se ve más claro. */
  contorno: boolean;
}

/** La elección con la que abre el taller la primera vez. */
export function seleccionInicial(idPaleta: string, idCara: string): Seleccion {
  return {
    idPaleta,
    idCara,
    indices: { ojos: 0, cejas: 0, nariz: 0, pelo: 0 },
    contorno: true,
  };
}

/** Devuelve una copia con la paleta cambiada (no muta la original). */
export function conPaleta(seleccion: Seleccion, idPaleta: string): Seleccion {
  return { ...seleccion, idPaleta };
}

/** Devuelve una copia con el catálogo de caras cambiado. */
export function conCara(seleccion: Seleccion, idCara: string): Seleccion {
  return { ...seleccion, idCara };
}

/** Devuelve una copia con el contorno encendido o apagado. */
export function conContorno(seleccion: Seleccion, contorno: boolean): Seleccion {
  return { ...seleccion, contorno };
}

/**
 * Devuelve una copia con el índice de una parte cambiado, dando la vuelta sobre
 * la cantidad de opciones: pasar del último vuelve al primero. Así el botón
 * "siguiente" nunca se queda sin nada que mostrar.
 */
export function conIndice(seleccion: Seleccion, parte: Parte, indice: number, cantidad: number): Seleccion {
  const total = cantidad > 0 ? cantidad : 1;
  const acotado = ((Math.trunc(indice) % total) + total) % total;
  return { ...seleccion, indices: { ...seleccion.indices, [parte]: acotado } };
}

/** La lista de opciones de una parte, tal como viene del catálogo de caras. */
export function opcionesDeParte(catalogo: CatalogoCaras, parte: Parte): readonly string[] {
  return catalogo[CLAVE_EN_CATALOGO[parte]];
}

/** El título visible de un grupo de opciones ("Ojos", "Pelo"...). */
export function etiquetaDeParte(parte: Parte): string {
  switch (parte) {
    case 'ojos':
      return 'Ojos';
    case 'cejas':
      return 'Cejas';
    case 'nariz':
      return 'Nariz';
    case 'pelo':
      return 'Pelo';
  }
}

/** El texto de un botón de opción, estilo Mii: "Ojos 2". */
export function textoBoton(parte: Parte, indice: number): string {
  return `${etiquetaDeParte(parte)} ${indice + 1}`;
}

/**
 * Traduce la elección a RASGOS del rig, listos para `armar`. Se pide por índice
 * (un número en texto, que es lo que entiende `rasgosDeCara`), de modo que la
 * pantalla nunca maneja ids de textura.
 */
export function rasgosDeSeleccion(seleccion: Seleccion, catalogo: CatalogoCaras): Record<string, RasgoPieza> {
  return rasgosDeCara(catalogo, {
    ojos: String(seleccion.indices.ojos),
    cejas: String(seleccion.indices.cejas),
    nariz: String(seleccion.indices.nariz),
    pelo: String(seleccion.indices.pelo),
  });
}

/**
 * Deja la elección dentro de los límites del catálogo. Se usa al leer lo guardado:
 * si el arte cambió y ahora hay menos caras, un índice viejo no puede quedar fuera
 * de rango (el niño vería una parte "fantasma").
 */
export function acotarSeleccion(seleccion: Seleccion, catalogo: CatalogoCaras): Seleccion {
  const indices: Record<Parte, number> = { ojos: 0, cejas: 0, nariz: 0, pelo: 0 };
  for (const parte of PARTES) {
    const cantidad = opcionesDeParte(catalogo, parte).length;
    const valor = seleccion.indices[parte];
    indices[parte] = cantidad <= 0 ? 0 : Math.min(Math.max(0, Math.trunc(valor)), cantidad - 1);
  }
  return { ...seleccion, indices };
}

/** ¿El dato tiene forma de `Seleccion`? Es el filtro de lo que se lee del disco. */
export function esSeleccionValida(dato: unknown): dato is Seleccion {
  if (typeof dato !== 'object' || dato === null) return false;
  const candidato = dato as Record<string, unknown>;
  if (typeof candidato.idPaleta !== 'string' || candidato.idPaleta.length === 0) return false;
  if (typeof candidato.idCara !== 'string' || candidato.idCara.length === 0) return false;
  if (typeof candidato.contorno !== 'boolean') return false;
  const indices = candidato.indices;
  if (typeof indices !== 'object' || indices === null) return false;
  for (const parte of PARTES) {
    const valor = (indices as Record<string, unknown>)[parte];
    if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 0) return false;
  }
  return true;
}

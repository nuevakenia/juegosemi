/**
 * Revisar lo armado y decirlo en castellano claro.
 *
 * El editor no decide solo si un nivel cierra: le pregunta al validador de la
 * lógica (`validarNivel`), que es el mismo que corre el juego de verdad. Lo único
 * que se hace acá es TRADUCIR esos avisos al idioma de un grande que está armando
 * un juego ("a la regla 2 le falta elegir el cuándo"), nunca un `reglas[1].si`.
 *
 * Regla de oro: nada de feedback negativo. El aviso dice qué falta, no que algo
 * esté mal hecho, y la pantalla sigue viva.
 */
import { validarNivel } from '@juegosemi/logica';
import type { NivelEnConstruccion } from './estado.ts';
import { nivelLogico } from './construir.ts';

/** Lo que devuelve la revisión: si cierra y qué falta, en castellano. */
export interface RevisionEditor {
  ok: boolean;
  /** Un aviso corto por cada cosa que falta. */
  mensajes: string[];
}

/** El número de regla que aparece en un camino como `reglas[2].hacer[0]`. */
function numeroDeRegla(camino: string): number | null {
  const encontrado = camino.match(/reglas\[(\d+)\]/);
  if (encontrado === null || encontrado[1] === undefined) return null;
  return Number(encontrado[1]) + 1;
}

/** Traduce un error del validador a algo que se entienda de un tirón. */
export function mensajeAmable(error: string): string {
  const regla = numeroDeRegla(error);
  const cual = regla === null ? '' : `La regla ${regla}`;

  if (error.includes('no hace nada')) return `${cual} todavía no dice qué hace.`;
  if (error.includes('sin id')) return 'Hay una regla sin nombre.';
  if (error.includes('está repetido')) return 'Hay dos reglas con el mismo nombre.';
  if (error.includes('no sé qué condición es')) return `${cual} todavía no tiene un cuándo.`;
  if (error.includes('acción desconocida')) return `${cual} pide algo que no sé hacer.`;
  if (error.includes('gesto desconocido')) return `${cual} pide un gesto que no existe.`;
  if (error.startsWith('id:')) return 'El juego necesita un nombre.';
  if (error.startsWith('misiones:')) return 'Las misiones se pisan: revisá el orden (eso se arma en la otra pantalla).';
  if (error.includes('que no existe')) return 'Hay una misión que pide otra que no está.';
  return `Algo no cierra: ${error}`;
}

/** El aviso general cuando el nivel está incompleto. */
export const AVISO_INCOMPLETO = 'Todavía falta algo para poder probarlo.';

/** El aviso cuando todo cierra. */
export const AVISO_LISTO = 'Todo listo: probá el juego cuando quieras.';

/** Corre el validador de la lógica y traduce el resultado. */
export function revisar(nivel: NivelEnConstruccion): RevisionEditor {
  // Un juego sin reglas no se puede probar: no pasa nada cuando se toca algo.
  if (nivel.reglas.length === 0) {
    return { ok: false, mensajes: ['Todavía no hay ninguna regla. Tocá «Nueva regla».'] };
  }
  const resultado = validarNivel(nivelLogico(nivel));
  if (resultado.ok) return { ok: true, mensajes: [] };
  const vistos: string[] = [];
  for (const error of resultado.errores) {
    const mensaje = mensajeAmable(error);
    if (vistos.indexOf(mensaje) === -1) vistos.push(mensaje);
  }
  return { ok: false, mensajes: vistos };
}

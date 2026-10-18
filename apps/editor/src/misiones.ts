/**
 * Las misiones vistas desde el editor: quién puede ir antes que quién, y avisar
 * cuando las misiones se piden en rueda.
 *
 * No hay dos validadores: la detección del ciclo la hace el MISMO validador de la
 * lógica (`validarNivel`, en `packages/logica/src/validar.ts`), que ya sabe
 * recorrer los prerrequisitos. Acá sólo se corre y se traduce su aviso a
 * castellano claro, para que el grande entienda qué arreglar sin leer un `id`.
 *
 * Regla de oro: nada de feedback negativo. El aviso dice qué pasa y qué se puede
 * hacer, y la pantalla sigue viva.
 */
import { validarNivel } from '@juegosemi/logica';
import type { MisionEditor, NivelEnConstruccion } from './estado.ts';
import { nombreDe } from './estado.ts';
import { nivelLogico } from './construir.ts';

/** La marca que deja `validarNivel` cuando hay una rueda de prerrequisitos. */
const MARCA_DE_CICLO = 'ciclo de prerrequisitos';

/**
 * El aviso en castellano si las misiones se piden entre ellas y nunca se puede
 * empezar por ninguna. Devuelve null cuando el orden cierra.
 */
export function avisoDeCiclo(nivel: NivelEnConstruccion): string | null {
  if (nivel.misiones.length === 0) return null;
  const resultado = validarNivel(nivelLogico(nivel));
  for (const error of resultado.errores) {
    if (error.includes(MARCA_DE_CICLO)) {
      const cual = idDelError(error);
      const nombre = cual === null ? 'una de ellas' : `«${nombreDe(nivel, cual)}»`;
      return `Las misiones se piden en rueda: ${nombre} quedaría esperando a otra que también la espera a ella, y así nunca se puede empezar. Sacale un «antes» a alguna.`;
    }
  }
  return null;
}

/** El id que `validarNivel` puso entre comillas en el aviso del ciclo, si lo hay. */
export function idDelError(error: string): string | null {
  const encontrado = error.match(/"([^"]+)"/);
  if (encontrado === null || encontrado[1] === undefined) return null;
  return encontrado[1];
}

/** Las otras misiones: las que se pueden elegir como «antes». */
export function candidatasARequisito(nivel: NivelEnConstruccion, misionId: string): MisionEditor[] {
  return nivel.misiones.filter((mision) => mision.id !== misionId);
}

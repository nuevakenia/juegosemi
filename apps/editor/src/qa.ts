/**
 * El HOOK DE QA del modo Probar: dejar el tablero a mano en la consola.
 *
 * Mientras se prueba un nivel, acá queda un objeto colgado de la ventana
 * (`window.juegosemi`) con la ESCENA, la LÓGICA, el PUENTE y el botón para
 * volver. Sirve para MEDIR el efecto de una regla sin adivinar: se mira el
 * contador de verdad después de soltar una pieza, o se lee el estado del mundo.
 *
 *   juegosemi.logica.mundo.contador('maletas')   → cuántas maletas van
 *   juegosemi.logica.estado()                    → mundo, misiones y si terminó
 *   juegosemi.puente.soltar('maleta', 'auto')    → disparar la regla a mano
 *   juegosemi.volver()                           → volver al editor
 *
 * No hay internet ni nada raro: es sólo una referencia a lo que ya está andando.
 * Al volver al editor, el hook se saca (no queda basura colgando).
 */
import type { Logica, Puente } from '@juegosemi/logica';
import type { Escena } from '@juegosemi/motor';

/** Las piezas vivas que quedan a mano durante la prueba. */
export interface PiezasQa {
  /** La escena del motor: las entidades y sus zonas. */
  escena: Escena;
  /** La lógica del nivel, con su mundo y sus misiones. */
  logica: Logica;
  /** El puente: disparar eventos y avanzar un paso a mano. */
  puente: Puente;
  /** Volver al editor (lo mismo que el botón grande). */
  volver: () => void;
}

/** El nombre con que el hook queda colgado de la ventana. */
export const NOMBRE_HOOK = 'juegosemi';

/** Publica (o saca, con null) el hook en la ventana. */
export function publicarQa(piezas: PiezasQa | null): void {
  const ventana = window as unknown as Record<string, unknown>;
  if (piezas === null) {
    delete ventana[NOMBRE_HOOK];
    return;
  }
  ventana[NOMBRE_HOOK] = piezas;
}

/** El hook que está colgado ahora, o null si no se está probando. */
export function leerQa(): PiezasQa | null {
  const ventana = window as unknown as Record<string, unknown>;
  const hook = ventana[NOMBRE_HOOK];
  if (typeof hook !== 'object' || hook === null) return null;
  return hook as PiezasQa;
}

/**
 * Lee un contador a través del hook (o null si no hay prueba andando). Es el
 * atajo para lo que más se mide: el efecto de una regla sobre un contador.
 */
export function contadorDeQa(nombre: string): number | null {
  const hook = leerQa();
  if (hook === null) return null;
  return hook.logica.mundo.contador(nombre);
}

/**
 * Meter el premio del día DENTRO del nivel, sin tocar el código del juego.
 *
 * El nivel ya guarda el nombre del premio en las variables del mundo
 * (`$premio-del-dia`) y lo paga con su recompensa. Lo único que hace falta es
 * dejar ahí el premio elegido; esta es la pieza que lo hace. La usa el juego al
 * arrancar y la va a usar el editor de niveles cuando escriba un nivel nuevo.
 *
 * Se devuelve una COPIA del nivel: el que vino de los datos no se toca.
 */
import type { Nivel } from '@juegosemi/logica';
import type { Recompensa } from './catalogo.ts';
import { VARIABLE_PREMIO_DEL_DIA } from './premio-del-dia.ts';

/** Devuelve el nivel con el premio del día puesto en sus variables del mundo. */
export function conPremioDelDia(nivel: Nivel, premio: Recompensa): Nivel {
  const mundo = nivel.mundo ?? {};
  const variables = { ...(mundo.variables ?? {}), [VARIABLE_PREMIO_DEL_DIA]: premio.id };
  return { ...nivel, mundo: { ...mundo, variables } };
}

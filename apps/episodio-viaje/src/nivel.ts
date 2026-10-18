/**
 * El nivel del episodio, leído de los DATOS.
 *
 * El recorrido no está en código: está en `packages/logica/data/viaje-casa-tia.json`
 * (maletas → auto → manivela → casa → premio). Acá sólo se trae y se tipa, para que
 * la app se juegue de punta a punta sin que nadie programe las reglas.
 *
 * Ojo: si mañana el editor escribe el mismo archivo con otro contenido, la app no
 * cambia ni una línea.
 */
import type { Nivel } from '@juegosemi/logica';
import datos from '../../../packages/logica/data/viaje-casa-tia.json';

/** El nivel del viaje a la casa de la tía, tal cual sale del archivo. */
export const NIVEL: Nivel = datos as unknown as Nivel;

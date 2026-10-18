/**
 * El PREMIO DEL DÍA: cuál de los premios del catálogo se va a usar, y que quede
 * guardado para la próxima vez.
 *
 * Vive sobre el PUERTO de almacenamiento (`PuertoAlmacenamiento`), no sobre
 * `localStorage` directo: igual que `apps/taller/src/guardado.ts`, así se prueba
 * con un almacén de mentira y el día que la tablet necesite otro backend no se
 * toca esta capa.
 *
 * Lo único que se guarda es el ID del premio (`"video-de-la-prima"`), en texto
 * plano: el nombre de la variable del mundo que ya usa el nivel (`premio-del-dia`).
 * Con eso, cambiar el premio del día es escribir ese id, y el nivel lo paga solo.
 *
 * Regla de oro: si lo guardado no sirve (un id viejo, un JSON roto, un premio de
 * otro episodio), se cae al primer premio del episodio. El niño nunca se queda
 * sin premio.
 */
import type { PuertoAlmacenamiento } from '@juegosemi/puertos';
import { crearAlmacenamientoLocal } from '@juegosemi/adaptadores-web';
import type { Recompensa } from './catalogo.ts';
import {
  RECOMPENSAS,
  RECOMPENSA_POR_DEFECTO,
  recompensaPorId,
  recompensasDeEpisodio,
} from './catalogo.ts';

/** La clave con que se guarda el premio del día dentro del espacio de premios. */
export const CLAVE_PREMIO_DEL_DIA = 'premio-del-dia';

/**
 * El nombre de la variable del mundo que guarda el nivel para decir cuál es el
 * premio (`reproducir_video($premio-del-dia)`). Es el mismo nombre de siempre.
 */
export const VARIABLE_PREMIO_DEL_DIA = 'premio-del-dia';

/** El almacén de premios, con su propio espacio para no pisar el de otros juegos. */
export function crearAlmacenRecompensas(): PuertoAlmacenamiento {
  return crearAlmacenamientoLocal('recompensas');
}

/** Guarda el id del premio del día. Si el almacenamiento falla, sólo no recuerda. */
export function guardarPremioDelDia(almacen: PuertoAlmacenamiento, id: string): void {
  almacen.guardar(CLAVE_PREMIO_DEL_DIA, id);
}

/**
 * El id del premio guardado, o null si no hay nada o está corrupto.
 * Se valida la forma al leer: un valor viejo o mal escrito no puede romper la
 * pantalla cuando Emiliano la abre.
 */
export function leerPremioDelDia(almacen: PuertoAlmacenamiento): string | null {
  const dato = almacen.leer<unknown>(CLAVE_PREMIO_DEL_DIA);
  if (typeof dato !== 'string') return null;
  const limpio = dato.trim();
  return limpio.length > 0 ? limpio : null;
}

/**
 * El premio del día para un episodio: lo guardado si existe y es de este
 * episodio; si no, el primero del episodio; y si el catálogo viene vacío, el de
 * por defecto. Nunca devuelve null.
 */
export function premioDelDia(
  almacen: PuertoAlmacenamiento,
  episodio: string,
  todas: readonly Recompensa[] = RECOMPENSAS,
): Recompensa {
  const guardado = leerPremioDelDia(almacen);
  if (guardado !== null) {
    const elegida = recompensaPorId(guardado, todas);
    if (elegida !== null && elegida.episodio === episodio) return elegida;
  }
  const primero = recompensasDeEpisodio(episodio, todas)[0];
  return primero ?? RECOMPENSA_POR_DEFECTO;
}

/** Elige y guarda el premio del día (lo que hace el selector al tocar una tarjeta). */
export function elegirPremioDelDia(almacen: PuertoAlmacenamiento, recompensa: Recompensa): void {
  guardarPremioDelDia(almacen, recompensa.id);
}

/** Borra el premio guardado (por si hay que empezar de cero). */
export function borrarPremioDelDia(almacen: PuertoAlmacenamiento): void {
  almacen.borrar(CLAVE_PREMIO_DEL_DIA);
}

/**
 * Guardar y recuperar el personaje del taller.
 *
 * Vive sobre el PUERTO de almacenamiento (`PuertoAlmacenamiento`), no sobre
 * `localStorage` directo: así se prueba con un almacén de mentira y el día que la
 * tablet necesite otro backend (almacenamiento nativo), no se toca esta capa.
 *
 * En el WebView viejo de la tablet, `localStorage` puede fallar; el adaptador ya
 * lo atrapa y devuelve null, y acá eso se traduce a "no había nada guardado":
 * el taller abre con la elección por defecto y no se cae nunca.
 */

import type { PuertoAlmacenamiento } from '@juegosemi/puertos';
import { crearAlmacenamientoLocal } from '@juegosemi/adaptadores-web';
import type { Seleccion } from './estado.ts';
import { esSeleccionValida } from './estado.ts';

/** La clave con que se guarda la selección dentro del espacio del taller. */
export const CLAVE_SELECCION = 'seleccion';

/** El almacén del taller, con su propio espacio para no pisar el de otros juegos. */
export function crearAlmacenTaller(): PuertoAlmacenamiento {
  return crearAlmacenamientoLocal('taller');
}

/** Guarda la elección. Si el almacenamiento falla, no pierde nada: sólo no recuerda. */
export function guardarSeleccion(almacen: PuertoAlmacenamiento, seleccion: Seleccion): void {
  almacen.guardar(CLAVE_SELECCION, seleccion);
}

/**
 * Devuelve la elección guardada, o null si no hay nada o está corrupta.
 * Se valida la forma al leer: un JSON viejo o mal escrito no puede romper la
 * pantalla cuando Emiliano la abre.
 */
export function leerSeleccion(almacen: PuertoAlmacenamiento): Seleccion | null {
  const dato = almacen.leer<unknown>(CLAVE_SELECCION);
  return esSeleccionValida(dato) ? dato : null;
}

/** Borra la elección guardada (por si hay que empezar de cero). */
export function borrarSeleccion(almacen: PuertoAlmacenamiento): void {
  almacen.borrar(CLAVE_SELECCION);
}

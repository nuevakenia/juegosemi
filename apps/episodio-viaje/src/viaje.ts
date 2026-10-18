/**
 * En qué momento del viaje está Emiliano.
 *
 * No hay un estado propio: la fase se DEDUCE del mundo del nivel, que es el que
 * sabe de verdad qué pasó. Así no pueden quedar dos verdades desincronizadas (la
 * pantalla por un lado y la lógica por otro).
 *
 *   cargando   todavía no están las tres maletas en el auto
 *   manivela   el viaje arrancó y la lógica está pidiendo girar la manivela
 *   manejando  la manivela ya se giró: queda manejar hasta la casa
 *   llegada    el auto entró en la zona de la casa (acá sale el premio)
 */
import type { Logica } from '@juegosemi/logica';

export type FaseViaje = 'cargando' | 'manivela' | 'manejando' | 'llegada';

/** Las llaves del mundo que usan las reglas del nivel. */
export const OBJETO_VIAJE = 'viaje-activo';
export const OBJETO_EN_LA_CASA = 'en-la-casa';

/** El gesto pedido para arrancar el auto, y sobre qué se hace. */
export const GESTO_MANIVELA = 'circulo';
export const OBJETIVO_MANIVELA = 'manivela';

/** La fase del viaje, mirando el mundo y el gesto pedido. */
export function faseDelViaje(logica: Logica): FaseViaje {
  if (!logica.mundo.activo(OBJETO_VIAJE)) return 'cargando';
  if (logica.eventos.gestoPedido(GESTO_MANIVELA, OBJETIVO_MANIVELA) !== null) return 'manivela';
  if (logica.mundo.activo(OBJETO_EN_LA_CASA)) return 'llegada';
  return 'manejando';
}

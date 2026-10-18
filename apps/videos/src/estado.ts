/**
 * El estado del lector de videos: en qué pantalla está Emiliano y qué video
 * tiene a mano. Es puro (nada de DOM, nada de timers), así se prueba entero sin
 * navegador.
 *
 * Tres pantallas nada más:
 *   galeria        → elige qué ver
 *   reproduciendo  → lo está viendo a pantalla completa
 *   aviso          → ese video no se puede ver acá (se avisa y se vuelve)
 *
 * Regla de oro metida en los datos: el aviso NO es un error. Es una frase en
 * castellano claro, sin signos de alarma, que dice qué pasa y qué hacer. Nunca
 * hay un estado "falló" ni un "quedó pegado".
 */

/** Las pantallas del lector. */
export type PantallaVideos = 'galeria' | 'reproduciendo' | 'aviso';

export interface EstadoVideos {
  pantalla: PantallaVideos;
  /** El id del video en curso (o del que no se pudo ver), o null. */
  video: string | null;
  /** La frase clara que se muestra cuando la pantalla es `aviso`. */
  aviso: string | null;
}

/**
 * Cuánto se deja el aviso en pantalla antes de volver solo a la galería.
 * Es un respiro para leer, no una espera: igual hay un botón grande para volver.
 */
export const ESPERA_AVISO_MS = 8000;

/** Cómo arranca la app: en la galería, con las manos vacías. */
export function estadoInicial(): EstadoVideos {
  return { pantalla: 'galeria', video: null, aviso: null };
}

/** Se eligió un video: a verlo. */
export function abrirVideo(estado: EstadoVideos, id: string): EstadoVideos {
  if (estado.pantalla === 'reproduciendo' && estado.video === id) return estado;
  return { pantalla: 'reproduciendo', video: id, aviso: null };
}

/** Ese video no se puede ver en esta pantalla: se avisa, sin drama. */
export function avisarQueNoSePuedeVer(estado: EstadoVideos, titulo: string): EstadoVideos {
  return { pantalla: 'aviso', video: estado.video, aviso: textoDeNoSePuedeVer(titulo) };
}

/** De vuelta a elegir, con todo limpio. */
export function volverALaGaleria(): EstadoVideos {
  return estadoInicial();
}

/**
 * La frase del aviso, siempre en castellano de Chile y sin cara de error:
 * dice qué pasa, que no pasa nada y qué hacer ahora.
 */
export function textoDeNoSePuedeVer(titulo: string): string {
  const nombre = titulo.trim().length > 0 ? titulo.trim() : 'Este video';
  return `El video "${nombre}" no se puede ver acá. No pasa nada: volvamos a elegir otro.`;
}

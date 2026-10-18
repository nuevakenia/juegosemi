/**
 * El catálogo de videos: la lista vive en DATOS, no en el código.
 *
 * `videos.json` tiene una línea por video (`id`, `titulo`, `archivo`). Agregar o
 * cambiar un video es editar esa línea; el archivo va en `assets/videos/` y el
 * empaquetador lo copia al paquete web (y de ahí al APK). Nada de internet.
 *
 * Regla de oro también acá: nada de esto falla. Si una línea viene mal escrita,
 * ese video no se muestra y el resto sigue andando; el niño nunca ve un error.
 */
import crudos from './videos.json';

/** Un video del catálogo, ya revisado. */
export interface VideoDatos {
  /** Identificador estable (el que usa la app para saber cuál se eligió). */
  id: string;
  /** El nombre grande que se ve en la tarjeta. */
  titulo: string;
  /** El archivo, dentro de `assets/videos/`. */
  archivo: string;
}

/** La carpeta donde quedan los videos dentro del paquete web. */
export const CARPETA_VIDEOS = 'assets/videos';

/** Un texto con contenido, o null si no sirve. */
function textoConContenido(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return limpio.length > 0 ? limpio : null;
}

/**
 * Convierte lo que venga del JSON en una lista de videos confiable.
 * Salta (en silencio) cualquier línea que no sirva y repetidos por `id`.
 */
export function normalizarVideos(crudos: unknown): VideoDatos[] {
  if (!Array.isArray(crudos)) return [];
  const yaVistos: string[] = [];
  const videos: VideoDatos[] = [];
  for (const crudo of crudos) {
    if (typeof crudo !== 'object' || crudo === null) continue;
    const registro = crudo as Record<string, unknown>;
    const id = textoConContenido(registro['id']);
    const titulo = textoConContenido(registro['titulo']);
    const archivo = textoConContenido(registro['archivo']);
    if (id === null || titulo === null || archivo === null) continue;
    if (yaVistos.indexOf(id) !== -1) continue;
    yaVistos.push(id);
    videos.push({ id, titulo, archivo });
  }
  return videos;
}

/** Los videos que trae la app, tal como salen de `videos.json`. */
export const VIDEOS: readonly VideoDatos[] = normalizarVideos(crudos);

/** La ruta real del archivo, dentro del paquete web. */
export function urlDeVideo(video: VideoDatos): string {
  return `${CARPETA_VIDEOS}/${video.archivo}`;
}

/** El video de un id, o null si ese id no está en la lista. */
export function videoPorId(id: string, videos: readonly VideoDatos[] = VIDEOS): VideoDatos | null {
  const encontrado = videos.find((video) => video.id === id);
  return encontrado === undefined ? null : encontrado;
}

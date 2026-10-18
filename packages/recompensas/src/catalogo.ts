/**
 * El catálogo de premios: la lista vive en DATOS, no en el código.
 *
 * `recompensas.json` tiene una línea por premio (`id`, `episodio`, `tipo`,
 * `titulo` y `archivo` o `texto`). Cambiar el premio de un juego es editar esa
 * línea; el archivo va en `assets/videos/` (o `assets/sonidos/`) y el
 * empaquetador lo copia al paquete web. Nada de internet.
 *
 * Es el MISMO patrón que `apps/videos/src/videos.json` (id, título, archivo):
 * la única diferencia es que acá cada premio dice a qué episodio pertenece y de
 * qué tipo es, para que un juego deje de mostrar videos de otro.
 *
 * Regla de oro también acá: si una línea viene mal escrita, ese premio no
 * aparece y el resto sigue andando; el niño nunca ve un error.
 */
import crudos from '../data/recompensas.json';

/** Los tres tipos de premio que entiende el catálogo. */
export type TipoRecompensa = 'video' | 'frase' | 'sonido';

/** Un premio del catálogo, ya revisado. */
export interface Recompensa {
  /** Identificador estable (es el que va en `$premio-del-dia`). */
  id: string;
  /** A qué episodio pertenece: los premios no se mezclan entre juegos. */
  episodio: string;
  tipo: TipoRecompensa;
  /** El nombre grande que se ve en la tarjeta. */
  titulo: string;
  /** El archivo, dentro de la carpeta del tipo. `null` para una frase. */
  archivo: string | null;
  /** El texto que se muestra, para los premios `frase`. `null` para los demás. */
  texto: string | null;
}

/** Los tipos válidos, en el orden en que se muestran. */
export const TIPOS_RECOMPENSA: readonly TipoRecompensa[] = ['video', 'frase', 'sonido'];

/** La carpeta, dentro del paquete web, donde vive el archivo de cada tipo. */
export const CARPETA_POR_TIPO: Record<TipoRecompensa, string> = {
  video: 'assets/videos',
  frase: 'assets/textos',
  sonido: 'assets/sonidos',
};

/**
 * El premio que se usa si el catálogo viene vacío o roto: así el juego SIEMPRE
 * tiene algo que dar, aunque no haya ni un archivo de datos.
 */
export const RECOMPENSA_POR_DEFECTO: Recompensa = {
  id: 'casa-de-la-tia',
  episodio: 'viaje-casa-tia',
  tipo: 'video',
  titulo: 'El premio del día',
  archivo: 'casa-de-la-tia.mp4',
  texto: null,
};

/** Un texto con contenido, o null si no sirve. */
function textoConContenido(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return limpio.length > 0 ? limpio : null;
}

/** ¿Es uno de los tres tipos válidos? */
function esTipo(valor: unknown): valor is TipoRecompensa {
  return typeof valor === 'string' && (TIPOS_RECOMPENSA as readonly string[]).indexOf(valor) !== -1;
}

/**
 * Convierte lo que venga del JSON en una lista de premios confiable.
 * Salta (en silencio) cualquier línea que no sirva y los repetidos por `id`.
 */
export function normalizarRecompensas(crudos: unknown): Recompensa[] {
  if (!Array.isArray(crudos)) return [];
  const yaVistos: string[] = [];
  const premios: Recompensa[] = [];
  for (const crudo of crudos) {
    if (typeof crudo !== 'object' || crudo === null) continue;
    const registro = crudo as Record<string, unknown>;
    const id = textoConContenido(registro['id']);
    const episodio = textoConContenido(registro['episodio']);
    const titulo = textoConContenido(registro['titulo']);
    if (id === null || episodio === null || titulo === null) continue;
    if (!esTipo(registro['tipo'])) continue;
    const archivo = textoConContenido(registro['archivo']);
    const texto = textoConContenido(registro['texto']);
    // Un video o un sonido sin archivo no sirve; una frase sin texto, tampoco.
    if (registro['tipo'] === 'frase' && texto === null) continue;
    if (registro['tipo'] !== 'frase' && archivo === null) continue;
    if (yaVistos.indexOf(id) !== -1) continue;
    yaVistos.push(id);
    premios.push({ id, episodio, tipo: registro['tipo'], titulo, archivo, texto });
  }
  return premios;
}

/** Los premios que trae el proyecto, tal como salen de `recompensas.json`. */
export const RECOMPENSAS: readonly Recompensa[] = normalizarRecompensas(crudos);

/** Todos los premios de un episodio, en el orden del catálogo. */
export function recompensasDeEpisodio(
  episodio: string,
  todas: readonly Recompensa[] = RECOMPENSAS,
): Recompensa[] {
  return todas.filter((premio) => premio.episodio === episodio);
}

/** El premio de un id, o null si ese id no está en la lista. */
export function recompensaPorId(
  id: string,
  todas: readonly Recompensa[] = RECOMPENSAS,
): Recompensa | null {
  const encontrada = todas.find((premio) => premio.id === id);
  return encontrada === undefined ? null : encontrada;
}

/** La ruta real del archivo, dentro del paquete web. `null` para una frase. */
export function urlDeRecompensa(recompensa: Recompensa): string | null {
  if (recompensa.archivo === null) return null;
  return `${CARPETA_POR_TIPO[recompensa.tipo]}/${recompensa.archivo}`;
}

/**
 * Los videos del mismo episodio que NO son el elegido: la lista de respaldos,
 * por si el premio del día no se puede ver en esta pantalla (el típico H.265).
 */
export function respaldosDeVideo(
  elegida: Recompensa,
  episodio: string,
  todas: readonly Recompensa[] = RECOMPENSAS,
): Recompensa[] {
  return todas.filter(
    (premio) => premio.episodio === episodio && premio.tipo === 'video' && premio.id !== elegida.id,
  );
}

/** El primer video de un episodio: el respaldo de última hora si no hay nada más. */
export function primerVideoDeEpisodio(
  episodio: string,
  todas: readonly Recompensa[] = RECOMPENSAS,
): Recompensa | null {
  const video = todas.find((premio) => premio.episodio === episodio && premio.tipo === 'video');
  return video === undefined ? null : video;
}

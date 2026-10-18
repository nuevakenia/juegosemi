/**
 * @juegosemi/recompensas — los PREMIOS de los juegos como contenido configurable.
 *
 * Todo lo de los premios vive acá, en datos y en piezas chicas:
 *
 *   catálogo       `recompensas.json` + `catalogo.ts`: qué premios hay, por
 *                  episodio, con su tipo (video/frase/sonido) y su archivo.
 *   premio del día `premio-del-dia.ts`: cuál se usa y cómo queda guardado
 *                  (sobre el puerto de almacenamiento, como el taller).
 *   nivel          `nivel.ts`: meter el premio elegido dentro del nivel, para
 *                  que el nivel lo pague con su recompensa y el juego no se
 *                  entere de nada.
 *   reproducción   `reproductor.ts` (el mismo del lector de videos) y
 *                  `reproducir-recompensa.ts`: ver el premio y, si no se puede
 *                  ver, avisar en castellano claro y probar el respaldo.
 *   selector       `selector.ts`: el botón grande "Cambiar el premio" para
 *                  cambiarlo sin escribir código (lo va a usar el editor).
 *
 * Regla de oro en todo el paquete: NUNCA hay feedback negativo. Un premio mal
 * escrito, un archivo que falta o un video que no decodifica no rompen nada.
 */
export type { Recompensa, TipoRecompensa } from './catalogo.ts';
export {
  CARPETA_POR_TIPO,
  RECOMPENSAS,
  RECOMPENSA_POR_DEFECTO,
  TIPOS_RECOMPENSA,
  normalizarRecompensas,
  primerVideoDeEpisodio,
  recompensaPorId,
  recompensasDeEpisodio,
  respaldosDeVideo,
  urlDeRecompensa,
} from './catalogo.ts';

export {
  CLAVE_PREMIO_DEL_DIA,
  VARIABLE_PREMIO_DEL_DIA,
  borrarPremioDelDia,
  crearAlmacenRecompensas,
  elegirPremioDelDia,
  guardarPremioDelDia,
  leerPremioDelDia,
  premioDelDia,
} from './premio-del-dia.ts';

export { conPremioDelDia } from './nivel.ts';

export {
  INTERVALO_POR_DEFECTO_MS,
  QUIETO_POR_DEFECTO_MS,
  TOPE_POR_DEFECTO_MS,
  verVideo,
  type OpcionesVerVideo,
  type Reproduccion,
} from './reproductor.ts';

export {
  reproducirRecompensa,
  textoDeRecompensaQueNoSeVe,
  type OpcionesReproducirRecompensa,
  type ReproduccionRecompensa,
} from './reproducir-recompensa.ts';

export {
  crearSelectorDeRecompensas,
  type OpcionesSelectorRecompensas,
  type SelectorRecompensas,
} from './selector.ts';

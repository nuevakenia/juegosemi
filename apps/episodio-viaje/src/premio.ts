/**
 * El premio del día: qué video se reproduce al llegar.
 *
 * El nivel guarda, en las variables del mundo, el NOMBRE del premio
 * (`premio-del-dia` → `"casa-de-la-tia"`). La lógica lo pasa tal cual al puerto de
 * video (acción `reproducir_video($premio-del-dia)`); acá vive lo único que la
 * lógica no puede saber: el id lógico del premio se convierte en una ruta de
 * archivo real.
 *
 * Todavía no hay videos de la familia: los de MUESTRA son dos H.264 y un H.265
 * (este último está a propósito, para probar el caso "este WebView no lo
 * decodifica" sin que el juego aporte nada raro).
 *
 * Regla de oro también acá: si el premio pedido no existe, NO se falla: se cae al
 * video por defecto. Un premio mal escrito nunca deja al niño sin video.
 */
import type { Nivel } from '@juegosemi/logica';
import type { CodecVideo, PuertoVideo, ResultadoVideo } from '@juegosemi/puertos';

/** La carpeta donde quedan los videos dentro del paquete web. */
export const CARPETA_VIDEOS = 'assets/videos';

/** El nombre de la variable del nivel que dice cuál es el video del día. */
export const VARIABLE_PREMIO = 'premio-del-dia';

/** Si el nivel no dice nada (o dice algo raro), se reproduce este. */
export const PREMIO_POR_DEFECTO = 'casa-de-la-tia';

export interface VideoDeMuestra {
  /** El id lógico que usa el nivel (`premio-del-dia`). */
  id: string;
  /** El archivo, dentro de `assets/videos/`. */
  archivo: string;
  codec: CodecVideo;
  titulo: string;
}

/**
 * Los videos de muestra. `video-del-final` es H.265 A PROPÓSITO: es el caso que
 * en la tablet Huawei no decodifica, para poder ver el aviso sin romper nada.
 */
export const VIDEOS_DE_MUESTRA: readonly VideoDeMuestra[] = [
  { id: 'casa-de-la-tia', archivo: 'casa-de-la-tia.mp4', codec: 'h264', titulo: 'La casa de la tía' },
  { id: 'video-de-la-prima', archivo: 'video-de-la-prima.mp4', codec: 'h264', titulo: 'El video de la prima' },
  { id: 'video-del-final', archivo: 'video-del-final.mp4', codec: 'h265', titulo: 'El video del final (H.265, de prueba)' },
];

/** El video de muestra de un id, o el de por defecto si ese id no existe. */
export function videoDeMuestra(id: string, videos: readonly VideoDeMuestra[] = VIDEOS_DE_MUESTRA): VideoDeMuestra {
  const encontrado = videos.find((v) => v.id === id);
  if (encontrado !== undefined) return encontrado;
  const porDefecto = videos.find((v) => v.id === PREMIO_POR_DEFECTO);
  // `VIDEOS_DE_MUESTRA` siempre trae el de por defecto; el `??` es por si alguien
  // pasa una lista propia sin él.
  return porDefecto ?? { id: PREMIO_POR_DEFECTO, archivo: `${PREMIO_POR_DEFECTO}.mp4`, codec: 'h264', titulo: 'El video del día' };
}

/** La ruta real del video de un id (nunca falla: cae al de por defecto). */
export function urlDeVideo(id: string, videos: readonly VideoDeMuestra[] = VIDEOS_DE_MUESTRA): string {
  return `${CARPETA_VIDEOS}/${videoDeMuestra(id, videos).archivo}`;
}

/** El premio que declara el nivel en sus variables del mundo. */
export function premioDelNivel(nivel: Nivel): string {
  const variables = nivel.mundo?.variables;
  if (variables === undefined) return PREMIO_POR_DEFECTO;
  const valor = variables[VARIABLE_PREMIO];
  return typeof valor === 'string' && valor.length > 0 ? valor : PREMIO_POR_DEFECTO;
}

/**
 * Envuelve un puerto de video para que la lógica siga hablando en ids lógicos
 * (`casa-de-la-tia`) y la pantalla reciba rutas de archivo de verdad.
 */
export function crearPuertoVideo(
  html: PuertoVideo,
  videos: readonly VideoDeMuestra[] = VIDEOS_DE_MUESTRA,
): PuertoVideo {
  return {
    soporta(codec: CodecVideo): Promise<boolean> {
      return html.soporta(codec);
    },
    reproducir(id: string, opciones = {}): Promise<ResultadoVideo> {
      return html.reproducir(urlDeVideo(id, videos), opciones);
    },
    detener(): void {
      html.detener();
    },
  };
}

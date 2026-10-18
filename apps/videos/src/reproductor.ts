/**
 * Ver un video y saber, de verdad, si se pudo ver.
 *
 * El adaptador `crearVideoHtml` ya hace lo difícil (no le cree a `canPlayType` ni
 * al evento `playing`: mide FRAMES). Acá se envuelve ese puerto con lo que le
 * falta al lector de videos:
 *
 *   1. si el adaptador dice que NO (típico H.265 en el WebView de la tablet),
 *      se avisa en castellano claro y se vuelve a la galería — nunca un
 *      rectángulo negro ni un mensaje feo;
 *   2. si dice que SÍ, se mira el `<video>` de verdad cada medio segundo para
 *      saber cuándo termina (tampoco acá se cree un solo evento) y se cierra por
 *      donde corresponda: terminó, lo cerraron, se quedó quieto, o pasó el tope.
 *
 * El tope es la red de seguridad: NADA deja a Emiliano esperando para siempre.
 */
import type { PuertoVideo, ResultadoVideo } from '@juegosemi/puertos';

export interface OpcionesVerVideo {
  /** El puerto de video (en la app: `crearVideoHtml()`). */
  puerto: PuertoVideo;
  /** La ruta real del archivo, dentro del paquete web. */
  url: string;
  /** Volumen de 0 a 1. */
  volumen?: number;
  /** Tope duro de la reproducción, en milisegundos. */
  topeMs?: number;
  /** Cada cuánto se revisa el `<video>` de verdad. */
  intervaloMs?: number;
  /** Cuánto se aguanta un video que quedó quieto, pausado en el segundo 0. */
  quietoMs?: number;
  /** Cuando el <video> no está a la vista (pruebas). */
  buscarVideo?: () => HTMLVideoElement | null;
  /** El video terminó (o el tope mandó): a volver tranquilos. */
  alTerminar: () => void;
  /** El video NO se puede ver en esta pantalla: acá se avisa y se sigue. */
  alNoPoder: (resultado: ResultadoVideo) => void;
}

/** Una reproducción en curso. */
export interface Reproduccion {
  /** La corta a mano (por ejemplo, si tocan el botón de volver). */
  cancelar(): void;
}

/** El tope duro por defecto, en milisegundos. */
export const TOPE_POR_DEFECTO_MS = 60000;

/** Cada cuánto se revisa el video, en milisegundos. */
export const INTERVALO_POR_DEFECTO_MS = 500;

/** Cuánto se aguanta al navegador que no larga, en milisegundos. */
export const QUIETO_POR_DEFECTO_MS = 4000;

export function verVideo(opciones: OpcionesVerVideo): Reproduccion {
  const topeMs = opciones.topeMs ?? TOPE_POR_DEFECTO_MS;
  const intervaloMs = opciones.intervaloMs ?? INTERVALO_POR_DEFECTO_MS;
  const quietoMs = opciones.quietoMs ?? QUIETO_POR_DEFECTO_MS;
  const buscar = opciones.buscarVideo ?? (() => document.querySelector('video'));

  let cerrado = false;
  let reloj: ReturnType<typeof setTimeout> | null = null;
  let transcurrido = 0;
  let quieto = 0;

  function cerrar(): void {
    if (reloj !== null) {
      clearTimeout(reloj);
      reloj = null;
    }
  }

  /** Se cierra bien: no hay nada más que mirar. */
  function terminar(): void {
    if (cerrado) return;
    cerrado = true;
    cerrar();
    opciones.puerto.detener();
    opciones.alTerminar();
  }

  /** Se cierra avisando que ese video no se puede ver acá. */
  function noPoder(resultado: ResultadoVideo): void {
    if (cerrado) return;
    cerrado = true;
    cerrar();
    opciones.puerto.detener();
    opciones.alNoPoder(resultado);
  }

  function revisar(): void {
    if (cerrado) return;
    transcurrido += intervaloMs;
    const video = buscar();
    if (video === null) return terminar(); // ya no está: lo cerró alguien
    if (video.ended || video.error !== null) return terminar();

    const duracion = video.duration;
    if (Number.isFinite(duracion) && duracion > 0 && video.currentTime >= duracion - 0.25) {
      return terminar();
    }

    // El navegador no lo quiso largar (autoplay bloqueado): no se hace esperar.
    if (video.paused && video.currentTime === 0 && video.readyState >= 3) {
      quieto += intervaloMs;
      if (quieto >= quietoMs) return terminar();
    } else {
      quieto = 0;
    }

    if (transcurrido >= topeMs) return terminar(); // el tope manda
    reloj = setTimeout(revisar, intervaloMs);
  }

  const enCurso = opciones.puerto.reproducir(opciones.url, {
    volumen: opciones.volumen ?? 1,
    pantallaCompleta: true,
  });

  enCurso.then(
    (resultado) => {
      if (cerrado) return;
      if (!resultado.ok) return noPoder(resultado);
      reloj = setTimeout(revisar, intervaloMs);
    },
    (error: unknown) => {
      noPoder({ ok: false, motivo: error instanceof Error ? error.message : String(error) });
    },
  );

  return {
    cancelar(): void {
      if (cerrado) return;
      cerrado = true;
      cerrar();
      opciones.puerto.detener();
    },
  };
}

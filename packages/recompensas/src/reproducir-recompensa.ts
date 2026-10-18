/**
 * Reproducir la RECOMPENSA del día, con respaldo: la parte robusta.
 *
 * Es el corazón de la regla de oro para los premios:
 *
 *   - si el premio es un video y NO se puede ver en esta pantalla (el típico
 *     H.265 en el WebView de la tablet, o un archivo que falta), NO se rompe
 *     nada: se avisa en castellano claro y se proban los otros videos del mismo
 *     episodio, en el orden del catálogo;
 *   - si el premio es una frase, se muestra el texto (no hay archivo que falle);
 *   - si el premio es un sonido, se reproduce con el puerto de audio si está, y
 *     si no, simplemente se sigue;
 *   - si NINGÚN video se pudo ver, se deja un aviso amable y se sigue: nunca un
 *     rectángulo negro, nunca un mensaje feo, nunca el niño esperando para siempre.
 *
 * No hay un reproductor nuevo: usa `verVideo` (el mismo del lector de videos).
 */
import type { PuertoAudio, PuertoVideo } from '@juegosemi/puertos';
import type { Recompensa } from './catalogo.ts';
import { urlDeRecompensa } from './catalogo.ts';
import { verVideo, type Reproduccion } from './reproductor.ts';

export interface OpcionesReproducirRecompensa {
  /** El puerto de video de verdad (en la app: `crearVideoHtml()`). */
  puerto: PuertoVideo;
  /** El premio del día. */
  recompensa: Recompensa;
  /** Otros premios por si este no se puede ver (videos del mismo episodio). */
  respaldos?: readonly Recompensa[];
  /** Sin puerto de audio, un premio de sonido sólo se anuncia y se sigue. */
  audio?: PuertoAudio;
  /** El premio terminó (o se agotaron los respaldos): a seguir tranquilos. */
  alTerminar: () => void;
  /** Aviso claro cuando algo no se pudo ver o mostrar. Nunca un error feo. */
  alAvisar?: (frase: string) => void;
  /** Cuando el <video> no está a la vista (pruebas). */
  buscarVideo?: () => HTMLVideoElement | null;
}

/** La reproducción del premio, para poder cortarla a mano. */
export interface ReproduccionRecompensa {
  cancelar(): void;
}

/**
 * La frase amable para cuando ni el premio ni sus respaldos se pudieron ver.
 * Castellano de Chile, sin signos de alarma, diciendo qué pasa y que no pasa nada.
 */
export function textoDeRecompensaQueNoSeVe(titulo: string): string {
  const nombre = titulo.trim().length > 0 ? titulo.trim() : 'El premio';
  return `El premio "${nombre}" no se puede ver acá. No pasa nada: ya lo veremos otro día.`;
}

/**
 * La lista de candidatos a reproducir: el premio elegido primero y después los
 * videos de respaldo del mismo episodio. Se respeta el orden del catálogo.
 */
function cadenaDeCandidatos(
  recompensa: Recompensa,
  respaldos: readonly Recompensa[],
): Recompensa[] {
  const videos = respaldos.filter((premio) => premio.tipo === 'video');
  return [recompensa, ...videos];
}

export function reproducirRecompensa(
  opciones: OpcionesReproducirRecompensa,
): ReproduccionRecompensa {
  let cancelada = false;
  let actual: Reproduccion | null = null;
  const candidatos = cadenaDeCandidatos(opciones.recompensa, opciones.respaldos ?? []);
  let indice = 0;

  function terminar(): void {
    if (cancelada) return;
    opciones.alTerminar();
  }

  /** Se agotaron los candidatos: aviso amable y a seguir. */
  function agotado(): void {
    opciones.alAvisar?.(textoDeRecompensaQueNoSeVe(opciones.recompensa.titulo));
    terminar();
  }

  function siguiente(): void {
    if (cancelada) return;
    const candidato = candidatos[indice];
    if (candidato === undefined) return agotado();
    indice += 1;

    if (candidato.tipo === 'frase') {
      opciones.alAvisar?.(candidato.texto ?? `¡${candidato.titulo}!`);
      return terminar();
    }

    if (candidato.tipo === 'sonido') {
      const url = urlDeRecompensa(candidato);
      const audio = opciones.audio;
      if (audio !== undefined && url !== null) {
        audio.cargar(candidato.id, url).then(
          () => audio.reproducir(candidato.id),
          () => undefined,
        );
      }
      return terminar();
    }

    // Video: acá está lo robusto. Si no se puede ver, se prueba el siguiente.
    const url = urlDeRecompensa(candidato);
    if (url === null) return siguiente(); // no debería pasar: el catálogo lo exige
    actual = verVideo({
      puerto: opciones.puerto,
      url,
      buscarVideo: opciones.buscarVideo,
      alTerminar: terminar,
      alNoPoder: () => siguiente(),
    });
  }

  siguiente();

  return {
    cancelar(): void {
      if (cancelada) return;
      cancelada = true;
      if (actual !== null) actual.cancelar();
    },
  };
}

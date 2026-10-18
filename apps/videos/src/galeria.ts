/**
 * La galería: una tarjeta GRANDE por video, con su marco de miniatura.
 *
 * Se arma con las piezas de `@juegosemi/ui` (nada de canvas ni de componentes
 * propios): `crearPantalla` pone el armazón con el título grande y `crearTarjeta`
 * hace que TODA la tarjeta sea el botón — para un niño es mucho más fácil
 * acertarle a un cuadro entero que a un botón chico adentro.
 *
 * La miniatura es opcional y llega tarde (hay que decodificar un cuadro): por eso
 * la tarjeta se pinta al tiro con su pictograma y, si el cuadro aparece, se pone
 * encima. Si no aparece (jsdom, H.265, o lo que sea), queda el pictograma: nunca
 * un hueco negro ni un aviso de error.
 */
import { crearElemento, crearPantalla, crearTarjeta } from '@juegosemi/ui';
import type { VideoDatos } from './catalogo.ts';

export interface OpcionesGaleria {
  /** Los videos a mostrar, en orden. */
  videos: readonly VideoDatos[];
  /** Se llama al tocar una tarjeta, con el video elegido. */
  alElegir: (video: VideoDatos) => void;
  /**
   * Pide la miniatura de un video. Debe llamar a `alTenerla` con una imagen
   * (data URL) cuando la consiga, y devolver cómo cancelar la espera.
   */
  alPedirMiniatura?: (video: VideoDatos, alTenerla: (imagen: string) => void) => () => void;
  /** Título de la pantalla. */
  titulo?: string;
  /** Bajada corta debajo del título. */
  subtitulo?: string;
}

/** La galería armada, lista para meter en la página. */
export interface Galeria {
  elemento: HTMLElement;
  /** Corta las esperas de miniaturas (al salir de la galería). */
  cancelar(): void;
}

/** El pictograma que acompaña a cada tarjeta mientras no hay cuadro. */
const PICTOGRAMA_VIDEO = '\uD83C\uDFAC';

/**
 * Arma la galería completa.
 * Si la lista viene vacía, lo dice en castellano claro y listo: nunca rompe.
 */
export function crearGaleria(opciones: OpcionesGaleria): Galeria {
  const cancelaciones: Array<() => void> = [];
  const cuerpo: HTMLElement[] = [];

  if (opciones.videos.length === 0) {
    cuerpo.push(
      crearElemento('p', {
        clases: 'js-galeria__vacia',
        texto: 'Todavía no hay videos acá. Cuando estén, van a aparecer en esta pantalla.',
      }),
    );
  } else {
    const grilla = crearElemento('div', { clases: 'js-galeria' });
    for (const video of opciones.videos) {
      grilla.appendChild(crearTarjetaDeVideo(video, opciones, cancelaciones));
    }
    cuerpo.push(grilla);
  }

  const elemento = crearPantalla({
    titulo: opciones.titulo ?? 'Los videos',
    subtitulo: opciones.subtitulo ?? 'Tocá un video para verlo',
    contenido: cuerpo,
  });

  return {
    elemento,
    cancelar(): void {
      for (const cancelar of cancelaciones) cancelar();
      cancelaciones.length = 0;
    },
  };
}

/** Una tarjeta grande, con su marco de miniatura adelante. */
function crearTarjetaDeVideo(
  video: VideoDatos,
  opciones: OpcionesGaleria,
  cancelaciones: Array<() => void>,
): HTMLElement {
  const tarjeta = crearTarjeta({
    titulo: video.titulo,
    texto: 'Tocá para verlo',
    pictograma: PICTOGRAMA_VIDEO,
    nombreAccesible: `Ver el video: ${video.titulo}`,
    alElegir: () => opciones.alElegir(video),
    clasesExtra: 'js-video-tarjeta',
  });

  // El marco va primero, arriba del título y del pictograma.
  const marco = crearElemento('span', { clases: 'js-video-tarjeta__marco' });
  tarjeta.insertBefore(marco, tarjeta.firstChild);

  const pedirMiniatura = opciones.alPedirMiniatura;
  if (pedirMiniatura !== undefined) {
    cancelaciones.push(
      pedirMiniatura(video, (imagen: string) => {
        const cuadro = crearElemento('img', { clases: 'js-video-tarjeta__cuadro' });
        cuadro.src = imagen;
        cuadro.alt = '';
        cuadro.setAttribute('aria-hidden', 'true');
        marco.textContent = '';
        marco.appendChild(cuadro);
        // Con el cuadro a la vista, el pictograma ya no hace falta.
        const pictograma = tarjeta.querySelector('.js-tarjeta__pictograma');
        if (pictograma !== null) pictograma.remove();
      }),
    );
  }

  return tarjeta;
}

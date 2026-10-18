/**
 * El lector de videos: la pantalla de verdad.
 *
 * Qué hace, con qué de lo que ya existe:
 *   1. la galería            → `crearGaleria` (tarjetas grandes de @juegosemi/ui)
 *   2. ver un video          → `verVideo` sobre el puerto `crearVideoHtml`
 *   3. "no se puede ver acá" → el aviso de `estado.ts`, en castellano claro
 *   4. elegir otro           → se vuelve a la galería, sin recargar la página
 *
 * Lo que NO hay acá: ni un reproductor propio. El `<video>`, la verificación de
 * frames y el código nativo del APK los pone `@juegosemi/adaptadores-web`. Esta
 * pantalla sólo decide QUÉ se ve y CUÁNDO se vuelve.
 *
 * Regla de oro del proyecto, dicha de nuevo porque es la que manda: NUNCA hay
 * feedback negativo. Si un video no se puede ver en esta tablet (el típico H.265
 * que el WebView viejo no decodifica), no hay mensaje feo, ni sonido de alarma,
 * ni rectángulo negro: se avisa con una frase amable y se vuelve a la galería.
 */
import { crearVideoHtml } from '@juegosemi/adaptadores-web';
import { crearBoton, crearElemento, crearPantalla } from '@juegosemi/ui';
import { VIDEOS, urlDeVideo, videoPorId, type VideoDatos } from './catalogo.ts';
import {
  ESPERA_AVISO_MS,
  abrirVideo,
  avisarQueNoSePuedeVer,
  estadoInicial,
  volverALaGaleria,
  type EstadoVideos,
} from './estado.ts';
import { crearGaleria, type Galeria } from './galeria.ts';
import { sacarMiniatura } from './miniatura.ts';
import { verVideo, type Reproduccion } from './reproductor.ts';
import '@juegosemi/ui/estilos.css';
import './videos.css';

function exigir<T extends HTMLElement>(id: string): T {
  const elemento = document.getElementById(id);
  if (elemento === null) throw new Error(`falta el elemento #${id} en el HTML`);
  return elemento as T;
}

const raiz = exigir<HTMLDivElement>('app');

/** El puerto de video de siempre: verifica frames, no eventos. */
const video = crearVideoHtml();

let estado: EstadoVideos = estadoInicial();
let galeria: Galeria | null = null;
let reproduccion: Reproduccion | null = null;
let relojDelAviso: number | null = null;

/** Deja la página limpia: sin timers, sin video y sin galería viva. */
function limpiar(): void {
  if (relojDelAviso !== null) {
    window.clearTimeout(relojDelAviso);
    relojDelAviso = null;
  }
  if (reproduccion !== null) {
    reproduccion.cancelar();
    reproduccion = null;
  }
  if (galeria !== null) {
    galeria.cancelar();
    galeria = null;
  }
  video.detener();
  raiz.textContent = '';
}

function pintar(elemento: HTMLElement): void {
  raiz.textContent = '';
  raiz.appendChild(elemento);
}

/** La galería: el estado de reposo de la app. */
function mostrarGaleria(): void {
  limpiar();
  estado = volverALaGaleria();
  galeria = crearGaleria({
    videos: VIDEOS,
    alElegir: verElegido,
    alPedirMiniatura: (uno, alTenerla) => sacarMiniatura(urlDeVideo(uno), alTenerla),
  });
  pintar(galeria.elemento);
  document.title = 'Los videos de Emiliano';
}

/** Se eligió un video: a verlo a pantalla completa. */
function verElegido(elegido: VideoDatos): void {
  limpiar();
  estado = abrirVideo(estado, elegido.id);
  document.title = elegido.titulo;

  const capa = crearElemento('div', { clases: 'js-reproductor' });
  capa.appendChild(
    crearBoton({
      etiqueta: 'Volver a los videos',
      pictograma: '\u2B05',
      nombreAccesible: `Volver a los videos (estás viendo ${elegido.titulo})`,
      alElegir: mostrarGaleria,
      // El video a pantalla completa vive en z-index 50: este botón va encima.
      clasesExtra: 'js-boton--volver js-boton--encima',
    }),
  );
  pintar(capa);

  reproduccion = verVideo({
    puerto: video,
    url: urlDeVideo(elegido),
    alTerminar: mostrarGaleria,
    alNoPoder: (resultado) => noSePudoVer(elegido, resultado.motivo),
  });
}

/**
 * Ese video no se puede ver en esta pantalla.
 * Se avisa en castellano claro, con un botón grande para volver, y a los pocos
 * segundos se vuelve solo: nunca se queda pegado en una pantalla muda.
 */
function noSePudoVer(noSeVe: VideoDatos, motivo: string | undefined): void {
  estado = avisarQueNoSePuedeVer(estado, noSeVe.titulo);
  limpiar();
  document.title = 'Los videos de Emiliano';
  console.info('juegosemi: el video no se puede ver acá', { id: noSeVe.id, motivo });

  const cuerpo: HTMLElement[] = [
    crearElemento('p', {
      clases: 'js-aviso__texto',
      texto: 'Tocá el botón y elegís otro video.',
    }),
    crearBoton({
      etiqueta: 'Volver a los videos',
      pictograma: '\uD83C\uDFAC',
      alElegir: mostrarGaleria,
      clasesExtra: 'js-aviso__boton',
    }),
  ];

  pintar(
    crearPantalla({
      titulo: 'Este video no se puede ver acá',
      subtitulo: estado.aviso ?? 'No pasa nada: volvamos a elegir otro.',
      contenido: cuerpo,
    }),
  );

  relojDelAviso = window.setTimeout(() => {
    relojDelAviso = null;
    mostrarGaleria();
  }, ESPERA_AVISO_MS);
}

mostrarGaleria();

console.info('juegosemi: lector de videos', {
  videos: VIDEOS.length,
  carpeta: 'assets/videos',
});

// Hook de diagnóstico para la consola del navegador (QA): deja todo a mano y
// permite abrir un video sin dedo.
(window as unknown as Record<string, unknown>)['juegosemiVideos'] = {
  videos: VIDEOS,
  estado: () => estado,
  alGaleria: mostrarGaleria,
  ver: (id: string): void => {
    const elegido = videoPorId(id);
    if (elegido !== null) verElegido(elegido);
  },
};

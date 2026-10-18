/**
 * La miniatura de un video, sacada del propio video con un canvas.
 *
 * Es un lujo, no un requisito. No siempre se puede: acá no hay decodificador
 * (jsdom), en la tablet el H.265 no se decodifica, y algunos navegadores no dejan
 * leer el cuadro del canvas. Por eso esto NUNCA falla, NUNCA avisa y NUNCA se
 * queda pegado: si no hubo cuadro a tiempo, la tarjeta se queda con su
 * pictograma y no pasó nada.
 *
 * El `al` que devuelve cancela la espera (y suelta el `<video>` escondido).
 */
export interface OpcionesMiniatura {
  /** Ancho del cuadro guardado, en píxeles. */
  ancho?: number;
  /** Segundo del video del que se saca el cuadro. */
  segundo?: number;
  /** Cuánto se espera, como máximo, a que haya cuadro. */
  tiempoMaximoMs?: number;
}

export function sacarMiniatura(
  url: string,
  alTenerla: (imagen: string) => void,
  opciones: OpcionesMiniatura = {},
): () => void {
  if (typeof document === 'undefined') return () => undefined;

  const ancho = opciones.ancho ?? 480;
  const segundo = opciones.segundo ?? 0.5;
  const tiempoMaximoMs = opciones.tiempoMaximoMs ?? 6000;

  let terminado = false;
  let reloj: ReturnType<typeof setTimeout> | null = null;

  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.playsInline = true;
  video.setAttribute('webkit-playsinline', 'true');
  video.setAttribute('aria-hidden', 'true');
  // Fuera de la vista: se decodifica igual, pero no molesta a nadie.
  video.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
  video.src = url;
  document.body.appendChild(video);

  function soltar(): void {
    if (reloj !== null) {
      clearTimeout(reloj);
      reloj = null;
    }
    video.removeEventListener('loadeddata', alTenerCuadro);
    video.removeEventListener('seeked', dibujar);
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (video.parentElement) video.parentElement.removeChild(video);
  }

  function terminar(imagen: string | null): void {
    if (terminado) return;
    terminado = true;
    soltar();
    if (imagen !== null) alTenerla(imagen);
  }

  /** Copia el cuadro actual del video a un canvas y lo devuelve como imagen. */
  function dibujar(): void {
    if (terminado) return;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    const lienzo = document.createElement('canvas');
    const alto = Math.max(1, Math.round((ancho * video.videoHeight) / video.videoWidth));
    lienzo.width = ancho;
    lienzo.height = alto;
    const pincel = lienzo.getContext('2d');
    if (pincel === null) {
      terminar(null);
      return;
    }
    try {
      pincel.drawImage(video, 0, 0, ancho, alto);
      terminar(lienzo.toDataURL('image/jpeg', 0.7));
    } catch {
      // El navegador no dejó leer el canvas: no hay miniatura y no pasó nada.
      terminar(null);
    }
  }

  /** Ya hay cuadro: se busca uno del medio (queda más lindo que el primero). */
  function alTenerCuadro(): void {
    if (terminado) return;
    const duracion = video.duration;
    if (Number.isFinite(duracion) && duracion > segundo + 1) {
      video.currentTime = segundo;
      return; // al llegar al segundo pedido dispara `seeked` → dibujar
    }
    dibujar();
  }

  video.addEventListener('loadeddata', alTenerCuadro);
  video.addEventListener('seeked', dibujar);
  reloj = setTimeout(() => terminar(null), tiempoMaximoMs);

  return () => terminar(null);
}

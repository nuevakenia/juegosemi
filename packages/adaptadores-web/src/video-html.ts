import type { CodecVideo, PuertoVideo, ResultadoVideo, OpcionesVideo } from '@juegosemi/puertos';

/**
 * Adaptador de video para el navegador / WebView de Android.
 *
 * LO IMPORTANTE (medido, y es la razón de que exista este adaptador):
 * en las tablets Huawei sin servicios de Google el WebView es Chromium 99 y el
 * `<video>` NO reproduce H.265. Peor: `canPlayType` MIENTE en WebViews viejos
 * (Chrome < 112 devolvía "probably" siempre) y el evento `playing` también miente
 * (dispara aunque no haya decodificado un solo frame, con videoWidth = 0).
 *
 * Por eso acá no se cree en eventos ni en `canPlayType`: se verifica FRAMES
 * (videoWidth > 0 y el tiempo avanzando). El juego usa `soporta()` para decidir,
 * y si el códec no está, el video se pide al adaptador nativo (Media3) en el APK.
 */
export interface OpcionesVideoHtml {
  /** Elemento donde se inserta el reproductor (por defecto, body). */
  contenedor?: HTMLElement;
  /** Prueba real al consultar `soporta()` (más lento, pero no miente). */
  verificarReproduciendo?: boolean;
}

const TIPOS_CODEC: Record<CodecVideo, string> = {
  h264: 'video/mp4; codecs="avc1.42E01E"',
  h265: 'video/mp4; codecs="hev1.1.6.L93.B0"',
};

export function crearVideoHtml(opciones: OpcionesVideoHtml = {}): PuertoVideo {
  let actual: HTMLVideoElement | null = null;

  function crearElemento(): HTMLVideoElement {
    const v = document.createElement('video');
    v.playsInline = true;
    v.controls = true;
    v.preload = 'auto';
    v.setAttribute('webkit-playsinline', 'true');
    return v;
  }

  /** ¿Decodifica de verdad? Se mide frames, no eventos. */
  async function decodifica(url: string, tiempoMaximoMs = 8000): Promise<boolean> {
    const v = crearElemento();
    v.src = url;
    v.muted = true;
    const host = opciones.contenedor ?? document.body;
    host.appendChild(v);
    try {
      await v.play().catch(() => undefined);
      const inicio = Date.now();
      let ultimo = v.currentTime;
      let avanzo = false;
      while (Date.now() - inicio < tiempoMaximoMs) {
        await esperar(150);
        if (v.videoWidth > 0 && v.videoHeight > 0 && v.currentTime > ultimo) {
          avanzo = true;
          break;
        }
        ultimo = v.currentTime;
      }
      return avanzo;
    } finally {
      v.pause();
      v.removeAttribute('src');
      v.load();
      if (v.parentElement) v.parentElement.removeChild(v);
    }
  }

  return {
    async soporta(codec: CodecVideo): Promise<boolean> {
      const v = crearElemento();
      const declarado = v.canPlayType(TIPOS_CODEC[codec]);
      if (declarado === '') return false;
      if (!opciones.verificarReproduciendo) return true;
      return decodifica(TIPOS_CODEC[codec] === TIPOS_CODEC.h264 ? '/videos/h264.mp4' : '/videos/h265.mp4');
    },

    async reproducir(url: string, opcionesVideo: OpcionesVideo = {}): Promise<ResultadoVideo> {
      this.detener();
      const v = crearElemento();
      actual = v;
      v.src = url;
      v.muted = false;
      v.volume = opcionesVideo.volumen ?? 1;
      const host = opciones.contenedor ?? document.body;
      host.appendChild(v);
      if (opcionesVideo.pantallaCompleta) {
        v.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;background:#000;z-index:50';
      }
      try {
        await v.play();
      } catch (e) {
        return { ok: false, motivo: `el navegador no dejó reproducir: ${(e as Error).message}` };
      }
      // Verificación de frames: el 'play' puede haber resuelto sin decodificar.
      const inicio = Date.now();
      while (Date.now() - inicio < 4000) {
        if (v.videoWidth > 0 && v.videoHeight > 0) return { ok: true };
        await esperar(120);
      }
      return { ok: false, motivo: 'arrancó pero no decodificó frames (codec no soportado por este WebView)' };
    },

    detener(): void {
      if (!actual) return;
      actual.pause();
      actual.removeAttribute('src');
      actual.load();
      if (actual.parentElement) actual.parentElement.removeChild(actual);
      actual = null;
    },
  };
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => {
    setTimeout(resolver, ms);
  });
}

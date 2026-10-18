import type { EventoEntrada, PuertoEntrada } from '@juegosemi/puertos';

/**
 * Entrada táctil/puntero para el navegador y el WebView de Android.
 *
 * Usa Pointer Events (soportados en Android 7+, y es lo único que además
 * funciona con mouse en el PC, así que se prueba igual en el escritorio).
 * El mapeo a coordenadas del lienzo se hace con `getBoundingClientRect`, así
 * que sirve igual en un celular chico, en la tablet grande y en el PC.
 */
export interface OpcionesEntradaTactil {
  elemento: HTMLElement;
  /** Tamaño lógico del área de juego (si difiere del tamaño del elemento). */
  tamanoLogico?: () => { ancho: number; alto: number };
}

export function crearEntradaTactil(opciones: OpcionesEntradaTactil): PuertoEntrada & { destruir: () => void } {
  const elemento = opciones.elemento;
  let callback: ((evento: EventoEntrada) => void) | null = null;
  const activos = new Set<number>();

  function aCoordenadas(evento: PointerEvent): { x: number; y: number } {
    const caja = elemento.getBoundingClientRect();
    const logico = opciones.tamanoLogico ? opciones.tamanoLogico() : { ancho: caja.width, alto: caja.height };
    const escalaX = logico.ancho / Math.max(1, caja.width);
    const escalaY = logico.alto / Math.max(1, caja.height);
    return { x: (evento.clientX - caja.left) * escalaX, y: (evento.clientY - caja.top) * escalaY };
  }

  function alPulsar(evento: PointerEvent): void {
    activos.add(evento.pointerId);
    // En un puntero real (dedo/mouse) esto captura el gesto. Con un puntero
    // SINTÉTICO (una prueba automatizada) puede no existir: no es un error.
    try {
      elemento.setPointerCapture?.(evento.pointerId);
    } catch {
      // nada: seguimos sin captura
    }
    evento.preventDefault();
    if (!callback) return;
    const { x, y } = aCoordenadas(evento);
    callback({ tipo: 'pulsar', x, y, puntero: evento.pointerId });
  }

  function alMover(evento: PointerEvent): void {
    if (!activos.has(evento.pointerId) || !callback) return;
    evento.preventDefault();
    const { x, y } = aCoordenadas(evento);
    callback({ tipo: 'mover', x, y, puntero: evento.pointerId });
  }

  function alSoltar(evento: PointerEvent): void {
    if (!activos.has(evento.pointerId)) return;
    activos.delete(evento.pointerId);
    if (!callback) return;
    const { x, y } = aCoordenadas(evento);
    callback({ tipo: 'soltar', x, y, puntero: evento.pointerId });
  }

  function alCancelar(evento: PointerEvent): void {
    if (!activos.has(evento.pointerId)) return;
    activos.delete(evento.pointerId);
    if (!callback) return;
    const { x, y } = aCoordenadas(evento);
    callback({ tipo: 'cancelar', x, y, puntero: evento.pointerId });
  }

  return {
    iniciar(alRecibir): void {
      callback = alRecibir;
      elemento.addEventListener('pointerdown', alPulsar);
      elemento.addEventListener('pointermove', alMover);
      elemento.addEventListener('pointerup', alSoltar);
      elemento.addEventListener('pointercancel', alCancelar);
      // sin esto, en Android el navegador se queda con el gesto (scroll/zoom)
      elemento.style.touchAction = 'none';
    },
    detener(): void {
      callback = null;
      elemento.removeEventListener('pointerdown', alPulsar);
      elemento.removeEventListener('pointermove', alMover);
      elemento.removeEventListener('pointerup', alSoltar);
      elemento.removeEventListener('pointercancel', alCancelar);
    },
    capacidades(): { tactil: boolean; puntero: boolean; giroscopio: boolean } {
      return {
        tactil: 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0,
        puntero: typeof PointerEvent !== 'undefined',
        giroscopio: typeof DeviceOrientationEvent !== 'undefined',
      };
    },
    destruir(): void {
      this.detener();
    },
  };
}

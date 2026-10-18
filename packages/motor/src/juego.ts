import type { AdaptadorRender, PuertoEntrada, PuertoPantalla, Reloj } from '@juegosemi/puertos';
import type { Arrastre } from './arrastre.ts';
import type { Escena } from './escena.ts';
import { Ticker } from './ticker.ts';
import type { Timeline } from './timeline.ts';

/**
 * El juego: une escena + ticker + timeline + entrada + render.
 *
 * El núcleo (`avanzar`) es una función pura respecto del navegador: recibe
 * cuánto tiempo real pasó y hace los pasos fijos. El bucle con
 * requestAnimationFrame es sólo el "motor de arranque" de esa función, así que
 * toda la lógica se puede probar sin navegador.
 */
export interface DependenciasJuego {
  escena: Escena;
  render: AdaptadorRender;
  entrada: PuertoEntrada;
  pantalla: PuertoPantalla;
  reloj: Reloj;
  arrastre?: Arrastre;
  timeline?: Timeline;
  /** Se llama en cada paso fijo, después de la lógica. */
  alPaso?: (paso: number, tiempoSimulado: number) => void;
}

export class Juego {
  private readonly deps: DependenciasJuego;
  private readonly ticker: Ticker;
  private corriendo = false;
  private ultimoTiempo = 0;
  private idAnimacion: number | null = null;

  constructor(deps: DependenciasJuego, ticker: Ticker = new Ticker()) {
    this.deps = deps;
    this.ticker = ticker;
  }

  get escena(): Escena {
    return this.deps.escena;
  }

  get timeline(): Timeline | undefined {
    return this.deps.timeline;
  }

  iniciar(): void {
    if (this.corriendo) return;
    this.corriendo = true;
    this.ultimoTiempo = this.deps.reloj.ahora();
    this.deps.entrada.iniciar((evento) => {
      const arrastre = this.deps.arrastre;
      if (arrastre) arrastre.procesar(evento);
    });
    const bucle = () => {
      if (!this.corriendo) return;
      const ahora = this.deps.reloj.ahora();
      const delta = (ahora - this.ultimoTiempo) / 1000;
      this.ultimoTiempo = ahora;
      this.avanzar(delta);
      this.dibujar();
      this.idAnimacion = peticionDeCuadro(bucle);
    };
    this.idAnimacion = peticionDeCuadro(bucle);
  }

  detener(): void {
    this.corriendo = false;
    this.deps.entrada.detener();
    if (this.idAnimacion !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.idAnimacion);
    }
    this.idAnimacion = null;
  }

  /**
   * Avanza el juego `deltaSegundos` de tiempo real. Devuelve cuántos pasos fijos
   * ejecutó. Es lo que se llama en los tests (sin navegador).
   */
  avanzar(deltaSegundos: number): number {
    return this.ticker.avanzar(deltaSegundos, (paso) => {
      const timeline = this.deps.timeline;
      if (timeline) timeline.actualizar(paso);
      if (this.deps.alPaso) this.deps.alPaso(paso, this.ticker.tiempo());
    });
  }

  /** Cuadro completo: pasos de lógica + sincronización del render. */
  dibujar(): void {
    this.deps.render.sincronizar(this.deps.escena.dibujos());
  }

  tiempoSimulado(): number {
    return this.ticker.tiempo();
  }

  pasos(): number {
    return this.ticker.pasos();
  }
}

function peticionDeCuadro(callback: () => void): number {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback);
  // Sin navegador (tests): un temporizador mínimo para no girar en vacío.
  return setTimeout(callback, 16) as unknown as number;
}

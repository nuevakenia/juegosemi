/**
 * El ticker: convierte el tiempo real en PASOS FIJOS de simulación.
 *
 * Por qué pasos fijos: en una tablet vieja el frame puede tardar 3 veces más que
 * en un PC, y la lógica (una animación, un temporizador, la boca que se mueve)
 * tiene que avanzar igual. Con pasos fijos el juego se ve más lento si no da
 * abasto, pero NUNCA se rompe ni se salta reglas.
 */

export const PASO_POR_DEFECTO = 1 / 60;

export class Ticker {
  private acumulador = 0;
  private readonly paso: number;
  private readonly maxPasosPorVuelta: number;
  private pasosTotales = 0;
  /** Segundos simulados desde el arranque. */
  private tiempoAcumulado = 0;

  constructor(paso: number = PASO_POR_DEFECTO, maxPasosPorVuelta = 5) {
    this.paso = paso;
    this.maxPasosPorVuelta = maxPasosPorVuelta;
  }

  /**
   * Incorpora `deltaSegundos` de tiempo real y llama a `alPaso` por cada paso
   * fijo que corresponda. El tope de pasos por vuelta evita el "efecto
   * metralleta" cuando el navegador volvió de un segundo plano o de una pausa
   * larga (si no, un salto de 10 s dispararía 600 pasos de golpe).
   */
  avanzar(deltaSegundos: number, alPaso: (paso: number) => void): number {
    const delta = Math.max(0, Math.min(deltaSegundos, this.maxPasosPorVuelta * this.paso));
    this.acumulador += delta;
    let pasos = 0;
    while (this.acumulador >= this.paso) {
      this.acumulador -= this.paso;
      this.tiempoAcumulado += this.paso;
      this.pasosTotales++;
      pasos++;
      alPaso(this.paso);
    }
    return pasos;
  }

  tiempo(): number {
    return this.tiempoAcumulado;
  }

  pasos(): number {
    return this.pasosTotales;
  }

  reiniciar(): void {
    this.acumulador = 0;
    this.tiempoAcumulado = 0;
    this.pasosTotales = 0;
  }
}

/**
 * El reconocedor de gestos: la máquina pura que lee los eventos de la entrada
 * táctil (pulsar / mover / soltar) y decide cuándo el niño completó lo pedido.
 *
 * Es puro a propósito: NO mira el reloj, NO toca el DOM y NO usa
 * requestAnimationFrame. El tiempo entra por parámetro (`ahoraMs`), así que los
 * cuatro gestos se prueban enteros sin un navegador.
 *
 * Lo que avisa, y nada más:
 *
 *   alProgresar(...)      cada vez que cambia el avance (para la barra).
 *   alCompletarGesto(...) cada vez que se completa UNA unidad del pedido. El juego
 *                         lo manda a la lógica como `gesto_completado`, y la regla
 *                         `pedir_gesto(gesto, veces, objetivo)` sabe contarlas.
 *
 * Nunca avisa de un error: si el gesto no se logra, no pasa nada. Si el dedo se
 * levanta a medias, sólo se reinicia el progreso de esa unidad.
 *
 * Cómo reconoce cada gesto:
 *
 *   toque_repetido  un toque corto (sin arrastrar) = una unidad. Con ventana para
 *                   que la racha visible se reinicie si el ritmo se corta.
 *   mantener        apretado sin soltar: la barra se llena con `latir`.
 *   circulo         el vector de movimiento del dedo gira: cada 2π = una unidad.
 *                   Así se gira la manivela sin tener que adivinar el centro.
 *   direccion       un arrastre que avanza lo pedido hacia el lado pedido.
 */
import type {
  AvanceGesto,
  EventoEntrada,
  PedidoGesto,
  PuertoGestos,
} from '@juegosemi/puertos';
import { VUELTA, acotar01, anguloDe, avanceEnDireccion, distancia, normalizarAngulo } from './geometria.ts';

// Tolerancias por defecto (generosas a propósito: el gesto tiene que perdonar).
const MANTENER_MS = 1500;
const VENTANA_TOQUES_MS = 3000;
const DISTANCIA_ARRASTRE_PX = 60;
const TAP_MAX_MS = 900;
const TAP_TOLERANCIA_PX = 48;
const PASO_CIRCULO_PX = 4;

interface Punto {
  x: number;
  y: number;
}

/** Un número positivo, o el valor de base si viene vacío o inválido. */
function positivo(valor: number | undefined, base: number): number {
  if (valor === undefined || !Number.isFinite(valor) || valor <= 0) return base;
  return valor;
}

/** Redondea un "cuántas veces" a un entero ≥ 1. */
function vecesDe(valor: number | undefined): number {
  return Math.max(1, Math.floor(positivo(valor, 1)));
}

/** Completa un pedido con las tolerancias por defecto de su gesto. */
export function normalizarPedido(pedido: PedidoGesto): PedidoGesto {
  const completo: PedidoGesto = {
    gesto: pedido.gesto,
    veces: vecesDe(pedido.veces),
  };
  if (pedido.destino !== undefined) completo.destino = pedido.destino;

  switch (pedido.gesto) {
    case 'mantener':
      completo.milisegundos = positivo(pedido.milisegundos, MANTENER_MS);
      break;
    case 'toque_repetido':
      completo.ventana = positivo(pedido.ventana, VENTANA_TOQUES_MS);
      break;
    case 'circulo':
      completo.sentido = pedido.sentido;
      break;
    case 'direccion':
      completo.distancia = positivo(pedido.distancia, DISTANCIA_ARRASTRE_PX);
      completo.direccion = pedido.direccion ?? 'derecha';
      break;
  }
  return completo;
}

export class Reconocedor implements PuertoGestos {
  private objetivo: PedidoGesto | null = null;
  private hechas = 0;
  private progreso = 0;
  private completado = false;

  // Estado de la interacción en curso (un dedo por vez: alcanza y simplifica).
  private puntero: number | null = null;
  private desde: Punto | null = null;
  private inicioMs: number | null = null;
  private apretado = false;
  private ultimoPunto: Punto | null = null;
  private anguloPrevio: number | null = null;
  private anguloAcumulado = 0;
  private ultimoToqueMs: number | null = null;
  /** Para `direccion`: píxeles ya recorridos hacia el lado pedido, entre varios arrastres. */
  private arrastreAcumulado = 0;
  /** Para `direccion`: lo más lejos que llegó ESTE arrastre (para no sumar dos veces). */
  private haciaEnTrazo = 0;

  private cbProgresar: ((avance: AvanceGesto) => void) | null = null;
  private cbCompletar: ((pedido: PedidoGesto, avance: AvanceGesto) => void) | null = null;

  // ── Lo que pide el juego ──────────────────────────────────────────────────

  pedir(pedido: PedidoGesto): void {
    this.objetivo = normalizarPedido(pedido);
    this.limpiar();
    this.notificarProgreso();
  }

  reiniciar(): void {
    this.objetivo = null;
    this.limpiar();
    this.progreso = 0;
  }

  pedido(): PedidoGesto | null {
    return this.objetivo;
  }

  avance(): AvanceGesto {
    return {
      progreso: this.completado ? 1 : acotar01(this.progreso),
      hechas: this.hechas,
      veces: this.objetivo === null ? 1 : vecesDe(this.objetivo.veces),
      completado: this.completado,
    };
  }

  alProgresar(callback: (avance: AvanceGesto) => void): void {
    this.cbProgresar = callback;
  }

  alCompletarGesto(callback: (pedido: PedidoGesto, avance: AvanceGesto) => void): void {
    this.cbCompletar = callback;
  }

  // ── Lo que llega de la entrada táctil ─────────────────────────────────────

  alimentar(evento: EventoEntrada, ahoraMs: number): void {
    const pedido = this.objetivo;
    if (pedido === null || this.completado) return;

    switch (pedido.gesto) {
      case 'toque_repetido':
        this.procesarToque(pedido, evento, ahoraMs);
        break;
      case 'mantener':
        this.procesarMantener(evento, ahoraMs);
        break;
      case 'circulo':
        this.procesarCirculo(pedido, evento);
        break;
      case 'direccion':
        this.procesarDireccion(pedido, evento);
        break;
    }
    this.notificarProgreso();
  }

  /** Late el reloj sin evento: sólo `mantener` avanza con esto. */
  latir(ahoraMs: number): void {
    const pedido = this.objetivo;
    if (pedido === null || this.completado || pedido.gesto !== 'mantener') return;
    this.latirMantener(pedido, ahoraMs);
    this.notificarProgreso();
  }

  // ── Cada gesto ────────────────────────────────────────────────────────────

  private procesarToque(pedido: PedidoGesto, evento: EventoEntrada, ahoraMs: number): void {
    if (evento.tipo === 'pulsar') {
      if (this.puntero !== null) return;
      this.puntero = evento.puntero;
      this.desde = { x: evento.x, y: evento.y };
      this.inicioMs = ahoraMs;
      return;
    }
    if (evento.tipo !== 'soltar' && evento.tipo !== 'cancelar') return;
    if (evento.puntero !== this.puntero) return;

    const desde = this.desde;
    const inicioMs = this.inicioMs;
    this.puntero = null;
    this.desde = null;
    this.inicioMs = null;

    if (evento.tipo === 'cancelar' || desde === null || inicioMs === null) return;
    const movido = distancia(desde.x, desde.y, evento.x, evento.y);
    // Un arrastre (o un toque eterno) no es un toque de "machacar".
    if (movido > TAP_TOLERANCIA_PX || ahoraMs - inicioMs > TAP_MAX_MS) return;

    // Ritmo: si pasó mucho desde el toque anterior, la racha visible se reinicia.
    // Ojo: lo ya logrado NUNCA se resta (regla de oro); sólo las "veces" que se
    // muestran. El toque igual avisa, así un niño lento también llega.
    const ventana = pedido.ventana ?? VENTANA_TOQUES_MS;
    if (this.ultimoToqueMs !== null && ahoraMs - this.ultimoToqueMs > ventana) {
      this.hechas = 0;
    }
    this.ultimoToqueMs = ahoraMs;
    this.unidad();
    if (!this.completado) this.progreso = this.hechas / vecesDe(pedido.veces);
  }

  private procesarMantener(evento: EventoEntrada, ahoraMs: number): void {
    if (evento.tipo === 'pulsar') {
      if (this.puntero !== null) return;
      this.puntero = evento.puntero;
      this.apretado = true;
      this.inicioMs = ahoraMs;
      this.progreso = 0;
      return;
    }
    if (evento.tipo !== 'soltar' && evento.tipo !== 'cancelar') return;
    if (evento.puntero !== this.puntero) return;
    this.puntero = null;
    this.apretado = false;
    this.inicioMs = null;
    // Se levantó antes de terminar: no pasó nada malo, la barra vuelve a cero.
    if (!this.completado) this.progreso = 0;
  }

  private latirMantener(pedido: PedidoGesto, ahoraMs: number): void {
    if (!this.apretado || this.inicioMs === null) return;
    const requiere = pedido.milisegundos ?? MANTENER_MS;
    const transcurrido = ahoraMs - this.inicioMs;
    if (transcurrido < requiere) {
      this.progreso = transcurrido / requiere;
      return;
    }
    // Una mantención completa. Si pide más, hay que volver a apretar.
    this.apretado = false;
    this.inicioMs = null;
    this.puntero = null;
    this.unidad();
    this.progreso = this.completado ? 1 : this.hechas / vecesDe(pedido.veces);
  }

  private procesarCirculo(pedido: PedidoGesto, evento: EventoEntrada): void {
    if (evento.tipo === 'pulsar') {
      if (this.puntero !== null) return;
      this.puntero = evento.puntero;
      this.ultimoPunto = { x: evento.x, y: evento.y };
      this.anguloPrevio = null;
      return;
    }
    if (evento.tipo === 'soltar' || evento.tipo === 'cancelar') {
      if (evento.puntero !== this.puntero) return;
      this.puntero = null;
      this.ultimoPunto = null;
      // Se corta el trazo; el ángulo ya ganado se conserva (perdonar, no exigir).
      this.anguloPrevio = null;
      return;
    }
    if (evento.tipo !== 'mover' || evento.puntero !== this.puntero) return;

    const anterior = this.ultimoPunto;
    if (anterior === null) return;
    const dx = evento.x - anterior.x;
    const dy = evento.y - anterior.y;
    if (Math.sqrt(dx * dx + dy * dy) < PASO_CIRCULO_PX) return;

    const angulo = anguloDe(anterior.x, anterior.y, evento.x, evento.y);
    this.ultimoPunto = { x: evento.x, y: evento.y };
    if (this.anguloPrevio === null) {
      this.anguloPrevio = angulo;
      return;
    }

    let delta = normalizarAngulo(angulo - this.anguloPrevio);
    this.anguloPrevio = angulo;
    // Si se pidió un sentido, el contrario se ignora (no resta: se descarta).
    if (pedido.sentido === 'horario' && delta < 0) delta = 0;
    if (pedido.sentido === 'antihorario' && delta > 0) delta = 0;

    this.anguloAcumulado += delta;
    if (Math.abs(this.anguloAcumulado) >= VUELTA) {
      this.anguloAcumulado -= Math.sign(this.anguloAcumulado) * VUELTA;
      this.unidad();
    }
    if (this.completado) {
      this.progreso = 1;
      this.anguloAcumulado = 0;
    } else {
      const fraccion = acotar01(Math.abs(this.anguloAcumulado) / VUELTA);
      this.progreso = acotar01((this.hechas + fraccion) / vecesDe(pedido.veces));
    }
  }

  private procesarDireccion(pedido: PedidoGesto, evento: EventoEntrada): void {
    if (evento.tipo === 'pulsar') {
      if (this.puntero !== null) return;
      this.puntero = evento.puntero;
      this.desde = { x: evento.x, y: evento.y };
      this.haciaEnTrazo = 0;
      return;
    }
    if (evento.tipo === 'soltar' || evento.tipo === 'cancelar') {
      if (evento.puntero !== this.puntero) return;
      this.puntero = null;
      this.desde = null;
      this.haciaEnTrazo = 0;
      // Lo arrastrado YA quedó contado: si suelta a mitad de camino, sigue desde
      // ahí (perdonar, no exigir). El progreso no se pierde.
      return;
    }
    if (evento.tipo !== 'mover' || evento.puntero !== this.puntero) return;

    const desde = this.desde;
    if (desde === null) return;
    const hacia = avanceEnDireccion(
      evento.x - desde.x,
      evento.y - desde.y,
      pedido.direccion ?? 'derecha',
    );
    // Se suma sólo lo NUEVO de este arrastre: ir y volver sobre lo mismo no infla
    // la cuenta, pero repetir el arrastre en el lado pedido sí va sumando.
    if (hacia > this.haciaEnTrazo) {
      this.arrastreAcumulado += hacia - this.haciaEnTrazo;
      this.haciaEnTrazo = hacia;
    }

    const distanciaPedida = pedido.distancia ?? DISTANCIA_ARRASTRE_PX;
    if (this.arrastreAcumulado < distanciaPedida) {
      this.progreso = acotar01(this.arrastreAcumulado / distanciaPedida);
      return;
    }

    // Una unidad completa: se descuenta lo pedido y se sigue desde el punto actual
    // (para varios, el origen se corre y el resto de este arrastre cuenta igual).
    this.arrastreAcumulado -= distanciaPedida;
    this.haciaEnTrazo = 0;
    this.desde = { x: evento.x, y: evento.y };
    this.unidad();
    if (this.completado) {
      this.progreso = 1;
      return;
    }
    const fraccion = acotar01(this.arrastreAcumulado / distanciaPedida);
    this.progreso = acotar01((this.hechas + fraccion) / vecesDe(pedido.veces));
  }

  // ── Ayudas internas ───────────────────────────────────────────────────────

  /** Cierra una unidad del pedido y avisa (el juego lo manda como `gesto_completado`). */
  private unidad(): void {
    const pedido = this.objetivo;
    if (pedido === null) return;
    this.hechas += 1;
    if (this.hechas >= vecesDe(pedido.veces)) {
      this.hechas = vecesDe(pedido.veces);
      this.completado = true;
      this.progreso = 1;
    }
    this.cbCompletar?.(pedido, this.avance());
  }

  private notificarProgreso(): void {
    this.cbProgresar?.(this.avance());
  }

  private limpiar(): void {
    this.hechas = 0;
    this.progreso = 0;
    this.completado = false;
    this.puntero = null;
    this.desde = null;
    this.inicioMs = null;
    this.apretado = false;
    this.ultimoPunto = null;
    this.anguloPrevio = null;
    this.anguloAcumulado = 0;
    this.ultimoToqueMs = null;
    this.arrastreAcumulado = 0;
    this.haciaEnTrazo = 0;
  }
}

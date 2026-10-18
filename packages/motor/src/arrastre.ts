import type { EventoEntrada } from '@juegosemi/puertos';
import type { Entidad } from './escena.ts';
import type { Escena } from './escena.ts';

/**
 * El arrastre (tocar, mover, soltar) sobre las entidades de la escena.
 *
 * Es la interacción central del primer juego (llevar a una persona hasta su
 * auto), así que vive en el motor y no en el juego: cualquier juego futuro
 * (arrastrar piezas de un personaje, ordenar pasos, armar secuencias) reusa
 * exactamente este comportamiento.
 */
export interface OpcionesArrastre {
  /** Filtro: qué entidades se pueden tomar. */
  sePuedeArrastrar?: (entidad: Entidad) => boolean;
  /**
   * Filtro de DESTINO: qué entidades cuentan al soltar. Sin esto, una pieza que
   * acaba de quedar encima de otra (por ejemplo la que se está desvaneciendo
   * sobre un auto) puede "robar" el destino. Medido en el juego de los autos.
   */
  sePuedeSoltar?: (entidad: Entidad) => boolean;
  alEmpezar?: (entidad: Entidad, x: number, y: number) => void;
  alMover?: (entidad: Entidad, x: number, y: number) => void;
  /** `destino` es la entidad que hay debajo al soltar (null si es el vacío). */
  alSoltar?: (entidad: Entidad, destino: Entidad | null, x: number, y: number) => void;
  /** Cuánto se levanta la pieza al agarrarla (para que se vea "levantada"). */
  escalaAlAgarrar?: number;
}

export class Arrastre {
  private readonly escena: Escena;
  private readonly opciones: OpcionesArrastre;
  private actual: Entidad | null = null;
  private desplazamiento = { x: 0, y: 0 };
  private escalaOriginalX = 1;
  private escalaOriginalY = 1;

  constructor(escena: Escena, opciones: OpcionesArrastre = {}) {
    this.escena = escena;
    this.opciones = opciones;
  }

  /** La entidad que se está arrastrando ahora mismo (null si ninguna). */
  enMano(): Entidad | null {
    return this.actual;
  }

  estaArrastrando(): boolean {
    return this.actual !== null;
  }

  /**
   * Procesa un evento de entrada. Es una función pura respecto del mundo: sólo
   * muta la escena y llama a los callbacks.
   */
  procesar(evento: EventoEntrada): void {
    if (evento.tipo === 'pulsar') {
      const elegida = this.escena.en(evento.x, evento.y, { filtro: this.opciones.sePuedeArrastrar });
      if (!elegida) return;
      this.actual = elegida;
      this.desplazamiento = { x: elegida.x - evento.x, y: elegida.y - evento.y };
      this.escalaOriginalX = elegida.escalaX;
      this.escalaOriginalY = elegida.escalaY;
      const aumento = this.opciones.escalaAlAgarrar ?? 1.15;
      elegida.escalaX = this.escalaOriginalX * aumento;
      elegida.escalaY = this.escalaOriginalY * aumento;
      // se pone adelante para que se vea por encima de todo
      elegida.orden += 1000;
      if (this.opciones.alEmpezar) this.opciones.alEmpezar(elegida, evento.x, evento.y);
      return;
    }

    if (!this.actual) return;
    const arrastrada = this.actual;

    if (evento.tipo === 'mover') {
      arrastrada.x = evento.x + this.desplazamiento.x;
      arrastrada.y = evento.y + this.desplazamiento.y;
      if (this.opciones.alMover) this.opciones.alMover(arrastrada, arrastrada.x, arrastrada.y);
      return;
    }

    if (evento.tipo === 'soltar' || evento.tipo === 'cancelar') {
      arrastrada.escalaX = this.escalaOriginalX;
      arrastrada.escalaY = this.escalaOriginalY;
      arrastrada.orden -= 1000;
      this.actual = null;
      const destino =
        evento.tipo === 'soltar'
          ? this.escena.en(evento.x, evento.y, { excluir: arrastrada.id, filtro: this.opciones.sePuedeSoltar })
          : null;
      if (this.opciones.alSoltar) this.opciones.alSoltar(arrastrada, destino, evento.x, evento.y);
    }
  }

  /** Cancela el arrastre en curso devolviendo la pieza a su lugar. */
  cancelar(): void {
    if (!this.actual) return;
    const arrastrada = this.actual;
    arrastrada.escalaX = this.escalaOriginalX;
    arrastrada.escalaY = this.escalaOriginalY;
    arrastrada.orden -= 1000;
    this.actual = null;
  }
}

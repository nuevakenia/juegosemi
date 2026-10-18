/**
 * @juegosemi/personajes — la boca de ventrílocuo.
 *
 * El truco del estilo South Park: no hay animación de boca, hay FORMAS de boca
 * que se intercambian mientras el personaje habla. Acá se decide QUÉ forma va
 * en cada momento a partir del texto que está diciendo, y cuánto se abre.
 *
 * Todo son DATOS: la tabla de visemas (`data/visemas.json`) dice qué forma le
 * toca a cada letra y cuánto abre cada una. Una letra que no esté en la tabla
 * se salta sin romper nada (los signos de puntuación, por ejemplo).
 */

import type { TablaVisemas, Visema, Pose } from './tipo.ts';

export interface BloqueVisema {
  visema: Visema;
  /** Momento en que empieza, en segundos desde el arranque del texto. */
  desde: number;
  hasta: number;
}

export interface OpcionesBoca {
  /** Cuánto dura cada forma de boca (una letra). */
  duracionPorVisema?: number;
  /** Cuánto se queda la boca cerrada entre palabras. */
  pausaEntrePalabras?: number;
  /** Cuánto se queda la boca cerrada en una coma o un punto. */
  pausaDePuntuacion?: number;
  /** Id de la pieza de la boca en el rig. */
  pieza?: string;
}

const DURACION_POR_VISEMA = 0.085;
const PAUSA_ENTRE_PALABRAS = 0.12;
const PAUSA_DE_PUNTUACION = 0.26;
const PIEZA_BOCA = 'boca';

/** Saca los acentos y pasa a minúscula: "Á" y "a" abren la boca igual. */
export function letraNormalizada(letra: string): string {
  return letra.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function visemaPorId(tabla: TablaVisemas, id: string): Visema | null {
  for (const visema of tabla.visemas) if (visema.id === id) return visema;
  return null;
}

/** La forma de boca de una letra (null si esa letra no tiene forma asignada). */
export function visemaDeLetra(tabla: TablaVisemas, letra: string): Visema | null {
  const id = tabla.letras[letraNormalizada(letra)];
  if (id === undefined) return null;
  return visemaPorId(tabla, id);
}

/** La boca de silencio. */
export function visemaCerrado(tabla: TablaVisemas): Visema | null {
  return visemaPorId(tabla, tabla.cerrada);
}

function esEspacio(letra: string): boolean {
  return /\s/.test(letra);
}

function esPuntuacion(letra: string): boolean {
  return /[.,;:!?¡¿…-]/.test(letra);
}

/**
 * Parte un texto en bloques de boca, con su momento de entrada y salida. Los
 * espacios y los signos cierran la boca un momento (si no, se ve como un
 * metralleta de formas).
 */
export function bloquesDeTexto(tabla: TablaVisemas, texto: string, opciones: OpcionesBoca = {}): BloqueVisema[] {
  const duracion = opciones.duracionPorVisema ?? DURACION_POR_VISEMA;
  const pausaPalabra = opciones.pausaEntrePalabras ?? PAUSA_ENTRE_PALABRAS;
  const pausaPuntuacion = opciones.pausaDePuntuacion ?? PAUSA_DE_PUNTUACION;
  const cerrada = visemaCerrado(tabla);

  const bloques: BloqueVisema[] = [];
  let t = 0;

  for (const letra of texto) {
    if (esEspacio(letra)) {
      if (cerrada && pausaPalabra > 0) bloques.push({ visema: cerrada, desde: t, hasta: t + pausaPalabra });
      t += pausaPalabra;
      continue;
    }
    if (esPuntuacion(letra)) {
      if (cerrada && pausaPuntuacion > 0) bloques.push({ visema: cerrada, desde: t, hasta: t + pausaPuntuacion });
      t += pausaPuntuacion;
      continue;
    }
    const visema = visemaDeLetra(tabla, letra);
    if (!visema) continue;
    bloques.push({ visema, desde: t, hasta: t + duracion });
    t += duracion;
  }

  return bloques;
}

/**
 * La pose de la boca para un visema: abre o cierra la pieza estirándola en
 * vertical. Es una escala ENCIMA de la de la plantilla, así que el lado derecho
 * (espejado) sigue abriendo bien.
 */
export function poseDeVisema(visema: Visema, pieza: string = PIEZA_BOCA): Pose {
  const abierto = 0.35 + 0.65 * Math.max(0, Math.min(1, visema.apertura));
  return { escalas: { [pieza]: { x: 1, y: abierto } } };
}

/** La textura de la boca para un visema (lo que come el adaptador de render). */
export function texturasDeVisema(visema: Visema | null, pieza: string = PIEZA_BOCA): Record<string, string | null> {
  return { [pieza]: visema ? visema.boca : null };
}

/**
 * La boca viva: se le dice un texto y después se le pregunta, momento a momento,
 * qué forma mostrar. No tiene reloj propio: el tiempo entra por parámetro, igual
 * que en el resto del motor (así se puede pausar y testear sin esperar).
 */
export class Boca {
  private readonly tabla: TablaVisemas;
  private readonly opciones: OpcionesBoca;
  private bloques: BloqueVisema[] = [];
  private inicio = 0;
  private dicho = '';
  private actual: Visema | null;

  constructor(tabla: TablaVisemas, opciones: OpcionesBoca = {}) {
    this.tabla = tabla;
    this.opciones = opciones;
    this.actual = visemaCerrado(tabla);
  }

  private get pieza(): string {
    return this.opciones.pieza ?? PIEZA_BOCA;
  }

  /** Empieza a decir un texto. `ahora` es el momento actual, en segundos. */
  decir(texto: string, ahora = 0): void {
    this.dicho = texto;
    this.inicio = ahora;
    this.bloques = bloquesDeTexto(this.tabla, texto, this.opciones);
    this.actual = visemaCerrado(this.tabla);
  }

  /** Cierra la boca y olvida el texto. */
  callar(): void {
    this.bloques = [];
    this.dicho = '';
    this.actual = visemaCerrado(this.tabla);
  }

  /** Cuánto dura el texto que está diciendo, en segundos. */
  duracion(): number {
    const ultimo = this.bloques[this.bloques.length - 1];
    return ultimo ? ultimo.hasta : 0;
  }

  /** ¿Está hablando en este momento? */
  hablando(ahora: number): boolean {
    const t = ahora - this.inicio;
    const ultimo = this.bloques[this.bloques.length - 1];
    if (!ultimo) return false;
    return t >= 0 && t < ultimo.hasta;
  }

  /** La forma de boca que corresponde a este momento. */
  visemaEn(ahora: number): Visema | null {
    const t = ahora - this.inicio;
    if (this.bloques.length === 0) return visemaCerrado(this.tabla);
    if (t < 0) return visemaCerrado(this.tabla);
    for (const bloque of this.bloques) {
      if (t >= bloque.desde && t < bloque.hasta) return bloque.visema;
    }
    return visemaCerrado(this.tabla);
  }

  /** Guarda el visema del momento y lo devuelve (es lo que llama el juego por paso). */
  actualizar(ahora: number): Visema | null {
    this.actual = this.visemaEn(ahora);
    return this.actual;
  }

  /** El último visema calculado (sin volver a mirar el reloj). */
  visemaActual(): Visema | null {
    return this.actual;
  }

  /** Cuánto abre la boca en este momento (0 cerrada, 1 abierta del todo). */
  apertura(ahora: number): number {
    const visema = this.visemaEn(ahora);
    return visema ? visema.apertura : 0;
  }

  /** El texto que está diciendo. */
  texto(): string {
    return this.dicho;
  }

  /** Los bloques armados (para depurar y para los tests). */
  bloquesArmados(): readonly BloqueVisema[] {
    return this.bloques;
  }

  /** Todo lo que el adaptador de render necesita para pintar esta boca. */
  opcionesDibujo(ahora: number): { pose: Pose; texturas: Record<string, string | null> } {
    const visema = this.visemaEn(ahora);
    return {
      pose: visema ? poseDeVisema(visema, this.pieza) : { escalas: { [this.pieza]: { x: 1, y: 0.35 } } },
      texturas: texturasDeVisema(visema, this.pieza),
    };
  }
}

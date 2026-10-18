/**
 * Encuadrar al personaje dentro del escenario.
 *
 * Medido en el navegador: el ORIGEN de `rig.dibujos({ x, y })` es la CABEZA y el
 * cuerpo se extiende hacia ABAJO, así que poner `y = alto - 40` recorta las
 * piernas. Acá no se adivina: se MIDE la caja que envuelve a los dibujos en la
 * grilla canónica (escala 1) y se calcula el zoom y el corrimiento para que el
 * rectángulo completo quede centrado y entero, sea un celular chico o una tablet.
 *
 * Es puro (sólo números y la lista de dibujos): se prueba sin navegador.
 */

import type { DibujoEntidad } from '@juegosemi/puertos';
import type { Pose, Rig } from '@juegosemi/personajes';

/** El rectángulo que envuelve a un conjunto de dibujos, en píxeles de destino. */
export interface Caja {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  ancho: number;
  alto: number;
}

/** Cuánto del escenario puede ocupar el personaje (deja aire para que respire). */
export const MARGEN_POR_DEFECTO = 0.9;

/**
 * La caja que envuelve a los dibujos. Usa el centro y el tamaño de cada pieza,
 * sin girarlas: un poco de aire de más nunca recorta y sale más barato que
 * resolver la rotación en el encuadre.
 */
export function medirDibujos(dibujos: readonly DibujoEntidad[]): Caja {
  if (dibujos.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, ancho: 0, alto: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const dibujo of dibujos) {
    const medioAncho = Math.abs(dibujo.ancho * dibujo.escalaX) / 2;
    const medioAlto = Math.abs(dibujo.alto * dibujo.escalaY) / 2;
    minX = Math.min(minX, dibujo.x - medioAncho);
    maxX = Math.max(maxX, dibujo.x + medioAncho);
    minY = Math.min(minY, dibujo.y - medioAlto);
    maxY = Math.max(maxY, dibujo.y + medioAlto);
  }
  return { minX, minY, maxX, maxY, ancho: maxX - minX, alto: maxY - minY };
}

/** La caja del rig en reposo (escala 1, sin corrimiento): la referencia del encuadre. */
export function medirRig(rig: Rig): Caja {
  return medirDibujos(rig.dibujos({ escala: 1, x: 0, y: 0 }));
}

/** Cómo escalar y correr al personaje para que entre entero y centrado. */
export interface Encuadre {
  escala: number;
  x: number;
  y: number;
}

/**
 * Calcula el zoom y el corrimiento para meter `caja` dentro de `ancho`×`alto`,
 * centrada. El eje que más aprieta manda (no se deforma), y `margen` deja aire.
 */
export function encuadrar(ancho: number, alto: number, caja: Caja, margen = MARGEN_POR_DEFECTO): Encuadre {
  const cajaAncho = caja.ancho > 0 ? caja.ancho : 1;
  const cajaAlto = caja.alto > 0 ? caja.alto : 1;
  const objetivoAncho = (ancho > 0 ? ancho : 1) * margen;
  const objetivoAlto = (alto > 0 ? alto : 1) * margen;
  const escala = Math.max(0.01, Math.min(objetivoAncho / cajaAncho, objetivoAlto / cajaAlto));
  const centroX = (caja.minX + caja.maxX) / 2;
  const centroY = (caja.minY + caja.maxY) / 2;
  return {
    escala,
    x: ancho / 2 - centroX * escala,
    y: alto / 2 - centroY * escala,
  };
}

/** Opciones de dibujo encuadrado. */
export interface OpcionesDibujoEncuadrado {
  /** Pose animada a aplicar encima del reposo. */
  pose?: Pose;
  /** Textura forzada por pieza (por acá entra el visema de la boca). */
  texturas?: Record<string, string | null>;
}

/** Los dibujos del rig, ya escalados y centrados dentro del escenario. */
export function dibujarConEncuadre(
  rig: Rig,
  encuadre: Encuadre,
  opciones: OpcionesDibujoEncuadrado = {},
): DibujoEntidad[] {
  const dibujo: {
    escala: number;
    x: number;
    y: number;
    pose?: Pose;
    texturas?: Record<string, string | null>;
  } = { escala: encuadre.escala, x: encuadre.x, y: encuadre.y };
  if (opciones.pose !== undefined) dibujo.pose = opciones.pose;
  if (opciones.texturas !== undefined) dibujo.texturas = opciones.texturas;
  return rig.dibujos(dibujo);
}

/**
 * Atajo de una sola llamada: mide el rig, lo encuadra y devuelve los dibujos
 * centrados. Sirve para el primer cuadro y para los tests; el bucle de animación
 * mide UNA vez por cambio de personaje y reencuadra sólo si cambia el tamaño.
 */
export function dibujarPersonaje(
  rig: Rig,
  ancho: number,
  alto: number,
  opciones: OpcionesDibujoEncuadrado & { margen?: number } = {},
): DibujoEntidad[] {
  const caja = medirRig(rig);
  const margen = opciones.margen === undefined ? MARGEN_POR_DEFECTO : opciones.margen;
  return dibujarConEncuadre(rig, encuadrar(ancho, alto, caja, margen), {
    pose: opciones.pose,
    texturas: opciones.texturas,
  });
}

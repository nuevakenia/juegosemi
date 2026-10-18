/**
 * Geometría de los gestos: leer direcciones y ángulos sin saber de DOM ni de
 * tiempo.
 *
 * Todo son funciones puras, así que la parte difícil del reconocimiento (la que
 * decide si un arrastre va en la dirección pedida o si un dedo dio una vuelta)
 * se prueba con números y no con un navegador.
 */
import type { DireccionGesto } from '@juegosemi/puertos';

/** Una vuelta completa, en radianes. */
export const VUELTA = Math.PI * 2;

/**
 * Lleva un ángulo a (-π, π]. Así un salto de 350° a 10° se lee como +20° y no
 * como -340°: es lo que permite sumar el giro de un dedo sin que el borde de la
 * circunferencia dispare un vuelco falso.
 */
export function normalizarAngulo(angulo: number): number {
  let a = angulo;
  while (a <= -Math.PI) a += VUELTA;
  while (a > Math.PI) a -= VUELTA;
  return a;
}

/** Distancia entre dos puntos. */
export function distancia(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Ángulo (radianes) del vector que va del primer punto al segundo. */
export function anguloDe(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

/** El eje unitario de una dirección pedida. En pantalla la Y crece hacia abajo. */
export function ejeDeDireccion(direccion: DireccionGesto): { x: number; y: number } {
  switch (direccion) {
    case 'izquierda':
      return { x: -1, y: 0 };
    case 'derecha':
      return { x: 1, y: 0 };
    case 'arriba':
      return { x: 0, y: -1 };
    case 'abajo':
      return { x: 0, y: 1 };
  }
}

/** Cuánto del desplazamiento va en la dirección pedida (positivo = va para allá). */
export function avanceEnDireccion(dx: number, dy: number, direccion: DireccionGesto): number {
  const eje = ejeDeDireccion(direccion);
  return dx * eje.x + dy * eje.y;
}

/** Encierra un valor entre 0 y 1 (y limpia los no-números a 0). */
export function acotar01(valor: number): number {
  if (!Number.isFinite(valor) || valor < 0) return 0;
  if (valor > 1) return 1;
  return valor;
}

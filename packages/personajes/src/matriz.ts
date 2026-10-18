/**
 * @juegosemi/personajes — matriz afín 2D (2x3).
 *
 * Es la única pieza de matemática del paquete: cada parte del cuerpo tiene su
 * matriz de mundo, y las partes hijas se cuelgan de la matriz del padre. Así el
 * rig queda articulado de verdad (si el hombro gira, el brazo entero se mueve)
 * y no hace falta redondear a mano ninguna posición.
 *
 * Layout de la matriz, igual que en canvas/PixiJS:
 *
 *   | a  c  e |
 *   | b  d  f |
 *   | 0  0  1 |
 *
 * Sin dependencias externas a propósito.
 */

export interface Punto {
  x: number;
  y: number;
}

export interface Matriz {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/** La matriz que no mueve nada. */
export function identidad(): Matriz {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

/**
 * `multiplicar(m, n)` = primero `n`, después `m` (el orden importa: una
 * rotación adentro de una traslación no es lo mismo que al revés).
 */
export function multiplicar(m: Matriz, n: Matriz): Matriz {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

export function trasladar(x: number, y: number): Matriz {
  return { a: 1, b: 0, c: 0, d: 1, e: x, f: y };
}

/** Rotación en RADIANES. Positivo gira en el sentido de las manecillas (y va para abajo). */
export function rotar(radianes: number): Matriz {
  const cos = Math.cos(radianes);
  const sin = Math.sin(radianes);
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
}

export function escalar(x: number, y: number): Matriz {
  return { a: x, b: 0, c: 0, d: y, e: 0, f: 0 };
}

/** Lleva un punto del sistema local al de la matriz. */
export function aplicar(m: Matriz, x: number, y: number): Punto {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

/** Cuánto gira esta matriz (radianes). Con espejo devuelve la imagen reflejada. */
export function rotacion(m: Matriz): number {
  return Math.atan2(m.b, m.a);
}

/** Largo del eje X: cuánto se estira la matriz en horizontal (siempre positivo). */
export function largoX(m: Matriz): number {
  return Math.hypot(m.a, m.b);
}

/**
 * Largo del eje Y. Sale NEGATIVO cuando la matriz está espejada (el
 * determinante cambió de signo): es la señal de "esta pieza va dada vuelta",
 * que el adaptador de render necesita para dar vuelta la textura.
 */
export function largoY(m: Matriz): number {
  const determinante = m.a * m.d - m.b * m.c;
  const largo = Math.hypot(m.c, m.d);
  return determinante < 0 ? -largo : largo;
}

/** Convierte grados (lo que se escribe en los DATOS) a radianes (lo que usa el render). */
export function aRadianes(grados: number): number {
  return (grados * Math.PI) / 180;
}

export function aGrados(radianes: number): number {
  return (radianes * 180) / Math.PI;
}

/** ¿Los dos números son prácticamente iguales? (para los tests y la mezcla de poses) */
export function casiIgual(a: number, b: number, tolerancia = 1e-9): boolean {
  return Math.abs(a - b) <= tolerancia;
}

export function puntoCasiIgual(a: Punto, b: Punto, tolerancia = 1e-9): boolean {
  return casiIgual(a.x, b.x, tolerancia) && casiIgual(a.y, b.y, tolerancia);
}

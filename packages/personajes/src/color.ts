/**
 * @juegosemi/personajes — colores.
 *
 * Los DATOS llevan el color como texto ("#f4c9a0"): es lo que un humano (o un
 * agente) escribe y revisa bien. El render quiere un número (0xf4c9a0). Acá
 * vive la traducción, y también el sombreado barato (oscurecer una manga para
 * que se note el brazo sobre el cuerpo) que no necesita ningún arte.
 */

export interface ColorRgb {
  r: number;
  g: number;
  b: number;
}

const HEX_CORTO = /^#([0-9a-fA-F]{3})$/;
const HEX_LARGO = /^#([0-9a-fA-F]{6})$/;

/** ¿Es un color hex válido de 3 o 6 dígitos? */
export function esHexValido(texto: unknown): texto is string {
  if (typeof texto !== 'string') return false;
  return HEX_CORTO.test(texto) || HEX_LARGO.test(texto);
}

/**
 * "#f4c9a0" → 0xf4c9a0. Devuelve null si el texto no es un hex válido: el
 * llamador decide qué hacer (nunca inventamos un color en silencio).
 */
export function colorANumero(texto: string): number | null {
  const largo = HEX_LARGO.exec(texto);
  if (largo) return parseInt(largo[1]!, 16);
  const corto = HEX_CORTO.exec(texto);
  if (!corto) return null;
  const d = corto[1]!;
  const r = d.charAt(0);
  const g = d.charAt(1);
  const b = d.charAt(2);
  return parseInt(`${r}${r}${g}${g}${b}${b}`, 16);
}

/** 0xf4c9a0 → "#f4c9a0" (siempre 6 dígitos, listo para los DATOS). */
export function numeroAColor(numero: number): string {
  const acotado = Math.max(0, Math.min(0xffffff, Math.round(numero)));
  const texto = acotado.toString(16).padStart(6, '0');
  return `#${texto}`;
}

export function aRgb(numero: number): ColorRgb {
  const acotado = Math.max(0, Math.min(0xffffff, Math.round(numero)));
  return {
    r: (acotado >> 16) & 0xff,
    g: (acotado >> 8) & 0xff,
    b: acotado & 0xff,
  };
}

export function deRgb(color: ColorRgb): number {
  const acotar = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (acotar(color.r) << 16) | (acotar(color.g) << 8) | acotar(color.b);
}

/** Mezcla lineal: f=0 devuelve `a`, f=1 devuelve `b`. Sirve para el fundido entre poses. */
export function mezclarColores(a: number, b: number, f: number): number {
  const t = Math.max(0, Math.min(1, f));
  const ca = aRgb(a);
  const cb = aRgb(b);
  return deRgb({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

/** Aclara acercando cada canal al blanco. `cantidad` va de 0 a 1. */
export function aclarar(numero: number, cantidad: number): number {
  return mezclarColores(numero, 0xffffff, cantidad);
}

/** Oscurece acercando cada canal al negro. `cantidad` va de 0 a 1. */
export function oscurecer(numero: number, cantidad: number): number {
  return mezclarColores(numero, 0x000000, cantidad);
}

/**
 * El "contorno" del estilo South Park: un color mucho más oscuro del mismo
 * tono, que se dibuja un poco más grande por detrás de la pieza.
 */
export function contornoDe(numero: number): number {
  return oscurecer(numero, 0.55);
}

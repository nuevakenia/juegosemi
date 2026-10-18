// Utilidades de accesibilidad compartidas por los componentes de la interfaz.
//
// Regla del paquete: los controles se arman con elementos nativos
// (<button>, <article>, <section>, <h1>/<h2>), nunca con <div> disfrazados de
// boton. Asi el teclado, los lectores de pantalla y el zoom del navegador
// funcionan sin codigo extra.

/**
 * Tamano minimo, en pixeles, de un blanco de toque comodo para un niño.
 * El CSS del paquete reserva al menos esta altura para botones y tarjetas.
 */
export const TOQUE_MINIMO_PX = 88;

/**
 * Junta nombres de clase, descarta los vacios o falsos y evita repetidos.
 * Sirve para armar el atributo `class` sin dejar espacios de sobra.
 */
export function unirClases(
  ...clases: Array<string | false | null | undefined>
): string {
  const resultado: string[] = [];
  for (const entrada of clases) {
    if (typeof entrada !== 'string' || entrada.length === 0) {
      continue;
    }
    const partes = entrada.split(' ');
    for (const parte of partes) {
      if (parte.length > 0 && resultado.indexOf(parte) === -1) {
        resultado.push(parte);
      }
    }
  }
  return resultado.join(' ');
}

/** Contador interno para fabricar ids unicos dentro de la pagina. */
let contadorIds = 0;

/**
 * Genera un id unico con el prefijo indicado.
 * Se usa para enlazar `aria-labelledby` con el titulo que corresponde.
 */
export function idUnico(prefijo: string): string {
  contadorIds += 1;
  return prefijo + '-' + String(contadorIds);
}

/** Opciones del atajo para crear elementos. */
export interface OpcionesElemento {
  /** Nombres de clase separados por espacio. */
  clases?: string;
  /** Texto visible del elemento. */
  texto?: string;
}

/**
 * Crea un elemento y le aplica clases y texto en un solo paso.
 * Atajo interno para no repetir `createElement` + `className` + `textContent`.
 */
export function crearElemento<K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  opciones?: OpcionesElemento,
): HTMLElementTagNameMap[K] {
  const elemento = document.createElement(etiqueta);
  if (opciones !== undefined) {
    if (opciones.clases !== undefined) {
      elemento.className = opciones.clases;
    }
    if (opciones.texto !== undefined) {
      elemento.textContent = opciones.texto;
    }
  }
  return elemento;
}

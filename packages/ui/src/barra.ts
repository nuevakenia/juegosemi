// Barra de progreso de la interfaz.
//
// Muestra cuánto falta para completar algo (un gesto, una carga, una espera) con
// un relleno que crece y un texto opcional arriba. Se arma con elementos nativos
// y se anuncia como `progressbar` para que el lector de pantalla diga el avance.
//
// Se usa tal cual desde el juego de gestos: la barra no sabe de gestos, sólo de
// un valor de 0 a 1.

import { crearElemento, unirClases } from './accesibilidad';

/** Datos para armar una barra. */
export interface OpcionesBarra {
  /** Texto que va arriba de la barra (por ejemplo, lo que hay que hacer). */
  etiqueta?: string;
  /** Valor inicial de 0 a 1. Por defecto 0. */
  valor?: number;
  /** Nombres de clase CSS extra. */
  clasesExtra?: string;
}

/** Una barra ya armada: el elemento y cómo moverla. */
export interface BarraProgreso {
  /** El elemento para meter en la pantalla. */
  elemento: HTMLElement;
  /** Fija el avance (0 a 1): mueve el relleno y actualiza el aria. */
  actualizar(valor: number): void;
  /** El valor actual (0 a 1). */
  valor(): number;
  /** Cambia el texto de arriba (lo crea si no lo había). */
  ponerEtiqueta(texto: string): void;
}

/** Encierra un valor entre 0 y 1 (y limpia los no-números a 0). */
function acotar01(valor: number): number {
  if (!Number.isFinite(valor) || valor < 0) return 0;
  if (valor > 1) return 1;
  return valor;
}

/**
 * Crea una barra de progreso accesible.
 * Devuelve un `<div>` con etiqueta opcional y una pista `role="progressbar"`.
 */
export function crearBarraProgreso(opciones?: OpcionesBarra): BarraProgreso {
  const dato = opciones ?? {};
  let valorActual = acotar01(dato.valor ?? 0);

  const raiz = crearElemento('div', { clases: unirClases('js-barra', dato.clasesExtra) });

  let etiquetaEl: HTMLElement | null = null;
  if (dato.etiqueta !== undefined) {
    etiquetaEl = crearElemento('p', { clases: 'js-barra__etiqueta', texto: dato.etiqueta });
    raiz.appendChild(etiquetaEl);
  }

  const pista = crearElemento('div', { clases: 'js-barra__pista' });
  pista.setAttribute('role', 'progressbar');
  pista.setAttribute('aria-valuemin', '0');
  pista.setAttribute('aria-valuemax', '100');
  const relleno = crearElemento('div', { clases: 'js-barra__relleno' });
  pista.appendChild(relleno);
  raiz.appendChild(pista);

  function pintar(): void {
    const porcentaje = Math.round(valorActual * 100);
    relleno.style.width = `${porcentaje}%`;
    pista.setAttribute('aria-valuenow', String(porcentaje));
  }
  pintar();

  return {
    elemento: raiz,
    actualizar(valor: number): void {
      valorActual = acotar01(valor);
      pintar();
    },
    valor(): number {
      return valorActual;
    },
    ponerEtiqueta(texto: string): void {
      if (etiquetaEl === null) {
        etiquetaEl = crearElemento('p', { clases: 'js-barra__etiqueta', texto });
        raiz.insertBefore(etiquetaEl, pista);
        return;
      }
      etiquetaEl.textContent = texto;
    },
  };
}

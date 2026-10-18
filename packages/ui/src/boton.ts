// Boton grande de la interfaz.
//
// Esta pensado para dedos de niño y para poca precision motriz: es ancho,
// alto, con texto grande y un pictograma que acompana la palabra. Cuando no
// hay pictograma ni un nombre accesible explicito, el propio texto visible le
// da el nombre al lector de pantalla.

import { crearElemento, unirClases } from './accesibilidad';

/** Datos para armar un boton grande. */
export interface OpcionesBoton {
  /** Texto visible del boton. Es obligatorio para que siempre se entienda. */
  etiqueta: string;
  /** Pictograma grande que acompana a la palabra (apoyo visual). */
  pictograma?: string;
  /**
   * Nombre para lectores de pantalla cuando el texto visible no alcanza.
   * Si se omite, el nombre accesible queda siendo la etiqueta visible.
   */
  nombreAccesible?: string;
  /** Se dispara al tocar, clickear o activar el boton con el teclado. */
  alElegir?: () => void;
  /** Boton apagado: se ve atenuado y no responde a la interaccion. */
  deshabilitado?: boolean;
  /** Clases CSS extra que quiera sumar quien use el componente. */
  clasesExtra?: string;
}

/**
 * Crea un `<button>` grande y accesible.
 * Siempre sale con `type="button"` para que no envie formularios sin querer.
 */
export function crearBoton(opciones: OpcionesBoton): HTMLButtonElement {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = unirClases('js-boton', opciones.clasesExtra);

  if (opciones.nombreAccesible !== undefined) {
    boton.setAttribute('aria-label', opciones.nombreAccesible);
  }

  if (opciones.pictograma !== undefined) {
    const pictograma = crearElemento('span', {
      clases: 'js-boton__pictograma',
      texto: opciones.pictograma,
    });
    // El pictograma es decorativo: el nombre lo aporta el texto o el aria-label.
    pictograma.setAttribute('aria-hidden', 'true');
    boton.appendChild(pictograma);
  }

  const texto = crearElemento('span', {
    clases: 'js-boton__texto',
    texto: opciones.etiqueta,
  });
  boton.appendChild(texto);

  if (opciones.deshabilitado === true) {
    boton.disabled = true;
    boton.setAttribute('aria-disabled', 'true');
  }

  if (opciones.alElegir !== undefined) {
    const manejador = opciones.alElegir;
    boton.addEventListener('click', function manejarClick(): void {
      manejador();
    });
  }

  return boton;
}

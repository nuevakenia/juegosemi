// Pantalla completa de la interfaz.
//
// Aporta el armazon de una vista: cabecera con titulo grande (y subtitulo
// opcional), un boton grande de volver y un area principal donde va el
// contenido. Mantener esta estructura igual en todas las pantallas ayuda a que
// el niño reconozca donde esta parado.

import { crearBoton } from './boton';
import { crearElemento } from './accesibilidad';

/** Datos para armar una pantalla. */
export interface OpcionesPantalla {
  /** Titulo principal, en texto grande. */
  titulo: string;
  /** Bajada corta debajo del titulo. */
  subtitulo?: string;
  /** Uno o varios elementos que van en el area principal. */
  contenido: HTMLElement | HTMLElement[];
  /** Texto del boton de volver. Por defecto: "Volver". */
  textoVolver?: string;
  /** Se dispara al tocar el boton de volver. Si falta, no se muestra el boton. */
  alVolver?: () => void;
}

/**
 * Crea el armazon de una pantalla.
 * Devuelve un `<div>` con `<header>`, boton de volver opcional y `<main>`.
 */
export function crearPantalla(opciones: OpcionesPantalla): HTMLElement {
  const raiz = crearElemento('div', { clases: 'js-pantalla' });

  const cabecera = crearElemento('header', {
    clases: 'js-pantalla__cabecera',
  });
  cabecera.appendChild(
    crearElemento('h1', {
      clases: 'js-pantalla__titulo',
      texto: opciones.titulo,
    }),
  );
  if (opciones.subtitulo !== undefined) {
    cabecera.appendChild(
      crearElemento('p', {
        clases: 'js-pantalla__subtitulo',
        texto: opciones.subtitulo,
      }),
    );
  }
  raiz.appendChild(cabecera);

  if (opciones.alVolver !== undefined) {
    const etiquetaVolver =
      opciones.textoVolver !== undefined ? opciones.textoVolver : 'Volver';
    raiz.appendChild(
      crearBoton({
        etiqueta: etiquetaVolver,
        pictograma: '\u2B05',
        alElegir: opciones.alVolver,
        clasesExtra: 'js-boton--volver',
      }),
    );
  }

  const cuerpo = crearElemento('main', { clases: 'js-pantalla__cuerpo' });
  const hijos = Array.isArray(opciones.contenido)
    ? opciones.contenido
    : [opciones.contenido];
  for (const hijo of hijos) {
    cuerpo.appendChild(hijo);
  }
  raiz.appendChild(cuerpo);

  return raiz;
}

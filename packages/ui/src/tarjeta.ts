// Tarjeta grande de la interfaz.
//
// Si recibe `alElegir`, la tarjeta entera es un boton: para un niño es mucho
// mas facil acertarle a un cuadro completo que a un boton chico adentro. Si no
// recibe accion, se comporta como un articulo de solo lectura.

import { crearElemento, unirClases } from './accesibilidad';

/** Datos para armar una tarjeta grande. */
export interface OpcionesTarjeta {
  /** Titulo de la tarjeta, en texto grande. */
  titulo: string;
  /** Texto de apoyo debajo del titulo. */
  texto?: string;
  /** Pictograma grande que refuerza el tema (apoyo visual). */
  pictograma?: string;
  /**
   * Nombre para lectores de pantalla cuando la tarjeta es elegible.
   * Si se omite, el nombre accesible sale del texto visible.
   */
  nombreAccesible?: string;
  /** Si viene, la tarjeta completa es clickeable y dispara esto. */
  alElegir?: () => void;
  /** Clases CSS extra que quiera sumar quien use el componente. */
  clasesExtra?: string;
}

/**
 * Crea una tarjeta grande.
 * Devuelve un `<button>` cuando es elegible y un `<article>` cuando no lo es.
 */
export function crearTarjeta(opciones: OpcionesTarjeta): HTMLElement {
  const esElegible = opciones.alElegir !== undefined;

  let raiz: HTMLElement;
  if (esElegible) {
    const boton = document.createElement('button');
    boton.type = 'button';
    raiz = boton;
  } else {
    raiz = document.createElement('article');
  }

  raiz.className = unirClases(
    'js-tarjeta',
    esElegible ? 'js-tarjeta--elegible' : undefined,
    opciones.clasesExtra,
  );

  if (esElegible && opciones.nombreAccesible !== undefined) {
    raiz.setAttribute('aria-label', opciones.nombreAccesible);
  }

  if (opciones.pictograma !== undefined) {
    const pictograma = crearElemento('span', {
      clases: 'js-tarjeta__pictograma',
      texto: opciones.pictograma,
    });
    pictograma.setAttribute('aria-hidden', 'true');
    raiz.appendChild(pictograma);
  }

  raiz.appendChild(
    crearElemento('span', {
      clases: 'js-tarjeta__titulo',
      texto: opciones.titulo,
    }),
  );

  if (opciones.texto !== undefined) {
    raiz.appendChild(
      crearElemento('span', {
        clases: 'js-tarjeta__texto',
        texto: opciones.texto,
      }),
    );
  }

  if (opciones.alElegir !== undefined) {
    const manejador = opciones.alElegir;
    raiz.addEventListener('click', function manejarClick(): void {
      manejador();
    });
  }

  return raiz;
}

// Menu de opciones de la interfaz.
//
// Se arma como una seccion con titulo propio y una grilla de botones grandes.
// La seccion queda etiquetada por su titulo, asi el lector de pantalla anuncia
// "menu, Juegos" antes de listar las opciones.

import { crearBoton } from './boton';
import { crearElemento, idUnico, unirClases } from './accesibilidad';

/** Una opcion del menu. */
export interface OpcionMenu {
  /** Texto visible del boton. */
  etiqueta: string;
  /** Pictograma grande que acompana a la palabra. */
  pictograma?: string;
  /** Nombre para lectores de pantalla, si la etiqueta no alcanza. */
  nombreAccesible?: string;
  /** Se dispara al elegir la opcion. */
  alElegir?: () => void;
}

/** Datos para armar un menu. */
export interface OpcionesMenu {
  /** Titulo visible del menu. */
  titulo: string;
  /** Opciones que se muestran, en orden. */
  opciones: OpcionMenu[];
  /** Clases CSS extra que quiera sumar quien use el componente. */
  clasesExtra?: string;
}

/**
 * Crea una seccion de menu con su titulo y un boton grande por opcion.
 * Devuelve un `<section>` con `aria-labelledby` apuntando a su propio titulo.
 */
export function crearMenu(opciones: OpcionesMenu): HTMLElement {
  const seccion = crearElemento('section', {
    clases: unirClases('js-menu', opciones.clasesExtra),
  });

  const idTitulo = idUnico('js-menu-titulo');
  const titulo = crearElemento('h2', {
    clases: 'js-menu__titulo',
    texto: opciones.titulo,
  });
  titulo.id = idTitulo;
  seccion.setAttribute('aria-labelledby', idTitulo);
  seccion.appendChild(titulo);

  const contenedor = crearElemento('div', { clases: 'js-menu__opciones' });
  for (const opcion of opciones.opciones) {
    contenedor.appendChild(
      crearBoton({
        etiqueta: opcion.etiqueta,
        pictograma: opcion.pictograma,
        nombreAccesible: opcion.nombreAccesible,
        alElegir: opcion.alElegir,
      }),
    );
  }
  seccion.appendChild(contenedor);

  return seccion;
}

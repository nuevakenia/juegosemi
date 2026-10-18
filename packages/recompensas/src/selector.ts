/**
 * El SELECTOR de premios: cambiar el premio del día sin escribir código.
 *
 * Un botón GRANDE ("Cambiar el premio") que despliega las opciones como
 * tarjetas grandes, una por premio del episodio. Se toca una tarjeta y ese pasa
 * a ser el premio del día.
 *
 * Es una pieza REUTILIZABLE a propósito: hoy la usa el episodio y mañana la va a
 * usar el editor de niveles (n-010) para elegir con qué se paga cada misión. Por
 * eso todo entra por parámetro (`recompensas`, `elegidoId`, `alElegir`) y el que
 * la usa decide qué hacer al elegir: guardar, avisar, escribir el nivel.
 *
 * Se arma sólo con las piezas de `@juegosemi/ui` (`crearBoton`, `crearTarjeta`,
 * `crearPantalla`): nada de canvas ni de componentes propios. Y nada de feedback
 * negativo: si no hay premios, se dice en castellano claro y listo.
 */
import { crearBoton, crearElemento, crearPantalla, crearTarjeta } from '@juegosemi/ui';
import type { Recompensa, TipoRecompensa } from './catalogo.ts';

/** El pictograma que acompaña a cada tipo de premio. */
const PICTOGRAMA_POR_TIPO: Record<TipoRecompensa, string> = {
  video: '\uD83C\uDFAC', // 🎬
  frase: '\uD83D\uDCAC', // 💬
  sonido: '\uD83D\uDD14', // 🔔
};

/** El nombre del tipo, para que se entienda de un vistazo. */
const NOMBRE_POR_TIPO: Record<TipoRecompensa, string> = {
  video: 'Un video',
  frase: 'Una frase',
  sonido: 'Un sonido',
};

export interface OpcionesSelectorRecompensas {
  /** Los premios a mostrar (normalmente los del episodio), en orden. */
  recompensas: readonly Recompensa[];
  /** El id del premio elegido ahora, para marcarlo (o null si no hay ninguno). */
  elegidoId?: string | null;
  /** Se tocó una tarjeta: acá el que usa el selector decide qué hacer. */
  alElegir: (recompensa: Recompensa) => void;
  /** Texto del botón grande. Por defecto: "Cambiar el premio". */
  etiqueta?: string;
  /** Título de la pantalla de opciones. */
  titulo?: string;
  /** Bajada corta debajo del título. */
  subtitulo?: string;
}

/** El selector armado, listo para meter en la página. */
export interface SelectorRecompensas {
  /** El elemento raíz (el botón y, cuando se abre, el panel de tarjetas). */
  elemento: HTMLElement;
  /** Abre el panel con las tarjetas grandes. */
  abrir(): void;
  /** Cierra el panel y deja el botón grande a la vista. */
  cerrar(): void;
  /** Vuelve a marcar qué premio está elegido ahora. */
  marcar(id: string | null): void;
}

export function crearSelectorDeRecompensas(
  opciones: OpcionesSelectorRecompensas,
): SelectorRecompensas {
  const raiz = crearElemento('div', { clases: 'js-selector' });

  const boton = crearBoton({
    etiqueta: opciones.etiqueta ?? 'Cambiar el premio',
    pictograma: '\uD83C\uDF81', // 🎁
    alElegir: () => abrir(),
    clasesExtra: 'js-selector__abrir',
  });
  raiz.appendChild(boton);

  const tarjetas = new Map<string, HTMLElement>();
  let elegidoId: string | null = opciones.elegidoId ?? null;

  const panel = armarPanel();
  panel.classList.add('js-selector__panel');

  function elegir(premio: Recompensa): void {
    elegidoId = premio.id;
    marcar(premio.id);
    opciones.alElegir(premio);
  }

  /** Un texto que dice de qué tipo es el premio y si es el que está elegido. */
  function descripcionDe(premio: Recompensa): string {
    return NOMBRE_POR_TIPO[premio.tipo];
  }

  function armarTarjeta(premio: Recompensa): HTMLElement {
    const tarjeta = crearTarjeta({
      titulo: premio.titulo,
      texto: descripcionDe(premio),
      pictograma: PICTOGRAMA_POR_TIPO[premio.tipo],
      nombreAccesible: `Elegir el premio: ${premio.titulo}`,
      alElegir: () => elegir(premio),
      clasesExtra: 'js-selector__tarjeta',
    });
    tarjeta.setAttribute('aria-pressed', premio.id === elegidoId ? 'true' : 'false');
    tarjetas.set(premio.id, tarjeta);
    return tarjeta;
  }

  function armarPanel(): HTMLElement {
    const contenido: HTMLElement[] = [];

    if (opciones.recompensas.length === 0) {
      contenido.push(
        crearElemento('p', {
          clases: 'js-selector__vacio',
          texto: 'No hay premios para este episodio todavía.',
        }),
      );
    } else {
      const grilla = crearElemento('div', { clases: 'js-selector__grilla' });
      for (const premio of opciones.recompensas) grilla.appendChild(armarTarjeta(premio));
      contenido.push(grilla);
    }

    return crearPantalla({
      titulo: opciones.titulo ?? 'Elegí el premio',
      subtitulo: opciones.subtitulo ?? 'Tocá un premio para cambiarlo',
      contenido,
      textoVolver: 'Listo',
      alVolver: () => cerrar(),
    });
  }

  function marcar(id: string | null): void {
    elegidoId = id;
    for (const [clave, tarjeta] of tarjetas) {
      const esElegida = clave === id;
      tarjeta.setAttribute('aria-pressed', esElegida ? 'true' : 'false');
      tarjeta.classList.toggle('js-selector__tarjeta--elegida', esElegida);
      const marca = tarjeta.querySelector('.js-selector__marca');
      if (esElegida && marca === null) {
        tarjeta.appendChild(crearElemento('span', { clases: 'js-selector__marca', texto: 'Elegido' }));
      } else if (!esElegida && marca !== null) {
        marca.remove();
      }
    }
  }

  function abrir(): void {
    raiz.appendChild(panel);
    marcar(elegidoId);
  }

  function cerrar(): void {
    if (panel.parentElement !== null) panel.parentElement.removeChild(panel);
  }

  marcar(elegidoId);

  return { elemento: raiz, abrir, cerrar, marcar };
}

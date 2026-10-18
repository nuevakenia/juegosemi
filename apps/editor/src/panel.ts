/**
 * El panel "Mis niveles": guardar en el dispositivo, abrir, borrar y pasar los
 * niveles por archivo (exportar e importar).
 *
 * Es sólo DOM y botones GRANDES: el estado y el almacenamiento viven en
 * `guardado.ts` y `exportar.ts`/`importar.ts`; acá se pintan las tarjetas y se
 * avisan los toques por callbacks. El que arma la pantalla (`main.ts`) decide qué
 * hacer con cada uno.
 *
 * Nada de feedback negativo: si el archivo no cierra, el aviso dice qué pasó y
 * lo que ya estaba armado NO se toca.
 */
import { crearBoton, crearElemento, crearTarjeta } from '@juegosemi/ui';
import type { NivelGuardado } from './guardado.ts';

/** Cómo se llama el botón de guardar. */
export const ETIQUETA_GUARDAR = 'Guardar en el dispositivo';
/** Cómo se llama el botón de exportar. */
export const ETIQUETA_EXPORTAR = 'Exportar el archivo';
/** Cómo se llama el botón de importar. */
export const ETIQUETA_IMPORTAR = 'Importar un archivo';

export interface OpcionesPanel {
  /** Los niveles guardados que hay ahora. */
  guardados: readonly NivelGuardado[];
  /** El nombre que arranca puesto en el campo de guardar. */
  nombreInicial: string;
  alGuardar: (nombre: string) => void;
  alAbrir: (id: string) => void;
  alBorrar: (id: string) => void;
  alExportar: () => void;
  alImportar: (texto: string) => void;
}

export interface Panel {
  elemento: HTMLElement;
  /** Vuelve a pintar la lista de niveles guardados. */
  pintar(guardados: readonly NivelGuardado[]): void;
  /** Deja un mensaje en castellano en la franja de abajo. */
  decir(mensaje: string): void;
}

/** Lee un archivo como texto (lo que hace falta para importar). */
export function leerArchivoDeTexto(archivo: File): Promise<string> {
  return new Promise<string>((resolver, rechazar) => {
    const lector = new FileReader();
    lector.addEventListener('load', () => {
      resolver(typeof lector.result === 'string' ? lector.result : '');
    });
    lector.addEventListener('error', () => rechazar(new Error('no se pudo leer el archivo')));
    lector.readAsText(archivo);
  });
}

/** Cuántas reglas y misiones tiene un nivel guardado, para el texto de la tarjeta. */
function resumenDe(guardado: NivelGuardado): string {
  const reglas = guardado.nivel.reglas.length;
  const misiones = guardado.nivel.misiones.length;
  return `${reglas === 1 ? '1 regla' : `${reglas} reglas`} · ${misiones === 1 ? '1 misión' : `${misiones} misiones`}`;
}

export function crearPanel(opciones: OpcionesPanel): Panel {
  const raiz = crearElemento('section', { clases: 'panel-niveles' });
  raiz.appendChild(crearElemento('h2', { clases: 'panel-niveles__titulo', texto: 'Mis niveles' }));

  // ── Guardar en el dispositivo ───────────────────────────────────────────────
  const guardar = crearElemento('div', { clases: 'panel-niveles__guardar' });
  const campoNombre = crearElemento('input', { clases: 'campo' });
  campoNombre.type = 'text';
  campoNombre.value = opciones.nombreInicial;
  campoNombre.setAttribute('aria-label', 'El nombre para guardar el nivel');
  campoNombre.placeholder = '¿Cómo se llama este nivel?';
  guardar.appendChild(campoNombre);
  guardar.appendChild(
    crearBoton({
      etiqueta: ETIQUETA_GUARDAR,
      pictograma: '💾',
      clasesExtra: 'panel-niveles__boton',
      alElegir: () => opciones.alGuardar(campoNombre.value),
    }),
  );
  raiz.appendChild(guardar);

  // ── Archivo: exportar e importar ────────────────────────────────────────────
  const archivo = crearElemento('div', { clases: 'panel-niveles__archivo' });
  archivo.appendChild(
    crearBoton({
      etiqueta: ETIQUETA_EXPORTAR,
      pictograma: '⬇️',
      clasesExtra: 'panel-niveles__boton',
      alElegir: () => opciones.alExportar(),
    }),
  );

  // El selector de archivo va escondido: se abre con el botón grande de al lado.
  const entrada = crearElemento('input', { clases: 'panel-niveles__archivo-oculto' });
  entrada.type = 'file';
  entrada.accept = '.json,application/json';
  entrada.setAttribute('aria-hidden', 'true');
  entrada.addEventListener('change', () => {
    const elegido = entrada.files === null ? undefined : entrada.files[0];
    if (elegido === undefined) return;
    void leerArchivoDeTexto(elegido).then(
      (texto) => opciones.alImportar(texto),
      () => decir('No pudimos leer ese archivo. Probá de nuevo.'),
    );
  });
  archivo.appendChild(entrada);
  archivo.appendChild(
    crearBoton({
      etiqueta: ETIQUETA_IMPORTAR,
      pictograma: '⬆️',
      clasesExtra: 'panel-niveles__boton',
      alElegir: () => entrada.click(),
    }),
  );
  raiz.appendChild(archivo);

  const aviso = crearElemento('p', { clases: 'panel-niveles__aviso' });
  aviso.setAttribute('role', 'status');
  raiz.appendChild(aviso);

  // ── La lista de niveles guardados ───────────────────────────────────────────
  const lista = crearElemento('div', { clases: 'panel-niveles__lista' });
  raiz.appendChild(lista);

  function decir(mensaje: string): void {
    aviso.textContent = mensaje;
  }

  function pintar(guardados: readonly NivelGuardado[]): void {
    lista.textContent = '';
    if (guardados.length === 0) {
      lista.appendChild(
        crearElemento('p', {
          clases: 'panel-niveles__vacio',
          texto: 'Todavía no guardaste ningún nivel. Tocá «Guardar en el dispositivo» y queda acá.',
        }),
      );
      return;
    }
    for (const guardado of guardados) {
      // La tarjeta NO es un botón: adentro van dos botones grandes (abrir y borrar).
      const tarjeta = crearTarjeta({
        titulo: guardado.nombre,
        texto: resumenDe(guardado),
        pictograma: '🎮',
        clasesExtra: 'panel-niveles__tarjeta',
      });
      tarjeta.appendChild(
        crearBoton({
          etiqueta: 'Abrir',
          pictograma: '📂',
          clasesExtra: 'panel-niveles__abrir',
          alElegir: () => opciones.alAbrir(guardado.id),
        }),
      );
      tarjeta.appendChild(
        crearBoton({
          etiqueta: 'Borrar',
          pictograma: '🗑',
          nombreAccesible: `Borrar ${guardado.nombre}`,
          clasesExtra: 'panel-niveles__borrar',
          alElegir: () => opciones.alBorrar(guardado.id),
        }),
      );
      lista.appendChild(tarjeta);
    }
  }

  pintar(opciones.guardados);

  return { elemento: raiz, pintar, decir };
}

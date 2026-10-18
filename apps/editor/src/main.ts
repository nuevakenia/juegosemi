/**
 * El editor de niveles: la pantalla que arma un juego tocando botones grandes.
 *
 * Es sólo cableado: el estado vive en `estado.ts`, la pantalla en `vista.ts` y la
 * prueba en vivo en `probar.ts`. Acá se juntan, y cuando se toca "Probar el juego"
 * se corre el nivel armado sin salir del editor; al terminar, se vuelve.
 *
 * Además de armar, acá se GUARDA en el dispositivo (`guardado.ts`), se PASA por
 * archivo (`exportar.ts` / `importar.ts`) y se deja el HOOK DE QA colgado de la
 * ventana mientras se prueba (`qa.ts`), para poder medir el efecto de una regla
 * sin adivinar.
 *
 * Sólo se prueba lo que CIERRA (el validador de la lógica tiene la última palabra);
 * si falta algo, el botón grande queda apagado y arriba se dice qué falta.
 */
import '@juegosemi/ui/estilos.css';
import type { NivelEnConstruccion } from './estado.ts';
import { nivelDeArranque } from './estado.ts';
import { nivelLogico } from './construir.ts';
import { revisar } from './validar-editor.ts';
import { crearEditor } from './vista.ts';
import { crearPrueba, type Prueba } from './probar.ts';
import { crearPanel } from './panel.ts';
import {
  borrarNivel,
  crearAlmacenEditor,
  guardarNivel,
  leerNiveles,
  nivelGuardado,
} from './guardado.ts';
import { descargarNivel, nombreDeArchivo } from './exportar.ts';
import { interpretarTexto } from './importar.ts';
import { publicarQa } from './qa.ts';

async function principal(): Promise<void> {
  const contenedor = document.getElementById('editor');
  const capa = document.getElementById('prueba');
  if (!contenedor || !capa) return;
  const raiz: HTMLElement = contenedor;
  const capaPrueba: HTMLElement = capa;

  const almacen = crearAlmacenEditor();
  let enPrueba: Prueba | null = null;

  function volver(): void {
    if (enPrueba !== null) {
      enPrueba.detener();
      enPrueba = null;
    }
    publicarQa(null);
    capaPrueba.textContent = '';
    capaPrueba.classList.remove('visible');
  }

  async function probar(nivel: NivelEnConstruccion): Promise<void> {
    const revision = revisar(nivel);
    if (!revision.ok) return; // el botón ya viene apagado: acá no se llega
    capaPrueba.textContent = '';
    const nueva = crearPrueba({
      nivel: nivelLogico(nivel),
      entidades: nivel.entidades,
      zonas: nivel.zonas,
      alVolver: () => volver(),
    });
    capaPrueba.appendChild(nueva.elemento);
    capaPrueba.classList.add('visible');
    enPrueba = nueva;
    await nueva.iniciar();

    // El hook de QA: deja la escena, la lógica y el puente a mano en la consola.
    const escena = nueva.escena();
    const logica = nueva.logica();
    const puente = nueva.puente();
    if (escena !== null && logica !== null && puente !== null) {
      publicarQa({ escena, logica, puente, volver });
    }
  }

  const editor = crearEditor({
    nivel: nivelDeArranque(),
    alProbar: (nivel) => {
      void probar(nivel);
    },
  });

  const panel = crearPanel({
    guardados: leerNiveles(almacen),
    nombreInicial: editor.nivel().titulo,
    alGuardar: (nombre) => {
      const guardados = guardarNivel(almacen, nombre, editor.nivel());
      panel.pintar(guardados);
      panel.decir('Listo: el nivel quedó guardado en este dispositivo.');
    },
    alAbrir: (id) => {
      const guardado = nivelGuardado(almacen, id);
      if (guardado === null) {
        panel.decir('Ese nivel ya no está guardado.');
        return;
      }
      editor.abrir(guardado.nivel);
      panel.decir(`Abriste «${guardado.nombre}».`);
    },
    alBorrar: (id) => {
      const guardados = borrarNivel(almacen, id);
      panel.pintar(guardados);
      panel.decir('Listo: borramos ese nivel guardado.');
    },
    alExportar: () => {
      descargarNivel(editor.nivel());
      panel.decir(`Se bajó el archivo ${nombreDeArchivo(editor.nivel())}.`);
    },
    alImportar: (texto) => {
      const resultado = interpretarTexto(texto);
      if (!resultado.ok) {
        // Nada se toca: lo que ya estaba armado queda como estaba.
        panel.decir(`Ese archivo no se pudo cargar. ${resultado.mensajes.join(' ')}`);
        return;
      }
      editor.abrir(resultado.nivel);
      panel.decir('Cargamos el nivel del archivo. Guardalo con un nombre para que quede.');
    },
  });

  raiz.appendChild(panel.elemento);
  raiz.appendChild(editor.elemento);

  // Hook de diagnóstico para la consola del navegador (QA): deja el editor a mano.
  (window as unknown as Record<string, unknown>)['editor'] = {
    nivel: () => editor.nivel(),
    probar: () => {
      void probar(editor.nivel());
    },
    volver,
    /** El puente de la prueba en curso (null si no se está probando). */
    puente: () => (enPrueba === null ? null : enPrueba.puente()),
  };
}

void principal();

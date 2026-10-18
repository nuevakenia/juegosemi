/**
 * El editor de niveles: la pantalla que arma un juego tocando botones grandes.
 *
 * Es sólo cableado: el estado vive en `estado.ts`, la pantalla en `vista.ts` y la
 * prueba en vivo en `probar.ts`. Acá se juntan, y cuando se toca "Probar el juego"
 * se corre el nivel armado sin salir del editor; al terminar, se vuelve.
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

async function principal(): Promise<void> {
  const contenedor = document.getElementById('editor');
  const capa = document.getElementById('prueba');
  if (!contenedor || !capa) return;
  const raiz: HTMLElement = contenedor;
  const capaPrueba: HTMLElement = capa;

  let enPrueba: Prueba | null = null;

  function volver(): void {
    if (enPrueba !== null) {
      enPrueba.detener();
      enPrueba = null;
    }
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
  }

  const editor = crearEditor({
    nivel: nivelDeArranque(),
    alProbar: (nivel) => {
      void probar(nivel);
    },
  });
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

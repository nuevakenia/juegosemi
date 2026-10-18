// @vitest-environment jsdom
/**
 * El panel "Mis niveles", tocado como lo va a tocar un chico: guardar, abrir,
 * borrar y pasar un archivo. Sólo se prueba el DOM y que los toques avisen al
 * cableado (el almacenamiento y el archivo se prueban aparte).
 */
import { describe, expect, it } from 'vitest';
import type { NivelGuardado } from './guardado.ts';
import { conCosa, conTitulo, crearNivelEnConstruccion } from './estado.ts';
import {
  crearPanel,
  ETIQUETA_EXPORTAR,
  ETIQUETA_GUARDAR,
  ETIQUETA_IMPORTAR,
  leerArchivoDeTexto,
} from './panel.ts';

/** El primer botón cuyo texto contiene lo que se busca (revienta si no está). */
function botonCon(raiz: HTMLElement, texto: string): HTMLButtonElement {
  for (const boton of Array.from(raiz.querySelectorAll('button'))) {
    if ((boton.textContent ?? '').includes(texto)) return boton;
  }
  const visibles = Array.from(raiz.querySelectorAll('button')).map((b) => b.textContent ?? '').join(' | ');
  throw new Error(`no encontré el botón "${texto}". Los que hay: ${visibles}`);
}

function unGuardado(nombre: string, id: string): NivelGuardado {
  const nivel = conCosa(conTitulo(crearNivelEnConstruccion(), nombre), 'entidades', 'la maleta');
  return { id, nombre, nivel };
}

/** Un panel con las llamadas anotadas, para revisar qué se tocó. */
function panel() {
  const llamadas: Record<string, string[]> = { guardar: [], abrir: [], borrar: [], exportar: [], importar: [] };
  const creado = crearPanel({
    guardados: [],
    nombreInicial: 'Mi juego',
    alGuardar: (nombre) => llamadas['guardar']?.push(nombre),
    alAbrir: (id) => llamadas['abrir']?.push(id),
    alBorrar: (id) => llamadas['borrar']?.push(id),
    alExportar: () => llamadas['exportar']?.push('si'),
    alImportar: (texto) => llamadas['importar']?.push(texto),
  });
  return { creado, llamadas };
}

describe('el panel "Mis niveles"', () => {
  it('arranca sin niveles guardados y lo dice en castellano', () => {
    const { creado } = panel();
    expect((creado.elemento.textContent ?? '')).toContain('Mis niveles');
    expect((creado.elemento.textContent ?? '')).toContain('Todavía no guardaste ningún nivel');
  });

  it('guarda con el nombre que se escribe', () => {
    const { creado, llamadas } = panel();
    const campo = creado.elemento.querySelector<HTMLInputElement>('.panel-niveles__guardar .campo');
    expect(campo).not.toBeNull();
    if (campo === null) return;
    campo.value = 'El viaje';

    botonCon(creado.elemento, ETIQUETA_GUARDAR).click();

    expect(llamadas['guardar']).toEqual(['El viaje']);
  });

  it('lista los niveles guardados como tarjetas grandes con abrir y borrar', () => {
    const { creado, llamadas } = panel();
    creado.pintar([unGuardado('El viaje', 'el-viaje'), unGuardado('La casa', 'la-casa')]);

    expect((creado.elemento.textContent ?? '')).toContain('El viaje');
    expect((creado.elemento.textContent ?? '')).toContain('La casa');

    botonCon(creado.elemento, 'Borrar').click();
    expect(llamadas['borrar']).toEqual(['el-viaje']);

    botonCon(creado.elemento, 'Abrir').click();
    expect(llamadas['abrir']).toEqual(['el-viaje']);
  });

  it('exporta e importa con botones grandes', () => {
    const { creado, llamadas } = panel();
    botonCon(creado.elemento, ETIQUETA_EXPORTAR).click();
    expect(llamadas['exportar']).toEqual(['si']);

    expect(botonCon(creado.elemento, ETIQUETA_IMPORTAR)).toBeDefined();
    const entrada = creado.elemento.querySelector<HTMLInputElement>('input[type="file"]');
    expect(entrada).not.toBeNull();
    expect(entrada?.accept ?? '').toContain('json');
  });

  it('deja un mensaje en castellano en la franja de estado', () => {
    const { creado } = panel();
    creado.decir('Listo: el nivel quedó guardado.');
    expect(creado.elemento.querySelector('[role="status"]')?.textContent).toContain('quedó guardado');
  });

  it('lee un archivo como texto (lo que hace falta para importar)', async () => {
    const archivo = new File(['{"id":"x","reglas":[]}'], 'nivel.juego.json', { type: 'application/json' });
    expect(await leerArchivoDeTexto(archivo)).toBe('{"id":"x","reglas":[]}');
  });
});

// @vitest-environment jsdom
/**
 * La bajada del archivo: se crea el Blob, se arma un enlace con `download` y se
 * lo toca. Acá se intercepta ese enlace (sin navegar de verdad) y se lee lo que
 * bajó, para comprobar que es EXACTAMENTE el texto del nivel.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { conCosa, conTitulo, crearNivelEnConstruccion } from './estado.ts';
import { descargarNivel, nombreDeArchivo, textoExportado } from './exportar.ts';

/** Lo que quedó de la bajada, para poder mirarlo. */
interface Interceptado {
  enlaces: HTMLAnchorElement[];
  blob: Blob | null;
}

/** Intercepta la bajada (sin navegar) y devuelve la maquinaria para revisarla. */
function interceptarBajada(): Interceptado {
  const registro: Interceptado = { enlaces: [], blob: null };
  const clickOriginal = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function click(): void {
    registro.enlaces.push(this);
  };
  URL.createObjectURL = (blob: Blob): string => {
    registro.blob = blob;
    return 'blob:falso';
  };
  URL.revokeObjectURL = (): void => undefined;
  // Se devuelve una forma de volver atrás por si la prueba falla a mitad.
  (globalThis as unknown as Record<string, unknown>)['__clickOriginal'] = clickOriginal;
  return registro;
}

/** Lee un Blob como texto (igual que cuando el navegador lee un archivo). */
function leerBlob(blob: Blob): Promise<string> {
  return new Promise<string>((resolver) => {
    const lector = new FileReader();
    lector.addEventListener('load', () => resolver(typeof lector.result === 'string' ? lector.result : ''));
    lector.readAsText(blob);
  });
}

afterEach(() => {
  const original = (globalThis as unknown as Record<string, unknown>)['__clickOriginal'];
  if (typeof original === 'function') HTMLAnchorElement.prototype.click = original as () => void;
});

describe('exportar: bajar el archivo', () => {
  it('arma un enlace con el atributo download y lo toca', () => {
    const registro = interceptarBajada();
    const nivel = conCosa(conTitulo(crearNivelEnConstruccion(), 'El viaje'), 'entidades', 'la maleta');

    descargarNivel(nivel);

    expect(registro.enlaces.length).toBe(1);
    const enlace = registro.enlaces[0];
    expect(enlace?.download).toBe(nombreDeArchivo(nivel));
    expect(enlace?.href).toContain('blob:');
    // El enlace se saca de la página: no queda basura.
    expect(document.body.contains(enlace ?? null)).toBe(false);
  });

  it('lo que baja es exactamente el texto del nivel', async () => {
    const registro = interceptarBajada();
    const nivel = conCosa(conTitulo(crearNivelEnConstruccion(), 'El viaje'), 'entidades', 'la maleta');

    descargarNivel(nivel);

    expect(registro.blob).not.toBeNull();
    if (registro.blob === null) return;
    expect(registro.blob.type).toBe('application/json');
    expect(await leerBlob(registro.blob)).toBe(textoExportado(nivel));
  });

  it('deja elegir el nombre del archivo', () => {
    const registro = interceptarBajada();
    descargarNivel(crearNivelEnConstruccion(), 'mi-juego.json');
    expect(registro.enlaces[0]?.download).toBe('mi-juego.json');
  });
});

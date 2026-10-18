/**
 * Exportar el nivel a un archivo: lo que se baja es EXACTAMENTE lo que el juego
 * carga, más (y bien aparte) el escenario del editor.
 *
 * El archivo tiene la forma del `Nivel` de `@juegosemi/logica` (id, título, mundo,
 * reglas, misiones: lo mismo que corre el PUENTE) y una sección extra,
 * `escenario`, con las piezas y las zonas que conoce el editor (ver
 * `escenario.ts`). El juego puede cargar el archivo tal cual: el campo de más lo
 * ignora.
 *
 * La bajada usa un Blob y un enlace de descarga (`document.createElement('a')`)
 * con el atributo `download`: nada de internet y nada de servidores. Todo pasa en
 * el navegador.
 *
 * El "viaje completo" (exportar → importar → igual) se prueba en
 * `exportar.test.ts`: el texto exportado, vuelto a importar, da el mismo nivel.
 */
import type { Nivel } from '@juegosemi/logica';
import type { NivelEnConstruccion } from './estado.ts';
import { idDesdeNombre } from './estado.ts';
import { nivelLogico } from './construir.ts';
import { escenarioDe, type EscenarioEditor } from './escenario.ts';

/** El nivel exportado: el mismo `Nivel` del juego más el escenario del editor. */
export type NivelExportado = Nivel & { escenario: EscenarioEditor };

/** La extensión del archivo, para reconocerlo sin pensarlo. */
export const EXTENSION = '.juego.json';

/** El nivel como va al archivo: la lógica del juego y, aparte, el escenario. */
export function exportarNivel(nivel: NivelEnConstruccion): NivelExportado {
  return { ...nivelLogico(nivel), escenario: escenarioDe(nivel) };
}

/** El nombre del archivo, sacado del título del juego. */
export function nombreDeArchivo(nivel: NivelEnConstruccion): string {
  return `${idDesdeNombre(nivel.titulo)}${EXTENSION}`;
}

/** El texto del archivo (JSON legible, indentado: se abre y se entiende). */
export function textoExportado(nivel: NivelEnConstruccion): string {
  return `${JSON.stringify(exportarNivel(nivel), null, 2)}\n`;
}

/**
 * Baja el nivel como archivo. Crea el Blob, le arma un enlace con `download` y lo
 * toca; después limpia el enlace y el Blob. Es puro DOM: sin red.
 */
export function descargarNivel(nivel: NivelEnConstruccion, nombre: string = nombreDeArchivo(nivel)): void {
  const texto = textoExportado(nivel);
  const blob = new Blob([texto], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.rel = 'noopener';
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

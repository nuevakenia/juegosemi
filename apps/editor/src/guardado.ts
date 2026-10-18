/**
 * Guardar y abrir los niveles del editor en el dispositivo.
 *
 * Vive sobre el PUERTO de almacenamiento (`PuertoAlmacenamiento`), no sobre
 * `localStorage` directo: igual que `apps/taller/src/guardado.ts`, así se prueba
 * con un almacén de mentira y el día que la tablet necesite otro backend (o el
 * WebView viejo de localStorage falle) no se toca esta capa. El adaptador ya
 * atrapa los errores y acá eso se traduce a "no había nada guardado": el editor
 * abre igual y nunca se cae.
 *
 * Se guardan VARIOS niveles, cada uno con su nombre, todos juntos bajo una clave
 * propia del editor (`editor:niveles`), para no pisar el espacio del taller ni el
 * de los premios.
 *
 * Regla de oro: un guardado viejo o mal escrito no rompe la pantalla. Lo que no
 * cierra se saltea al leer y los demás niveles siguen ahí.
 */
import type { PuertoAlmacenamiento } from '@juegosemi/puertos';
import { crearAlmacenamientoLocal } from '@juegosemi/adaptadores-web';
import type { NivelEnConstruccion } from './estado.ts';
import { idDesdeNombre, idLibre } from './estado.ts';

/** La clave con que se guardan TODOS los niveles, dentro del espacio del editor. */
export const CLAVE_NIVELES = 'niveles';

/** Un nivel guardado: cómo se llama y el nivel entero (para poder volver a editarlo). */
export interface NivelGuardado {
  /** El id del guardado (sale del nombre); sirve para abrir y para borrar. */
  id: string;
  /** El nombre que le puso el grande. */
  nombre: string;
  /** El nivel tal cual estaba en el editor (para seguir editándolo al abrirlo). */
  nivel: NivelEnConstruccion;
}

/** El almacén del editor, con su propio espacio para no pisar el de otros juegos. */
export function crearAlmacenEditor(): PuertoAlmacenamiento {
  return crearAlmacenamientoLocal('editor');
}

/** ¿El nivel guardado tiene la forma que esperamos? (no nos fiamos del almacén). */
function esNivelGuardadoValido(dato: unknown): dato is NivelGuardado {
  if (typeof dato !== 'object' || dato === null) return false;
  const registro = dato as Record<string, unknown>;
  if (typeof registro['id'] !== 'string' || registro['id'].trim() === '') return false;
  if (typeof registro['nombre'] !== 'string' || registro['nombre'].trim() === '') return false;
  const nivel = registro['nivel'];
  if (typeof nivel !== 'object' || nivel === null) return false;
  const n = nivel as Record<string, unknown>;
  const listas = ['entidades', 'zonas', 'contadores', 'interruptores', 'misiones', 'reglas'];
  return listas.every((clave) => Array.isArray(n[clave]));
}

/**
 * Los niveles guardados, en el orden en que se guardaron. Si el almacén no tiene
 * nada o trae basura, devuelve la lista vacía (o sólo lo que sí cierra).
 */
export function leerNiveles(almacen: PuertoAlmacenamiento): NivelGuardado[] {
  const dato = almacen.leer<unknown>(CLAVE_NIVELES);
  if (!Array.isArray(dato)) return [];
  const guardados: NivelGuardado[] = [];
  for (const crudo of dato) {
    if (esNivelGuardadoValido(crudo)) guardados.push(crudo);
  }
  return guardados;
}

/** El nivel guardado de ese id, o null. */
export function nivelGuardado(almacen: PuertoAlmacenamiento, id: string): NivelGuardado | null {
  for (const guardado of leerNiveles(almacen)) {
    if (guardado.id === id) return guardado;
  }
  return null;
}

/** Un id de guardado que todavía no esté usado, a partir del nombre. */
export function idDeGuardado(nombre: string, existentes: readonly string[]): string {
  const limpio = nombre.trim();
  return idLibre(existentes, idDesdeNombre(limpio === '' ? 'mi-juego' : limpio));
}

/**
 * Guarda un nivel con ese nombre. Si ya había uno guardado con el mismo nombre,
 * lo pisa (no se llenó de copias); si no, lo agrega al final. Devuelve la lista
 * actualizada, que es lo que se vuelve a pintar.
 */
export function guardarNivel(
  almacen: PuertoAlmacenamiento,
  nombre: string,
  nivel: NivelEnConstruccion,
): NivelGuardado[] {
  const actuales = leerNiveles(almacen);
  const limpio = nombre.trim() === '' ? nivel.titulo : nombre.trim();

  // Si ya hay uno guardado con el MISMO nombre, se pisa esa ficha (mismo id).
  let id: string | null = null;
  for (const actual of actuales) {
    if (actual.nombre === limpio) {
      id = actual.id;
      break;
    }
  }
  if (id === null) id = idDeGuardado(limpio, actuales.map((guardado) => guardado.id));

  const guardado: NivelGuardado = { id, nombre: limpio, nivel };

  let reemplazado = false;
  const siguientes = actuales.map((actual) => {
    if (actual.id !== id) return actual;
    reemplazado = true;
    return guardado;
  });
  if (!reemplazado) siguientes.push(guardado);

  almacen.guardar(CLAVE_NIVELES, siguientes);
  return siguientes;
}

/** Borra el nivel guardado con ese id. Devuelve la lista que queda. */
export function borrarNivel(almacen: PuertoAlmacenamiento, id: string): NivelGuardado[] {
  const siguientes = leerNiveles(almacen).filter((guardado) => guardado.id !== id);
  almacen.guardar(CLAVE_NIVELES, siguientes);
  return siguientes;
}

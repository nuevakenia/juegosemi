/**
 * Las acciones: el "entonces ..." de una regla.
 *
 * Hay dos familias, y la diferencia importa:
 *
 *   LOCALES   las resuelve la lógica sola, porque son del mundo o de la partida:
 *             marcar/sumar, activar/desactivar un objeto, pedir un gesto,
 *             completar una misión, terminar el nivel, esperar.
 *   EXTERNAS  las tiene que hacer el juego, porque tocan la pantalla o el aparato:
 *             mostrar/ocultar/mover/animar, decir, sonar, reproducir video,
 *             celebrar, mostrar un mensaje.
 *
 * Las externas se avisan por `Efectos.aplicar(...)`: este paquete no sabe (ni tiene
 * por qué) qué es un canvas.
 *
 * Se aceptan las dos formas de escribir una acción:
 *   "ocultar($entidad)"                      texto cómodo para escribir a mano
 *   { tipo: 'ocultar', objetivo: '$entidad' }  objeto, que es lo que arma el editor
 */
import type { Accion, AccionEstructurada, AccionResuelta } from './tipo.ts';
import type { Mundo } from './mundo.ts';
import type { ColaEventos } from './eventos.ts';
import type { Misiones } from './misiones.ts';

/** Las acciones que resuelve la propia lógica (no llegan al juego). */
export const ACCIONES_LOCALES = [
  'marcar',
  'sumar',
  'activar',
  'desactivar',
  'pedir_gesto',
  'cancelar_gesto',
  'completar',
  'terminar_nivel',
] as const;

export function esLocal(nombre: string): boolean {
  return (ACCIONES_LOCALES as readonly string[]).includes(nombre);
}

/**
 * Parte `decir(caco, "hola")` en nombre y argumentos.
 * Formato acordado con el timeline del motor (el mismo lenguaje humano).
 */
export function parsearAccion(accion: string): { nombre: string; args: string[] } {
  const texto = accion.trim();
  const abre = texto.indexOf('(');
  if (abre === -1 || !texto.endsWith(')')) return { nombre: texto, args: [] };
  const nombre = texto.slice(0, abre).trim();
  const cuerpo = texto.slice(abre + 1, -1).trim();
  if (cuerpo.length === 0) return { nombre, args: [] };
  const args: string[] = [];
  let actual = '';
  let comilla: string | null = null;
  for (const ch of cuerpo) {
    if (comilla !== null) {
      if (ch === comilla) comilla = null;
      else actual += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      comilla = ch;
      continue;
    }
    if (ch === ',') {
      args.push(actual.trim());
      actual = '';
      continue;
    }
    actual += ch;
  }
  if (actual.trim().length > 0) args.push(actual.trim());
  return { nombre, args };
}

/**
 * Lleva una acción declarada a una acción resuelta: nombre + un mapa de argumentos.
 * Las dos formas (texto y objeto) salen con la misma pinta, así que el juego que las
 * aplica no tiene que saber de dónde vinieron.
 */
export function resolverAccion(accion: Accion, sustituir: (t: string) => string): AccionResuelta {
  if (typeof accion === 'string') {
    const { nombre, args } = parsearAccion(accion);
    const resuelta: AccionResuelta = { nombre, args: {} };
    const nombresDeArgs: Record<string, string[]> = {
      marcar: ['variable', 'valor'],
      sumar: ['contador', 'cuanto'],
      activar: ['objeto'],
      desactivar: ['objeto'],
      pedir_gesto: ['gesto', 'veces', 'objetivo'],
      cancelar_gesto: ['gesto', 'objetivo'],
      completar: ['mision'],
      mostrar: ['objetivo'],
      ocultar: ['objetivo'],
      mover: ['objetivo', 'x', 'y'],
      animar: ['objetivo', 'animacion'],
      escalar: ['objetivo', 'escala'],
      decir: ['entidad', 'frase'],
      sonar: ['sonido'],
      detener_sonido: ['sonido'],
      reproducir_video: ['video'],
      mostrar_mensaje: ['texto'],
      celebrar: [],
      esperar: ['duracion'],
      terminar_nivel: [],
    };
    const nombres = nombresDeArgs[nombre] ?? [];
    args.forEach((crudo, i) => {
      const clave = nombres[i] ?? `arg${i}`;
      const texto = sustituir(crudo);
      resuelta.args[clave] = numeroSiSePuede(texto);
    });
    return resuelta;
  }

  const estructurada: AccionEstructurada = accion;
  const resuelta: AccionResuelta = { nombre: estructurada.tipo, args: {} };
  for (const [clave, valor] of Object.entries(estructurada)) {
    if (clave === 'tipo' || valor === undefined) continue;
    resuelta.args[clave] = typeof valor === 'string' ? numeroSiSePuede(sustituir(valor)) : valor;
  }
  return resuelta;
}

/** "3" → 3 (para que los argumentos de texto se comporten como números). */
function numeroSiSePuede(texto: string): string | number {
  if (/^-?\d+(\.\d+)?$/.test(texto)) return Number(texto);
  return texto;
}

export interface ResultadoLocal {
  /** true = la acción la resolvió la lógica (el juego no tiene que hacer nada). */
  resuelta: boolean;
  /** Avisos que la lógica sí tiene que propagar como efecto (fin de nivel). */
  aviso?: string;
  /** Misión que quedó cumplida por esta acción (`completar`), si la hubo. */
  misionCumplida?: string;
}

/**
 * Aplica las acciones que le tocan al mundo. Devuelve si la resolvió o no; las que
 * no, las tiene que aplicar el juego (y las pide `Efectos.aplicar`).
 *
 * De paso publica los eventos que la lógica sí puede mirar: `variable_cambiada`
 * (cuando `marcar` cambia de verdad el valor) y `objeto_activado` /
 * `objeto_desactivado` (cuando un interruptor cambia de estado). Así una regla
 * puede reaccionar a lo que hizo otra, que es lo que abre puertas en cadena.
 */
export function aplicarAccionLocal(
  accion: AccionResuelta,
  mundo: Mundo,
  eventos: ColaEventos,
  misiones?: Misiones,
): ResultadoLocal {
  const texto = (clave: string): string => String(accion.args[clave] ?? '');
  const numero = (clave: string, porDefecto = 1): number => {
    const valor = accion.args[clave];
    return typeof valor === 'number' ? valor : porDefecto;
  };

  /** Cuenta los cambios de variable que la acción dejó en el mundo. */
  const avisarVariables = (): void => {
    for (const cambio of mundo.tomarCambios()) {
      eventos.empujar({ tipo: 'variable_cambiada', variable: cambio.nombre, valor: cambio.valor });
    }
  };

  switch (accion.nombre) {
    case 'marcar':
      mundo.marcar(texto('variable'), accion.args['valor'] ?? '');
      avisarVariables();
      return { resuelta: true };
    case 'sumar':
      mundo.sumar(texto('contador'), numero('cuanto', 1));
      return { resuelta: true };
    case 'activar': {
      const objeto = texto('objeto');
      if (mundo.activar(objeto)) {
        eventos.empujar({ tipo: 'objeto_activado', objeto });
        return { resuelta: true, aviso: 'objeto_activado' };
      }
      return { resuelta: true };
    }
    case 'desactivar': {
      const objeto = texto('objeto');
      if (mundo.desactivar(objeto)) {
        eventos.empujar({ tipo: 'objeto_desactivado', objeto });
        return { resuelta: true, aviso: 'objeto_desactivado' };
      }
      return { resuelta: true };
    }
    case 'pedir_gesto':
      eventos.pedirGesto(texto('gesto'), texto('objetivo'), Math.max(1, numero('veces', 1)));
      return { resuelta: true };
    case 'cancelar_gesto':
      eventos.cancelarGesto(texto('gesto'), texto('objetivo'));
      return { resuelta: true };
    case 'completar': {
      const cumplida = misiones?.completar(texto('mision')) ?? null;
      return cumplida === null ? { resuelta: true } : { resuelta: true, misionCumplida: cumplida.id };
    }
    case 'terminar_nivel':
      return { resuelta: true, aviso: 'nivel_terminado' };
    default:
      return { resuelta: false };
  }
}

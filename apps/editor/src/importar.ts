/**
 * Importar un archivo de nivel: leerlo, validarlo con el MISMO validador de la
 * lógica y volver a armarlo como nivel del editor, para seguir tocándolo.
 *
 * El viaje de vuelta es el espejo exacto de `exportar.ts`/`construir.ts`: una
 * condición del juego vuelve a ser una plantilla con sus respuestas, y una acción
 * estructurada vuelve a ser un ENTONCES elegido. Por eso
 * "exportar → importar → exportar" da el MISMO archivo (se prueba en
 * `exportar.test.ts`).
 *
 * Dos reglas de oro:
 *
 *   1. NADA se carga si algo no cierra: primero se valida con `validarNivel` y,
 *      si hay algo que el editor no sabe rearmar, se avisa en castellano y se
 *      deja el trabajo que ya estaba armado como estaba. Nunca a medias.
 *   2. Los avisos van en castellano claro, no en `reglas[1].si`.
 */
import type { Accion, Condicion, Mision, Nivel, Regla } from '@juegosemi/logica';
import { validarNivel } from '@juegosemi/logica';
import type {
  AccionElegida,
  CosaEditor,
  MisionEditor,
  NivelEnConstruccion,
  ReglaEditor,
  Respuestas,
} from './estado.ts';
import { PLANTILLAS_ENTONCES, plantillaCuando } from './plantillas.ts';
import { mensajeAmable } from './validar-editor.ts';
import { esEscenarioEditor, type EscenarioEditor } from './escenario.ts';

/** La importación salió bien: queda este nivel para editar. */
export interface ImportacionOk {
  ok: true;
  nivel: NivelEnConstruccion;
}

/** La importación no se pudo hacer: se avisa y NO se toca lo que ya estaba. */
export interface ImportacionMala {
  ok: false;
  mensajes: string[];
}

export type ResultadoImportacion = ImportacionOk | ImportacionMala;

/** El aviso parejo cuando el archivo no es un juego. */
export const NO_ES_UN_JUEGO = 'Ese archivo no parece un juego del editor: fijate que sea uno que hayas exportado.';

/** Una condición del juego vuelta a plantilla + respuestas (null si no se sabe rearmar). */
export function condicionAEditor(condicion: Condicion): { id: string; valores: Respuestas } | null {
  const c = condicion as Record<string, unknown>;
  const texto = (clave: string): string => {
    const valor = c[clave];
    return typeof valor === 'string' ? valor : '';
  };
  const numero = (clave: string): number | undefined => {
    const valor = c[clave];
    return typeof valor === 'number' ? valor : undefined;
  };
  const valores: Respuestas = {};

  if (texto('toco') !== '') {
    valores['toco'] = texto('toco');
    const veces = numero('veces');
    if (veces !== undefined) valores['veces'] = veces;
    return { id: 'toca', valores };
  }
  if (texto('contador') !== '') {
    valores['contador'] = texto('contador');
    const alMenos = numero('al_menos');
    if (alMenos !== undefined) valores['al_menos'] = alMenos;
    return { id: 'contador', valores };
  }
  if (texto('mision') !== '') {
    valores['mision'] = texto('mision');
    return { id: 'mision', valores };
  }
  if (texto('evento') === 'entidad_soltada' && texto('destino') !== '') {
    valores['destino'] = texto('destino');
    if (texto('entidad') !== '') valores['entidad'] = texto('entidad');
    return { id: 'suelta_sobre', valores };
  }
  if (texto('evento') === 'gesto_completado' && texto('gesto') !== '') {
    valores['gesto'] = texto('gesto');
    if (texto('destino') !== '') valores['objetivo'] = texto('destino');
    const veces = numero('veces');
    if (veces !== undefined) valores['veces'] = veces;
    return { id: 'gesto', valores };
  }
  if (texto('evento') === 'zona_entrada' && texto('zona') !== '') {
    valores['zona'] = texto('zona');
    return { id: 'zona', valores };
  }
  return null;
}

/** Una acción del juego vuelta a un ENTONCES elegido (null si no se sabe rearmar). */
export function accionAEditor(accion: Accion): AccionElegida | null {
  // Las acciones escritas a mano en texto (`ocultar($entidad)`) no las arma el
  // editor, así que no se sabe volver a tocarlas.
  if (typeof accion === 'string') return null;
  const plantilla = PLANTILLAS_ENTONCES.find((candidata) => candidata.accion === accion.tipo);
  if (plantilla === undefined) return null;
  const crudo = accion as unknown as Record<string, unknown>;
  const valores: Respuestas = {};
  for (const pregunta of plantilla.preguntas) {
    const valor = crudo[pregunta.clave];
    if (typeof valor === 'string' && valor !== '') valores[pregunta.clave] = valor;
    if (typeof valor === 'number') valores[pregunta.clave] = valor;
  }
  return { entoncesId: plantilla.id, valores };
}

/** El id del video-premio que paga una misión, si lo hay (y avisa de lo que sobre). */
export function premioDeRecompensa(acciones: readonly Accion[] | undefined): string | null {
  let premio: string | null = null;
  for (const accion of acciones ?? []) {
    if (typeof accion === 'string') {
      if (accion.trim() === 'celebrar') continue;
      return null;
    }
    if (accion.tipo === 'celebrar') continue;
    if (accion.tipo === 'reproducir_video' && typeof accion.video === 'string' && accion.video !== '') {
      premio = accion.video;
      continue;
    }
    return null;
  }
  return premio;
}

/** Las cosas del juego (id y nombre) que el escenario conoce. */
function cosasDeEscenario(piezas: readonly { id: string; nombre?: string }[]): CosaEditor[] {
  return piezas.map((pieza) => ({ id: pieza.id, nombre: typeof pieza.nombre === 'string' ? pieza.nombre : pieza.id }));
}

/** Las claves de un objeto del mundo, como cosas (el nombre es el id). */
function cosasDeCuenta(mapa: Record<string, unknown> | undefined): CosaEditor[] {
  if (mapa === undefined || typeof mapa !== 'object' || mapa === null) return [];
  return Object.keys(mapa).map((clave) => ({ id: clave, nombre: clave }));
}

/** Rearma una regla del juego; null si trae algo que el editor no sabe tocar. */
function reglaAEditor(regla: Regla): ReglaEditor | null {
  let cuandoId: string | null = null;
  let cuandoValores: Respuestas = {};
  if (regla.si !== undefined) {
    const cuando = condicionAEditor(regla.si);
    if (cuando === null) return null;
    cuandoId = cuando.id;
    cuandoValores = cuando.valores;
  }
  const acciones: AccionElegida[] = [];
  for (const accion of regla.hacer) {
    const elegida = accionAEditor(accion);
    if (elegida === null) return null;
    acciones.push(elegida);
  }
  return { id: regla.id, cuandoId, cuandoValores, acciones };
}

/** Rearma una misión del juego; null si trae algo que el editor no sabe tocar. */
function misionAEditor(mision: Mision): MisionEditor | null {
  const cumple = condicionAEditor(mision.cumple);
  if (cumple === null) return null;
  const premio = premioDeRecompensa(mision.recompensa);
  if (premio === null && (mision.recompensa ?? []).length > 0) return null;
  return {
    id: mision.id,
    nombre: mision.texto ?? mision.id,
    cumpleId: cumple.id,
    cumpleValores: cumple.valores,
    requiere: [...(mision.requiere ?? [])],
    recompensa: premio,
  };
}

/**
 * Rearma el nivel del editor a partir de un archivo ya validado. Devuelve los
 * avisos en castellano de lo que no se pudo tocar (lista vacía = perfecto).
 */
export function rearmarNivel(exportado: Nivel & { escenario?: EscenarioEditor }): {
  nivel: NivelEnConstruccion;
  avisos: string[];
} {
  const avisos: string[] = [];

  const escenario: EscenarioEditor | null =
    esEscenarioEditor(exportado.escenario) ? exportado.escenario : null;
  const entidades = escenario === null ? [] : cosasDeEscenario(escenario.piezas);
  const zonas = escenario === null ? [] : cosasDeEscenario(escenario.zonas);
  if (escenario === null && exportado.reglas.length === 0) {
    avisos.push('El archivo no traía el escenario, así que la pantalla queda sin piezas.');
  }

  const contadores = cosasDeCuenta(exportado.mundo?.contadores);
  const interruptores = cosasDeCuenta(exportado.mundo?.objetos);

  const reglas: ReglaEditor[] = [];
  for (const regla of exportado.reglas) {
    const rearmada = reglaAEditor(regla);
    if (rearmada === null) {
      avisos.push(`La regla «${regla.id}» está escrita de una forma que el editor todavía no sabe volver a tocar.`);
      continue;
    }
    reglas.push(rearmada);
  }

  const misiones: MisionEditor[] = [];
  for (const mision of exportado.misiones ?? []) {
    const rearmada = misionAEditor(mision);
    if (rearmada === null) {
      avisos.push(`La misión «${mision.id}» tiene algo que el editor todavía no sabe volver a tocar.`);
      continue;
    }
    misiones.push(rearmada);
  }

  const nivel: NivelEnConstruccion = {
    id: exportado.id,
    titulo: exportado.titulo ?? 'Mi juego',
    entidades,
    zonas,
    contadores,
    interruptores,
    misiones,
    reglas,
  };
  return { nivel, avisos };
}

/**
 * Lee el texto de un archivo y devuelve el nivel para editar, o los avisos en
 * castellano de por qué no se puede. No toca nada del editor: el que llama decide
 * (así un archivo que no cierra nunca rompe lo que ya estaba armado).
 */
export function interpretarTexto(texto: string): ResultadoImportacion {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return { ok: false, mensajes: [NO_ES_UN_JUEGO] };
  }
  if (typeof crudo !== 'object' || crudo === null) return { ok: false, mensajes: [NO_ES_UN_JUEGO] };
  const registro = crudo as Record<string, unknown>;
  if (typeof registro['id'] !== 'string' || !Array.isArray(registro['reglas'])) {
    return { ok: false, mensajes: [NO_ES_UN_JUEGO] };
  }

  const validacion = validarNivel(crudo as Nivel);
  if (!validacion.ok) {
    const mensajes: string[] = [];
    for (const error of validacion.errores) {
      const mensaje = mensajeAmable(error);
      if (mensajes.indexOf(mensaje) === -1) mensajes.push(mensaje);
    }
    return { ok: false, mensajes };
  }

  const rearmado = rearmarNivel(crudo as Nivel & { escenario?: EscenarioEditor });
  if (rearmado.avisos.length > 0) {
    return { ok: false, mensajes: rearmado.avisos };
  }
  return { ok: true, nivel: rearmado.nivel };
}

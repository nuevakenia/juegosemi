/**
 * Construir la lógica a partir de lo que se tocó en el editor.
 *
 * Es la traducción entre las dos formas:
 *
 *   EDITOR   { cuandoId: 'suelta_sobre', cuandoValores: { destino: 'auto', entidad: 'maleta' },
 *              acciones: [{ entoncesId: 'desaparece', valores: { objetivo: 'maleta' } }] }
 *   LÓGICA   { si: { evento: 'entidad_soltada', destino: 'auto', entidad: 'maleta' },
 *              hacer: [{ tipo: 'ocultar', objetivo: 'maleta' }] }
 *
 * Todo es puro y se prueba sin navegador. Las dos reglas de oro de acá:
 *
 *   - una acción que no está completa NO se escribe (así el nivel nunca hace algo a
 *     medias); la regla queda sin `hacer` y el validador lo avisa en castellano;
 *   - una condición sin su dato principal tampoco se escribe (no se inventa un
 *     "siempre" que dispare la regla en el primer paso).
 */
import type {
  Accion,
  AccionEstructurada,
  Condicion,
  CondicionContador,
  CondicionEvento,
  CondicionMision,
  CondicionToque,
  Mision,
  MundoDatos,
  Nivel,
  Regla,
} from '@juegosemi/logica';
import type { MisionEditor, NivelEnConstruccion, ReglaEditor, Respuestas } from './estado.ts';
import { numeroDe, textoDe } from './estado.ts';
import { plantillaCuando, plantillaEntonces, type Pregunta } from './plantillas.ts';

/** Una respuesta con algo adentro (texto no vacío o número). */
function hayRespuesta(valor: string | number | undefined): boolean {
  if (valor === undefined) return false;
  if (typeof valor === 'number') return Number.isFinite(valor);
  return valor.trim() !== '';
}

/** ¿Están respondidas todas las preguntas obligatorias de esta plantilla? */
function respuestasCompletas(preguntas: readonly Pregunta[], valores: Respuestas): boolean {
  for (const pregunta of preguntas) {
    if (pregunta.opcional === true) continue;
    if (!hayRespuesta(valores[pregunta.clave])) return false;
  }
  return true;
}

/** Los valores que arrancan puestos al elegir un CUANDO (veces, "llega a"). */
export function valoresPorDefectoCuando(cuandoId: string): Respuestas {
  const plantilla = plantillaCuando(cuandoId);
  if (plantilla === null) return {};
  const valores: Respuestas = {};
  for (const pregunta of [...plantilla.extras].concat(plantilla.quien)) {
    if (pregunta.porDefecto !== undefined) valores[pregunta.clave] = pregunta.porDefecto;
  }
  return valores;
}

/**
 * Los valores que arrancan puestos al agregar una acción. La primera pregunta de
 * lista hereda lo que ya se eligió en el paso QUIEN: si la regla es "suelta sobre
 * el auto", "desaparece" arranca apuntando a lo que se suelta ($entidad) o a la
 * entidad que se soltó, para no preguntar dos veces lo mismo.
 */
export function valoresPorDefectoEntonces(
  regla: ReglaEditor,
  entoncesId: string,
): Respuestas {
  const plantilla = plantillaEntonces(entoncesId);
  if (plantilla === null) return {};
  const valores: Respuestas = {};
  for (const pregunta of plantilla.preguntas) {
    if (pregunta.porDefecto !== undefined) valores[pregunta.clave] = pregunta.porDefecto;
  }
  const delCuando = plantillaCuando(regla.cuandoId);
  for (const pregunta of plantilla.preguntas) {
    if (pregunta.tipo !== 'entidad' || valores[pregunta.clave] !== undefined) continue;
    if (delCuando === null) continue;
    if (regla.cuandoId === 'suelta_sobre' && pregunta.admiteEntidadActual === true) {
      valores[pregunta.clave] = '$entidad';
      continue;
    }
    const elegido = textoDe(regla.cuandoValores, delCuando.quien.clave);
    if (elegido !== '') valores[pregunta.clave] = elegido;
  }
  return valores;
}

/**
 * La condición de un CUANDO (de una regla o del cómo-se-cumple de una misión), o
 * undefined si todavía le falta el dato principal. Es la misma traducción para
 * los dos: una misión se cumple con la misma clase de condición que dispara una
 * regla, así no hay dos vocabularios.
 */
export function condicionDe(
  cuandoId: string | null,
  cuandoValores: Respuestas,
): Condicion | undefined {
  const plantilla = plantillaCuando(cuandoId);
  if (plantilla === null) return undefined;
  const v = (clave: string): string => textoDe(cuandoValores, clave);
  const n = (clave: string): number | null => numeroDe(cuandoValores, clave);

  if (plantilla.id === 'toca') {
    const toco = v('toco');
    if (toco === '') return undefined;
    const condicion: CondicionToque = { toco };
    const veces = n('veces');
    if (veces !== null && veces > 1) condicion.veces = veces;
    return condicion;
  }

  if (plantilla.id === 'suelta_sobre') {
    const destino = v('destino');
    if (destino === '') return undefined;
    const condicion: CondicionEvento = { evento: 'entidad_soltada', destino };
    const entidad = v('entidad');
    if (entidad !== '') condicion.entidad = entidad;
    return condicion;
  }

  if (plantilla.id === 'gesto') {
    const gesto = v('gesto');
    if (gesto === '') return undefined;
    const condicion: CondicionEvento = { evento: 'gesto_completado', gesto };
    const objetivo = v('objetivo');
    if (objetivo !== '') condicion.destino = objetivo;
    const veces = n('veces');
    if (veces !== null && veces > 1) condicion.veces = veces;
    return condicion;
  }

  if (plantilla.id === 'contador') {
    const contador = v('contador');
    if (contador === '') return undefined;
    const condicion: CondicionContador = { contador };
    const alMenos = n('al_menos');
    if (alMenos !== null && alMenos > 1) condicion.al_menos = alMenos;
    return condicion;
  }

  if (plantilla.id === 'zona') {
    const zona = v('zona');
    if (zona === '') return undefined;
    const condicion: CondicionEvento = { evento: 'zona_entrada', zona };
    return condicion;
  }

  if (plantilla.id === 'mision') {
    const mision = v('mision');
    if (mision === '') return undefined;
    const condicion: CondicionMision = { mision, hecha: true };
    return condicion;
  }

  return undefined;
}

/** Una acción escrita, o null si todavía le falta alguna respuesta obligatoria. */
export function accionDe(entoncesId: string, valores: Respuestas): AccionEstructurada | null {
  const plantilla = plantillaEntonces(entoncesId);
  if (plantilla === null) return null;
  if (!respuestasCompletas(plantilla.preguntas, valores)) return null;
  const campos: Record<string, string | number> = {};
  for (const pregunta of plantilla.preguntas) {
    const valor = valores[pregunta.clave];
    if (valor === undefined) continue;
    if (typeof valor === 'string' && valor.trim() === '') continue;
    campos[pregunta.clave] = valor;
  }
  return { tipo: plantilla.accion, ...campos } as AccionEstructurada;
}

/** Las acciones escritas de una regla (sólo las que están completas). */
export function accionesDe(regla: ReglaEditor): Accion[] {
  const acciones: Accion[] = [];
  for (const elegida of regla.acciones) {
    const accion = accionDe(elegida.entoncesId, elegida.valores);
    if (accion !== null) acciones.push(accion);
  }
  return acciones;
}

/** Una regla del editor traducida a la forma de la lógica. */
export function aRegla(regla: ReglaEditor): Regla {
  const si = condicionDe(regla.cuandoId, regla.cuandoValores);
  const hacer = accionesDe(regla);
  return si === undefined ? { id: regla.id, hacer } : { id: regla.id, si, hacer };
}

/** El mundo inicial del nivel: los contadores en 0 y los interruptores apagados. */
export function mundoDe(nivel: NivelEnConstruccion): MundoDatos {
  const contadores: Record<string, number> = {};
  for (const contador of nivel.contadores) contadores[contador.id] = 0;
  const objetos: Record<string, boolean> = {};
  for (const interruptor of nivel.interruptores) objetos[interruptor.id] = false;
  return { contadores, objetos };
}

/**
 * Las acciones que paga una misión al cumplirse: el video-premio elegido y el
 * festejo. Es exactamente la forma del nivel canónico
 * (`["reproducir_video(...)", "celebrar"]`), escrita como objetos.
 */
export function recompensaDe(premioId: string | null): Accion[] {
  if (premioId === null) return [];
  const video: AccionEstructurada = { tipo: 'reproducir_video', video: premioId };
  return [video, { tipo: 'celebrar' }];
}

/** ¿La misión ya tiene una condición con su dato principal? */
export function misionEstaCompleta(mision: MisionEditor): boolean {
  return condicionDe(mision.cumpleId, mision.cumpleValores) !== undefined;
}

/** Una misión del editor traducida a la forma de la lógica (o null si está a medias). */
export function aMision(mision: MisionEditor): Mision | null {
  const cumple = condicionDe(mision.cumpleId, mision.cumpleValores);
  if (cumple === undefined) return null;
  const logica: Mision = {
    id: mision.id,
    texto: mision.nombre,
    cumple,
    requiere: mision.requiere,
  };
  const recompensa = recompensaDe(mision.recompensa);
  if (recompensa.length > 0) logica.recompensa = recompensa;
  return logica;
}

/**
 * Las misiones escritas en el nivel. Una misión a la que todavía le falta decir
 * cómo se cumple NO se escribe (igual que una acción a medias): así el juego
 * nunca recibe una misión que no se puede terminar.
 */
export function misionesDe(nivel: NivelEnConstruccion): Mision[] {
  const misiones: Mision[] = [];
  for (const mision of nivel.misiones) {
    const escrita = aMision(mision);
    if (escrita !== null) misiones.push(escrita);
  }
  return misiones;
}

/** El nivel completo, listo para validar y para probar (incluidas las misiones). */
export function nivelLogico(nivel: NivelEnConstruccion): Nivel {
  return {
    id: nivel.id,
    titulo: nivel.titulo,
    mundo: mundoDe(nivel),
    reglas: nivel.reglas.map(aRegla),
    misiones: misionesDe(nivel),
  };
}

/** ¿La regla ya tiene un cuándo con su dato y al menos una acción completa? */
export function reglaEstaCompleta(regla: ReglaEditor): boolean {
  if (condicionDe(regla.cuandoId, regla.cuandoValores) === undefined) return false;
  return accionesDe(regla).length > 0;
}

/** ¿Cuántas reglas están completas? (lo que se ve en el contador del editor). */
export function reglasCompletas(nivel: NivelEnConstruccion): number {
  return nivel.reglas.filter(reglaEstaCompleta).length;
}

/** ¿Cuántas misiones ya dicen cómo se cumplen? */
export function misionesCompletas(nivel: NivelEnConstruccion): number {
  return nivel.misiones.filter(misionEstaCompleta).length;
}

/**
 * Las PLANTILLAS del editor: la clave de todo.
 *
 * Un juego se arma en tres pasos grandes y sin escribir una línea de código:
 *
 *   CUANDO   qué pasa: toca algo, suelta algo sobre algo, hace un gesto,
 *            un contador llega a un número, llega a una zona, se cumple una misión.
 *   QUIEN    de qué se trata: la entidad, la zona o el contador de la pantalla.
 *   ENTONCES qué pasa: aparece, desaparece, dice, suena, video, suma, abre, termina.
 *
 * Acá NO se inventa nada: cada plantilla calza con una condición o una acción que
 * el paquete `@juegosemi/logica` ya sabe evaluar (`condiciones.ts` / `acciones.ts` /
 * `validar.ts`). Si mañana la lógica suma una acción, se agrega acá una plantilla
 * y el editor la ofrece sola.
 *
 * Y no todas las combinaciones tienen sentido: un video o un final de nivel son
 * PREMIOS, así que sólo se ofrecen cuando el CUANDO es una meta (un contador, una
 * zona o una misión). Tocando un botón no se paga un video.
 */
import { GESTOS_CONOCIDOS } from '@juegosemi/logica';

/** Así se llama el protagonista en la frase de cada regla. */
export const SUJETO = 'Emiliano';

/** Los gestos que el sistema sabe reconocer (los mismos que valida la lógica). */
export const GESTOS: readonly string[] = GESTOS_CONOCIDOS;

/** Lo que una pregunta del editor le pide al grande: una cosa de la lista o un texto. */
export type TipoPregunta =
  | 'entidad'
  | 'zona'
  | 'gesto'
  | 'contador'
  | 'interruptor'
  | 'mision'
  | 'numero'
  | 'frase'
  | 'sonido'
  | 'video';

/** Una pregunta del editor. Las de lista se responden tocando botones grandes. */
export interface Pregunta {
  /** Con qué nombre queda guardada la respuesta dentro de la regla. */
  clave: string;
  /** Lo que se le pregunta al grande, en castellano. */
  etiqueta: string;
  tipo: TipoPregunta;
  /** Si es opcional, la regla funciona igual sin responderla. */
  opcional?: boolean;
  /** Ofrece además "$entidad": "lo que se suelta" (el comodín de la lógica). */
  admiteEntidadActual?: boolean;
  /** Lo que arranca puesto al elegir la plantilla. */
  porDefecto?: string | number;
  /** Pista corta dentro del campo de texto. */
  pista?: string;
}

/** Una plantilla del paso CUANDO. */
export interface PlantillaCuando {
  id: string;
  /** El texto grande del botón ("Toca algo"). */
  etiqueta: string;
  pictograma: string;
  /** La pregunta principal: es el paso QUIEN. */
  quien: Pregunta;
  /** Las preguntas extra (cuántas veces, qué gesto...). */
  extras: readonly Pregunta[];
  /** Los ENTONCES que tienen sentido con este CUANDO. */
  acciones: readonly string[];
}

/** Una plantilla del paso ENTONCES. */
export interface PlantillaEntonces {
  id: string;
  /** El texto grande del botón ("aparece"). */
  etiqueta: string;
  pictograma: string;
  /** La acción real de la lógica que se escribe al elegirla. */
  accion: string;
  /** Lo que hay que completar para que la acción sirva. */
  preguntas: readonly Pregunta[];
}

/** El comodín de la lógica: "la entidad que se acaba de soltar o tocar". */
export const ENTIDAD_ACTUAL = '$entidad';

/** Lo que puede hacer cualquier disparador: afectar la pantalla, el mundo o el sonido. */
const ACCIONES_SIEMPRE: readonly string[] = ['aparece', 'desaparece', 'dice', 'suena', 'suma', 'abre'];

/** Lo que sólo tiene sentido al cerrar una meta (el premio y el final). */
const ACCIONES_DE_META: readonly string[] = ['video', 'termina'];

/** Los CUANDO que son una meta y no un toque suelto. */
export const CUANDO_META: readonly string[] = ['contador', 'zona', 'mision'];

/** Las plantillas del paso CUANDO, en el orden en que se muestran. */
export const PLANTILLAS_CUANDO: readonly PlantillaCuando[] = [
  {
    id: 'toca',
    etiqueta: 'Toca algo',
    pictograma: '👆',
    quien: { clave: 'toco', etiqueta: '¿Qué toca?', tipo: 'entidad' },
    extras: [{ clave: 'veces', etiqueta: '¿Cuántas veces?', tipo: 'numero', porDefecto: 1, opcional: true }],
    acciones: ACCIONES_SIEMPRE,
  },
  {
    id: 'suelta_sobre',
    etiqueta: 'Suelta algo sobre algo',
    pictograma: '🧩',
    quien: { clave: 'destino', etiqueta: '¿Sobre qué lo suelta?', tipo: 'entidad' },
    extras: [
      { clave: 'entidad', etiqueta: '¿Qué suelta?', tipo: 'entidad', opcional: true },
    ],
    acciones: ACCIONES_SIEMPRE,
  },
  {
    id: 'gesto',
    etiqueta: 'Hace un gesto',
    pictograma: '🌀',
    quien: { clave: 'objetivo', etiqueta: '¿Sobre qué lo hace?', tipo: 'entidad', opcional: true },
    extras: [
      { clave: 'gesto', etiqueta: '¿Qué gesto?', tipo: 'gesto' },
      { clave: 'veces', etiqueta: '¿Cuántas veces?', tipo: 'numero', porDefecto: 1, opcional: true },
    ],
    acciones: ACCIONES_SIEMPRE,
  },
  {
    id: 'contador',
    etiqueta: 'Un contador llega a un número',
    pictograma: '🔢',
    quien: { clave: 'contador', etiqueta: '¿Cuál contador?', tipo: 'contador' },
    extras: [{ clave: 'al_menos', etiqueta: '¿Llega a cuántos?', tipo: 'numero', porDefecto: 1, opcional: true }],
    acciones: [...ACCIONES_SIEMPRE, ...ACCIONES_DE_META],
  },
  {
    id: 'zona',
    etiqueta: 'Llega a una zona',
    pictograma: '📍',
    quien: { clave: 'zona', etiqueta: '¿A qué zona?', tipo: 'zona' },
    extras: [],
    acciones: [...ACCIONES_SIEMPRE, ...ACCIONES_DE_META],
  },
  {
    id: 'mision',
    etiqueta: 'Se cumple una misión',
    pictograma: '🚩',
    quien: { clave: 'mision', etiqueta: '¿Qué misión?', tipo: 'mision' },
    extras: [],
    acciones: [...ACCIONES_SIEMPRE, ...ACCIONES_DE_META],
  },
];

/** Las plantillas del paso ENTONCES, en el orden en que se muestran. */
export const PLANTILLAS_ENTONCES: readonly PlantillaEntonces[] = [
  {
    id: 'aparece',
    etiqueta: 'aparece',
    pictograma: '👀',
    accion: 'mostrar',
    preguntas: [{ clave: 'objetivo', etiqueta: '¿Qué aparece?', tipo: 'entidad', admiteEntidadActual: true }],
  },
  {
    id: 'desaparece',
    etiqueta: 'desaparece',
    pictograma: '🙈',
    accion: 'ocultar',
    preguntas: [{ clave: 'objetivo', etiqueta: '¿Qué desaparece?', tipo: 'entidad', admiteEntidadActual: true }],
  },
  {
    id: 'dice',
    etiqueta: 'dice',
    pictograma: '💬',
    accion: 'decir',
    preguntas: [
      { clave: 'entidad', etiqueta: '¿Quién habla?', tipo: 'entidad' },
      { clave: 'frase', etiqueta: '¿Qué dice?', tipo: 'frase', pista: '¡vamos!' },
    ],
  },
  {
    id: 'suena',
    etiqueta: 'suena',
    pictograma: '🔔',
    accion: 'sonar',
    preguntas: [{ clave: 'sonido', etiqueta: '¿Qué suena?', tipo: 'sonido', pista: 'bien' }],
  },
  {
    id: 'video',
    etiqueta: 'se ve un video',
    pictograma: '🎬',
    accion: 'reproducir_video',
    preguntas: [{ clave: 'video', etiqueta: '¿Qué video?', tipo: 'video' }],
  },
  {
    id: 'suma',
    etiqueta: 'suma',
    pictograma: '➕',
    accion: 'sumar',
    preguntas: [
      { clave: 'contador', etiqueta: '¿A qué contador?', tipo: 'contador' },
      { clave: 'cuanto', etiqueta: '¿Cuánto suma?', tipo: 'numero', porDefecto: 1 },
    ],
  },
  {
    id: 'abre',
    etiqueta: 'abre',
    pictograma: '🔓',
    accion: 'activar',
    preguntas: [{ clave: 'objeto', etiqueta: '¿Qué abre?', tipo: 'interruptor' }],
  },
  {
    id: 'termina',
    etiqueta: 'termina el nivel',
    pictograma: '🏁',
    accion: 'terminar_nivel',
    preguntas: [],
  },
];

/** La plantilla de un CUANDO, o null si ese id no existe. */
export function plantillaCuando(id: string | null): PlantillaCuando | null {
  if (id === null) return null;
  for (const plantilla of PLANTILLAS_CUANDO) {
    if (plantilla.id === id) return plantilla;
  }
  return null;
}

/** La plantilla de un ENTONCES, o null si ese id no existe. */
export function plantillaEntonces(id: string | null): PlantillaEntonces | null {
  if (id === null) return null;
  for (const plantilla of PLANTILLAS_ENTONCES) {
    if (plantilla.id === id) return plantilla;
  }
  return null;
}

/** Los ENTONCES que tienen sentido con este CUANDO (nunca todos por todos). */
export function accionesQueTienenSentido(cuandoId: string | null): readonly string[] {
  const plantilla = plantillaCuando(cuandoId);
  return plantilla === null ? [] : plantilla.acciones;
}

/** ¿Esta pareja CUANDO/ENTONCES tiene sentido? */
export function tieneSentido(cuandoId: string | null, entoncesId: string): boolean {
  return accionesQueTienenSentido(cuandoId).indexOf(entoncesId) !== -1;
}

/** Las plantillas de ENTONCES que se le ofrecen a este CUANDO, ya filtradas. */
export function entoncesDisponibles(cuandoId: string | null): PlantillaEntonces[] {
  const libres = accionesQueTienenSentido(cuandoId);
  return PLANTILLAS_ENTONCES.filter((plantilla) => libres.indexOf(plantilla.id) !== -1);
}

/** El nombre legible del gesto, para la frase ("gira en círculo"). */
export function nombreDeGesto(id: string): string {
  const nombres: Record<string, string> = {
    toque_repetido: 'toca repetido',
    mantener: 'mantiene apretado',
    circulo: 'da una vuelta',
    direccion: 'desliza derecho',
    deslizar: 'desliza',
    sacudir: 'sacude',
    palabra: 'dice una palabra',
  };
  return nombres[id] ?? id;
}

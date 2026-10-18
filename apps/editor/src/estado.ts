/**
 * El ESTADO del editor de niveles: el juego que se está armando.
 *
 * Es PURO a propósito: no toca el DOM, ni el almacenamiento, ni el render. Sólo
 * guarda el nivel en construcción y sabe aplicarle las operaciones de alto nivel
 * ("agregar una regla en blanco", "elegir el cuándo", "elegir qué hace", "borrar la
 * regla"). Todo lo que se hace tocando un botón es una de estas operaciones.
 *
 * Las reglas se guardan en la forma del editor (qué plantilla se eligió y qué
 * respuestas se tocaron) y `construir.ts` las traduce a la forma de la lógica
 * (`si <condición> entonces <acciones>`), que es la que valida `validarNivel` y la
 * que corre el PUENTE cuando se prueba.
 *
 * Ojo: además de las reglas, el nivel en construcción lleva las COSAS del juego
 * (qué entidades, zonas, contadores e interruptores hay). Sin eso no hay entre qué
 * elegir, y el editor no tendría listas que ofrecer.
 */
import type { Categoria } from './categorias.ts';
import { tieneSentido } from './plantillas.ts';

/** Una cosa del juego: su id (el que va en los datos) y cómo se llama en pantalla. */
export interface CosaEditor {
  id: string;
  nombre: string;
}

/** Las respuestas que se tocaron para una plantilla (por clave de pregunta). */
export type Respuestas = Record<string, string | number>;

/** Una acción elegida: su plantilla y sus respuestas. */
export interface AccionElegida {
  entoncesId: string;
  valores: Respuestas;
}

/** Una regla en construcción: el "si ... entonces ..." de la pantalla. */
export interface ReglaEditor {
  id: string;
  /** Qué plantilla del paso CUANDO se eligió (null mientras no se eligió ninguna). */
  cuandoId: string | null;
  /** Las respuestas del paso CUANDO (incluido el QUIEN). */
  cuandoValores: Respuestas;
  /** Las acciones del ENTONCES, en el orden en que se agregaron. */
  acciones: AccionElegida[];
}

/**
 * Una MISIÓN en construcción: qué hay que lograr, de qué depende y qué se gana.
 *
 * Es la parte que faltaba del editor. Una misión se arma como una regla (primero
 * se elige cómo se cumple, igual que el paso CUANDO) pero además lleva sus
 * PRERREQUISITOS EN ORDEN (de qué misiones depende, y en qué orden hay que
 * cumplirlas: el orden manda) y su PREMIO (un video del catálogo).
 */
export interface MisionEditor extends CosaEditor {
  /** Cómo se cumple: la plantilla del CUANDO elegida (null mientras no se elija). */
  cumpleId: string | null;
  /** Las respuestas de esa condición. */
  cumpleValores: Respuestas;
  /** Las misiones que hay que cumplir antes, EN ORDEN (el primero va primero). */
  requiere: string[];
  /** El video-premio que se gana al cumplirla (id del catálogo), o null. */
  recompensa: string | null;
}

/** El nivel que se está armando. */
export interface NivelEnConstruccion {
  id: string;
  titulo: string;
  /** Las cosas que hay en la pantalla (se arrastran, se tocan, aparecen y desaparecen). */
  entidades: CosaEditor[];
  /** Los lugares a los que se puede llegar. */
  zonas: CosaEditor[];
  /** Los números que se suman (cuántas maletas, cuántos toques). */
  contadores: CosaEditor[];
  /** Los interruptores que se prenden (la puerta abierta, el viaje activo). */
  interruptores: CosaEditor[];
  /** Las misiones del juego, con sus prerrequisitos y su premio. */
  misiones: MisionEditor[];
  reglas: ReglaEditor[];
}

/** El id de una cosa a partir de su nombre: "La casa de la tía" → "la-casa-de-la-tia". */
export function idDesdeNombre(nombre: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  return limpio.length > 0 ? limpio : 'cosa';
}

/** Un id que todavía no esté usado: si ya está, le agrega un número. */
export function idLibre(existentes: readonly string[], base: string): string {
  if (existentes.indexOf(base) === -1) return base;
  let numero = 2;
  while (existentes.indexOf(`${base}-${numero}`) !== -1) numero += 1;
  return `${base}-${numero}`;
}

/** El nivel en blanco: sin nada. */
export function crearNivelEnConstruccion(): NivelEnConstruccion {
  return {
    id: 'mi-juego',
    titulo: 'Mi juego',
    entidades: [],
    zonas: [],
    contadores: [],
    interruptores: [],
    misiones: [],
    reglas: [],
  };
}

/** El nivel con el que abre el editor: un par de cosas ya puestas, para empezar a jugar. */
export function nivelDeArranque(): NivelEnConstruccion {
  return conCosa(
    conCosa(conCosa(crearNivelEnConstruccion(), 'entidades', 'la maleta'), 'entidades', 'el auto'),
    'contadores',
    'maletas',
  );
}

/** Las cosas de una categoría, en su orden. */
export function cosasDe(nivel: NivelEnConstruccion, categoria: Categoria): CosaEditor[] {
  // Las misiones son cosas con extras (prerrequisitos y premio): igual calzan acá.
  if (categoria === 'misiones') return nivel.misiones;
  return nivel[categoria];
}

/** Los ids de las cosas de una categoría (para no repetirlos). */
export function idsDe(nivel: NivelEnConstruccion, categoria: Categoria): string[] {
  return cosasDe(nivel, categoria).map((cosa) => cosa.id);
}

/** Lee una respuesta de una regla como texto (vacío si no está). */
export function textoDe(valores: Respuestas, clave: string): string {
  const valor = valores[clave];
  if (valor === undefined) return '';
  return String(valor);
}

/** Lee una respuesta de una regla como número (null si no hay o no es un número). */
export function numeroDe(valores: Respuestas, clave: string): number | null {
  const valor = valores[clave];
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  if (typeof valor === 'string' && valor.trim() !== '' && Number.isFinite(Number(valor))) return Number(valor);
  return null;
}

// ── Las cosas del juego ──────────────────────────────────────────────────────

/**
 * Agrega una cosa a una categoría. El id sale del nombre y, si ya existe, se le
 * suma un número: nunca se pisan dos cosas.
 */
export function conCosa(nivel: NivelEnConstruccion, categoria: Categoria, nombre: string): NivelEnConstruccion {
  const limpio = nombre.trim();
  if (limpio === '') return nivel;
  const id = idLibre(idsDe(nivel, categoria), idDesdeNombre(limpio));
  if (categoria === 'misiones') {
    return { ...nivel, misiones: [...nivel.misiones, misionEnBlanco(id, limpio)] };
  }
  return { ...nivel, [categoria]: [...nivel[categoria], { id, nombre: limpio }] };
}

/** Saca una cosa de una categoría (sus reglas quedan como están: el validador avisa). */
export function sinCosa(nivel: NivelEnConstruccion, categoria: Categoria, id: string): NivelEnConstruccion {
  if (categoria === 'misiones') {
    return { ...nivel, misiones: nivel.misiones.filter((mision) => mision.id !== id) };
  }
  return { ...nivel, [categoria]: nivel[categoria].filter((cosa) => cosa.id !== id) };
}

/** Cambia el título del juego (lo que se ve arriba del editor). */
export function conTitulo(nivel: NivelEnConstruccion, titulo: string): NivelEnConstruccion {
  return { ...nivel, titulo };
}

/** El nombre legible de una cosa por su id (el id tal cual si no la encuentra). */
export function nombreDe(nivel: NivelEnConstruccion, id: string): string {
  for (const categoria of ['entidades', 'zonas', 'contadores', 'interruptores', 'misiones'] as const) {
    for (const cosa of cosasDe(nivel, categoria)) {
      if (cosa.id === id) return cosa.nombre;
    }
  }
  return id;
}

// ── Las reglas ───────────────────────────────────────────────────────────────

/** Un id de regla que todavía no esté usado. */
function idDeReglaNueva(nivel: NivelEnConstruccion): string {
  return idLibre(
    nivel.reglas.map((regla) => regla.id),
    'regla',
  );
}

/** La regla con ese id, o null. */
export function reglaPorId(nivel: NivelEnConstruccion, reglaId: string): ReglaEditor | null {
  for (const regla of nivel.reglas) {
    if (regla.id === reglaId) return regla;
  }
  return null;
}

/** Cambia una regla por su id, devolviendo una copia del nivel. */
function conRegla(
  nivel: NivelEnConstruccion,
  reglaId: string,
  cambiar: (regla: ReglaEditor) => ReglaEditor,
): NivelEnConstruccion {
  return {
    ...nivel,
    reglas: nivel.reglas.map((regla) => (regla.id === reglaId ? cambiar(regla) : regla)),
  };
}

/** Agrega una regla EN BLANCO: sin cuándo y sin nada que hacer. */
export function agregarReglaEnBlanco(nivel: NivelEnConstruccion): NivelEnConstruccion {
  const regla: ReglaEditor = {
    id: idDeReglaNueva(nivel),
    cuandoId: null,
    cuandoValores: {},
    acciones: [],
  };
  return { ...nivel, reglas: [...nivel.reglas, regla] };
}

/** Borra una regla. */
export function quitarRegla(nivel: NivelEnConstruccion, reglaId: string): NivelEnConstruccion {
  return { ...nivel, reglas: nivel.reglas.filter((regla) => regla.id !== reglaId) };
}

/** Sube o baja una regla en la lista (el orden en que se prueban). */
export function moverRegla(nivel: NivelEnConstruccion, reglaId: string, cuanto: number): NivelEnConstruccion {
  const i = nivel.reglas.findIndex((regla) => regla.id === reglaId);
  if (i === -1) return nivel;
  const j = i + cuanto;
  if (j < 0 || j >= nivel.reglas.length) return nivel;
  const reglas = [...nivel.reglas];
  const actual = reglas[i];
  const vecina = reglas[j];
  if (actual === undefined || vecina === undefined) return nivel;
  reglas[i] = vecina;
  reglas[j] = actual;
  return { ...nivel, reglas };
}

/**
 * Elige el CUANDO de una regla. Arranca las respuestas de cero y les pone los
 * valores por defecto de la plantilla (las veces, el "llega a").
 *
 * Además saca las acciones que ya no tienen sentido con el nuevo cuándo: si una
 * regla tenía un video y el cuándo deja de ser una meta, ese video se va.
 */
export function elegirCuando(
  nivel: NivelEnConstruccion,
  reglaId: string,
  cuandoId: string,
  valoresPorDefecto: Respuestas,
): NivelEnConstruccion {
  return conRegla(nivel, reglaId, (regla) => {
    const acciones = regla.acciones.filter((accion) => tieneSentido(cuandoId, accion.entoncesId));
    return { ...regla, cuandoId, cuandoValores: { ...valoresPorDefecto }, acciones };
  });
}

/** Pone (o cambia) una respuesta del paso CUANDO. */
export function ponerValorCuando(
  nivel: NivelEnConstruccion,
  reglaId: string,
  clave: string,
  valor: string | number,
): NivelEnConstruccion {
  return conRegla(nivel, reglaId, (regla) => ({
    ...regla,
    cuandoValores: { ...regla.cuandoValores, [clave]: valor },
  }));
}

/** Agrega una acción al ENTONCES, con sus valores por defecto. */
export function agregarAccion(
  nivel: NivelEnConstruccion,
  reglaId: string,
  entoncesId: string,
  valoresPorDefecto: Respuestas,
): NivelEnConstruccion {
  return conRegla(nivel, reglaId, (regla) => ({
    ...regla,
    acciones: [...regla.acciones, { entoncesId, valores: { ...valoresPorDefecto } }],
  }));
}

/** Pone (o cambia) una respuesta de una acción del ENTONCES. */
export function ponerValorAccion(
  nivel: NivelEnConstruccion,
  reglaId: string,
  indice: number,
  clave: string,
  valor: string | number,
): NivelEnConstruccion {
  return conRegla(nivel, reglaId, (regla) => ({
    ...regla,
    acciones: regla.acciones.map((accion, i) =>
      i === indice ? { ...accion, valores: { ...accion.valores, [clave]: valor } } : accion,
    ),
  }));
}

/** Saca una acción del ENTONCES. */
export function quitarAccion(nivel: NivelEnConstruccion, reglaId: string, indice: number): NivelEnConstruccion {
  return conRegla(nivel, reglaId, (regla) => ({
    ...regla,
    acciones: regla.acciones.filter((_, i) => i !== indice),
  }));
}

// ── Las misiones (sus prerrequisitos, su cómo-se-cumple y su premio) ─────────

/** Una misión recién creada: con su nombre, sin condición, sin deps y sin premio. */
export function misionEnBlanco(id: string, nombre: string): MisionEditor {
  return { id, nombre, cumpleId: null, cumpleValores: {}, requiere: [], recompensa: null };
}

/** La misión con ese id, o null. */
export function misionPorId(nivel: NivelEnConstruccion, misionId: string): MisionEditor | null {
  for (const mision of nivel.misiones) {
    if (mision.id === misionId) return mision;
  }
  return null;
}

/** Cambia una misión por su id, devolviendo una copia del nivel. */
function conMision(
  nivel: NivelEnConstruccion,
  misionId: string,
  cambiar: (mision: MisionEditor) => MisionEditor,
): NivelEnConstruccion {
  return {
    ...nivel,
    misiones: nivel.misiones.map((mision) => (mision.id === misionId ? cambiar(mision) : mision)),
  };
}

/**
 * Elige CÓMO SE CUMPLE una misión (una plantilla del CUANDO, normalmente una
 * meta: un contador, una zona o otra misión). Arranca las respuestas de cero con
 * los valores por defecto de la plantilla, igual que el paso CUANDO de una regla.
 */
export function elegirCumple(
  nivel: NivelEnConstruccion,
  misionId: string,
  cumpleId: string,
  valoresPorDefecto: Respuestas,
): NivelEnConstruccion {
  return conMision(nivel, misionId, (mision) => ({
    ...mision,
    cumpleId,
    cumpleValores: { ...valoresPorDefecto },
  }));
}

/** Pone (o cambia) una respuesta de la condición de una misión. */
export function ponerValorCumple(
  nivel: NivelEnConstruccion,
  misionId: string,
  clave: string,
  valor: string | number,
): NivelEnConstruccion {
  return conMision(nivel, misionId, (mision) => ({
    ...mision,
    cumpleValores: { ...mision.cumpleValores, [clave]: valor },
  }));
}

/**
 * Pone los PRERREQUISITOS de una misión, en el orden dado (el orden manda).
 * Deja afuera los ids repetidos y la propia misión: una misión no se requiere a
 * sí misma.
 */
export function conRequiere(
  nivel: NivelEnConstruccion,
  misionId: string,
  requiere: readonly string[],
): NivelEnConstruccion {
  const limpio: string[] = [];
  for (const id of requiere) {
    if (id === misionId) continue;
    if (limpio.indexOf(id) === -1) limpio.push(id);
  }
  return conMision(nivel, misionId, (mision) => ({ ...mision, requiere: limpio }));
}

/**
 * Prende o apaga un prerrequisito de una misión. Al prenderlo queda AL FINAL del
 * orden (y después se puede subir); al apagarlo, se va de la lista.
 */
export function alternarRequiere(
  nivel: NivelEnConstruccion,
  misionId: string,
  otraId: string,
): NivelEnConstruccion {
  const mision = misionPorId(nivel, misionId);
  if (mision === null || otraId === misionId) return nivel;
  if (mision.requiere.indexOf(otraId) !== -1) {
    return conRequiere(nivel, misionId, mision.requiere.filter((id) => id !== otraId));
  }
  return conRequiere(nivel, misionId, [...mision.requiere, otraId]);
}

/** Mueve un prerrequisito de lugar dentro del orden (positivo baja, negativo sube). */
export function moverRequiere(
  nivel: NivelEnConstruccion,
  misionId: string,
  otraId: string,
  cuanto: number,
): NivelEnConstruccion {
  const mision = misionPorId(nivel, misionId);
  if (mision === null) return nivel;
  const i = mision.requiere.indexOf(otraId);
  if (i === -1) return nivel;
  const j = i + cuanto;
  if (j < 0 || j >= mision.requiere.length) return nivel;
  const orden = [...mision.requiere];
  const actual = orden[i];
  const vecina = orden[j];
  if (actual === undefined || vecina === undefined) return nivel;
  orden[i] = vecina;
  orden[j] = actual;
  return conRequiere(nivel, misionId, orden);
}

/** Le pone el premio (el id de un video del catálogo) a una misión, o lo saca. */
export function ponerRecompensa(
  nivel: NivelEnConstruccion,
  misionId: string,
  recompensa: string | null,
): NivelEnConstruccion {
  return conMision(nivel, misionId, (mision) => ({ ...mision, recompensa }));
}

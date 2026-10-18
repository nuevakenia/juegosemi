/**
 * El contrato de la lógica: todo lo que un juego necesita para decir "si pasa esto,
 * entonces esto otro" SIN programar.
 *
 * Este paquete no conoce el render, ni el sonido, ni el video, ni Android: sólo
 * decide. Lo que hay que mostrar o sonar se avisa por `efectos.aplicar(...)` y el
 * juego (o el test) hace lo suyo. Por eso toda la lógica se prueba sin navegador.
 */

// ─── El mundo (lo que el juego recuerda) ──────────────────────────────────────

export type Valor = number | boolean | string;

export interface MundoDatos {
  variables?: Record<string, Valor>;
  contadores?: Record<string, number>;
  /** Interruptores: objeto → prendido/apagado. */
  objetos?: Record<string, boolean>;
}

// ─── Eventos (lo que pasa) ────────────────────────────────────────────────────

export type TipoEvento =
  | 'entidad_soltada'
  | 'entidad_tocada'
  | 'zona_entrada'
  | 'gesto_completado'
  | 'gesto_pedido'
  | 'objeto_activado'
  | 'objeto_desactivado'
  | 'variable_cambiada'
  | 'paso_completado'
  | 'mision_cumplida'
  | 'nivel_terminado';

export interface Evento {
  tipo: TipoEvento;
  /** Quién lo hizo (una entidad de la escena). */
  entidad?: string;
  /** Sobre qué o adónde (un destino, una zona, un objeto). */
  destino?: string;
  zona?: string;
  objeto?: string;
  gesto?: string;
  variable?: string;
  valor?: Valor;
  mision?: string;
  secuencia?: string;
  paso?: number;
  /** Cuántas veces (por ejemplo, toques acumulados). */
  veces?: number;
  /** Dónde pasó, cuando importa (soltar, tocar): la lógica igual decide por datos. */
  x?: number;
  y?: number;
}

// ─── Condiciones ("si ...") ───────────────────────────────────────────────────

export interface CondicionVariable {
  variable: string;
  es?: Valor;
  distinto?: Valor;
  mayor?: number;
  menor?: number;
  igual_a?: number;
}
export interface CondicionContador {
  contador: string;
  es?: number;
  al_menos?: number;
  a_lo_mas?: number;
}
export interface CondicionEvento {
  evento: TipoEvento;
  entidad?: string;
  destino?: string;
  zona?: string;
  objeto?: string;
  gesto?: string;
  variable?: string;
  mision?: string;
  /** Para los toques: exige al menos esta cantidad acumulada. */
  veces?: number;
}
export interface CondicionZona {
  zona: string;
  ocupada_por?: string;
  vacia?: boolean;
}
export interface CondicionMision {
  mision: string;
  hecha?: boolean;
  en_curso?: boolean;
  /** ¿Está disponible? (sus prerrequisitos están cumplidos). */
  disponible?: boolean;
}
export interface CondicionPaso {
  paso: string;
  hecho?: number;
  /** Al menos este paso de la secuencia. */
  al_menos?: number;
}

export interface CondicionObjeto {
  activo: string;
  es?: boolean;
}

/** Consulta un gesto pedido y todavía sin completar ("¿ya giró la manivela 3 veces?"). */
export interface CondicionGesto {
  gesto: string;
  objetivo?: string;
  /** Cuántas veces lleva hechas del pedido. */
  veces?: number;
  /** Todavía queda al menos esta cantidad por hacer (avance, no exigencia). */
  faltan?: number;
}

/** Toques repetidos sobre algo: "machacar el botón 5 veces". */
export interface CondicionToque {
  toco: string;
  veces?: number;
}

export type Condicion =
  | CondicionObjeto
  | CondicionVariable
  | CondicionContador
  | CondicionEvento
  | CondicionZona
  | CondicionMision
  | CondicionPaso
  | CondicionGesto
  | CondicionToque
  | { y: Condicion[] }
  | { o: Condicion[] }
  | { no: Condicion };

// ─── Acciones ("entonces ...") ────────────────────────────────────────────────

/**
 * Una acción es `nombre(args)` en texto (cómodo para escribir a mano) o un objeto
 * con `tipo` y sus campos (cómodo para el editor, que no tiene por qué armar
 * strings). Las dos formas se aceptan: el editor produce objetos y el archivo
 * escrito a mano puede usar el texto legible.
 */
export type Accion = string | AccionEstructurada;

export interface AccionEstructurada {
  tipo: string;
  objetivo?: string;
  entidad?: string;
  variable?: string;
  contador?: string;
  valor?: Valor;
  cuanto?: number;
  objeto?: string;
  texto?: string;
  frase?: string;
  video?: string;
  sonido?: string;
  gesto?: string;
  veces?: number;
  segundos?: number;
  mision?: string;
  x?: number;
  y?: number;
  escala?: number;
  animacion?: string;
  /** Para `esperar`: segundos. */
  duracion?: number;
}

/** Una acción ya interpretada, lista para que el juego la aplique. */
export interface AccionResuelta {
  nombre: string;
  args: Record<string, string | number | boolean>;
}

// ─── Reglas ───────────────────────────────────────────────────────────────────

export interface Regla {
  id: string;
  /** Si se cumple, se ejecutan las acciones. */
  si?: Condicion;
  hacer: Accion[];
  /**
   * Una sola vez MIENTRAS la condición se siga cumpliendo (por defecto sí). Se
   * rearma sola cuando la condición deja de cumplirse: así una regla que
   * reacciona a `entidad_soltada` dispara con cada maleta, y una que mira un
   * interruptor dispara una sola vez aunque el interruptor quede prendido.
   */
  una_vez?: boolean;
  /** Prioridad: se evalúan de menor a mayor. */
  orden?: number;
}

// ─── Misiones ─────────────────────────────────────────────────────────────────

export interface Mision {
  id: string;
  texto?: string;
  /** Condición que la cumple. */
  cumple: Condicion;
  /** Misiones que tienen que estar cumplidas antes. */
  requiere?: string[];
  /** Lo que se hace al cumplirla (normalmente la recompensa). */
  recompensa?: Accion[];
}

export type EstadoMision = 'pendiente' | 'en_curso' | 'hecha';

// ─── El nivel completo ────────────────────────────────────────────────────────

export interface Nivel {
  id: string;
  titulo?: string;
  /** Cómo arranca el mundo. */
  mundo?: MundoDatos;
  reglas: Regla[];
  misiones?: Mision[];
  /** Condición de victoria. Si no está, el nivel termina cuando todas las misiones. */
  nivel_terminado?: Condicion;
}

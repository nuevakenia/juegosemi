/**
 * @juegosemi/personajes — los TIPOS de los datos.
 *
 * Todo el sistema es DATOS: nada de arte hecho a mano en un editor gráfico. Un
 * personaje es un puñado de números y de ids de textura, guardados en JSON, y
 * este archivo es el contrato de ese JSON.
 *
 * Regla de la casa: si algo se puede escribir como dato, se escribe como dato.
 */

export interface Tamano {
  ancho: number;
  alto: number;
}

export interface Desplazamiento {
  x: number;
  y: number;
}

/**
 * Una pieza del rig: un rectángulo articulado. El sistema de coordenadas local
 * de una pieza arranca en su esquina de arriba a la izquierda; `pivote` es el
 * punto por donde gira (el hombro, la cadera, el cuello) y también donde se
 * cuelgan las piezas hijas.
 */
export interface PiezaRig {
  id: string;
  /** Id de la pieza padre. Ausente o null = pieza raíz. */
  padre?: string | null;
  /** Dónde va el origen local de esta pieza dentro del sistema local del padre. */
  desplazamiento: Desplazamiento;
  tamano: Tamano;
  /** Punto de giro dentro del rectángulo. Por defecto, el centro. */
  pivote?: Desplazamiento;
  /** Espejo y estiramientos. sirve para el lado derecho del cuerpo (x: -1). */
  escala?: Desplazamiento;
  /** Giro de reposo de la pieza, en GRADOS (lo que se escribe en los datos). */
  grados?: number;
  /** Clave de la paleta ("piel", "pelo", "camisa"). */
  rol?: string;
  /** Color literal ("#f4c9a0"). Gana si no hay rol. */
  color?: string;
  /** Id lógico de textura. null = se dibuja el rectángulo de color. */
  textura?: string | null;
  /** Orden de dibujo: mayor = más adelante. */
  orden?: number;
  /** false para piezas que existen en el rig pero no se ven (manos por detrás). */
  visible?: boolean;
}

/** El rig de base: la jerarquía de piezas que comparten todos los personajes del mismo tipo. */
export interface PlantillaRig {
  id: string;
  nombre: string;
  /** Alto del personaje en la grilla canónica (los datos se escriben a esta escala). */
  altoReferencia: number;
  /** Id de la pieza raíz de la jerarquía. */
  raiz: string;
  piezas: PiezaRig[];
}

/** Cambios que un personaje le hace a una pieza de la plantilla. */
export interface RasgoPieza {
  rol?: string;
  color?: string;
  textura?: string | null;
  visible?: boolean;
  grados?: number;
  desplazamiento?: Desplazamiento;
  escala?: Desplazamiento;
}

/** Un personaje: qué plantilla usa, con qué paleta y con qué rasgos propios. */
export interface PersonajeDatos {
  id: string;
  nombre: string;
  /** Id de la plantilla de rig. */
  plantilla: string;
  /** Id de la paleta de colores. */
  paleta: string;
  /** Id del catálogo de caras (ojos, cejas, boca) que usa. */
  cara?: string;
  /** Cambios por pieza, encima de la plantilla. */
  rasgos?: Record<string, RasgoPieza>;
  /** Ids de las animaciones que trae puestas (la primera es la de reposo). */
  animaciones?: string[];
}

export interface Paleta {
  id: string;
  nombre: string;
  colores: Record<string, string>;
}

export interface Pose {
  /** Giro de cada pieza, en GRADOS, sumado al giro de reposo. */
  grados?: Record<string, number>;
  /** Visibilidad de cada pieza. */
  visible?: Record<string, boolean>;
  /** Posición local de cada pieza, encima de la de la plantilla. */
  desplazamientos?: Record<string, Desplazamiento>;
  /** Estiramiento de cada pieza, encima del de la plantilla (acá se abre la boca). */
  escalas?: Record<string, Desplazamiento>;
}

export interface Fotograma {
  /** Momento del fotograma, en segundos desde el arranque de la animación. */
  en: number;
  pose: Pose;
}

export interface Animacion {
  id: string;
  nombre: string;
  /** Duración total, en segundos. */
  duracion: number;
  /** true = se repite sola (caminar); false = corre una vez (saltar, saludar). */
  bucle: boolean;
  fotogramas: Fotograma[];
}

/** Una forma de la boca del ventrílocuo (estilo South Park). */
export interface Visema {
  id: string;
  /** Id de textura de la boca. */
  boca: string;
  /** Cuánto se abre, de 0 a 1. Sirve para las bocas sin textura (un rectángulo). */
  apertura: number;
}

export interface TablaVisemas {
  id: string;
  /** La boca de reposo (silencio). */
  cerrada: string;
  visemas: Visema[];
  /** Qué visema le toca a cada letra. */
  letras: Record<string, string>;
}

/** El catálogo de caras: qué texturas hay para cada parte. */
export interface CatalogoCaras {
  id: string;
  nombre: string;
  ojos: string[];
  cejas: string[];
  narices: string[];
  bocas: string[];
  pelos: string[];
}

/** La forma de resultado que usan todos los validadores del proyecto. */
export interface ResultadoValidacion<T> {
  ok: boolean;
  valor?: T;
  errores: string[];
}

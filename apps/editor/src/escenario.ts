/**
 * El ESCENARIO del editor: las piezas y las zonas que el editor conoce, con su
 * id, su nombre, su posición y su tamaño.
 *
 * Va aparte del nivel (que sólo tiene mundo, reglas y misiones) porque así lo
 * pidió el juego: cuando lo lea, va a poder colocar las piezas en la pantalla
 * sin inventar nada. Dentro del archivo exportado viaja en una sección propia y
 * documentada, la clave `escenario`:
 *
 *   "escenario": {
 *     "version": 1,
 *     "nota": "…qué es esto…",
 *     "piezas": [ { "id", "nombre", "x", "y", "ancho", "alto" }, … ],
 *     "zonas":  [ { "id", "nombre", "x", "y", "ancho", "alto" }, … ]
 *   }
 *
 * HOY el juego todavía no lo lee: esta sección es de ANTICIPO, la integración va
 * en una tarjeta aparte. Igual el editor ya tiene que exportarla.
 *
 * Las posiciones salen del mismo reparto que usa la prueba en vivo
 * (`tablero.ts`), sobre una pantalla de referencia, para que sean deterministas:
 * exportar dos veces el mismo nivel da el mismo escenario.
 */
import type { NivelEnConstruccion } from './estado.ts';
import { repartirEnGrilla, repartirZonas } from './tablero.ts';

/** Una pieza ya colocada: es lo que el juego necesita para dibujarla. */
export interface PiezaEscenario {
  /** El id que usa la lógica (el mismo de las reglas). */
  id: string;
  /** Cómo se llama en pantalla. */
  nombre: string;
  /** Centro de la pieza, en píxeles. */
  x: number;
  y: number;
  /** Cuánto ocupa, en píxeles. */
  ancho: number;
  alto: number;
}

/** El escenario completo del editor. */
export interface EscenarioEditor {
  /** Para que el juego sepa qué forma tiene esta sección si mañana cambia. */
  version: number;
  /** Qué es esto, en castellano, para quien abra el archivo. */
  nota: string;
  /** Lo que se arrastra y se toca. */
  piezas: PiezaEscenario[];
  /** Los lugares a los que se llega. */
  zonas: PiezaEscenario[];
}

/** La versión del formato del escenario. */
export const VERSION_ESCENARIO = 1;

/** La nota que viaja en el archivo, para que se entienda la sección de un tirón. */
export const NOTA_ESCENARIO =
  'Piezas y zonas que conoce el editor (id, nombre, posición y tamaño). ' +
  'Se reparten igual que en el tablero de la prueba. El juego todavía no lee esta sección.';

/** La pantalla de referencia sobre la que se reparten las piezas al exportar. */
export const ANCHO_REFERENCIA = 1024;
export const ALTO_REFERENCIA = 768;

/** Convierte una ficha del tablero en una pieza del escenario, con números redondos. */
function pieza(
  id: string,
  nombre: string,
  ficha: { x: number; y: number; ancho: number; alto: number },
): PiezaEscenario {
  return {
    id,
    nombre,
    x: Math.round(ficha.x),
    y: Math.round(ficha.y),
    ancho: Math.round(ficha.ancho),
    alto: Math.round(ficha.alto),
  };
}

/**
 * El escenario del nivel: las entidades arriba en una grilla y las zonas abajo en
 * una franja, con las mismas cuentas que el tablero de la prueba. Es puro: sólo
 * números entrando y saliendo.
 */
export function escenarioDe(
  nivel: NivelEnConstruccion,
  ancho: number = ANCHO_REFERENCIA,
  alto: number = ALTO_REFERENCIA,
): EscenarioEditor {
  const fichas = repartirEnGrilla(
    nivel.entidades.map((cosa) => cosa.id),
    ancho,
    alto,
  );
  const fichasZonas = repartirZonas(
    nivel.zonas.map((cosa) => cosa.id),
    ancho,
    alto,
  );

  const piezas: PiezaEscenario[] = [];
  nivel.entidades.forEach((cosa, i) => {
    const ficha = fichas[i];
    if (ficha === undefined) return;
    piezas.push(pieza(cosa.id, cosa.nombre, ficha));
  });

  const zonas: PiezaEscenario[] = [];
  nivel.zonas.forEach((cosa, i) => {
    const ficha = fichasZonas[i];
    if (ficha === undefined) return;
    zonas.push(pieza(cosa.id, cosa.nombre, ficha));
  });

  return { version: VERSION_ESCENARIO, nota: NOTA_ESCENARIO, piezas, zonas };
}

/** ¿Esta forma es un escenario del editor? (para leer un archivo sin confiar en él). */
export function esEscenarioEditor(dato: unknown): dato is EscenarioEditor {
  if (typeof dato !== 'object' || dato === null) return false;
  const escenario = dato as Record<string, unknown>;
  return Array.isArray(escenario['piezas']) && Array.isArray(escenario['zonas']);
}

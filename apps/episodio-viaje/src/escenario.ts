/**
 * El escenario del episodio, en DATOS (todavía sin fotos reales).
 *
 * Son formas grandes con su nombre encima: la casa es una ZONA (una región con
 * nombre, `casa-de-la-tia`) y las piezas que se arrastran son las tres maletas.
 * Nada de esto dibuja: se arma una `Escena` de verdad (del motor, pura) y el
 * render de la app se encarga de pintarla.
 *
 * La colocación es una FUNCIÓN PURA del tamaño de la pantalla: entra el ancho y el
 * alto, sale dónde va cada pieza. Así se prueba sin navegador que en un celular
 * chico nada quede fuera de pantalla ni encima de otra cosa — que es justo lo que
 * rompe un juego para un niño que arrastra con el dedo.
 */
import { Escena } from '@juegosemi/motor';

/** El nombre de la zona de la casa, el mismo que usan las reglas del nivel. */
export const ZONA_CASA = 'casa-de-la-tia';

/** El gesto y el objetivo de la manivela (lo pide el nivel por datos). */
export const ID_AUTO = 'auto';
export const ID_CASA = 'casa';
export const ID_MANIVELA = 'manivela';
export const ID_ABUELO = 'abuelo';
/** Las maletas, en el orden en que se muestran. */
export const IDS_MALETAS: readonly string[] = ['maleta-1', 'maleta-2', 'maleta-3'];

const MARGEN = 12;

/** Una región con nombre (la casa): sirve para saber si alguien llegó. */
export interface Zona {
  nombre: string;
  /** Centro y tamaño, en el mismo sistema que la escena. */
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export type ClasePieza = 'maleta' | 'auto' | 'casa' | 'manivela' | 'abuelo';

/** Una pieza del escenario, ya colocada. */
export interface Colocacion {
  id: string;
  clase: ClasePieza;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  /** El texto grande que se dibuja encima (mientras no hay fotos). */
  etiqueta: string;
  color: number;
  visible: boolean;
  orden: number;
}

/** El reparto en pantalla, sin escena: puro y testeable. */
export interface DisenoEscenario {
  colocaciones: Colocacion[];
  zonaCasa: Zona;
  franjaAviso: number;
}

/** Los ids de las piezas que la app necesita nombrar. */
export interface Piezas {
  maletas: string[];
  auto: string;
  casa: string;
  manivela: string;
  abuelo: string;
}

/** El escenario armado: la escena viva, la zona y de dónde sale cada maleta. */
export interface Escenario {
  escena: Escena;
  piezas: Piezas;
  zonaCasa: Zona;
  franjaAviso: number;
  ancho: number;
  alto: number;
  /** Dónde volvía cada maleta si se soltó donde no iba (regla de oro). */
  origenes: Record<string, { x: number; y: number }>;
}

/** Encierra un valor entre un mínimo y un máximo. */
function acotar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
}

/**
 * Coloca las piezas según el tamaño de la pantalla.
 *
 * El auto y la casa comparten la fila del medio (el auto tiene que poder manejar
 * hasta la casa); las maletas van abajo, la manivela aparece arriba del auto y el
 * abuelo queda en el rincón de arriba a la izquierda.
 */
export function disenarEscenario(ancho: number, alto: number): DisenoEscenario {
  const franjaAviso = acotar(alto * 0.12, 56, 110);
  const util = Math.max(220, alto - franjaAviso - MARGEN);
  const yMedio = franjaAviso + util * 0.45;

  const tamCasa = Math.min(ancho * 0.34, util * 0.5);
  const altoCasa = tamCasa * 0.9;
  const tamAuto = Math.min(ancho * 0.26, util * 0.34);
  const altoAuto = tamAuto * 0.7;
  const tamMaleta = Math.min(ancho / 5.4, util * 0.2);
  const altoMaleta = tamMaleta * 0.85;
  const tamManivela = Math.min(ancho * 0.16, util * 0.16, tamAuto * 0.7);
  const tamAbuelo = Math.min(ancho * 0.14, util * 0.12, 90);

  const casaX = ancho - MARGEN - tamCasa / 2;
  const autoX = MARGEN + tamAuto / 2 + ancho * 0.02;
  const yMaletas = franjaAviso + util * 0.85;

  const colocaciones: Colocacion[] = [];

  // La casa: es la meta y la zona. Va bien grande, a la derecha.
  colocaciones.push({
    id: ID_CASA,
    clase: 'casa',
    x: casaX,
    y: yMedio,
    ancho: tamCasa,
    alto: altoCasa,
    etiqueta: 'Casa de la tía',
    color: 0xb5651d,
    visible: true,
    orden: 1,
  });

  // El auto: el único destino válido de las maletas.
  colocaciones.push({
    id: ID_AUTO,
    clase: 'auto',
    x: autoX,
    y: yMedio,
    ancho: tamAuto,
    alto: altoAuto,
    etiqueta: 'El auto',
    color: 0x3d5a80,
    visible: true,
    orden: 5,
  });

  // Las maletas: abajo, en fila y bien separadas.
  const paso = ancho / IDS_MALETAS.length;
  IDS_MALETAS.forEach((id, i) => {
    colocaciones.push({
      id,
      clase: 'maleta',
      x: paso * (i + 0.5),
      y: yMaletas,
      ancho: tamMaleta,
      alto: altoMaleta,
      etiqueta: `Maleta ${i + 1}`,
      color: 0xffc857,
      visible: true,
      orden: 10,
    });
  });

  // La manivela: nace ESCONDIDA; la muestra la lógica cuando ya están las maletas.
  const yManivela = Math.max(
    franjaAviso + tamAbuelo + 16,
    yMedio - altoAuto / 2 - tamManivela / 2 - 8,
  );
  colocaciones.push({
    id: ID_MANIVELA,
    clase: 'manivela',
    x: autoX,
    y: yManivela,
    ancho: tamManivela,
    alto: tamManivela,
    etiqueta: 'Manivela',
    color: 0x9aa5b1,
    visible: false,
    orden: 12,
  });

  // El abuelo: el que habla. Arriba a la izquierda, en la franja del aviso.
  colocaciones.push({
    id: ID_ABUELO,
    clase: 'abuelo',
    x: MARGEN + tamAbuelo / 2,
    y: franjaAviso + 8 + tamAbuelo / 2,
    ancho: tamAbuelo,
    alto: tamAbuelo,
    etiqueta: 'El abuelo',
    color: 0x7bbf7b,
    visible: true,
    orden: 8,
  });

  const zonaCasa: Zona = { nombre: ZONA_CASA, x: casaX, y: yMedio, ancho: tamCasa, alto: altoCasa };
  return { colocaciones, zonaCasa, franjaAviso };
}

/** Arma la escena viva a partir del reparto en pantalla. */
export function armarEscenario(ancho: number, alto: number): Escenario {
  const diseno = disenarEscenario(ancho, alto);
  const escena = new Escena();
  const origenes: Record<string, { x: number; y: number }> = {};

  for (const pieza of diseno.colocaciones) {
    escena.agregar({
      id: pieza.id,
      x: pieza.x,
      y: pieza.y,
      ancho: pieza.ancho,
      alto: pieza.alto,
      color: pieza.color,
      etiqueta: pieza.etiqueta,
      visible: pieza.visible,
      orden: pieza.orden,
      datos: { clase: pieza.clase },
    });
    origenes[pieza.id] = { x: pieza.x, y: pieza.y };
  }

  return {
    escena,
    piezas: {
      maletas: [...IDS_MALETAS],
      auto: ID_AUTO,
      casa: ID_CASA,
      manivela: ID_MANIVELA,
      abuelo: ID_ABUELO,
    },
    zonaCasa: diseno.zonaCasa,
    franjaAviso: diseno.franjaAviso,
    ancho,
    alto,
    origenes,
  };
}

/** ¿El centro del punto cayó dentro de la zona? (así se sabe que el auto llegó). */
export function centroEnZona(zona: Zona, punto: { x: number; y: number }): boolean {
  return (
    punto.x >= zona.x - zona.ancho / 2 &&
    punto.x <= zona.x + zona.ancho / 2 &&
    punto.y >= zona.y - zona.alto / 2 &&
    punto.y <= zona.y + zona.alto / 2
  );
}

/** ¿Se tocan dos rectángulos? (para auditar que el reparto no se pise). */
export function seSuperponen(
  a: { x: number; y: number; ancho: number; alto: number },
  b: { x: number; y: number; ancho: number; alto: number },
): boolean {
  const separadosX = Math.abs(a.x - b.x) >= (a.ancho + b.ancho) / 2;
  const separadosY = Math.abs(a.y - b.y) >= (a.alto + b.alto) / 2;
  return !separadosX && !separadosY;
}

import type { Familia } from '@juegosemi/contenido';

/**
 * El tablero del juego: dónde va cada persona y cada auto en la pantalla.
 *
 * Está aparte del dibujo a propósito: es una función pura (entra el tamaño de la
 * pantalla y el contenido, sale una lista de posiciones), así que se prueba sin
 * navegador y se puede auditar que en un celular chico nada quede fuera de
 * pantalla ni encima de otra pieza — que es exactamente lo que rompe un juego
 * para un niño que arrastra con el dedo.
 */

export interface Casilla {
  id: string;
  clase: 'persona' | 'auto';
  x: number;
  y: number;
  ancho: number;
  alto: number;
  /** Id del auto al que pertenece una persona (sólo en las personas). */
  auto?: string;
}

export interface Tablero {
  casillas: Casilla[];
  /** Alto reservado arriba para el aviso (frase del acierto). */
  franjaAviso: number;
  ancho: number;
  alto: number;
}

const MARGEN = 12;

/**
 * Calcula el tablero. En pantallas anchas (tablet, PC) las personas van en una
 * fila arriba y los autos en una fila abajo; en pantallas angostas (celular) se
 * parte en dos filas cada grupo, para que las piezas sigan siendo grandes.
 */
export function disenarTablero(familia: Familia, ancho: number, alto: number): Tablero {
  const franjaAviso = Math.min(120, Math.max(72, alto * 0.14));
  const columnas = ancho >= 620 ? Math.max(3, Math.min(6, familia.personas.length)) : 3;
  const filas = Math.ceil(familia.personas.length / columnas);

  const anchoUtil = ancho - MARGEN * 2;
  const celdaAncho = anchoUtil / columnas;

  const zonaPersonas = alto - franjaAviso - MARGEN * 2;
  const altoPorGrupo = zonaPersonas / 2 / filas;

  const tamanoPersona = Math.min(celdaAncho * 0.72, altoPorGrupo * 0.62, 150);
  const tamanoAuto = Math.min(celdaAncho * 0.86, altoPorGrupo * 0.7, 210);

  const casillas: Casilla[] = [];

  // Personas: arriba, en `filas` filas.
  familia.personas.forEach((persona, i) => {
    const columna = i % columnas;
    const fila = Math.floor(i / columnas);
    casillas.push({
      id: `persona:${persona.id}`,
      clase: 'persona',
      x: MARGEN + celdaAncho * (columna + 0.5),
      y: franjaAviso + MARGEN + altoPorGrupo * (fila + 0.5),
      ancho: tamanoPersona,
      alto: tamanoPersona,
      auto: persona.auto,
    });
  });

  // Autos: abajo, con el MISMO orden de columnas (así el juego no se resuelve
  // por posición: el niño tiene que mirar cuál es el auto de quién).
  const desplazamiento = familia.personas.length % columnas === 1 ? 0.5 : 0;
  familia.autos.forEach((auto, i) => {
    const columna = (i + desplazamiento) % columnas;
    const fila = Math.floor(i / columnas);
    casillas.push({
      id: `auto:${auto.id}`,
      clase: 'auto',
      x: MARGEN + celdaAncho * (columna + 0.5),
      y: franjaAviso + MARGEN + altoPorGrupo * filas + altoPorGrupo * (fila + 0.5),
      ancho: tamanoAuto,
      alto: tamanoAuto * 0.75,
    });
  });

  return { casillas, franjaAviso, ancho, alto };
}

/** Dónde vuelve una persona cuando se equivoca (su casilla original). */
export function casillaDeOrigen(tablero: Tablero, personaId: string): Casilla | null {
  return tablero.casillas.find((c) => c.id === `persona:${personaId}`) ?? null;
}

/**
 * El tablero de la PRUEBA: dónde queda cada cosa cuando se toca "Probar".
 *
 * Es una repartición pura (sólo números): entra el tamaño de la pantalla y la
 * lista de entidades, sale dónde va cada una. Las zonas van en una franja abajo,
 * anchas, como la casa a la que se llega.
 *
 * Se prueba sin navegador: lo que importa es que nada quede fuera de la pantalla
 * ni encima de otra cosa (eso es lo que rompe un juego que se arrastra con el dedo).
 */

/** Una pieza ya colocada en el tablero de la prueba. */
export interface Ficha {
  id: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/** Cuánto alto de la pantalla se lleva la zona de las entidades (el resto es la franja). */
const PROPORCION_ENTIDADES = 0.68;

/** El ancho máximo cómodo de una ficha, para que no se vea gigante en la tablet. */
const LADO_MAXIMO = 150;

/** Coloca las entidades en una grilla, en la parte de arriba de la pantalla. */
export function repartirEnGrilla(ids: readonly string[], ancho: number, alto: number): Ficha[] {
  const cantidad = ids.length;
  if (cantidad === 0) return [];
  const columnas = Math.max(1, Math.ceil(Math.sqrt(cantidad)));
  const filas = Math.max(1, Math.ceil(cantidad / columnas));
  const anchoUtil = Math.max(1, ancho);
  const altoUtil = Math.max(1, alto * PROPORCION_ENTIDADES);
  const anchoCelda = anchoUtil / columnas;
  const altoCelda = altoUtil / filas;
  const lado = Math.max(40, Math.min(LADO_MAXIMO, anchoCelda * 0.78, altoCelda * 0.78));

  const fichas: Ficha[] = [];
  ids.forEach((id, i) => {
    const columna = i % columnas;
    const fila = Math.floor(i / columnas);
    fichas.push({
      id,
      x: anchoCelda * (columna + 0.5),
      y: altoCelda * (fila + 0.5),
      ancho: lado,
      alto: lado,
    });
  });
  return fichas;
}

/** Coloca las zonas en una franja abajo, una al lado de la otra. */
export function repartirZonas(ids: readonly string[], ancho: number, alto: number): Ficha[] {
  const cantidad = ids.length;
  if (cantidad === 0) return [];
  const anchoUtil = Math.max(1, ancho);
  const altoReal = Math.max(1, alto);
  const altoFranja = Math.max(60, altoReal * (1 - PROPORCION_ENTIDADES) - 16);
  const anchoZona = (anchoUtil / cantidad) * 0.9;
  const y = altoReal - altoFranja / 2;
  const fichas: Ficha[] = [];
  ids.forEach((id, i) => {
    fichas.push({
      id,
      x: (anchoUtil / cantidad) * (i + 0.5),
      y,
      ancho: anchoZona,
      alto: altoFranja - 8,
    });
  });
  return fichas;
}

/** ¿Este punto cae dentro de la ficha? (para saber si soltó algo en una zona). */
export function dentroDe(ficha: Ficha, x: number, y: number): boolean {
  return (
    x >= ficha.x - ficha.ancho / 2 &&
    x <= ficha.x + ficha.ancho / 2 &&
    y >= ficha.y - ficha.alto / 2 &&
    y <= ficha.y + ficha.alto / 2
  );
}

/** La primera ficha que contiene el punto (null si ninguna). */
export function fichaEn(fichas: readonly Ficha[], x: number, y: number): Ficha | null {
  for (const ficha of fichas) {
    if (dentroDe(ficha, x, y)) return ficha;
  }
  return null;
}

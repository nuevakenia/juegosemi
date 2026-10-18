/**
 * @juegosemi/personajes — la cara estilo South Park.
 *
 * La cara no se dibuja: se ARMA eligiendo piezas de un catálogo (ojos, cejas,
 * nariz, boca, pelo) y traduciéndolas a rasgos del rig. Da igual si las
 * texturas todavía no existen: el personaje se ve igual, con rectángulos de
 * color, y cuando llegue el arte se ve mejor. Nada queda esperando al dibujante.
 */

import { colorANumero, numeroAColor, oscurecer } from './color.ts';
import type { CatalogoCaras, RasgoPieza } from './tipo.ts';

/** Los ids de las piezas de la cara en la plantilla. */
export interface PiezasDeCara {
  cara: string;
  pelo: string;
  ojoIzq: string;
  ojoDer: string;
  cejaIzq: string;
  cejaDer: string;
  nariz: string;
  boca: string;
}

export const PIEZAS_DE_CARA_POR_DEFECTO: PiezasDeCara = {
  cara: 'cara',
  pelo: 'pelo',
  ojoIzq: 'ojo-izq',
  ojoDer: 'ojo-der',
  cejaIzq: 'ceja-izq',
  cejaDer: 'ceja-der',
  nariz: 'nariz',
  boca: 'boca',
};

export interface OpcionesCara {
  /** Id de textura de ojos (se usa para los dos ojos). */
  ojos?: string;
  cejas?: string;
  nariz?: string;
  pelo?: string;
  /** Si el pelo es largo, se estira hacia abajo para tapar las orejas. */
  peloLargo?: boolean;
  /** Color de piel literal; si no viene, manda el rol "piel" de la paleta. */
  colorPiel?: string;
  /** Color de pelo literal. */
  colorPelo?: string;
  /** True para que la cara se vea más oscura (contraluz, sombra de la capucha). */
  sombra?: boolean;
  piezas?: Partial<PiezasDeCara>;
}

/**
 * Elige una textura del catálogo. `pedido` puede ser un id exacto o un número
 * (el "índice de la cara", como en los Miis). Null = no hay nada que elegir.
 */
export function elegirDeCatalogo(lista: readonly string[], pedido: string | undefined, indice = 0): string | null {
  if (lista.length === 0) return null;
  if (pedido !== undefined) {
    if (lista.includes(pedido)) return pedido;
    const numero = Number(pedido);
    if (Number.isInteger(numero) && numero >= 0 && numero < lista.length) {
      return lista[numero] ?? null;
    }
  }
  return lista[indice % lista.length] ?? null;
}

function conPieza(base: PiezasDeCara, cambios: Partial<PiezasDeCara> | undefined): PiezasDeCara {
  if (!cambios) return base;
  return {
    cara: cambios.cara ?? base.cara,
    pelo: cambios.pelo ?? base.pelo,
    ojoIzq: cambios.ojoIzq ?? base.ojoIzq,
    ojoDer: cambios.ojoDer ?? base.ojoDer,
    cejaIzq: cambios.cejaIzq ?? base.cejaIzq,
    cejaDer: cambios.cejaDer ?? base.cejaDer,
    nariz: cambios.nariz ?? base.nariz,
    boca: cambios.boca ?? base.boca,
  };
}

/**
 * Traduce una elección de cara a RASGOS del rig, listos para pasarle a `armar`.
 * El pelo largo se resuelve estirando la pieza de pelo y bajándola un poco: no
 * hace falta una textura nueva para cada peinado.
 */
export function rasgosDeCara(catalogo: CatalogoCaras, opciones: OpcionesCara = {}): Record<string, RasgoPieza> {
  const piezas = conPieza(PIEZAS_DE_CARA_POR_DEFECTO, opciones.piezas);
  const rasgos: Record<string, RasgoPieza> = {};

  const ojos = elegirDeCatalogo(catalogo.ojos, opciones.ojos);
  if (ojos) {
    rasgos[piezas.ojoIzq] = { textura: ojos };
    rasgos[piezas.ojoDer] = { textura: ojos };
  }

  const cejas = elegirDeCatalogo(catalogo.cejas, opciones.cejas);
  if (cejas) {
    rasgos[piezas.cejaIzq] = { textura: cejas };
    rasgos[piezas.cejaDer] = { textura: cejas };
  }

  const nariz = elegirDeCatalogo(catalogo.narices, opciones.nariz);
  if (nariz) rasgos[piezas.nariz] = { textura: nariz };

  const pelo = elegirDeCatalogo(catalogo.pelos, opciones.pelo);
  const rasgoPelo: RasgoPieza = {};
  if (pelo) rasgoPelo.textura = pelo;
  if (opciones.colorPelo) rasgoPelo.color = opciones.colorPelo;
  if (opciones.peloLargo) {
    rasgoPelo.escala = { x: 1, y: 1.6 };
    rasgoPelo.desplazamiento = { x: -3, y: 14 };
  }
  if (Object.keys(rasgoPelo).length > 0) rasgos[piezas.pelo] = rasgoPelo;

  if (opciones.colorPiel) {
    rasgos[piezas.cara] = { color: opciones.colorPiel };
    rasgos[piezas.nariz] = { ...(rasgos[piezas.nariz] ?? {}), color: opciones.colorPiel };
  }

  if (opciones.sombra && opciones.colorPiel) {
    const piel = colorANumero(opciones.colorPiel);
    if (piel !== null) rasgos[piezas.cara] = { color: numeroAColor(oscurecer(piel, 0.18)) };
  }

  return rasgos;
}

/** ¿El catálogo tiene esta pieza? Sirve para no elegir algo que no existe. */
export function tieneTextura(catalogo: CatalogoCaras, parte: keyof Omit<CatalogoCaras, 'id' | 'nombre'>, textura: string): boolean {
  return catalogo[parte].includes(textura);
}

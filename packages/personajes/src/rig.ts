/**
 * @juegosemi/personajes — el armador del rig.
 *
 * Toma una PLANTILLA (la jerarquía de piezas), una PALETA (los colores) y los
 * RASGOS de un personaje, y devuelve las piezas ya resueltas: cada una con su
 * rectángulo, su giro, su color y su matriz de mundo. Con una POSE encima, la
 * misma pieza sale girada, y como cada hija cuelga de la matriz del padre, el
 * brazo entero se mueve cuando gira el hombro.
 *
 * Este módulo NO sabe de PixiJS ni del DOM: devuelve datos, y el adaptador de
 * render (packages/render-pixi) los pinta.
 */

import type { DibujoEntidad } from '@juegosemi/puertos';
import { colorANumero, contornoDe } from './color.ts';
import {
  aRadianes,
  aplicar,
  escalar,
  identidad,
  largoX,
  largoY,
  multiplicar,
  rotacion,
  rotar,
  trasladar,
  type Matriz,
} from './matriz.ts';
import type { Paleta, PersonajeDatos, PiezaRig, PlantillaRig, Pose, RasgoPieza } from './tipo.ts';

export interface PiezaResuelta {
  id: string;
  padre: string | null;
  /** Centro del rectángulo, en la grilla canónica de la plantilla. */
  x: number;
  y: number;
  /** Giro en radianes. */
  rot: number;
  escalaX: number;
  /** Negativo = la pieza va espejada (el lado derecho del cuerpo). */
  escalaY: number;
  ancho: number;
  alto: number;
  color: number | null;
  textura: string | null;
  orden: number;
  visible: boolean;
  /** Sistema local de la pieza → sistema del personaje. */
  matriz: Matriz;
}

export interface OpcionesRig {
  paleta: Paleta;
  /** Cambios por pieza, encima de la plantilla. */
  rasgos?: Record<string, RasgoPieza>;
  /** Dibuja un contorno oscuro detrás de cada pieza de color (estilo South Park). */
  contorno?: boolean;
  /** Prefijo de los ids de los dibujos (normalmente el id del personaje). */
  idBase?: string;
}

export interface OpcionesDibujo {
  pose?: Pose;
  /** Zoom: 1 = grilla canónica de la plantilla. */
  escala?: number;
  /** Dónde va el origen del personaje, en píxeles de destino. */
  x?: number;
  y?: number;
  alfa?: number;
  /** Textura forzada por pieza (por acá entra el visema de la boca). */
  texturas?: Record<string, string | null>;
}

/** Las claves de dibujo de una pieza, ya con los rasgos y la pose aplicados. */
interface AtributosPieza {
  pivote: { x: number; y: number };
  desplazamiento: { x: number; y: number };
  grados: number;
  escala: { x: number; y: number } | null;
  color: number | null;
  textura: string | null;
  visible: boolean;
  orden: number;
}

function colorDePieza(pieza: PiezaRig, rasgo: RasgoPieza | undefined, paleta: Paleta): number | null {
  if (rasgo && rasgo.color) {
    const directo = colorANumero(rasgo.color);
    if (directo !== null) return directo;
  }
  const rol = rasgo && rasgo.rol ? rasgo.rol : pieza.rol;
  if (rol) {
    const hex = paleta.colores[rol];
    if (hex) {
      const porRol = colorANumero(hex);
      if (porRol !== null) return porRol;
    }
  }
  if (pieza.color) {
    const literal = colorANumero(pieza.color);
    if (literal !== null) return literal;
  }
  return null;
}

/**
 * El rig armado de un personaje. Se construye una vez (es la parte "cara") y
 * después se le pide una pose u otra en cada paso del ticker (la parte "barata").
 */
export class Rig {
  readonly plantilla: PlantillaRig;
  readonly paleta: Paleta;
  readonly idBase: string;
  /** Las piezas en orden jerárquico: SIEMPRE el padre antes que sus hijas. */
  private readonly jerarquico: PiezaRig[];
  private readonly porId: Map<string, PiezaRig>;
  private readonly rasgos: Record<string, RasgoPieza>;
  private readonly ordendesDeDibujo: Map<string, number>;
  private readonly contorno: boolean;

  constructor(plantilla: PlantillaRig, opciones: OpcionesRig) {
    this.plantilla = plantilla;
    this.paleta = opciones.paleta;
    this.rasgos = opciones.rasgos ?? {};
    this.contorno = opciones.contorno ?? false;
    this.idBase = opciones.idBase ?? plantilla.id;
    this.porId = new Map(plantilla.piezas.map((p) => [p.id, p]));
    this.jerarquico = this.ordenarJerarquico();
    this.ordendesDeDibujo = new Map();
    this.jerarquico.forEach((pieza, i) => {
      this.ordendesDeDibujo.set(pieza.id, pieza.orden === undefined ? i : pieza.orden);
    });
  }

  /** Recorrido en profundidad desde la raíz: los padres quedan antes que las hijas. */
  private ordenarJerarquico(): PiezaRig[] {
    const salida: PiezaRig[] = [];
    const visitadas = new Set<string>();
    const visita = (id: string): void => {
      if (visitadas.has(id)) return;
      const pieza = this.porId.get(id);
      if (!pieza) return;
      visitadas.add(id);
      salida.push(pieza);
      for (const otra of this.plantilla.piezas) {
        if (otra.padre === id) visita(otra.id);
      }
    };
    visita(this.plantilla.raiz);
    // Si la plantilla trae piezas sueltas (no debería: el validador lo caza),
    // se agregan al final para no perderlas nunca.
    for (const pieza of this.plantilla.piezas) {
      if (!visitadas.has(pieza.id)) salida.push(pieza);
    }
    return salida;
  }

  /** Los ids de todas las piezas, en orden jerárquico. */
  ids(): string[] {
    return this.jerarquico.map((p) => p.id);
  }

  /** ¿Existe esta pieza en el rig? */
  tiene(id: string): boolean {
    return this.porId.has(id);
  }

  /** Alto total del personaje en la grilla canónica. */
  alto(): number {
    return this.plantilla.altoReferencia;
  }

  private atributos(pieza: PiezaRig, pose: Pose | undefined): AtributosPieza {
    const rasgo = this.rasgos[pieza.id];
    const pivote = pieza.pivote ?? { x: pieza.tamano.ancho / 2, y: pieza.tamano.alto / 2 };

    const desplazamientoDePose = pose && pose.desplazamientos ? pose.desplazamientos[pieza.id] : undefined;
    const desplazamiento = desplazamientoDePose
      ? desplazamientoDePose
      : rasgo && rasgo.desplazamiento
        ? rasgo.desplazamiento
        : pieza.desplazamiento;

    const giroDePose = pose && pose.grados ? pose.grados[pieza.id] : undefined;
    const grados = (pieza.grados ?? 0) + (rasgo && rasgo.grados !== undefined ? rasgo.grados : 0) + (giroDePose !== undefined ? giroDePose : 0);

    const escalaDePose = pose && pose.escalas ? pose.escalas[pieza.id] : undefined;
    const escalaBase = rasgo && rasgo.escala ? rasgo.escala : pieza.escala ?? null;
    // El multiplicador de la pose se aplica ENCIMA del de la plantilla: así la
    // boca del ventrílocuo se abre y se cierra sin dejar de estar espejada.
    let escala: { x: number; y: number } | null = escalaBase ? { x: escalaBase.x, y: escalaBase.y } : null;
    if (escalaDePose) {
      escala = escala
        ? { x: escala.x * escalaDePose.x, y: escala.y * escalaDePose.y }
        : { x: escalaDePose.x, y: escalaDePose.y };
    }

    const visibleDePose = pose && pose.visible ? pose.visible[pieza.id] : undefined;
    const visible =
      visibleDePose !== undefined ? visibleDePose : rasgo && rasgo.visible !== undefined ? rasgo.visible : pieza.visible !== false;

    const textura = rasgo && rasgo.textura !== undefined ? rasgo.textura : pieza.textura ?? null;

    return {
      pivote,
      desplazamiento: { x: desplazamiento.x, y: desplazamiento.y },
      grados,
      escala: escala ? { x: escala.x, y: escala.y } : null,
      color: colorDePieza(pieza, rasgo, this.paleta),
      textura,
      visible,
      orden: this.ordendesDeDibujo.get(pieza.id) ?? 0,
    };
  }

  /**
   * Resuelve todas las piezas con una pose (opcional). Devuelve una lista nueva
   * en orden de dibujo: de atrás hacia adelante.
   */
  conPose(pose?: Pose): PiezaResuelta[] {
    const matrices = new Map<string, Matriz>();
    const salida: PiezaResuelta[] = [];

    for (const pieza of this.jerarquico) {
      const attrs = this.atributos(pieza, pose);
      const padreId = pieza.padre ?? null;
      const matrizPadre = padreId ? matrices.get(padreId) ?? identidad() : identidad();

      // local = trasladar(desplazamiento) · trasladar(pivote) · rotar(grados) · escalar · trasladar(-pivote)
      // O sea: la pieza gira y se espeja SOBRE SU PIVOTE, no sobre la esquina.
      let matriz = multiplicar(matrizPadre, trasladar(attrs.desplazamiento.x, attrs.desplazamiento.y));
      matriz = multiplicar(matriz, trasladar(attrs.pivote.x, attrs.pivote.y));
      matriz = multiplicar(matriz, rotar(aRadianes(attrs.grados)));
      if (attrs.escala) matriz = multiplicar(matriz, escalar(attrs.escala.x, attrs.escala.y));
      matriz = multiplicar(matriz, trasladar(-attrs.pivote.x, -attrs.pivote.y));

      matrices.set(pieza.id, matriz);

      const centro = aplicar(matriz, pieza.tamano.ancho / 2, pieza.tamano.alto / 2);
      salida.push({
        id: pieza.id,
        padre: padreId,
        x: centro.x,
        y: centro.y,
        rot: rotacion(matriz),
        escalaX: largoX(matriz),
        escalaY: largoY(matriz),
        ancho: pieza.tamano.ancho,
        alto: pieza.tamano.alto,
        color: attrs.color,
        textura: attrs.textura,
        orden: attrs.orden,
        visible: attrs.visible,
        matriz,
      });
    }

    salida.sort((a, b) => a.orden - b.orden);
    return salida;
  }

  /** Una sola pieza ya resuelta (null si no existe en el rig). */
  obtener(id: string, pose?: Pose): PiezaResuelta | null {
    if (!this.porId.has(id)) return null;
    const piezas = this.conPose(pose);
    for (const pieza of piezas) if (pieza.id === id) return pieza;
    return null;
  }

  /**
   * Los dibujos listos para el adaptador de render. Las piezas sin textura
   * salen como rectángulo de color (así el personaje existe ANTES de que haya
   * arte), y con `contorno` se agrega el borde oscuro del estilo South Park.
   */
  dibujos(opciones: OpcionesDibujo = {}): DibujoEntidad[] {
    const piezas = this.conPose(opciones.pose);
    const zoom = opciones.escala === undefined ? 1 : opciones.escala;
    const dx = opciones.x === undefined ? 0 : opciones.x;
    const dy = opciones.y === undefined ? 0 : opciones.y;
    const alfa = opciones.alfa === undefined ? 1 : opciones.alfa;
    const texturas = opciones.texturas;

    const salida: DibujoEntidad[] = [];
    for (const pieza of piezas) {
      if (!pieza.visible) continue;
      let textura = pieza.textura;
      if (texturas && Object.prototype.hasOwnProperty.call(texturas, pieza.id)) {
        textura = texturas[pieza.id] ?? null;
      }

      if (this.contorno && pieza.color !== null && textura === null) {
        salida.push({
          id: `${this.idBase}:${pieza.id}:contorno`,
          x: dx + pieza.x * zoom,
          y: dy + pieza.y * zoom,
          rot: pieza.rot,
          escalaX: (pieza.escalaX * zoom * (pieza.ancho + 4)) / pieza.ancho,
          escalaY: (pieza.escalaY * zoom * (pieza.alto + 4)) / pieza.alto,
          ancho: pieza.ancho,
          alto: pieza.alto,
          textura: null,
          orden: pieza.orden - 0.5,
          visible: true,
          alfa,
          color: contornoDe(pieza.color),
        });
      }

      salida.push({
        id: `${this.idBase}:${pieza.id}`,
        x: dx + pieza.x * zoom,
        y: dy + pieza.y * zoom,
        rot: pieza.rot,
        escalaX: pieza.escalaX * zoom,
        escalaY: pieza.escalaY * zoom,
        ancho: pieza.ancho,
        alto: pieza.alto,
        textura,
        orden: pieza.orden,
        visible: true,
        alfa,
        color: pieza.color,
      });
    }

    salida.sort((a, b) => a.orden - b.orden);
    return salida;
  }
}

/**
 * Arma el rig de un personaje: su plantilla, su paleta y sus rasgos.
 * `personaje` es opcional porque también se arma un rig "pelado" (para el taller
 * de personajes, cuando todavía no hay personaje elegido).
 */
export function armar(
  plantilla: PlantillaRig,
  paleta: Paleta,
  personaje?: PersonajeDatos | null,
  opciones: { contorno?: boolean; idBase?: string } = {},
): Rig {
  const config: OpcionesRig = { paleta };
  if (personaje && personaje.rasgos) config.rasgos = personaje.rasgos;
  if (opciones.contorno !== undefined) config.contorno = opciones.contorno;
  config.idBase = opciones.idBase ?? (personaje ? personaje.id : plantilla.id);
  return new Rig(plantilla, config);
}

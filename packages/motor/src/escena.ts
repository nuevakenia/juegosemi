import type { DibujoEntidad } from '@juegosemi/puertos';

/**
 * Una entidad de la escena. Es puro estado: el motor lo actualiza y el
 * adaptador de render lo pinta. `textura` es un id lógico (nunca una ruta de
 * archivo): el adaptador decide cómo resolverlo.
 */
export interface Entidad {
  id: string;
  x: number;
  y: number;
  /** Rotación en radianes. */
  rot: number;
  escalaX: number;
  escalaY: number;
  ancho: number;
  alto: number;
  textura: string | null;
  orden: number;
  visible: boolean;
  alfa: number;
  color: number | null;
  /** Texto dibujado encima de la pieza (el nombre). */
  etiqueta: string | null;
  /** Datos libres del juego (a qué auto pertenece, si ya se acertó, etc.). */
  datos: Record<string, unknown>;
}

export interface EntidadParcial {
  id: string;
  x?: number;
  y?: number;
  rot?: number;
  escalaX?: number;
  escalaY?: number;
  ancho?: number;
  alto?: number;
  textura?: string | null;
  orden?: number;
  visible?: boolean;
  alfa?: number;
  color?: number | null;
  etiqueta?: string | null;
  datos?: Record<string, unknown>;
}

/**
 * La escena: un conjunto de entidades con orden de dibujo. Sin dependencias.
 * El hit test trabaja sobre el rectángulo centrado en (x, y): es una
 * aproximación suficiente para el tipo de juegos de este proyecto (tocar y
 * arrastrar cosas grandes).
 */
export class Escena {
  private readonly entidades = new Map<string, Entidad>();
  private contadorOrden = 0;

  agregar(parcial: EntidadParcial): Entidad {
    const entidad: Entidad = {
      id: parcial.id,
      x: parcial.x ?? 0,
      y: parcial.y ?? 0,
      rot: parcial.rot ?? 0,
      escalaX: parcial.escalaX ?? 1,
      escalaY: parcial.escalaY ?? 1,
      ancho: parcial.ancho ?? 100,
      alto: parcial.alto ?? 100,
      textura: parcial.textura ?? null,
      orden: parcial.orden ?? this.contadorOrden++,
      visible: parcial.visible ?? true,
      alfa: parcial.alfa ?? 1,
      color: parcial.color ?? null,
      etiqueta: parcial.etiqueta ?? null,
      datos: parcial.datos ?? {},
    };
    this.entidades.set(entidad.id, entidad);
    return entidad;
  }

  quitar(id: string): boolean {
    return this.entidades.delete(id);
  }

  obtener(id: string): Entidad | null {
    return this.entidades.get(id) ?? null;
  }

  /** Todas las entidades, ordenadas por `orden` (dibujo de atrás hacia adelante). */
  todas(): Entidad[] {
    return [...this.entidades.values()].sort((a, b) => a.orden - b.orden);
  }

  cantidad(): number {
    return this.entidades.size;
  }

  limpiar(): void {
    this.entidades.clear();
    this.contadorOrden = 0;
  }

  /**
   * La entidad más adelante (mayor `orden`) cuyo rectángulo contiene el punto.
   * Devuelve null si no hay ninguna (o si está oculta). `opciones.excluir` sirve
   * para el arrastre (al soltar una pieza encima de otra, no queremos que se
   * devuelva a sí misma) y `opciones.filtro` para aceptar sólo algunos destinos.
   */
  en(
    x: number,
    y: number,
    opciones: { excluir?: string; filtro?: (entidad: Entidad) => boolean } = {},
  ): Entidad | null {
    const candidatas = this.todas().reverse();
    for (const e of candidatas) {
      if (!e.visible || e.alfa <= 0.01) continue;
      if (opciones.excluir !== undefined && e.id === opciones.excluir) continue;
      if (opciones.filtro && !opciones.filtro(e)) continue;
      const ancho = e.ancho * Math.abs(e.escalaX);
      const alto = e.alto * Math.abs(e.escalaY);
      if (x >= e.x - ancho / 2 && x <= e.x + ancho / 2 && y >= e.y - alto / 2 && y <= e.y + alto / 2) {
        return e;
      }
    }
    return null;
  }

  /** La vista mínima que necesita el adaptador de render. */
  dibujos(): DibujoEntidad[] {
    return this.todas().map((e) => ({
      id: e.id,
      x: e.x,
      y: e.y,
      rot: e.rot,
      escalaX: e.escalaX,
      escalaY: e.escalaY,
      ancho: e.ancho,
      alto: e.alto,
      textura: e.textura,
      orden: e.orden,
      visible: e.visible,
      alfa: e.alfa,
      color: e.color,
      etiqueta: e.etiqueta,
    }));
  }
}

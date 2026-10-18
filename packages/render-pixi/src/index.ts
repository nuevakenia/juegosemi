import {
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  Texture,
  Assets,
} from 'pixi.js';
import type { AdaptadorRender, DibujoEntidad } from '@juegosemi/puertos';

/**
 * Adaptador de render 2D sobre PixiJS 8.
 *
 * Es el ÚNICO lugar del proyecto que conoce PixiJS. El motor le entrega una
 * lista de dibujos (`DibujoEntidad`) y acá se convierten en sprites/figuras.
 *
 * Decisiones que importan para las tablets modestas:
 *  - `antialias: false` y `resolucion` acotada: la GPU de un WebView viejo lo
 *    agradece;
 *  - una entidad sin textura se dibuja con `Graphics` (así se puede jugar sin
 *    ningún asset: útil para probar el juego antes de tener las fotos);
 *  - las texturas se resuelven por id lógico, no por ruta.
 */

export interface RenderPixi extends AdaptadorRender {
  /** Registra una textura con un id lógico. */
  registrarTextura(id: string, url: string): Promise<void>;
  /** Cuántos objetos hay en pantalla ahora (para diagnósticos y tests). */
  cantidadDibujada(): number;
  /** Fuerza un cuadro (útil para las capturas de prueba). */
  pintar(): void;
}

interface Nodo {
  contenedor: Container;
  sprite: Sprite | null;
  figura: Graphics | null;
  texto: Text | null;
  claveTextura: string | null;
  claveEtiqueta: string | null;
  color: number | null;
  ancho: number;
  alto: number;
}

export async function crearRenderPixi(
  contenedor: HTMLElement,
  opciones: { ancho?: number; alto?: number; fondo?: number; resolucion?: number } = {},
): Promise<RenderPixi> {
  const ancho = opciones.ancho ?? contenedor.clientWidth ?? 800;
  const alto = opciones.alto ?? contenedor.clientHeight ?? 600;

  const app = new Application();
  await app.init({
    width: ancho,
    height: alto,
    background: opciones.fondo ?? 0x0d1117,
    antialias: false,
    resolution: opciones.resolucion ?? 1,
    autoDensity: false,
  });
  contenedor.appendChild(app.canvas);

  const raiz = new Container();
  app.stage.addChild(raiz);
  const nodos = new Map<string, Nodo>();
  const texturas = new Map<string, Texture>();

  function crearNodo(dibujo: DibujoEntidad): Nodo {
    const contenedorNuevo = new Container();
    contenedorNuevo.label = dibujo.id;
    const nodo: Nodo = {
      contenedor: contenedorNuevo,
      sprite: null,
      figura: null,
      texto: null,
      claveTextura: null,
      claveEtiqueta: null,
      color: null,
      ancho: dibujo.ancho,
      alto: dibujo.alto,
    };
    raiz.addChild(contenedorNuevo);
    return nodo;
  }

  /** Dibuja el nombre encima de la pieza (imprescindible mientras no hay fotos). */
  function aplicarEtiqueta(nodo: Nodo, dibujo: DibujoEntidad): void {
    const etiqueta: string | null = dibujo.etiqueta ?? null;
    const clave = etiqueta === null ? null : `${etiqueta}|${Math.round(dibujo.ancho)}`;
    if (clave === nodo.claveEtiqueta) return;
    if (nodo.texto) {
      nodo.texto.destroy();
      nodo.texto = null;
    }
    if (etiqueta !== null) {
      const tamano = Math.max(11, Math.min(26, Math.round(dibujo.ancho / 7)));
      // contraste: texto oscuro sobre piezas claras, blanco sobre las oscuras
      const base = dibujo.color ?? 0xdddddd;
      const r = (base >> 16) & 0xff;
      const g = (base >> 8) & 0xff;
      const b = base & 0xff;
      const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const texto = new Text();
      texto.text = etiqueta;
      texto.style = {
        fontFamily: 'system-ui, sans-serif',
        fontSize: tamano,
        fontWeight: '700',
        fill: luminancia > 0.55 ? 0x0b1220 : 0xffffff,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: Math.max(60, dibujo.ancho - 12),
      };
      texto.anchor.set(0.5);
      texto.y = dibujo.alto / 2 - tamano;
      nodo.contenedor.addChild(texto);
      nodo.texto = texto;
    }
    nodo.claveEtiqueta = clave;
  }

  function aplicarTextura(nodo: Nodo, dibujo: DibujoEntidad): void {
    const textura = dibujo.textura ? texturas.get(dibujo.textura) ?? null : null;
    const clave = textura ? dibujo.textura : null;
    if (clave !== nodo.claveTextura) {
      // se reconstruye el dibujo interno de este nodo
      if (nodo.sprite) {
        nodo.sprite.destroy();
        nodo.sprite = null;
      }
      if (nodo.figura) {
        nodo.figura.destroy();
        nodo.figura = null;
      }
      if (textura) {
        const sprite = new Sprite(textura);
        sprite.anchor.set(0.5);
        nodo.contenedor.addChild(sprite);
        nodo.sprite = sprite;
      }
      nodo.claveTextura = clave;
    }
    if (nodo.sprite && textura) {
      nodo.sprite.width = dibujo.ancho;
      nodo.sprite.height = dibujo.alto;
    } else if (!nodo.sprite) {
      const color = dibujo.color ?? 0x8899aa;
      if (!nodo.figura || nodo.color !== color || nodo.ancho !== dibujo.ancho || nodo.alto !== dibujo.alto) {
        if (nodo.figura) nodo.figura.destroy();
        const figura = new Graphics();
        figura.roundRect(-dibujo.ancho / 2, -dibujo.alto / 2, dibujo.ancho, dibujo.alto, Math.min(24, dibujo.ancho / 6));
        figura.fill(color);
        nodo.contenedor.addChild(figura);
        nodo.figura = figura;
        nodo.color = color;
        nodo.ancho = dibujo.ancho;
        nodo.alto = dibujo.alto;
      }
    }
  }

  const adaptador: RenderPixi = {
    sincronizar(dibujos: readonly DibujoEntidad[]): void {
      const vistos = new Set<string>();
      for (const dibujo of dibujos) {
        vistos.add(dibujo.id);
        let nodo = nodos.get(dibujo.id);
        if (!nodo) {
          nodo = crearNodo(dibujo);
          nodos.set(dibujo.id, nodo);
        }
        aplicarTextura(nodo, dibujo);
        aplicarEtiqueta(nodo, dibujo);
        nodo.contenedor.position.set(dibujo.x, dibujo.y);
        nodo.contenedor.rotation = dibujo.rot;
        nodo.contenedor.scale.set(dibujo.escalaX, dibujo.escalaY);
        nodo.contenedor.alpha = dibujo.alfa;
        nodo.contenedor.visible = dibujo.visible;
        nodo.contenedor.zIndex = dibujo.orden;
      }
      // los que ya no están, se retiran
      for (const [id, nodo] of nodos) {
        if (!vistos.has(id)) {
          nodo.contenedor.destroy({ children: true });
          nodos.delete(id);
        }
      }
    },
    async registrarTextura(id: string, url: string): Promise<void> {
      const textura = (await Assets.load(url)) as Texture;
      texturas.set(id, textura);
    },
    cantidadDibujada(): number {
      return nodos.size;
    },
    pintar(): void {
      app.render();
    },
    tamano(): { ancho: number; alto: number } {
      return { ancho, alto };
    },
    destruir(): void {
      nodos.clear();
      texturas.clear();
      app.destroy(true, { children: true });
    },
  };
  return adaptador;
}

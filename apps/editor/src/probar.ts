/**
 * El botón PROBAR: correr el nivel armado sin salir del editor.
 *
 * Junta las mismas piezas que el episodio de verdad (`apps/episodio-viaje`):
 *
 *   el PUENTE     engancha la lógica del nivel con lo que pasa en la pantalla,
 *   la ESCENA     el motor con las entidades y las zonas repartidas por el tablero,
 *   el ARRASTRE   tocar y mover una cosa y soltarla sobre otra,
 *   el RENDER     Pixi, con la etiqueta encima de cada pieza (todavía no hay fotos),
 *   el JUEGO      el ticker que hace andar todo.
 *
 * No hay una sola regla en código: lo que corre es EXACTAMENTE el nivel que se armó
 * tocando botones. Al terminar (o al tocar "Volver al editor") se apaga el tablero.
 */
import type { AvisosDelJuego, Nivel } from '@juegosemi/logica';
import { Puente } from '@juegosemi/logica';
import type { Entidad, Escena } from '@juegosemi/motor';
import { Escena as EscenaMotor, Juego } from '@juegosemi/motor';
import type { PuertoPantalla } from '@juegosemi/puertos';
import { crearEntradaTactil, crearReloj } from '@juegosemi/adaptadores-web';
import type { RenderPixi } from '@juegosemi/render-pixi';
import { crearRenderPixi } from '@juegosemi/render-pixi';
import { crearBoton, crearElemento } from '@juegosemi/ui';
import type { CosaEditor } from './estado.ts';
import { dentroDe, repartirEnGrilla, repartirZonas, type Ficha } from './tablero.ts';

/** Los colores de las piezas, para que se distingan de un vistazo. */
const COLORES: readonly number[] = [0x3d5a80, 0xffc857, 0x7bbf7b, 0xb5651d, 0x9aa5b1, 0xc86b6b, 0x6bbfc8, 0xb08bd0];

/** El fondo del tablero (gris azulado oscuro, como el episodio). */
const FONDO = 0x101820;

export interface OpcionesPrueba {
  /** El nivel ya traducido a la forma de la lógica (lo que valida y corre el puente). */
  nivel: Nivel;
  /** Las entidades del juego (lo que se toca y se arrastra). */
  entidades: readonly CosaEditor[];
  /** Las zonas del juego (los lugares a los que se llega). */
  zonas: readonly CosaEditor[];
  /** Se tocó "Volver al editor". */
  alVolver: () => void;
}

export interface Prueba {
  /** El tablero para meter en la página. */
  elemento: HTMLElement;
  /** Arma el tablero y arranca el juego. */
  iniciar(): Promise<void>;
  /** Apaga el juego y suelta el render. */
  detener(): void;
  /** Para la consola de QA: el puente en vivo (null si no está andando). */
  puente(): Puente | null;
}

/** La escena viva de la prueba, con sus zonas. */
export interface EscenaDePrueba {
  escena: Escena;
  zonas: Ficha[];
  entidades: Ficha[];
}

/**
 * Arma la escena del tablero: una ficha por entidad, arriba, y una banda por zona,
 * abajo. Es puro hasta que se le pasa la `Escena` del motor.
 */
export function armarEscenaDePrueba(
  entidades: readonly CosaEditor[],
  zonas: readonly CosaEditor[],
  ancho: number,
  alto: number,
  escena: Escena = new EscenaMotor(),
): EscenaDePrueba {
  const fichasEntidades = repartirEnGrilla(
    entidades.map((cosa) => cosa.id),
    ancho,
    alto,
  );
  const fichasZonas = repartirZonas(
    zonas.map((cosa) => cosa.id),
    ancho,
    alto,
  );

  entidades.forEach((cosa, i) => {
    const ficha = fichasEntidades[i];
    if (ficha === undefined) return;
    escena.agregar({
      id: cosa.id,
      x: ficha.x,
      y: ficha.y,
      ancho: ficha.ancho,
      alto: ficha.alto,
      color: COLORES[i % COLORES.length] ?? 0x8899aa,
      etiqueta: cosa.nombre,
      datos: { clase: 'entidad' },
      orden: 10 + i,
    });
  });
  zonas.forEach((cosa, i) => {
    const ficha = fichasZonas[i];
    if (ficha === undefined) return;
    escena.agregar({
      id: cosa.id,
      x: ficha.x,
      y: ficha.y,
      ancho: ficha.ancho,
      alto: ficha.alto,
      color: 0x2f6f4f,
      etiqueta: cosa.nombre,
      datos: { clase: 'zona' },
      orden: 1 + i,
    });
  });

  return { escena, zonas: fichasZonas, entidades: fichasEntidades };
}

/** La zona que contiene el punto, si hay alguna. */
export function zonaEn(zonas: readonly Ficha[], x: number, y: number): Ficha | null {
  for (const zona of zonas) {
    if (dentroDe(zona, x, y)) return zona;
  }
  return null;
}

export function crearPrueba(opciones: OpcionesPrueba): Prueba {
  const raiz = crearElemento('div', { clases: 'prueba' });

  const barra = crearElemento('div', { clases: 'prueba__barra' });
  const titulo = crearElemento('h2', { clases: 'prueba__titulo', texto: `Probando: ${opciones.nivel.titulo ?? 'tu juego'}` });
  barra.appendChild(titulo);
  barra.appendChild(
    crearBoton({
      etiqueta: 'Volver al editor',
      pictograma: '⬅',
      clasesExtra: 'prueba__volver',
      alElegir: () => opciones.alVolver(),
    }),
  );
  raiz.appendChild(barra);

  const aviso = crearElemento('p', { clases: 'prueba__aviso' });
  aviso.setAttribute('role', 'status');
  aviso.textContent = 'Tocá y arrastrá las cosas para probar tus reglas.';
  raiz.appendChild(aviso);

  const lienzo = crearElemento('div', { clases: 'prueba__lienzo' });
  raiz.appendChild(lienzo);

  let juego: Juego | null = null;
  let render: RenderPixi | null = null;
  let entrada: ReturnType<typeof crearEntradaTactil> | null = null;
  let puente: Puente | null = null;

  function decir(texto: string): void {
    aviso.textContent = texto;
  }

  async function iniciar(): Promise<void> {
    const ancho = Math.max(320, Math.round(lienzo.clientWidth || 800));
    const alto = Math.max(240, Math.round(lienzo.clientHeight || 600));

    const armado = armarEscenaDePrueba(opciones.entidades, opciones.zonas, ancho, alto);

    const avisos: AvisosDelJuego = {
      alDecir: (_entidad, frase) => decir(frase),
      alMensaje: (texto) => decir(texto),
      alCelebrar: () => {
        decir('¡Muy bien!');
        aviso.classList.add('prueba__aviso--festejo');
        window.setTimeout(() => aviso.classList.remove('prueba__aviso--festejo'), 1200);
      },
      alEfecto: (accion) => {
        if (accion.nombre === 'sonar') decir(`Suena: ${String(accion.args['sonido'] ?? '')}`);
        if (accion.nombre === 'reproducir_video') decir(`Se gana el video: ${String(accion.args['video'] ?? '')}`);
      },
      alTerminar: () => decir('¡Se terminó el juego!'),
    };

    const puenteArmado = new Puente(opciones.nivel, { escena: armado.escena, avisos });
    puente = puenteArmado;

    const arrastre = puenteArmado.arrastre({
      escalaAlAgarrar: 1.2,
      sePuedeArrastrar: (entidad: Entidad) => entidad.datos['clase'] === 'entidad',
      sePuedeSoltar: () => true,
      alSoltar: (entidad: Entidad, _destino: Entidad | null, x: number, y: number) => {
        // Si lo soltó dentro de una zona, es que llegó: se lo avisa a la lógica.
        const zona = zonaEn(armado.zonas, x, y);
        if (zona !== null) puenteArmado.entrarZona(zona.id, entidad.id);
      },
    });

    render = await crearRenderPixi(lienzo, { ancho, alto, fondo: FONDO });

    const pantalla: PuertoPantalla = {
      tamano: () => ({ ancho, alto }),
      alCambiar: () => {
        // En la prueba el tamaño es fijo: no hay nada que reacomodar.
      },
    };

    entrada = crearEntradaTactil({ elemento: lienzo, tamanoLogico: () => ({ ancho, alto }) });

    juego = new Juego({
      escena: armado.escena,
      render,
      entrada,
      pantalla,
      reloj: crearReloj(),
      arrastre,
      alPaso: (_paso, tiempoSimulado) => {
        puenteArmado.paso(tiempoSimulado);
      },
    });

    juego.iniciar();
    juego.dibujar();
  }

  function detener(): void {
    if (juego !== null) {
      juego.detener();
      juego = null;
    }
    if (entrada !== null) {
      entrada.destruir();
      entrada = null;
    }
    if (render !== null) {
      render.destruir();
      render = null;
    }
    puente = null;
    lienzo.textContent = '';
  }

  return { elemento: raiz, iniciar, detener, puente: () => puente };
}

/**
 * El puente: engancha el MOTOR con la LÓGICA sin tocar ni uno ni otro.
 *
 * Es lo único que queda entre "un nivel escrito en datos" y "el juego andando":
 *
 *   ENTRADA      el arrastre de una pieza sobre otra  →  evento `entidad_soltada`
 *                un toque                            →  evento `entidad_tocada` (con la cuenta)
 *                llegar a una zona                    →  evento `zona_entrada`
 *                un gesto logrado                     →  evento `gesto_completado`
 *   TIMELINE     cada regla del timeline que se ejecuta →  evento `paso_completado`
 *   ESCENA       `mostrar` / `ocultar` / `mover` / `escalar` mueven las entidades de verdad
 *   PUERTOS      `sonar` y `reproducir_video` salen por los puertos (audio, video)
 *   AVISOS       lo que necesita decisión del juego (`decir`, `animar`, `celebrar`,
 *                `mostrar_mensaje`) se avisa por callbacks: el puente no inventa
 *                una boca de ventrílocuo ni un cartel de festejo.
 *
 * Nada de acá sabe de PixiJS, del DOM ni de Android, así que todo se prueba sin
 * navegador: se le da una escena, puertos de mentira y se avanza a mano.
 *
 * El reloj: `paso()` recibe el tiempo simulado que da el ticker. Con eso los
 * contadores de "machacar 5 veces en 3 segundos" son deterministas en las pruebas
 * (no dependen del reloj de la máquina).
 */
import {
  Arrastre,
  Timeline,
  PASO_POR_DEFECTO,
  type Escena,
  type OpcionesArrastre,
  type Regla as ReglaDeTimeline,
} from '@juegosemi/motor';
import type { PuertoAudio, PuertoVideo } from '@juegosemi/puertos';
import type { AccionResuelta, Evento, Nivel } from './tipo.ts';
import { Logica, type ResultadoPaso } from './logica.ts';
import { aplicarAccionLocal, resolverAccion } from './acciones.ts';

/** Lo que la lógica pide y sólo el juego sabe hacer. */
export interface AvisosDelJuego {
  /** `decir(personaje, "frase")`: boca de ventrílocuo + sonido. */
  alDecir?: (entidad: string, frase: string) => void;
  /** `animar(objetivo, nombre)`: una animación del personaje o de la pieza. */
  alAnimar?: (objetivo: string, animacion: string) => void;
  /** `mostrar_mensaje(texto)`: el cartel grande. */
  alMensaje?: (texto: string) => void;
  /** `celebrar()`: el único refuerzo fuerte (el acierto). */
  alCelebrar?: () => void;
  /** Todo lo que el puente no resuelve solo (o que pidió algo que no está en la escena). */
  alEfecto?: (accion: AccionResuelta) => void;
  /** Fin del nivel (motivo: lo pidió una acción, o se cumplieron las misiones). */
  alTerminar?: (motivo: 'accion' | 'misiones') => void;
}

export interface OpcionesPuente {
  escena: Escena;
  /** Sin puerto de audio, `sonar` se avisa por `alEfecto`. */
  audio?: PuertoAudio;
  /** Sin puerto de video, `reproducir_video` se avisa por `alEfecto`. */
  video?: PuertoVideo;
  /**
   * Las reglas del timeline del motor (los "a los 2 s pasa esto"). Se conectan solas:
   * cada regla que se ejecuta avisa `paso_completado` (para las condiciones `paso`)
   * y su acción se aplica igual que las de una regla común.
   */
  timeline?: { secuencia?: string; reglas: readonly ReglaDeTimeline[] };
  avisos?: AvisosDelJuego;
  /** Cuántos milisegundos duran los toques repetidos ("machacar 5 veces"). */
  ventanaToques?: number;
}

const VENTANA_TOQUES_POR_DEFECTO = 3000;

export class Puente {
  readonly logica: Logica;
  readonly escena: Escena;
  /** El timeline del motor; hay que dárselo al `Juego` para que lo avance. */
  readonly timeline: Timeline | null = null;

  private readonly audio: PuertoAudio | undefined;
  private readonly video: PuertoVideo | undefined;
  private readonly avisos: AvisosDelJuego;
  private readonly ventanaToques: number;
  private readonly toques = new Map<string, { veces: number; desde: number }>();
  private tiempo = 0;

  constructor(nivel: Nivel, opciones: OpcionesPuente) {
    this.escena = opciones.escena;
    this.audio = opciones.audio;
    this.video = opciones.video;
    this.avisos = opciones.avisos ?? {};
    this.ventanaToques = opciones.ventanaToques ?? VENTANA_TOQUES_POR_DEFECTO;

    this.logica = new Logica(nivel, {
      aplicar: (accion) => this.aplicar(accion),
      termino: (motivo) => this.avisos.alTerminar?.(motivo),
    });

    if (opciones.timeline) {
      const secuencia = opciones.timeline.secuencia ?? nivel.id;
      this.timeline = new Timeline(opciones.timeline.reglas, (accion) => {
        this.logica.emitir({ tipo: 'paso_completado', secuencia });
        this.ejecutarAccion(resolverAccion(accion, (t) => t));
      });
    }
  }

  // ── Lo que el juego llama ──────────────────────────────────────────────────

  /**
   * Un paso del ticker: se vencen los toques viejos y la lógica procesa lo que haya
   * pasado. `tiempoSimulado` es el del ticker (`Juego` lo da en `alPaso`).
   */
  paso(tiempoSimulado?: number): ResultadoPaso {
    this.tiempo = tiempoSimulado ?? this.tiempo + PASO_POR_DEFECTO;
    this.vencerToques();
    return this.logica.paso([]);
  }

  /** Un arrastre ya enganchado: soltar una pieza avisa a la lógica. */
  arrastre(opciones: OpcionesArrastre = {}): Arrastre {
    return new Arrastre(this.escena, {
      ...opciones,
      alEmpezar: (entidad, x, y) => {
        opciones.alEmpezar?.(entidad, x, y);
        this.tocar(entidad.id, x, y);
      },
      alSoltar: (entidad, destino, x, y) => {
        opciones.alSoltar?.(entidad, destino, x, y);
        this.soltar(entidad.id, destino === null ? null : destino.id, x, y);
      },
    });
  }

  /** Toque sobre una entidad. `veces` es la cuenta de toques seguidos (machaque). */
  tocar(entidad: string, x?: number, y?: number): void {
    const cuenta = this.toques.get(entidad);
    const veces = cuenta === undefined ? 1 : cuenta.veces + 1;
    const desde = cuenta === undefined ? this.tiempo : cuenta.desde;
    this.toques.set(entidad, { veces, desde });
    this.logica.emitir({ tipo: 'entidad_tocada', entidad, veces, x, y });
  }

  /** Se soltó una entidad sobre otra (o sobre el vacío, con `destino` null). */
  soltar(entidad: string, destino: string | null, x?: number, y?: number): void {
    const evento: Evento = { tipo: 'entidad_soltada', entidad, x, y };
    if (destino !== null) evento.destino = destino;
    this.logica.emitir(evento);
  }

  /** Alguien llegó a una zona (las zonas las sabe el escenario del juego). */
  entrarZona(zona: string, entidad: string): void {
    this.logica.emitir({ tipo: 'zona_entrada', zona, entidad });
  }

  /** Un gesto se completó (lo detecta el adaptador de gestos, otra tarjeta). */
  gestoCompletado(gesto: string, objetivo?: string): void {
    const evento: Evento = { tipo: 'gesto_completado', gesto };
    if (objetivo !== undefined) evento.destino = objetivo;
    this.logica.emitir(evento);
  }

  /** Se prendió un interruptor por fuera de las reglas (un botón de la pantalla). */
  objetoActivado(objeto: string): void {
    this.logica.emitir({ tipo: 'objeto_activado', objeto });
  }

  /** Avisa cualquier evento tal cual (para lo que no tenga una ayuda propia). */
  avisar(evento: Evento): void {
    this.logica.emitir(evento);
  }

  /** Los toques que siguen contando (para dibujar la barrita que se llena). */
  toquesSeguidos(): Array<{ entidad: string; veces: number }> {
    return [...this.toques.entries()].map(([entidad, cuenta]) => ({ entidad, veces: cuenta.veces }));
  }

  // ── Lo que la lógica pide ──────────────────────────────────────────────────

  private ejecutarAccion(accion: AccionResuelta): void {
    const local = aplicarAccionLocal(accion, this.logica.mundo, this.logica.eventos, this.logica.misiones);
    if (!local.resuelta) this.aplicar(accion);
  }

  /** Aplica una acción al aparato: escena primero, después puertos, después avisos. */
  private aplicar(accion: AccionResuelta): void {
    const objetivo = this.objetivo(accion);
    switch (accion.nombre) {
      case 'mostrar':
      case 'ocultar': {
        const entidad = this.escena.obtener(objetivo);
        if (entidad === null) return this.noEsta(accion);
        entidad.visible = accion.nombre === 'mostrar';
        if (entidad.visible) entidad.alfa = 1;
        return;
      }
      case 'mover': {
        const entidad = this.escena.obtener(objetivo);
        if (entidad === null) return this.noEsta(accion);
        entidad.x = this.numero(accion, 'x', entidad.x);
        entidad.y = this.numero(accion, 'y', entidad.y);
        return;
      }
      case 'escalar': {
        const entidad = this.escena.obtener(objetivo);
        if (entidad === null) return this.noEsta(accion);
        const escala = this.numero(accion, 'escala', 1);
        entidad.escalaX = escala;
        entidad.escalaY = escala;
        return;
      }
      case 'animar':
        if (this.escena.obtener(objetivo) === null) return this.noEsta(accion);
        this.avisos.alAnimar?.(objetivo, String(accion.args['animacion'] ?? ''));
        return;
      case 'decir':
        this.avisos.alDecir?.(String(accion.args['entidad'] ?? ''), String(accion.args['frase'] ?? ''));
        return;
      case 'sonar': {
        const id = String(accion.args['sonido'] ?? '');
        if (this.audio === undefined) return this.avisos.alEfecto?.(accion);
        void this.audio.reproducir(id);
        return;
      }
      case 'detener_sonido': {
        const id = String(accion.args['sonido'] ?? '');
        if (this.audio === undefined) return this.avisos.alEfecto?.(accion);
        this.audio.detener(id);
        return;
      }
      case 'reproducir_video': {
        const id = String(accion.args['video'] ?? '');
        if (this.video === undefined) return this.avisos.alEfecto?.(accion);
        void this.video.reproducir(id, { pantallaCompleta: true });
        return;
      }
      case 'mostrar_mensaje':
        this.avisos.alMensaje?.(String(accion.args['texto'] ?? ''));
        return;
      case 'celebrar':
        this.avisos.alCelebrar?.();
        return;
      default:
        this.avisos.alEfecto?.(accion);
    }
  }

  /** El id sobre el que actúa la acción (el editor y el texto lo escriben distinto). */
  private objetivo(accion: AccionResuelta): string {
    const valor = accion.args['objetivo'] ?? accion.args['entidad'];
    return valor === undefined ? '' : String(valor);
  }

  private numero(accion: AccionResuelta, clave: string, porDefecto: number): number {
    const valor = accion.args[clave];
    return typeof valor === 'number' ? valor : porDefecto;
  }

  /** El juego nombró algo que no está en la escena: decide él (puede que lo cree). */
  private noEsta(accion: AccionResuelta): void {
    this.avisos.alEfecto?.(accion);
  }

  /** Los toques que ya no cuentan (pasó la ventana del machaque). */
  private vencerToques(): void {
    const limite = this.ventanaToques / 1000;
    for (const [entidad, cuenta] of this.toques) {
      if (this.tiempo - cuenta.desde > limite) this.toques.delete(entidad);
    }
  }
}

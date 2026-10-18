/**
 * @juegosemi/puertos — los CONTRATOS entre el motor y cada plataforma.
 *
 * Regla del proyecto: el motor (packages/motor) NO conoce PixiJS, el DOM, ni
 * Android. Todo lo que depende de la plataforma entra por uno de estos puertos.
 * Agregar una capacidad nueva (micrófono, giroscopio, gamepad, cámara) es
 * escribir un adaptador nuevo que implemente una de estas interfaces, sin tocar
 * el motor.
 */

// ─── Tiempo ──────────────────────────────────────────────────────────────────

/** Fuente de tiempo inyectable (para poder testear sin navegador). */
export interface Reloj {
  /** Milisegundos desde el arranque. */
  ahora(): number;
}

// ─── Entrada ─────────────────────────────────────────────────────────────────

export type TipoEventoEntrada = 'pulsar' | 'mover' | 'soltar' | 'cancelar';

export interface EventoEntrada {
  tipo: TipoEventoEntrada;
  /** Coordenadas en píxeles de CSS, relativas al lienzo. */
  x: number;
  y: number;
  /** Identificador del dedo/puntero (permite multitáctil). */
  puntero: number;
}

export interface PuertoEntrada {
  /** Arranca la escucha. `alRecibir` recibe cada evento en orden. */
  iniciar(alRecibir: (evento: EventoEntrada) => void): void;
  detener(): void;
  /** Capacidades declaradas por el adaptador (para decidir la interfaz). */
  capacidades(): { tactil: boolean; puntero: boolean; giroscopio: boolean };
}

// ─── Audio ───────────────────────────────────────────────────────────────────

export interface OpcionesAudio {
  volumen?: number;
  bucle?: boolean;
}

export interface PuertoAudio {
  /** Registra un sonido con un id lógico. */
  cargar(id: string, url: string): Promise<void>;
  /** Reproduce un sonido ya cargado. */
  reproducir(id: string, opciones?: OpcionesAudio): Promise<void>;
  detener(id: string): void;
  detenerTodo(): void;
  /**
   * True cuando el navegador ya desbloqueó el audio (requiere un gesto del
   * usuario). Los adaptadores deben llamar a `desbloquear()` en el primer toque.
   */
  estaDesbloqueado(): boolean;
  desbloquear(): Promise<void>;
}

// ─── Video ───────────────────────────────────────────────────────────────────

export type CodecVideo = 'h264' | 'h265';

export interface OpcionesVideo {
  /** Reproducir a pantalla completa dentro de la app. */
  pantallaCompleta?: boolean;
  /** Volumen de 0 a 1. */
  volumen?: number;
}

export interface ResultadoVideo {
  ok: boolean;
  /** Motivo legible cuando `ok === false` (para el reporte y los logs). */
  motivo?: string;
}

/**
 * Contrato de video. Existe porque el `<video>` del WebView de las tablets
 * Huawei (Chromium 99) NO reproduce H.265: ahí entra el adaptador nativo
 * (Media3/ExoPlayer). El motor sólo ve este puerto.
 */
export interface PuertoVideo {
  /**
   * ¿Se puede reproducir de verdad este códec? Ojo: `canPlayType` MIENTE en
   * WebViews viejos; el adaptador debe verificar frames, no eventos.
   */
  soporta(codec: CodecVideo): Promise<boolean>;
  reproducir(url: string, opciones?: OpcionesVideo): Promise<ResultadoVideo>;
  detener(): void;
}

// ─── Almacenamiento ──────────────────────────────────────────────────────────

export interface PuertoAlmacenamiento {
  guardar(clave: string, valor: unknown): void;
  leer<T>(clave: string): T | null;
  borrar(clave: string): void;
  claves(): string[];
}

// ─── Plataforma ──────────────────────────────────────────────────────────────

export interface SoportePlataforma {
  webgl1: boolean;
  webgl2: boolean;
  /** Versión de Chromium del WebView, si se pudo leer del userAgent. */
  chromium: number | null;
  /** True si el dispositivo es Huawei/HONOR (WebView propio, suele ser viejo). */
  huawei: boolean;
}

export interface InfoPlataforma {
  nombre: 'web' | 'android' | 'desconocida';
  userAgent: string;
  ancho: number;
  alto: number;
  densidad: number;
  nucleos: number;
  soporte: SoportePlataforma;
}

export interface PuertoPlataforma {
  info(): InfoPlataforma;
  vibrar(milisegundos: number): void;
}

// ─── Render ──────────────────────────────────────────────────────────────────

/**
 * Una entidad dibujable. El motor la produce; el adaptador de render la pinta.
 * `textura` es un id lógico (el adaptador decide cómo resolverlo).
 */
export interface DibujoEntidad {
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
  /** Orden de dibujo: mayor = más adelante. */
  orden: number;
  visible: boolean;
  /** 0 = opaco. Sirve para el "aparecer/desaparecer". */
  alfa: number;
  /** Color de relleno cuando no hay textura (útil sin assets). */
  color: number | null;
  /** Texto que se dibuja encima (nombre de la persona, del auto, etc.). */
  etiqueta?: string | null;
}

export interface AdaptadorRender {
  /** Pinta el fotograma completo a partir de los dibujos del motor. */
  sincronizar(dibujos: readonly DibujoEntidad[]): void;
  /** Alto y ancho del área de dibujo en píxeles de CSS. */
  tamano(): { ancho: number; alto: number };
  destruir(): void;
}

export interface AdaptadorRenderFabrica {
  crear(
    contenedor: HTMLElement,
    opciones?: { ancho?: number; alto?: number; fondo?: number; resolucion?: number },
  ): Promise<AdaptadorRender>;
}

// ─── Lienzo de destino ───────────────────────────────────────────────────────

/**
 * El "display" que el motor usa para saber sus dimensiones lógicas (y para
 * escalar el mundo a pantallas distintas, de un celular chico a una tablet
 * grande). El adaptador de plataforma lo implementa.
 */
export interface PuertoPantalla {
  /** Tamaño lógico del área de juego. */
  tamano(): { ancho: number; alto: number };
  /** Se llama cuando cambia el tamaño o la orientación. */
  alCambiar(callback: () => void): void;
}

// ─── Gestos (acciones tipo QTE) ──────────────────────────────────────────────
//
// Un gesto pedido ("machacar el botón", "girar la manivela") es una capacidad
// reutilizable: el juego lo pide por datos (`pedir_gesto(...)`) y recibe
// `gesto_completado` cuando el niño lo logra. El reconocimiento vive en
// `@juegosemi/gestos` (puro, sin navegador) y el adaptador que lo enchufa a la
// entrada táctil vive en `@juegosemi/adaptadores-web`.
//
// Regla de oro del proyecto: un gesto no se falla. Si el niño no lo completa,
// simplemente no avanza; el reconocedor NUNCA avisa de un error.

/** Los gestos que reconoce el adaptador de entrada táctil de este proyecto. */
export type TipoGesto = 'toque_repetido' | 'mantener' | 'circulo' | 'direccion';

/** Lado hacia el que se arrastra (para `direccion`). */
export type DireccionGesto = 'izquierda' | 'derecha' | 'arriba' | 'abajo';

/** Sentido del giro (para `circulo`). Si no se pide, sirve cualquiera. */
export type SentidoGiro = 'horario' | 'antihorario';

/** Un gesto pedido: qué hacer, sobre qué y con qué tolerancia. */
export interface PedidoGesto {
  gesto: TipoGesto;
  /**
   * Sobre qué se hace (una entidad, una zona, un objeto). Viaja tal cual al
   * evento `gesto_completado` como `destino`, para que la lógica sepa de qué
   * pedido se trata cuando hay más de uno a la vez.
   */
  destino?: string;
  /**
   * Cuántas unidades hay que completar. Cada unidad avisa UN `gesto_completado`:
   * 5 toques, 3 vueltas, 2 mantenciones... Por defecto 1.
   */
  veces?: number;
  /** Milisegundos que hay que mantener apretado, por unidad (`mantener`). */
  milisegundos?: number;
  /** Sentido que hay que respetar al girar (`circulo`). Por defecto: cualquiera. */
  sentido?: SentidoGiro;
  /** Lado hacia el que hay que arrastrar (`direccion`). Por defecto: `derecha`. */
  direccion?: DireccionGesto;
  /** Píxeles mínimos de arrastre para dar por hecha una unidad (`direccion`). */
  distancia?: number;
  /** Cadencia de toques: si entre uno y otro pasa más, la racha visible reinicia. */
  ventana?: number;
}

/** El progreso de un gesto pedido, pensado para una barra que se llena. */
export interface AvanceGesto {
  /** De 0 a 1. Nunca baja por castigo: sólo reinicia una racha que quedó lenta. */
  progreso: number;
  /** Unidades completadas del pedido. */
  hechas: number;
  /** Unidades que pide el pedido. */
  veces: number;
  /** ¿Ya se completó el pedido entero? */
  completado: boolean;
}

/**
 * El puerto de gestos. El juego pide un gesto y mira cómo avanza; el adaptador
 * lo reconoce sobre los eventos de la entrada táctil.
 *
 * Los tiempos entran por parámetro (`ahoraMs`) en vez de leerse adentro: así el
 * reconocedor es puro y los cuatro gestos se prueban sin un navegador.
 */
export interface PuertoGestos {
  /** Pone a esperar un gesto (reemplaza el anterior). */
  pedir(pedido: PedidoGesto): void;
  /** El gesto pedido actual, o null si no hay ninguno. */
  pedido(): PedidoGesto | null;
  /** El progreso del gesto pedido (para la barra). */
  avance(): AvanceGesto;
  /** Alimenta un evento de la entrada táctil. `ahoraMs` es el reloj. */
  alimentar(evento: EventoEntrada, ahoraMs: number): void;
  /**
   * Late el reloj sin evento: para `mantener` la barra se llena aunque el dedo
   * no se mueva. Se llama una vez por cuadro.
   */
  latir(ahoraMs: number): void;
  /** Olvida el pedido y reinicia el progreso. */
  reiniciar(): void;
  /** Se avisa cada vez que cambia el progreso (para refrescar la barra). */
  alProgresar(callback: (avance: AvanceGesto) => void): void;
  /** Se avisa al completar UNA unidad del pedido (→ `gesto_completado`). */
  alCompletarGesto(callback: (pedido: PedidoGesto, avance: AvanceGesto) => void): void;
}

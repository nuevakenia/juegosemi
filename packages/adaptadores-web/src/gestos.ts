/**
 * Adaptador de gestos para el navegador (y el WebView de Android).
 *
 * Es el pegamento entre la entrada táctil que YA existe
 * (`crearEntradaTactil`, que emite `pulsar/mover/soltar`) y el reconocedor puro
 * de `@juegosemi/gestos`. Acá está lo único que el reconocedor no puede hacer
 * solo, porque toca el navegador: leer el reloj y latir una vez por cuadro (para
 * que `mantener` llene la barra aunque el dedo no se mueva).
 *
 * El juego no ve nada de esto: pide un gesto por el puerto (`pedir(...)`) y
 * escucha `alCompletarGesto(...)` para mandar el `gesto_completado` a la lógica.
 */
import type {
  AvanceGesto,
  EventoEntrada,
  PedidoGesto,
  PuertoGestos,
  Reloj,
} from '@juegosemi/puertos';
import { Reconocedor } from '@juegosemi/gestos';
import { crearEntradaTactil } from './entrada-tactil.ts';
import { crearReloj } from './plataforma.ts';

/** Lo que se puede ajustar al crear los gestos. */
export interface OpcionesGestosTactiles {
  /** Elemento que recibe el dedo (el lienzo o el marco del juego). */
  elemento: HTMLElement;
  /** Tamaño lógico si el elemento está escalado (igual que en la entrada táctil). */
  tamanoLogico?: () => { ancho: number; alto: number };
  /** Reloj inyectable (por defecto `performance.now()`). */
  reloj?: Reloj;
  /**
   * Si el juego además necesita los eventos crudos (arrastrar, botones), los
   * recibe acá: el adaptador no se los roba a nadie.
   */
  alEvento?: (evento: EventoEntrada) => void;
  /** Cada cambio de progreso (para pintar la barra). */
  alProgresar?: (avance: AvanceGesto) => void;
  /** Una unidad del gesto completada → el juego lo manda como `gesto_completado`. */
  alCompletarGesto?: (pedido: PedidoGesto, avance: AvanceGesto) => void;
}

export interface GestosTactiles extends PuertoGestos {
  /** Deja de escuchar el dedo y apaga el latido. */
  detener(): void;
  /** Igual que `detener` (nombre cómodo para el arranque de la app). */
  destruir(): void;
}

export function crearGestosTactiles(opciones: OpcionesGestosTactiles): GestosTactiles {
  const reloj = opciones.reloj ?? crearReloj();
  const reconocedor = new Reconocedor();
  if (opciones.alProgresar !== undefined) reconocedor.alProgresar(opciones.alProgresar);
  if (opciones.alCompletarGesto !== undefined) reconocedor.alCompletarGesto(opciones.alCompletarGesto);

  const entrada = crearEntradaTactil({
    elemento: opciones.elemento,
    tamanoLogico: opciones.tamanoLogico,
  });

  entrada.iniciar((evento) => {
    // El reloj acompaña a cada evento: el reconocedor es puro y no lo mira solo.
    reconocedor.alimentar(evento, reloj.ahora());
    opciones.alEvento?.(evento);
  });

  // El latido le da tiempo al reconocedor sin eventos (clave para `mantener`).
  let latido = 0;
  const latir = (): void => {
    reconocedor.latir(reloj.ahora());
    latido = window.requestAnimationFrame(latir);
  };
  latido = window.requestAnimationFrame(latir);

  function detener(): void {
    if (latido !== 0) {
      window.cancelAnimationFrame(latido);
      latido = 0;
    }
    entrada.detener();
  }

  return {
    pedir: (pedido: PedidoGesto): void => reconocedor.pedir(pedido),
    pedido: (): PedidoGesto | null => reconocedor.pedido(),
    avance: (): AvanceGesto => reconocedor.avance(),
    alimentar: (evento: EventoEntrada, ahoraMs: number): void => reconocedor.alimentar(evento, ahoraMs),
    latir: (ahoraMs: number): void => reconocedor.latir(ahoraMs),
    reiniciar: (): void => reconocedor.reiniciar(),
    alProgresar: (callback: (avance: AvanceGesto) => void): void => reconocedor.alProgresar(callback),
    alCompletarGesto: (callback: (pedido: PedidoGesto, avance: AvanceGesto) => void): void =>
      reconocedor.alCompletarGesto(callback),
    detener,
    destruir: detener,
  };
}

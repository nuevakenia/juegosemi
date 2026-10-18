/**
 * Los datos del juego de gestos: los cuatro gestos, en orden, y el nivel que los
 * pide uno por uno.
 *
 * Está todo en datos y separado de la pantalla (que vive en main.ts) para poder
 * probarlo sin navegador y para que el día de mañana salga del mismo editor que
 * los demás niveles.
 *
 * Cómo encaja con la lógica: cada paso pide un gesto (`pedir_gesto`) y el juego
 * deja de pedirlo cuando la lógica lo da por completo. La regla `avanzar` mira
 * exactamente eso: llegó un `gesto_completado` de este gesto Y ya no está pedido
 * (la lógica lo borra al completarlo), así que avanza UNA vez, al final.
 */
import type { Nivel, Regla } from '@juegosemi/logica';
import type { DireccionGesto, SentidoGiro, TipoGesto } from '@juegosemi/puertos';

/** Un gesto del recorrido, con lo que hace falta para pedirlo y para mostrarlo. */
export interface PasoGesto {
  gesto: TipoGesto;
  /** Sobre qué se hace (viaja como `destino`). */
  objetivo: string;
  /** Título corto del paso. */
  etiqueta: string;
  /** Qué tiene que hacer el niño, en lenguaje de todos los días. */
  ayuda: string;
  /** Pictograma grande que acompaña la palabra. */
  pictograma: string;
  /** Cuántas unidades hay que completar. */
  veces: number;
  /** Para `mantener`: milisegundos apretado. */
  milisegundos?: number;
  /** Para `circulo`: sentido que hay que girar. */
  sentido?: SentidoGiro;
  /** Para `direccion`: lado hacia el que arrastrar. */
  direccion?: DireccionGesto;
  /** Para `direccion`: píxeles mínimos de arrastre. */
  distancia?: number;
}

/** El recorrido: un gesto por paso, de los más fáciles a los que piden más. */
export const PASOS_GESTOS: readonly PasoGesto[] = [
  {
    gesto: 'toque_repetido',
    objetivo: 'boton',
    etiqueta: 'Machacar el botón',
    ayuda: 'Tocá el botón 5 veces, bien rápido',
    pictograma: '\u{1F518}',
    veces: 5,
  },
  {
    gesto: 'mantener',
    objetivo: 'globo',
    etiqueta: 'Inflar el globo',
    ayuda: 'Apretá y no soltés hasta llenar la barra',
    pictograma: '\u{1F388}',
    veces: 1,
    milisegundos: 1500,
  },
  {
    gesto: 'circulo',
    objetivo: 'manivela',
    etiqueta: 'Girar la manivela',
    ayuda: 'Girá el dedo en círculos, como una manivela',
    pictograma: '\u{1F3A1}',
    veces: 1,
    sentido: 'horario',
  },
  {
    gesto: 'direccion',
    objetivo: 'palanca',
    etiqueta: 'Pasar la palanca',
    ayuda: 'Arrastrá el dedo bien a la derecha',
    pictograma: '\u{1F579}\u{FE0F}',
    veces: 1,
    direccion: 'derecha',
    distancia: 70,
  },
];

/** El paso de un gesto, o null si no lo pedimos nosotros. */
export function pasoPorGesto(gesto: TipoGesto): PasoGesto | null {
  for (const paso of PASOS_GESTOS) {
    if (paso.gesto === gesto) return paso;
  }
  return null;
}

/** Arma el nivel: pide cada gesto al llegar a su paso y avanza al completarlo. */
export function crearNivelGestos(): Nivel {
  const reglas: Regla[] = [];

  PASOS_GESTOS.forEach((paso, indice) => {
    // Avanza el paso cuando ESTE gesto quedó completo: llegó su `gesto_completado`
    // y (en el mismo paso) la lógica ya borró el pedido por haberlo completado.
    reglas.push({
      id: `avanzar-${paso.gesto}`,
      orden: -1,
      si: {
        y: [
          { evento: 'gesto_completado', gesto: paso.gesto },
          { no: { gesto: paso.gesto } },
        ],
      },
      hacer: ['sumar(paso, 1)'],
    });
    // Al llegar a este paso, se pide el gesto (una sola vez).
    reglas.push({
      id: `pedir-${paso.gesto}`,
      si: { contador: 'paso', es: indice },
      hacer: [`pedir_gesto(${paso.gesto}, ${paso.veces}, ${paso.objetivo})`],
    });
  });

  return {
    id: 'juego-gestos',
    titulo: 'Los gestos',
    mundo: { contadores: { paso: 0 } },
    reglas,
    // Cuando se completaron todos los pasos, se terminó.
    nivel_terminado: { contador: 'paso', al_menos: PASOS_GESTOS.length },
  };
}

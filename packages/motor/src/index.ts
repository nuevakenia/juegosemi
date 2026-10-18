/**
 * @juegosemi/motor — el núcleo del proyecto.
 *
 * No conoce PixiJS, ni el DOM, ni Android: todo lo de plataforma entra por los
 * puertos de @juegosemi/puertos.
 */
export { Escena, type Entidad, type EntidadParcial } from './escena.ts';
export { Ticker, PASO_POR_DEFECTO } from './ticker.ts';
export { Arrastre, type OpcionesArrastre } from './arrastre.ts';
export {
  Timeline,
  aSegundos,
  parsearAccion,
  type Regla,
  type Duracion,
  type AlEjecutar,
  type ContextoEjecucion,
} from './timeline.ts';
export { Juego, type DependenciasJuego } from './juego.ts';

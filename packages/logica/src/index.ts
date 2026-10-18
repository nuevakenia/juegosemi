/**
 * @juegosemi/logica — el sistema para armar juegos nuevos con datos.
 *
 * Un nivel se escribe así (y el editor de la tablet produce lo mismo):
 *
 *   mundo:    qué recuerda el juego (variables, contadores, interruptores)
 *   reglas:   si <condición> → <acciones>   (con encadenamiento)
 *   misiones: qué hay que lograr, en qué orden, y qué se gana
 *
 * Nada de esto sabe dibujar ni sonar: lo que toca la pantalla se avisa por
 * `Efectos.aplicar(...)`. Por eso todo se prueba sin navegador.
 *
 * Para engancharlo al motor (arrastre, escena, ticker, timeline) está `Puente`.
 */
export type {
  Accion,
  AccionEstructurada,
  AccionResuelta,
  Condicion,
  CondicionContador,
  CondicionEvento,
  CondicionGesto,
  CondicionMision,
  CondicionObjeto,
  CondicionPaso,
  CondicionToque,
  CondicionVariable,
  CondicionZona,
  EstadoMision,
  Evento,
  Mision,
  MundoDatos,
  Nivel,
  Regla,
  TipoEvento,
  Valor,
} from './tipo.ts';

export { Mundo } from './mundo.ts';
export { ColaEventos } from './eventos.ts';
export { Misiones, type EstadoDeMision } from './misiones.ts';
export { evaluarCondicion, type ContextoCondicion } from './condiciones.ts';
export { ACCIONES_LOCALES, aplicarAccionLocal, esLocal, parsearAccion, resolverAccion, type ResultadoLocal } from './acciones.ts';
export { Logica, type Efectos, type ResultadoPaso } from './logica.ts';
export { Puente, type AvisosDelJuego, type OpcionesPuente } from './puente.ts';
export { GESTOS_CONOCIDOS, validarNivel, type ResultadoValidacion } from './validar.ts';

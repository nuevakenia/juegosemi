import type { Auto, Familia, Persona } from '@juegosemi/contenido';

/**
 * Las REGLAS del primer juego: llevar a cada persona hasta su auto.
 *
 * Regla de oro del proyecto (pedido explícito de Papu): cuando se equivoca, NO
 * hay feedback negativo. El juego no dice "no", no suena un error, no pierde
 * nada: simplemente la pieza vuelve a su lugar y se puede intentar otra vez. El
 * único feedback fuerte es el acierto (frase + sonido + festejo), que es lo que
 * engancha a Emiliano.
 *
 * Este archivo es lógica pura: no toca el DOM, no toca PixiJS, no suena. Así se
 * prueba completo sin navegador.
 */

export type Animo = 'festejo' | 'neutro';

export interface Partida {
  familia: Familia;
  /** personaId → autoId (sólo las resueltas). */
  asignadas: Record<string, string>;
  aciertos: number;
  intentos: number;
  fallos: number;
}

export interface ResultadoIntento {
  /** True si el auto es el correcto. */
  correcto: boolean;
  /** La frase para mostrar/leer. Sólo hay frase cuando acertó. */
  frase: string | null;
  /** 'festejo' en el acierto; 'neutro' cuando todavía no. Nunca negativo. */
  animo: Animo;
  /** True cuando ya no queda ninguna persona pendiente. */
  completada: boolean;
  /** Cuántas personas quedan por resolver. */
  quedan: number;
}

export function crearPartida(familia: Familia): Partida {
  return { familia, asignadas: {}, aciertos: 0, intentos: 0, fallos: 0 };
}

/** Las personas que todavía no tienen su auto asignado, en el orden del contenido. */
export function personasPendientes(partida: Partida): Persona[] {
  return partida.familia.personas.filter((p) => partida.asignadas[p.id] === undefined);
}

/** Los autos que todavía no fueron tomados. */
export function autosLibres(partida: Partida): Auto[] {
  const tomados = new Set(Object.values(partida.asignadas));
  return partida.familia.autos.filter((a) => !tomados.has(a.id));
}

export function estaCompletada(partida: Partida): boolean {
  return personasPendientes(partida).length === 0;
}

/** El auto correcto de una persona (para el taller y para los tests). */
export function autoCorrecto(partida: Partida, personaId: string): Auto | null {
  const persona = partida.familia.personas.find((p) => p.id === personaId);
  if (!persona) return null;
  return partida.familia.autos.find((a) => a.id === persona.auto) ?? null;
}

/**
 * Intenta llevar `personaId` al auto `autoId`.
 *
 * `partida` se muta (es el estado del juego) y se devuelve el resultado.
 */
export function intentar(partida: Partida, personaId: string, autoId: string | null): ResultadoIntento {
  const persona = partida.familia.personas.find((p) => p.id === personaId);
  const quedanAntes = personasPendientes(partida).length;

  // Sin destino no es un intento: sólo se soltó en el vacío.
  if (!persona || autoId === null) {
    return { correcto: false, frase: null, animo: 'neutro', completada: estaCompletada(partida), quedan: quedanAntes };
  }

  // Si esa persona ya está resuelta, no se vuelve a contar.
  if (partida.asignadas[personaId] !== undefined) {
    return { correcto: true, frase: null, animo: 'neutro', completada: estaCompletada(partida), quedan: quedanAntes };
  }

  partida.intentos++;

  if (persona.auto === autoId) {
    partida.asignadas[personaId] = autoId;
    partida.aciertos++;
    const quedan = personasPendientes(partida).length;
    return {
      correcto: true,
      frase: persona.frase ?? `¡Muy bien! ${persona.nombre} con su auto.`,
      animo: 'festejo',
      completada: quedan === 0,
      quedan,
    };
  }

  // Se equivocó: se cuenta para el reporte del adulto, pero el niño no recibe
  // ningún mensaje negativo (la pieza vuelve sola a su lugar en la pantalla).
  partida.fallos++;
  return { correcto: false, frase: null, animo: 'neutro', completada: estaCompletada(partida), quedan: quedanAntes };
}

/** Vuelve la partida al principio (mismo contenido, todo pendiente). */
export function reiniciar(partida: Partida): void {
  partida.asignadas = {};
  partida.aciertos = 0;
  partida.intentos = 0;
  partida.fallos = 0;
}

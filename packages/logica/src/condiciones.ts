/**
 * Evaluar condiciones: el "si ..." de una regla.
 *
 * Todas devuelven sí o no, y se combinan con y / o / no, así que cualquier cosa que
 * se pueda preguntar del juego se puede escribir en datos:
 *
 *   { "y": [ { "activo": "interruptor-viaje" }, { "contador": "maletas", "al_menos": 3 } ] }
 *   { "o": [ { "evento": "entidad_soltada", "destino": "auto" }, { "variable": "prisa", "es": true } ] }
 *   { "no": { "mision": "llegar", "hecha": true } }
 *
 * Las condiciones de EVENTO miran sólo el paso actual (los eventos no sobreviven al
 * paso): así la regla reacciona justo cuando pasa, y no tres segundos después.
 *
 * Nota de implementación: las condiciones se leen como datos con su tipo comprobado
 * (no con casts a ciegas). Son datos que van a venir de afuera —de un archivo o del
 * editor— así que NUNCA hay que confiar en su forma: una condición con un campo mal
 * escrito tiene que dar "no" y no reventar el juego en mitad de la partida.
 */
import type { Condicion, EstadoMision, TipoEvento } from './tipo.ts';
import type { Mundo } from './mundo.ts';
import type { ColaEventos } from './eventos.ts';
import type { Misiones } from './misiones.ts';

export interface ContextoCondicion {
  mundo: Mundo;
  eventos: ColaEventos;
  misiones: Misiones;
  /** Cuántos pasos de cada secuencia se completaron (evento `paso_completado`). */
  pasos: Map<string, number>;
  /** Sustituye los comodines del evento actual ($entidad, $destino, $zona...). */
  sustituir: (texto: string) => string;
}

function texto(valor: unknown, sustituir: (t: string) => string): string | null {
  if (typeof valor !== 'string') return null;
  return sustituir(valor);
}

function numeroDe(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

export function evaluarCondicion(condicion: Condicion | undefined, ctx: ContextoCondicion): boolean {
  if (condicion === undefined) return true; // sin condición = siempre
  const c = condicion as Record<string, unknown>;
  const sust = ctx.sustituir;

  // ── Combinadores ──────────────────────────────────────────────────────────
  if (Array.isArray(c['y'])) return (c['y'] as Condicion[]).every((hija) => evaluarCondicion(hija, ctx));
  if (Array.isArray(c['o'])) return (c['o'] as Condicion[]).some((hija) => evaluarCondicion(hija, ctx));
  if (c['no'] !== undefined) return !evaluarCondicion(c['no'] as Condicion, ctx);

  // ── Interruptor ───────────────────────────────────────────────────────────
  const objetoActivo = texto(c['activo'], sust);
  if (objetoActivo !== null) {
    const valor = ctx.mundo.activo(objetoActivo);
    return c['es'] === undefined ? valor : valor === c['es'];
  }

  // ── Variable (número, sí/no o texto) ──────────────────────────────────────
  const variable = texto(c['variable'], sust);
  if (variable !== null) {
    const actual = ctx.mundo.variable(variable);
    if (c['es'] !== undefined && actual !== c['es']) return false;
    if (c['distinto'] !== undefined && actual === c['distinto']) return false;
    const mayor = numeroDe(c['mayor']);
    if (mayor !== null && (typeof actual !== 'number' || !(actual > mayor))) return false;
    const menor = numeroDe(c['menor']);
    if (menor !== null && (typeof actual !== 'number' || !(actual < menor))) return false;
    const igualA = numeroDe(c['igual_a']);
    if (igualA !== null && (typeof actual !== 'number' || actual !== igualA)) return false;
    return true;
  }

  // ── Contador ──────────────────────────────────────────────────────────────
  const contador = texto(c['contador'], sust);
  if (contador !== null) {
    const actual = ctx.mundo.contador(contador);
    const es = numeroDe(c['es']);
    if (es !== null && actual !== es) return false;
    const alMenos = numeroDe(c['al_menos']);
    if (alMenos !== null && actual < alMenos) return false;
    const aLoMas = numeroDe(c['a_lo_mas']);
    if (aLoMas !== null && actual > aLoMas) return false;
    return true;
  }

  // ── Evento del paso (lo que ACABA de pasar) ───────────────────────────────
  if (typeof c['evento'] === 'string') {
    const filtro: Record<string, string> = {};
    for (const campo of ['entidad', 'destino', 'zona', 'objeto', 'gesto', 'variable', 'mision']) {
      const valor = texto(c[campo], sust);
      if (valor !== null) filtro[campo] = valor;
    }
    const encontrado = ctx.eventos.buscar(c['evento'] as TipoEvento, filtro);
    if (!encontrado) return false;
    const veces = numeroDe(c['veces']);
    if (veces !== null && (encontrado.veces ?? 1) < veces) return false;
    return true;
  }

  // ── Gesto pedido (los QTE): "¿ya giró la manivela?" ───────────────────────
  const gesto = texto(c['gesto'], sust);
  if (gesto !== null) {
    const objetivo = texto(c['objetivo'], sust);
    const pedido = ctx.eventos.gestoPedido(gesto, objetivo ?? undefined);
    if (pedido === null) return false;
    const veces = numeroDe(c['veces']);
    if (veces !== null && pedido.hechas < veces) return false;
    // `faltan` es avance, no exigencia: "todavía queda al menos esto por hacer".
    const faltan = numeroDe(c['faltan']);
    if (faltan !== null && pedido.veces - pedido.hechas < faltan) return false;
    return true;
  }

  // ── Toques repetidos: "machacar el botón 5 veces" ─────────────────────────
  const toco = texto(c['toco'], sust);
  if (toco !== null) {
    const encontrado = ctx.eventos.buscar('entidad_tocada', { entidad: toco });
    if (!encontrado) return false;
    const veces = numeroDe(c['veces']);
    if (veces !== null && (encontrado.veces ?? 1) < veces) return false;
    return true;
  }

  // ── Zona (quién llegó) ────────────────────────────────────────────────────
  const zona = texto(c['zona'], sust);
  if (zona !== null) {
    if (c['vacia'] === true) return ctx.eventos.buscar('zona_entrada', { zona }) === null;
    const filtro: Record<string, string> = { zona };
    const ocupadaPor = texto(c['ocupada_por'], sust);
    if (ocupadaPor !== null) filtro['entidad'] = ocupadaPor;
    return ctx.eventos.buscar('zona_entrada', filtro) !== null;
  }

  // ── Misión ────────────────────────────────────────────────────────────────
  const mision = texto(c['mision'], sust);
  if (mision !== null) {
    const estado: EstadoMision | null = ctx.misiones.estadoDe(mision);
    if (estado === null) return false;
    if (c['hecha'] !== undefined && (estado === 'hecha') !== c['hecha']) return false;
    if (c['en_curso'] !== undefined && (estado === 'en_curso') !== c['en_curso']) return false;
    // `disponible` = tiene los requisitos puestos (no es lo mismo que hecha).
    if (c['disponible'] !== undefined && ctx.misiones.disponible(mision) !== c['disponible']) return false;
    return true;
  }

  // ── Paso de una secuencia ─────────────────────────────────────────────────
  const paso = texto(c['paso'], sust);
  if (paso !== null) {
    const hechos = ctx.pasos.get(paso) ?? 0;
    const alMenos = numeroDe(c['al_menos']);
    if (alMenos !== null && hechos < alMenos) return false;
    const hecho = numeroDe(c['hecho']);
    if (hecho !== null && hechos !== hecho) return false;
    return true;
  }

  // Condición con forma desconocida: no se cumple (y el validador la reporta).
  return false;
}

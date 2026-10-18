/**
 * La máquina de la lógica: el paso que se corre 60 veces por segundo.
 *
 * Orden de cada paso:
 *   1. entran los eventos de lo que pasó (se soltó una pieza, se completó un gesto...)
 *   2. se evalúan las reglas, en orden, y se ejecutan las que se cumplen
 *   3. ENCADENAMIENTO: si una regla cambió el mundo, se vuelve a evaluar todo (así
 *      "subió las tres maletas" habilita "arrancar el viaje", y eso habilita "pedir
 *      la manivela"). Se corta a las 8 vueltas para no colgarse nunca.
 *   4. se actualizan las misiones (con sus prerrequisitos) y se disparan recompensas
 *   5. se ve si el nivel terminó
 *   6. los eventos se tiran: no sobreviven al paso
 *
 * Dos cosas que hacen que casi todo salga escrito en datos:
 *
 *   `una_vez` (por defecto sí) significa "no repetir MIENTRAS la condición siga
 *   cumpliéndose"; la regla se rearma sola cuando la condición deja de cumplirse.
 *   Por eso UNA regla de "soltar maleta sobre el auto" sirve para las tres maletas,
 *   y una regla que mira un interruptor dispara una única vez.
 *
 *   Las misiones se actualizan por pasadas atómicas, una tras otra: lo que se cumple
 *   en una pasada habilita la siguiente. Así "llegar" no se puede cumplir sin
 *   "manejar", y el orden lo garantizan los datos.
 *
 * Este archivo NO sabe dibujar ni sonar: lo que toca la pantalla o el aparato se
 * avisa por `efectos.aplicar(...)`. Por eso la lógica entera se prueba sin navegador.
 */
import type { AccionResuelta, Condicion, Evento, Mision, Nivel, Regla } from './tipo.ts';
import { Mundo } from './mundo.ts';
import { ColaEventos } from './eventos.ts';
import { Misiones } from './misiones.ts';
import { evaluarCondicion, type ContextoCondicion } from './condiciones.ts';
import { aplicarAccionLocal, resolverAccion } from './acciones.ts';

export interface Efectos {
  /** El juego hace lo que toca pantalla, sonido o video. */
  aplicar(accion: AccionResuelta): void;
  /** Aviso de fin de nivel (para cortar la música, mostrar el cartel, etc.). */
  termino?(motivo: 'accion' | 'misiones'): void;
}

export interface ResultadoPaso {
  /** Todo lo que se ejecutó en el paso (locales y externas), para depurar y testear. */
  acciones: AccionResuelta[];
  /** Misiones cumplidas en este paso. */
  cumplidas: string[];
  /** ¿El nivel terminó en este paso? */
  nivelTerminado: boolean;
}

/** Tope de vueltas del encadenamiento: si algo se muerde la cola, no cuelga el juego. */
const MAX_VUELTAS = 8;

export class Logica {
  readonly mundo: Mundo;
  readonly eventos = new ColaEventos();
  readonly misiones: Misiones;

  private readonly nivel: Nivel;
  private readonly efectos: Efectos;
  private readonly pasos = new Map<string, number>();
  /** Reglas que ya dispararon (rearmables: salen de acá cuando su condición se apaga). */
  private readonly yaDisparadas = new Set<string>();
  private readonly disparadasEnEstePaso = new Set<string>();
  private terminado = false;

  constructor(nivel: Nivel, efectos: Efectos) {
    this.nivel = nivel;
    this.efectos = efectos;
    this.mundo = new Mundo(nivel.mundo ?? {});
    this.misiones = new Misiones(nivel.misiones ?? []);
  }

  // ── Lo que el juego llama cuando pasa algo ────────────────────────────────

  /** Avisa de un evento (el arrastre, la entrada táctil o los gestos llaman acá). */
  emitir(evento: Evento): void {
    if (evento.tipo === 'paso_completado') {
      const secuencia = evento.secuencia ?? '';
      this.pasos.set(secuencia, (this.pasos.get(secuencia) ?? 0) + 1);
    }
    // Un gesto completado se normaliza contra el pedido: así la regla puede preguntar
    // "¿llegó a 3 vueltas?" sin que el juego lleve ninguna cuenta.
    if (evento.tipo === 'gesto_completado' && evento.gesto !== undefined) {
      const pedido = this.eventos.gestoPedido(evento.gesto, evento.destino);
      if (pedido !== null) {
        const avance = this.eventos.completarGesto(evento.gesto, pedido.objetivo);
        if (avance !== null) {
          evento.destino = pedido.objetivo;
          evento.veces = avance.hechas;
        }
      }
    }
    this.eventos.empujar(evento);
  }

  /** Cuántos pasos de cada secuencia se completaron (para `{ paso: "...", hechos }`). */
  pasosCompletados(secuencia: string): number {
    return this.pasos.get(secuencia) ?? 0;
  }

  terminadoNivel(): boolean {
    return this.terminado;
  }

  estado(): { mundo: ReturnType<Mundo['instantanea']>; misiones: Record<string, string>; terminado: boolean } {
    return { mundo: this.mundo.instantanea(), misiones: this.misiones.instantanea(), terminado: this.terminado };
  }

  // ── El paso ───────────────────────────────────────────────────────────────

  paso(eventosDelPaso: Evento[] = []): ResultadoPaso {
    if (this.terminado) return { acciones: [], cumplidas: [], nivelTerminado: true };
    for (const evento of eventosDelPaso) this.emitir(evento);

    const acciones: AccionResuelta[] = [];
    const cumplidas: string[] = [];
    this.disparadasEnEstePaso.clear();

    // 2 y 3: las reglas, encadenando hasta que el mundo se estabiliza.
    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      let cambioEnVuelta = false;
      for (const regla of this.reglasOrdenadas()) {
        if (this.terminado) break;
        if (this.evaluarRegla(regla, acciones, cumplidas)) cambioEnVuelta = true;
      }
      if (!cambioEnVuelta) break;
    }

    // Un cambio de variable hecho a mano en el mundo (fuera de una regla) igual avisa.
    this.avisarVariables();

    if (!this.terminado) {
      // 4: las misiones, encadenando pasadas (una misión habilita la siguiente).
      for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
        const nuevas = this.misiones.actualizar((mision) => this.cumple(mision.cumple, this.sustituidor(null)));
        for (const mision of nuevas) {
          cumplidas.push(mision.id);
          this.eventos.empujar({ tipo: 'mision_cumplida', mision: mision.id });
          this.aplicarRecompensa(mision, acciones, cumplidas);
        }
        if (nuevas.length === 0) break;
      }

      // 5: ¿terminó el nivel?
      if (this.finDeNivel()) this.terminar('misiones');
    }

    // 6: los eventos viven un paso.
    const nivelTerminado = this.terminado;
    this.eventos.limpiarPaso();
    this.rearmarReglas();
    return { acciones, cumplidas, nivelTerminado };
  }

  // ── Ayudas internas ───────────────────────────────────────────────────────

  /**
   * Evalúa una regla y, si le toca, ejecuta sus acciones. Devuelve true cuando algo
   * del mundo cambió (lo que hace que valga la pena dar otra vuelta de encadenado).
   */
  private evaluarRegla(regla: Regla, acciones: AccionResuelta[], cumplidas: string[]): boolean {
    const unaVez = regla.una_vez !== false;
    if (!unaVez && this.disparadasEnEstePaso.has(regla.id)) return false;

    const eventoQueGatilla = this.eventoDeCondicion(regla.si);
    const sustituir = this.sustituidor(eventoQueGatilla);
    const seCumple = this.cumple(regla.si, sustituir);

    if (!seCumple) {
      // La condición se apagó: la regla se rearma para cuando vuelva a encenderse.
      if (unaVez && !this.disparadasEnEstePaso.has(regla.id)) this.yaDisparadas.delete(regla.id);
      return false;
    }
    if (unaVez && this.yaDisparadas.has(regla.id)) return false;

    this.disparadasEnEstePaso.add(regla.id);
    if (unaVez) this.yaDisparadas.add(regla.id);

    let cambio = false;
    for (const accion of regla.hacer) {
      const resuelta = resolverAccion(accion, sustituir);
      acciones.push(resuelta);
      const local = aplicarAccionLocal(resuelta, this.mundo, this.eventos, this.misiones);
      if (!local.resuelta) {
        this.efectos.aplicar(resuelta);
        continue;
      }
      cambio = true;
      this.avisarVariables();
      if (local.aviso === 'nivel_terminado') this.terminar('accion');
      if (local.misionCumplida !== undefined) this.cumplirPorAccion(local.misionCumplida, acciones, cumplidas);
    }
    return cambio;
  }

  /** Publica los cambios de variable del mundo como eventos del paso. */
  private avisarVariables(): void {
    for (const cambio of this.mundo.tomarCambios()) {
      this.eventos.empujar({ tipo: 'variable_cambiada', variable: cambio.nombre, valor: cambio.valor });
    }
  }

  /** Una acción pidió completar una misión: se avisa y se paga la recompensa. */
  private cumplirPorAccion(id: string, acciones: AccionResuelta[], cumplidas: string[]): void {
    const mision = this.misiones.definicion(id);
    if (mision === null) return;
    cumplidas.push(id);
    this.eventos.empujar({ tipo: 'mision_cumplida', mision: id });
    this.aplicarRecompensa(mision, acciones, cumplidas);
  }

  /** Lo que se hace al cumplirse una misión (normalmente la recompensa). */
  private aplicarRecompensa(mision: Mision, acciones: AccionResuelta[], cumplidas: string[]): void {
    for (const accion of mision.recompensa ?? []) {
      const resuelta = resolverAccion(accion, this.sustituidor(null));
      acciones.push(resuelta);
      const local = aplicarAccionLocal(resuelta, this.mundo, this.eventos, this.misiones);
      if (!local.resuelta) {
        this.efectos.aplicar(resuelta);
        continue;
      }
      if (local.aviso === 'nivel_terminado') this.terminar('accion');
      if (local.misionCumplida !== undefined) this.cumplirPorAccion(local.misionCumplida, acciones, cumplidas);
    }
  }

  private reglasOrdenadas(): Regla[] {
    return [...this.nivel.reglas].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  }

  /**
   * Rearma las reglas que ya dispararon cuando su condición dejó de cumplirse. Se
   * mira con los eventos del paso YA tirados: por eso una regla que reacciona a
   * "se soltó algo sobre el auto" vuelve a estar lista en el paso siguiente (y sirve
   * para las tres maletas), mientras que una que mira un interruptor queda apagada
   * todo el tiempo que el interruptor siga prendido.
   */
  private rearmarReglas(): void {
    if (this.yaDisparadas.size === 0) return;
    for (const regla of this.nivel.reglas) {
      if (!this.yaDisparadas.has(regla.id)) continue;
      if (!this.cumple(regla.si, this.sustituidor(null))) this.yaDisparadas.delete(regla.id);
    }
  }

  private cumple(condicion: Condicion | undefined, sustituir: (t: string) => string): boolean {
    const ctx: ContextoCondicion = {
      mundo: this.mundo,
      eventos: this.eventos,
      misiones: this.misiones,
      pasos: this.pasos,
      sustituir,
    };
    return evaluarCondicion(condicion, ctx);
  }

  /**
   * El evento que gatilla una condición: es el que provee los comodines
   * ($entidad, $destino, $zona, $gesto). Busca en profundidad dentro de y/o/no.
   */
  private eventoDeCondicion(condicion: Condicion | undefined): Evento | null {
    if (condicion === undefined) return null;
    const c = condicion as Record<string, unknown>;
    if (typeof c['evento'] === 'string') {
      const filtro: Record<string, string> = {};
      for (const campo of ['entidad', 'destino', 'zona', 'objeto', 'gesto', 'variable', 'mision']) {
        const valor = c[campo];
        if (typeof valor === 'string') filtro[campo] = valor;
      }
      return this.eventos.buscar(c['evento'] as Evento['tipo'], filtro);
    }
    for (const clave of ['y', 'o']) {
      const lista = c[clave];
      if (Array.isArray(lista)) {
        for (const hija of lista as Condicion[]) {
          const encontrado = this.eventoDeCondicion(hija);
          if (encontrado) return encontrado;
        }
      }
    }
    if (c['no'] !== undefined) return this.eventoDeCondicion(c['no'] as Condicion);
    return null;
  }

  /**
   * Comodines: `$campo` en una acción se cambia por el dato real. Se busca primero en
   * el evento que gatilló la regla ($entidad, $destino, $zona, $gesto) y si no está
   * ahí, en las variables del mundo ($premio-del-dia). Así el editor puede usar
   * variables en cualquier acción sin que el juego sepa nada.
   */
  private sustituidor(evento: Evento | null): (texto: string) => string {
    return (texto: string): string => {
      if (!texto.startsWith('$')) return texto;
      const campo = texto.slice(1);
      const delEvento = evento === null ? undefined : (evento as unknown as Record<string, unknown>)[campo];
      if (delEvento !== undefined) return String(delEvento);
      const delMundo = this.mundo.variable(campo);
      return delMundo === undefined ? texto : String(delMundo);
    };
  }

  /**
   * ¿Se terminó el nivel? Si los datos traen `nivel_terminado`, manda esa condición
   * (así "no se puede llegar y terminar"); si no, termina cuando no queda ninguna
   * misión pendiente. Un nivel sin misiones no se termina solo.
   */
  private finDeNivel(): boolean {
    if (this.nivel.nivel_terminado !== undefined) {
      return this.cumple(this.nivel.nivel_terminado, this.sustituidor(null));
    }
    if ((this.nivel.misiones ?? []).length === 0) return false;
    return this.misiones.pendientes().length === 0;
  }

  private terminar(motivo: 'accion' | 'misiones'): void {
    if (this.terminado) return;
    this.terminado = true;
    this.eventos.empujar({ tipo: 'nivel_terminado' });
    this.efectos.termino?.(motivo);
  }
}

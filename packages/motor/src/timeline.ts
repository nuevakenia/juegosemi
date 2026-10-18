/**
 * El timeline declarativo: el "lenguaje humano" para orquestar escenas.
 *
 * La idea es que una situación se escriba como DATOS (YAML/JSON) y no como
 * código, para que un agente la pueda crear y editar sin editor gráfico:
 *
 *   pasos:
 *     - en: 2s
 *       hacer: decir(caco, "voy al mecanico")
 *     - desde: 3s
 *       hasta: 6s
 *       esperar: 1s
 *       hacer: bailar(caco)
 *     - cuando: [tocado(caco), activado(boton)]
 *       hacer: reproducir(video: en-el-cerro)
 *     - siempre_que: activado(boton-baile)
 *       hacer: bailar(caco)
 *
 * Reglas de la casa:
 *  - `en`: dispara UNA vez cuando el tiempo llega.
 *  - `desde`/`hasta`: ventana de tiempo. Sin `esperar` dispara al entrar; con
 *    `esperar` repite cada tanto mientras dure la ventana; `terminar` corre al
 *    salir de la ventana.
 *  - `cuando`: lista de condiciones, TODAS tienen que estar puestas (AND);
 *    dispara UNA vez.
 *  - `siempre_que`: dispara en cada FLANCO (cuando pasa de no cumplirse a
 *    cumplirse). Con `esperar`, repite mientras se cumpla.
 *
 * Y lo importante para la pausa: cada regla lleva su "ack". Pausar y reanudar
 * NO vuelve a disparar lo ya disparado.
 */

export type Duracion = number | string;

export interface Regla {
  en?: Duracion;
  desde?: Duracion;
  hasta?: Duracion;
  cuando?: string | string[];
  siempre_que?: string | string[];
  hacer?: string | string[];
  esperar?: Duracion;
  terminar?: string | string[];
}

export interface ContextoEjecucion {
  /** Índice de la regla dentro del timeline. */
  regla: number;
  /** Momento (en segundos) en que se ejecutó la acción. */
  tiempo: number;
  /** True cuando la acción viene del cierre de una ventana (`terminar`). */
  alCerrar: boolean;
}

export type AlEjecutar = (accion: string, contexto: ContextoEjecucion) => void;

/** Convierte "3s", "500ms" o 3 a segundos. */
export function aSegundos(valor: Duracion | undefined, porDefecto: number | null = null): number | null {
  if (valor === undefined || valor === null) return porDefecto;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : porDefecto;
  const texto = valor.trim().toLowerCase();
  const ms = texto.match(/^(-?\d+(?:\.\d+)?)\s*ms$/);
  if (ms) return Number(ms[1]) / 1000;
  const s = texto.match(/^(-?\d+(?:\.\d+)?)\s*s?$/);
  if (s) return Number(s[1]);
  return porDefecto;
}

function lista(valor: string | string[] | undefined): string[] {
  if (valor === undefined || valor === null) return [];
  return Array.isArray(valor) ? valor : [valor];
}

interface EstadoRegla {
  /** Ya disparó (para `en` y `cuando`). */
  disparada: boolean;
  /** Última vez que disparó (para `esperar`). */
  ultimaVez: number;
  /** Estaba dentro de su ventana en la vuelta anterior. */
  enVentana: boolean;
  /** Se estaba cumpliendo el `siempre_que` en la vuelta anterior. */
  cumpliaAntes: boolean;
}

export class Timeline {
  private readonly reglas: Regla[];
  private readonly alEjecutar: AlEjecutar;
  private readonly condiciones = new Set<string>();
  private readonly estados: EstadoRegla[];
  private readonly registro: Array<{ accion: string; contexto: ContextoEjecucion }> = [];
  private pausado = false;
  private tiempoActual = 0;
  private vueltas = 0;

  constructor(reglas: readonly Regla[], alEjecutar: AlEjecutar) {
    this.reglas = [...reglas];
    this.alEjecutar = alEjecutar;
    this.estados = this.reglas.map(() => ({ disparada: false, ultimaVez: -Infinity, enVentana: false, cumpliaAntes: false }));
  }

  /** Marca o desmarca una condición con nombre (la dispara el juego). */
  marcar(condicion: string, valor = true): void {
    if (valor) this.condiciones.add(condicion);
    else this.condiciones.delete(condicion);
  }

  /** ¿Está puesta esta condición? */
  tiene(condicion: string): boolean {
    return this.condiciones.has(condicion);
  }

  /** ¿Se cumplen TODAS las condiciones de la lista? */
  private seCumplen(condiciones: string[]): boolean {
    for (const c of condiciones) if (!this.condiciones.has(c)) return false;
    return true;
  }

  pausar(): void {
    this.pausado = true;
  }

  reanudar(): void {
    this.pausado = false;
  }

  estaPausado(): boolean {
    return this.pausado;
  }

  /** Segundos transcurridos desde el arranque (no cuenta el tiempo pausado). */
  tiempo(): number {
    return this.tiempoActual;
  }

  vueltasProcesadas(): number {
    return this.vueltas;
  }

  /** Historial de acciones ejecutadas (para depurar y para los tests). */
  historial(): ReadonlyArray<{ accion: string; contexto: ContextoEjecucion }> {
    return this.registro;
  }

  private ejecutar(acciones: string[], indice: number, alCerrar: boolean): void {
    for (const accion of acciones) {
      const contexto: ContextoEjecucion = { regla: indice, tiempo: this.tiempoActual, alCerrar };
      this.registro.push({ accion, contexto });
      this.alEjecutar(accion, contexto);
    }
  }

  /**
   * Avanza el timeline. `deltaSegundos` es el paso de simulación (típicamente
   * 1/60). Se llama una vez por paso del ticker.
   */
  actualizar(deltaSegundos: number): void {
    if (this.pausado) return;
    this.tiempoActual += Math.max(0, deltaSegundos);
    this.vueltas++;
    const t = this.tiempoActual;

    this.reglas.forEach((regla, i) => {
      const estado = this.estados[i]!;
      const hacer = lista(regla.hacer);

      // ── `en`: una sola vez, al llegar ─────────────────────────────────────
      const en = aSegundos(regla.en);
      if (en !== null && !estado.disparada && t >= en) {
        estado.disparada = true;
        estado.ultimaVez = t;
        this.ejecutar(hacer, i, false);
      }

      // ── `cuando`: todas las condiciones puestas, una sola vez ─────────────
      const cuando = lista(regla.cuando);
      if (cuando.length > 0 && !estado.disparada && this.seCumplen(cuando)) {
        estado.disparada = true;
        estado.ultimaVez = t;
        this.ejecutar(hacer, i, false);
      }

      // ── `desde`/`hasta`: ventana de tiempo ────────────────────────────────
      const desde = aSegundos(regla.desde);
      const hasta = aSegundos(regla.hasta, desde === null ? null : Number.POSITIVE_INFINITY);
      if (desde !== null) {
        // Tolerancia de flotantes: los pasos de 1/60 no caen exactos en los
        // bordes (3.0000000000000004 es "3" para cualquiera que mire esto).
        const epsilon = 1e-9;
        const dentro = t >= desde - epsilon && (hasta === null || t <= hasta + epsilon);
        const esperar = aSegundos(regla.esperar);
        if (dentro) {
          const toca = esperar === null ? !estado.enVentana : t - estado.ultimaVez >= esperar;
          if (toca) {
            estado.ultimaVez = t;
            this.ejecutar(hacer, i, false);
          }
        } else if (estado.enVentana) {
          // se cerró la ventana: corre `terminar`
          this.ejecutar(lista(regla.terminar), i, true);
        }
        estado.enVentana = dentro;
      }

      // ── `siempre_que`: en cada flanco (con `esperar`, también mientras dure) ─
      const siempre = lista(regla.siempre_que);
      if (siempre.length > 0) {
        const seCumple = this.seCumplen(siempre);
        const esperar = aSegundos(regla.esperar);
        const flanco = seCumple && !estado.cumpliaAntes;
        const repetir = seCumple && esperar !== null && t - estado.ultimaVez >= esperar;
        if (flanco || repetir) {
          estado.ultimaVez = t;
          this.ejecutar(hacer, i, false);
        }
        estado.cumpliaAntes = seCumple;
      }
    });
  }
}

/**
 * Parte una acción del DSL en nombre y argumentos:
 *   `decir(caco, "hola")`  → { nombre: 'decir', args: ['caco', '"hola"'] }
 *   `esperar(1s)`          → { nombre: 'esperar', args: ['1s'] }
 *   `bailar`               → { nombre: 'bailar', args: [] }
 */
export function parsearAccion(accion: string): { nombre: string; args: string[] } {
  const texto = accion.trim();
  const abre = texto.indexOf('(');
  if (abre === -1 || !texto.endsWith(')')) {
    return { nombre: texto, args: [] };
  }
  const nombre = texto.slice(0, abre).trim();
  const cuerpo = texto.slice(abre + 1, -1).trim();
  if (cuerpo.length === 0) return { nombre, args: [] };
  // separa por comas respetando lo que está entre comillas
  const args: string[] = [];
  let actual = '';
  let comilla: string | null = null;
  for (const ch of cuerpo) {
    if (comilla) {
      if (ch === comilla) comilla = null;
      else actual += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      comilla = ch;
      continue;
    }
    if (ch === ',') {
      args.push(actual.trim());
      actual = '';
      continue;
    }
    actual += ch;
  }
  if (actual.trim().length > 0) args.push(actual.trim());
  return { nombre, args };
}

/**
 * Las misiones: qué hay que lograr, en qué orden, y qué se gana.
 *
 * Cada misión dice con qué condición se cumple y de qué misiones depende. Eso es lo
 * que hace que "no se pueda llegar y terminar": si para llegar hay que haber
 * manejado, y para manejar hay que haber subido las maletas, el orden queda
 * garantizado por los datos y no por código.
 *
 * Estados: pendiente (todavía no se puede) → en_curso (sus requisitos están, pero
 * falta cumplirla) → hecha (cumplida; dispara su recompensa una sola vez).
 */
import type { Accion, Mision, EstadoMision } from './tipo.ts';

export interface EstadoDeMision {
  id: string;
  texto: string;
  estado: EstadoMision;
  requiere: string[];
}

export class Misiones {
  private readonly definidas: Mision[];
  private readonly estados = new Map<string, EstadoMision>();

  constructor(misiones: readonly Mision[] = []) {
    this.definidas = [...misiones];
    for (const mision of this.definidas) this.estados.set(mision.id, 'pendiente');
  }

  definicion(id: string): Mision | null {
    return this.definidas.find((m) => m.id === id) ?? null;
  }

  estadoDe(id: string): EstadoMision | null {
    return this.estados.get(id) ?? null;
  }

  /** Las que todavía no se cumplieron. */
  pendientes(): EstadoDeMision[] {
    return this.listado().filter((m) => m.estado !== 'hecha');
  }

  listado(): EstadoDeMision[] {
    return this.definidas.map((m) => ({
      id: m.id,
      texto: m.texto ?? m.id,
      estado: this.estados.get(m.id) ?? 'pendiente',
      requiere: m.requiere ?? [],
    }));
  }

  /** ¿Están cumplidos los requisitos de esta misión? (`estados` deja mirar una foto). */
  requisitosCumplidos(mision: Mision, estados: ReadonlyMap<string, EstadoMision> = this.estados): boolean {
    for (const requiere of mision.requiere ?? []) {
      if (estados.get(requiere) !== 'hecha') return false;
    }
    return true;
  }

  /**
   * ¿Se puede trabajar en esta misión? Es "tiene los requisitos puestos", que es
   * distinto de "está hecha": una misión sin requisitos está disponible desde el
   * arranque aunque todavía no se haya cumplido.
   */
  disponible(id: string): boolean {
    const mision = this.definicion(id);
    if (mision === null) return false;
    return this.requisitosCumplidos(mision);
  }

  /**
   * Marca una misión como hecha porque una acción lo pidió (`completar(...)`).
   * Devuelve la misión si de verdad se completó; null si no existe, si ya estaba
   * hecha o si le faltan requisitos (el orden manda también acá: si `llegar`
   * requiere `manejar`, ninguna acción puede saltarse el paso).
   */
  completar(id: string): Mision | null {
    const mision = this.definicion(id);
    if (mision === null) return null;
    if (this.estados.get(id) === 'hecha') return null;
    if (!this.requisitosCumplidos(mision)) return null;
    this.estados.set(id, 'hecha');
    return mision;
  }

  /**
   * Revisa todas las misiones contra el mundo y actualiza los estados. Devuelve las
   * que se cumplieron EN ESTA PASADA (para disparar sus recompensas y emitir el
   * evento `mision_cumplida`).
   *
   * La pasada es ATÓMICA: los requisitos se miran contra los estados de cómo
   * estaban al empezarla. Lo que se cumple acá recién cuenta para la pasada
   * siguiente; el encadenamiento (una misión habilita la siguiente) lo hace quien
   * llama, pasada tras pasada. Así una sola pasada es predecible y se puede
   * probar sola.
   */
  actualizar(cumple: (mision: Mision) => boolean): Mision[] {
    const cumplidasAhora: Mision[] = [];
    const antes = new Map(this.estados);
    for (const mision of this.definidas) {
      const estado = antes.get(mision.id) ?? 'pendiente';
      if (estado === 'hecha') continue;
      if (!this.requisitosCumplidos(mision, antes)) {
        this.estados.set(mision.id, 'pendiente');
        continue;
      }
      // Requisitos listos: está en curso, y si la condición se cumple, se completa.
      if (cumple(mision)) {
        this.estados.set(mision.id, 'hecha');
        cumplidasAhora.push(mision);
      } else {
        this.estados.set(mision.id, 'en_curso');
      }
    }
    return cumplidasAhora;
  }

  /** La recompensa que hay que aplicar al cumplirse (vacía si no tiene). */
  recompensaDe(id: string): Accion[] {
    return this.definicion(id)?.recompensa ?? [];
  }

  instantanea(): Record<string, EstadoMision> {
    return Object.fromEntries(this.estados);
  }

  cargar(datos: Record<string, EstadoMision>): void {
    for (const mision of this.definidas) {
      const guardado = datos[mision.id];
      this.estados.set(mision.id, guardado ?? 'pendiente');
    }
  }
}

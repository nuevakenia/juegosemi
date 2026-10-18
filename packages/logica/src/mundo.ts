/**
 * El mundo: lo que el juego RECUERDA.
 *
 * Son tres cosas, y nada más: variables con valor (número, sí/no o texto),
 * contadores (cuántas veces pasó algo) y objetos como interruptores
 * (la puerta abierta, el interruptor 80 prendido).
 *
 * Todo es dato y se puede guardar y volver a cargar tal cual (la partida de Emiliano
 * tiene que sobrevivir a cerrar la app).
 */
import type { MundoDatos, Valor } from './tipo.ts';

export class Mundo {
  private readonly variables = new Map<string, Valor>();
  private readonly contadores = new Map<string, number>();
  private readonly objetos = new Map<string, boolean>();
  private readonly cambios: Array<{ nombre: string; valor: Valor }> = [];

  constructor(inicial: MundoDatos = {}) {
    for (const [nombre, valor] of Object.entries(inicial.variables ?? {})) {
      this.variables.set(nombre, valor);
    }
    for (const [nombre, valor] of Object.entries(inicial.contadores ?? {})) {
      this.contadores.set(nombre, valor);
    }
    for (const [nombre, valor] of Object.entries(inicial.objetos ?? {})) {
      this.objetos.set(nombre, valor);
    }
  }

  // ── Variables ──────────────────────────────────────────────────────────────

  variable(nombre: string): Valor | undefined {
    return this.variables.get(nombre);
  }

  marcar(nombre: string, valor: Valor): void {
    if (this.variables.get(nombre) === valor) return;
    this.variables.set(nombre, valor);
    this.cambios.push({ nombre, valor });
  }

  /** Cambios de variables desde el último `tomarCambios()`. */
  tomarCambios(): Array<{ nombre: string; valor: Valor }> {
    const copia = [...this.cambios];
    this.cambios.length = 0;
    return copia;
  }

  // ── Contadores ─────────────────────────────────────────────────────────────

  contador(nombre: string): number {
    return this.contadores.get(nombre) ?? 0;
  }

  sumar(nombre: string, cuanto = 1): number {
    const nuevo = this.contador(nombre) + cuanto;
    this.contadores.set(nombre, nuevo);
    return nuevo;
  }

  ponerContador(nombre: string, valor: number): void {
    this.contadores.set(nombre, valor);
  }

  // ── Interruptores ──────────────────────────────────────────────────────────

  activo(objeto: string): boolean {
    return this.objetos.get(objeto) === true;
  }

  activar(objeto: string): boolean {
    const antes = this.activo(objeto);
    this.objetos.set(objeto, true);
    return !antes; // true si de verdad cambió (para no repetir el evento)
  }

  desactivar(objeto: string): boolean {
    const antes = this.activo(objeto);
    this.objetos.set(objeto, false);
    return antes;
  }

  // ── Guardar y cargar ───────────────────────────────────────────────────────

  instantanea(): MundoDatos {
    return {
      variables: Object.fromEntries(this.variables),
      contadores: Object.fromEntries(this.contadores),
      objetos: Object.fromEntries(this.objetos),
    };
  }

  cargar(datos: MundoDatos): void {
    this.variables.clear();
    this.contadores.clear();
    this.objetos.clear();
    for (const [nombre, valor] of Object.entries(datos.variables ?? {})) this.variables.set(nombre, valor);
    for (const [nombre, valor] of Object.entries(datos.contadores ?? {})) this.contadores.set(nombre, valor);
    for (const [nombre, valor] of Object.entries(datos.objetos ?? {})) this.objetos.set(nombre, valor);
    this.cambios.length = 0;
  }
}

/**
 * La cola de eventos del paso: lo que ACABA de pasar.
 *
 * Regla importante y a propósito: los eventos viven UN paso. Una regla que reacciona
 * a `entidad_soltada` lo hace en el mismo paso en que el niño soltó la pieza, y al
 * paso siguiente ya no. Eso evita el bug caro de "reaccionó a algo de hace tres
 * segundos" y es lo que permite tener una sola regla que sirva para las tres maletas.
 *
 * Los contadores de toques son la excepción: se acumulan dentro del paso para poder
 * preguntar "¿tocó 5 veces?" (los gestos y el machaque de botón).
 */
import type { Evento, TipoEvento } from './tipo.ts';

export class ColaEventos {
  private readonly eventos: Evento[] = [];
  private readonly gestosPedidos = new Map<string, { objetivo: string; veces: number; hechas: number }>();

  empujar(evento: Evento): void {
    this.eventos.push(evento);
  }

  /** Todos los eventos del paso (para depurar y para los tests). */
  todos(): readonly Evento[] {
    return this.eventos;
  }

  /** ¿Pasó algún evento de este tipo en el paso? */
  hay(tipo: TipoEvento): boolean {
    return this.eventos.some((e) => e.tipo === tipo);
  }

  /**
   * Busca el primer evento que calce. `filtro` deja exigir campos (destino, zona,
   * gesto...). Se usa desde la evaluación de condiciones.
   */
  buscar(tipo: TipoEvento, filtro: Partial<Evento> = {}): Evento | null {
    for (const evento of this.eventos) {
      if (evento.tipo !== tipo) continue;
      let calza = true;
      for (const [campo, valor] of Object.entries(filtro)) {
        if (valor === undefined) continue;
        if ((evento as unknown as Record<string, unknown>)[campo] !== valor) {
          calza = false;
          break;
        }
      }
      if (calza) return evento;
    }
    return null;
  }

  // ── Gestos pedidos (los QTE) ───────────────────────────────────────────────
  //
  // Cuando el juego pide un gesto ("girar la manivela 3 veces"), queda anotado acá.
  // Cada vez que llega un `gesto_completado` de ese gesto y ese objetivo, suma.
  // Así el machaque repetido funciona sin que el juego lleve la cuenta.

  pedirGesto(gesto: string, objetivo: string, veces = 1): void {
    this.gestosPedidos.set(`${gesto}|${objetivo}`, { objetivo, veces, hechas: 0 });
  }

  cancelarGesto(gesto: string, objetivo: string): void {
    this.gestosPedidos.delete(`${gesto}|${objetivo}`);
  }

  /** ¿Está pedido este gesto (y sin completar todavía)? */
  gestoPedido(gesto: string, objetivo?: string): { objetivo: string; veces: number; hechas: number } | null {
    if (objetivo !== undefined) return this.gestosPedidos.get(`${gesto}|${objetivo}`) ?? null;
    for (const [clave, pedido] of this.gestosPedidos) {
      if (clave.startsWith(`${gesto}|`)) return pedido;
    }
    return null;
  }

  completarGesto(gesto: string, objetivo: string): { veces: number; hechas: number; completo: boolean } | null {
    const clave = `${gesto}|${objetivo}`;
    const pedido = this.gestosPedidos.get(clave);
    if (!pedido) return null;
    pedido.hechas++;
    const completo = pedido.hechas >= pedido.veces;
    if (completo) this.gestosPedidos.delete(clave);
    return { veces: pedido.veces, hechas: pedido.hechas, completo };
  }

  gestosPendientes(): Array<{ gesto: string; objetivo: string; veces: number; hechas: number }> {
    return [...this.gestosPedidos.entries()].map(([clave, v]) => ({
      gesto: clave.split('|')[0] ?? '',
      objetivo: v.objetivo,
      veces: v.veces,
      hechas: v.hechas,
    }));
  }

  /** Se llama al terminar el paso: los eventos no sobreviven. */
  limpiarPaso(): void {
    this.eventos.length = 0;
  }
}

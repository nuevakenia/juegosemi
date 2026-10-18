import { describe, expect, it } from 'vitest';
import { ColaEventos } from './eventos.ts';

describe('ColaEventos: lo que acaba de pasar', () => {
  it('guarda los eventos del paso y los deja consultar', () => {
    const cola = new ColaEventos();
    cola.empujar({ tipo: 'entidad_soltada', entidad: 'maleta-1', destino: 'auto' });
    expect(cola.todos()).toHaveLength(1);
    expect(cola.hay('entidad_soltada')).toBe(true);
    expect(cola.hay('zona_entrada')).toBe(false);
  });

  it('buscar filtra por campos (destino, zona...)', () => {
    const cola = new ColaEventos();
    cola.empujar({ tipo: 'entidad_soltada', entidad: 'maleta-1', destino: 'auto' });
    expect(cola.buscar('entidad_soltada', { destino: 'auto' })).not.toBeNull();
    expect(cola.buscar('entidad_soltada', { destino: 'basurero' })).toBeNull();
  });

  it('sin filtro devuelve el primero del tipo', () => {
    const cola = new ColaEventos();
    cola.empujar({ tipo: 'entidad_tocada', entidad: 'a' });
    cola.empujar({ tipo: 'entidad_tocada', entidad: 'b' });
    expect(cola.buscar('entidad_tocada')?.entidad).toBe('a');
  });

  it('limpiarPaso tira los eventos (no sobreviven al paso) pero NO los gestos pedidos', () => {
    const cola = new ColaEventos();
    cola.pedirGesto('circulo', 'manivela', 3);
    cola.empujar({ tipo: 'entidad_tocada', entidad: 'boca' });
    cola.limpiarPaso();
    expect(cola.todos()).toHaveLength(0);
    expect(cola.gestoPedido('circulo', 'manivela')).not.toBeNull();
  });

  it('un gesto pedido lleva la cuenta y se completa a las N veces', () => {
    const cola = new ColaEventos();
    cola.pedirGesto('circulo', 'manivela', 3);
    expect(cola.completarGesto('circulo', 'manivela')).toEqual({ veces: 3, hechas: 1, completo: false });
    expect(cola.completarGesto('circulo', 'manivela')).toEqual({ veces: 3, hechas: 2, completo: false });
    expect(cola.completarGesto('circulo', 'manivela')).toEqual({ veces: 3, hechas: 3, completo: true });
    expect(cola.gestoPedido('circulo', 'manivela')).toBeNull();
  });

  it('completar un gesto que nadie pidió no hace nada (no inventa progreso)', () => {
    const cola = new ColaEventos();
    expect(cola.completarGesto('circulo', 'manivela')).toBeNull();
  });

  it('se puede preguntar por un gesto sin decir el objetivo', () => {
    const cola = new ColaEventos();
    cola.pedirGesto('mantener', 'globo', 2);
    expect(cola.gestoPedido('mantener')?.objetivo).toBe('globo');
    expect(cola.gestoPedido('circulo')).toBeNull();
  });

  it('cancelar un gesto lo saca de la lista', () => {
    const cola = new ColaEventos();
    cola.pedirGesto('circulo', 'manivela', 3);
    cola.cancelarGesto('circulo', 'manivela');
    expect(cola.gestoPedido('circulo', 'manivela')).toBeNull();
  });

  it('lista los gestos pendientes con su avance (para dibujar la barra)', () => {
    const cola = new ColaEventos();
    cola.pedirGesto('circulo', 'manivela', 3);
    cola.completarGesto('circulo', 'manivela');
    expect(cola.gestosPendientes()).toEqual([{ gesto: 'circulo', objetivo: 'manivela', veces: 3, hechas: 1 }]);
  });
});

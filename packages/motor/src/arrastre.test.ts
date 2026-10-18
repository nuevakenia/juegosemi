import { describe, it, expect } from 'vitest';
import { Escena } from './escena.ts';
import { Arrastre } from './arrastre.ts';

function escenaDePrueba() {
  const escena = new Escena();
  const persona = escena.agregar({ id: 'caco', x: 100, y: 100, ancho: 80, alto: 80, datos: { tipo: 'persona' } });
  const auto = escena.agregar({ id: 'auto-caco', x: 400, y: 100, ancho: 160, alto: 120, datos: { tipo: 'auto' } });
  return { escena, persona, auto };
}

describe('Escena', () => {
  it('agrega, obtiene y quita entidades', () => {
    const { escena } = escenaDePrueba();
    expect(escena.cantidad()).toBe(2);
    expect(escena.obtener('caco')?.x).toBe(100);
    expect(escena.quitar('caco')).toBe(true);
    expect(escena.obtener('caco')).toBeNull();
  });

  it('encuentra la entidad que está bajo un punto', () => {
    const { escena } = escenaDePrueba();
    expect(escena.en(100, 100)?.id).toBe('caco');
    expect(escena.en(400, 100)?.id).toBe('auto-caco');
    expect(escena.en(250, 250)).toBeNull();
  });

  it('devuelve la de más adelante cuando se superponen', () => {
    const escena = new Escena();
    escena.agregar({ id: 'abajo', x: 0, y: 0, ancho: 100, alto: 100, orden: 1 });
    escena.agregar({ id: 'arriba', x: 0, y: 0, ancho: 100, alto: 100, orden: 2 });
    expect(escena.en(0, 0)?.id).toBe('arriba');
  });

  it('ignora las ocultas', () => {
    const escena = new Escena();
    escena.agregar({ id: 'fantasma', x: 0, y: 0, ancho: 100, alto: 100, visible: false });
    expect(escena.en(0, 0)).toBeNull();
  });

  it('respeta la escala al calcular el área tocable', () => {
    const escena = new Escena();
    escena.agregar({ id: 'grande', x: 0, y: 0, ancho: 100, alto: 100, escalaX: 2, escalaY: 2 });
    expect(escena.en(90, 0)?.id).toBe('grande');
  });
});

describe('Arrastre', () => {
  it('toma una entidad y la sigue con el dedo', () => {
    const { escena, persona } = escenaDePrueba();
    const arrastre = new Arrastre(escena);
    arrastre.procesar({ tipo: 'pulsar', x: 100, y: 100, puntero: 1 });
    expect(arrastre.enMano()?.id).toBe('caco');
    arrastre.procesar({ tipo: 'mover', x: 200, y: 150, puntero: 1 });
    expect(persona.x).toBe(200);
    expect(persona.y).toBe(150);
  });

  it('al agarrar, la pieza se agranda un poco y vuelve al soltar', () => {
    const { escena, persona } = escenaDePrueba();
    const arrastre = new Arrastre(escena);
    arrastre.procesar({ tipo: 'pulsar', x: 100, y: 100, puntero: 1 });
    expect(persona.escalaX).toBeGreaterThan(1);
    arrastre.procesar({ tipo: 'soltar', x: 100, y: 100, puntero: 1 });
    expect(persona.escalaX).toBe(1);
  });

  it('informa el destino correcto al soltar encima de otra entidad', () => {
    const { escena } = escenaDePrueba();
    const soltadas: Array<{ id: string; destino: string | null }> = [];
    const arrastre = new Arrastre(escena, {
      alSoltar: (e, destino) => soltadas.push({ id: e.id, destino: destino ? destino.id : null }),
    });
    arrastre.procesar({ tipo: 'pulsar', x: 100, y: 100, puntero: 1 });
    arrastre.procesar({ tipo: 'mover', x: 400, y: 100, puntero: 1 });
    arrastre.procesar({ tipo: 'soltar', x: 400, y: 100, puntero: 1 });
    expect(soltadas).toEqual([{ id: 'caco', destino: 'auto-caco' }]);
  });

  it('soltar en el vacío informa destino null', () => {
    const { escena } = escenaDePrueba();
    const soltadas: Array<string | null> = [];
    const arrastre = new Arrastre(escena, { alSoltar: (_e, destino) => soltadas.push(destino ? destino.id : null) });
    arrastre.procesar({ tipo: 'pulsar', x: 100, y: 100, puntero: 1 });
    arrastre.procesar({ tipo: 'mover', x: 250, y: 250, puntero: 1 });
    arrastre.procesar({ tipo: 'soltar', x: 250, y: 250, puntero: 1 });
    expect(soltadas).toEqual([null]);
  });

  it('respeta el filtro (no se pueden arrastrar los autos)', () => {
    const { escena } = escenaDePrueba();
    const arrastre = new Arrastre(escena, { sePuedeArrastrar: (e) => e.datos['tipo'] === 'persona' });
    arrastre.procesar({ tipo: 'pulsar', x: 400, y: 100, puntero: 1 });
    expect(arrastre.enMano()).toBeNull();
  });

  it('el filtro de destino evita que otra pieza se robe el soltado', () => {
    const { escena } = escenaDePrueba();
    // una persona "desvanecida" encima del auto de la mamá (el caso real medido)
    escena.agregar({ id: 'caco-resuelto', x: 400, y: 100, ancho: 90, alto: 90, orden: 999, datos: { tipo: 'persona' } });
    const destinos: Array<string | null> = [];
    const arrastre = new Arrastre(escena, {
      sePuedeArrastrar: (e) => e.id === 'caco',
      sePuedeSoltar: (e) => e.datos['tipo'] === 'auto',
      alSoltar: (_e, destino) => destinos.push(destino ? destino.id : null),
    });
    arrastre.procesar({ tipo: 'pulsar', x: 100, y: 100, puntero: 1 });
    arrastre.procesar({ tipo: 'mover', x: 400, y: 100, puntero: 1 });
    arrastre.procesar({ tipo: 'soltar', x: 400, y: 100, puntero: 1 });
    expect(destinos).toEqual(['auto-caco']);
  });

  it('cancelar devuelve la pieza a su tamaño', () => {
    const { escena, persona } = escenaDePrueba();
    const arrastre = new Arrastre(escena);
    arrastre.procesar({ tipo: 'pulsar', x: 100, y: 100, puntero: 1 });
    arrastre.cancelar();
    expect(arrastre.enMano()).toBeNull();
    expect(persona.escalaX).toBe(1);
  });
});

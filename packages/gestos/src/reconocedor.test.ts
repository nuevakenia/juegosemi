// Prueba del reconocedor de gestos. SIN navegador: se le pasan eventos y un
// reloj a mano, así que los cuatro gestos se prueban enteros con vitest.
import { describe, expect, it } from 'vitest';
import type { EventoEntrada, TipoEventoEntrada } from '@juegosemi/puertos';
import { Reconocedor, normalizarPedido } from './reconocedor.ts';

function evento(tipo: TipoEventoEntrada, x: number, y: number, puntero = 1): EventoEntrada {
  return { tipo, x, y, puntero };
}

/** Puntos de un dedo girando: `vueltas` (puede ser 1.15 para pasarse un poco). */
function puntosDeCirculo(
  cx: number,
  cy: number,
  radio: number,
  pasos: number,
  vueltas: number,
): Array<{ x: number; y: number }> {
  const puntos: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= pasos; i++) {
    const angulo = (i / pasos) * Math.PI * 2 * vueltas;
    puntos.push({ x: cx + radio * Math.cos(angulo), y: cy + radio * Math.sin(angulo) });
  }
  return puntos;
}

/** Arrastra el dedo por esos puntos, avanzando el reloj. Devuelve el tiempo final. */
function arrastrar(
  reconocedor: Reconocedor,
  puntos: Array<{ x: number; y: number }>,
  desdeMs: number,
  pasoMs: number,
): number {
  let t = desdeMs;
  const primero = puntos[0];
  if (primero === undefined) return t;
  reconocedor.alimentar(evento('pulsar', primero.x, primero.y), t);
  for (let i = 1; i < puntos.length; i++) {
    const p = puntos[i];
    if (p === undefined) continue;
    t += pasoMs;
    reconocedor.alimentar(evento('mover', p.x, p.y), t);
  }
  const ultimo = puntos[puntos.length - 1];
  if (ultimo !== undefined) {
    t += pasoMs;
    reconocedor.alimentar(evento('soltar', ultimo.x, ultimo.y), t);
  }
  return t;
}

describe('Reconocedor: toque_repetido', () => {
  it('avisa una unidad por toque y completa las veces pedidas', () => {
    const reconocedor = new Reconocedor();
    let unidades = 0;
    reconocedor.alCompletarGesto(() => {
      unidades += 1;
    });
    reconocedor.pedir({ gesto: 'toque_repetido', veces: 5, destino: 'boton' });

    let t = 0;
    for (let i = 0; i < 5; i++) {
      reconocedor.alimentar(evento('pulsar', 100, 100), t);
      t += 100;
      reconocedor.alimentar(evento('soltar', 102, 101), t);
      t += 200;
    }

    expect(unidades).toBe(5);
    expect(reconocedor.avance().hechas).toBe(5);
    expect(reconocedor.avance().completado).toBe(true);
  });

  it('llena la barra a medida que se toca', () => {
    const reconocedor = new Reconocedor();
    reconocedor.pedir({ gesto: 'toque_repetido', veces: 4 });
    reconocedor.alimentar(evento('pulsar', 10, 10), 0);
    reconocedor.alimentar(evento('soltar', 10, 10), 60);
    expect(reconocedor.avance().progreso).toBeCloseTo(0.25);
  });

  it('un arrastre no cuenta como toque (y no es una falla: no avisa nada)', () => {
    const reconocedor = new Reconocedor();
    let unidades = 0;
    reconocedor.alCompletarGesto(() => {
      unidades += 1;
    });
    reconocedor.pedir({ gesto: 'toque_repetido', veces: 2 });
    reconocedor.alimentar(evento('pulsar', 0, 0), 0);
    reconocedor.alimentar(evento('mover', 80, 0), 50);
    reconocedor.alimentar(evento('soltar', 80, 0), 100);

    expect(unidades).toBe(0);
    expect(reconocedor.avance().completado).toBe(false);
  });

  it('un toque lento reinicia la racha visible, pero el toque igual avisa', () => {
    const reconocedor = new Reconocedor();
    let unidades = 0;
    reconocedor.alCompletarGesto(() => {
      unidades += 1;
    });
    reconocedor.pedir({ gesto: 'toque_repetido', veces: 4, ventana: 1000 });

    // dos toques seguidos
    reconocedor.alimentar(evento('pulsar', 5, 5), 0);
    reconocedor.alimentar(evento('soltar', 5, 5), 50);
    reconocedor.alimentar(evento('pulsar', 5, 5), 200);
    reconocedor.alimentar(evento('soltar', 5, 5), 250);
    expect(reconocedor.avance().hechas).toBe(2);

    // pasa mucho tiempo y vuelve a tocar: la racha visible arranca de nuevo
    reconocedor.alimentar(evento('pulsar', 5, 5), 5000);
    reconocedor.alimentar(evento('soltar', 5, 5), 5050);
    expect(reconocedor.avance().hechas).toBe(1);
    // ...pero los tres toques se avisaron igual (a nadie se le quitó lo hecho)
    expect(unidades).toBe(3);
  });
});

describe('Reconocedor: mantener', () => {
  it('la barra se llena con el reloj y completa al llegar a los ms', () => {
    const reconocedor = new Reconocedor();
    let completados = 0;
    reconocedor.alCompletarGesto(() => {
      completados += 1;
    });
    reconocedor.pedir({ gesto: 'mantener', milisegundos: 1000, veces: 1, destino: 'globo' });

    reconocedor.alimentar(evento('pulsar', 50, 50), 0);
    reconocedor.latir(500);
    expect(reconocedor.avance().progreso).toBeCloseTo(0.5);
    expect(reconocedor.avance().completado).toBe(false);

    reconocedor.latir(1000);
    expect(completados).toBe(1);
    expect(reconocedor.avance().completado).toBe(true);
    expect(reconocedor.avance().progreso).toBe(1);
  });

  it('si suelta antes, no pasa nada: vuelve a cero y no completa', () => {
    const reconocedor = new Reconocedor();
    let completados = 0;
    reconocedor.alCompletarGesto(() => {
      completados += 1;
    });
    reconocedor.pedir({ gesto: 'mantener', milisegundos: 1000, veces: 1 });
    reconocedor.alimentar(evento('pulsar', 50, 50), 0);
    reconocedor.latir(400);
    reconocedor.alimentar(evento('soltar', 50, 50), 500);

    expect(completados).toBe(0);
    expect(reconocedor.avance().progreso).toBe(0);
    expect(reconocedor.avance().completado).toBe(false);
  });

  it('pide dos mantenciones y hay que apretar dos veces', () => {
    const reconocedor = new Reconocedor();
    let completados = 0;
    reconocedor.alCompletarGesto(() => {
      completados += 1;
    });
    reconocedor.pedir({ gesto: 'mantener', milisegundos: 500, veces: 2 });

    reconocedor.alimentar(evento('pulsar', 50, 50), 0);
    reconocedor.latir(500);
    expect(completados).toBe(1);
    expect(reconocedor.avance().completado).toBe(false);

    // la segunda: hay que volver a apretar
    reconocedor.alimentar(evento('pulsar', 50, 50), 600);
    reconocedor.latir(1100);
    expect(completados).toBe(2);
    expect(reconocedor.avance().completado).toBe(true);
  });
});

describe('Reconocedor: circulo', () => {
  it('una vuelta completa da la unidad', () => {
    const reconocedor = new Reconocedor();
    let vueltas = 0;
    reconocedor.alCompletarGesto(() => {
      vueltas += 1;
    });
    reconocedor.pedir({ gesto: 'circulo', veces: 1, destino: 'manivela' });

    const puntos = puntosDeCirculo(200, 200, 120, 60, 1.15);
    arrastrar(reconocedor, puntos, 0, 16);

    expect(vueltas).toBeGreaterThanOrEqual(1);
    expect(reconocedor.avance().completado).toBe(true);
  });

  it('un arrastre recto no da vuelta', () => {
    const reconocedor = new Reconocedor();
    let vueltas = 0;
    reconocedor.alCompletarGesto(() => {
      vueltas += 1;
    });
    reconocedor.pedir({ gesto: 'circulo', veces: 1 });
    const recto: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= 20; i++) recto.push({ x: i * 20, y: 100 });
    arrastrar(reconocedor, recto, 0, 16);

    expect(vueltas).toBe(0);
    expect(reconocedor.avance().completado).toBe(false);
  });

  it('respeta el sentido pedido: girar al revés no cuenta', () => {
    const reconocedor = new Reconocedor();
    let vueltas = 0;
    reconocedor.alCompletarGesto(() => {
      vueltas += 1;
    });
    // los puntos van en sentido que miramos como "horario": el antihorario no debe contar
    reconocedor.pedir({ gesto: 'circulo', sentido: 'antihorario', veces: 1 });
    const puntos = puntosDeCirculo(200, 200, 120, 60, 1.15);
    arrastrar(reconocedor, puntos, 0, 16);

    expect(vueltas).toBe(0);
    expect(reconocedor.avance().completado).toBe(false);
  });

  it('el sentido correcto sí cuenta', () => {
    const reconocedor = new Reconocedor();
    let vueltas = 0;
    reconocedor.alCompletarGesto(() => {
      vueltas += 1;
    });
    reconocedor.pedir({ gesto: 'circulo', sentido: 'horario', veces: 1 });
    arrastrar(reconocedor, puntosDeCirculo(200, 200, 120, 60, 1.15), 0, 16);

    expect(vueltas).toBeGreaterThanOrEqual(1);
    expect(reconocedor.avance().completado).toBe(true);
  });

  it('tres vueltas piden tres vueltas', () => {
    const reconocedor = new Reconocedor();
    let vueltas = 0;
    reconocedor.alCompletarGesto(() => {
      vueltas += 1;
    });
    reconocedor.pedir({ gesto: 'circulo', veces: 3 });
    arrastrar(reconocedor, puntosDeCirculo(200, 200, 120, 120, 3.2), 0, 16);

    expect(vueltas).toBe(3);
    expect(reconocedor.avance().completado).toBe(true);
  });
});

describe('Reconocedor: direccion', () => {
  it('completa al arrastrar hacia el lado pedido', () => {
    const reconocedor = new Reconocedor();
    let hechas = 0;
    reconocedor.alCompletarGesto(() => {
      hechas += 1;
    });
    reconocedor.pedir({ gesto: 'direccion', direccion: 'derecha', distancia: 60, destino: 'palanca' });

    reconocedor.alimentar(evento('pulsar', 100, 100), 0);
    reconocedor.alimentar(evento('mover', 140, 100), 16);
    expect(reconocedor.avance().completado).toBe(false);
    reconocedor.alimentar(evento('mover', 170, 100), 32);

    expect(hechas).toBe(1);
    expect(reconocedor.avance().completado).toBe(true);
  });

  it('arrastrar para el otro lado no completa', () => {
    const reconocedor = new Reconocedor();
    let hechas = 0;
    reconocedor.alCompletarGesto(() => {
      hechas += 1;
    });
    reconocedor.pedir({ gesto: 'direccion', direccion: 'derecha', distancia: 60 });
    reconocedor.alimentar(evento('pulsar', 200, 100), 0);
    reconocedor.alimentar(evento('mover', 100, 100), 16);

    expect(hechas).toBe(0);
    expect(reconocedor.avance().progreso).toBe(0);
    expect(reconocedor.avance().completado).toBe(false);
  });

  it('reconoce las cuatro direcciones', () => {
    const casos: Array<[TipoEventoEntrada, number, number, 'izquierda' | 'derecha' | 'arriba' | 'abajo']> = [
      ['mover', 180, 100, 'derecha'],
      ['mover', 20, 100, 'izquierda'],
      ['mover', 100, 20, 'arriba'],
      ['mover', 100, 180, 'abajo'],
    ];
    for (const [, x, y, direccion] of casos) {
      const reconocedor = new Reconocedor();
      reconocedor.pedir({ gesto: 'direccion', direccion, distancia: 60 });
      reconocedor.alimentar(evento('pulsar', 100, 100), 0);
      reconocedor.alimentar(evento('mover', x, y), 16);
      expect(reconocedor.avance().completado).toBe(true);
    }
  });
});

describe('Reconocedor: un gesto cortado a medias no pierde el progreso', () => {
  it('el círculo sigue sumando si suelta a mitad de camino', () => {
    const reconocedor = new Reconocedor();
    let vueltas = 0;
    reconocedor.alCompletarGesto(() => {
      vueltas += 1;
    });
    reconocedor.pedir({ gesto: 'circulo', veces: 1 });

    // media vuelta y suelta: todavía no hay unidad, pero quedó a mitad de barra
    arrastrar(reconocedor, puntosDeCirculo(200, 200, 120, 30, 0.5), 0, 16);
    expect(vueltas).toBe(0);
    expect(reconocedor.avance().progreso).toBeGreaterThan(0.2);

    // retoma y da la otra media vuelta: la vuelta se completa entre los dos trazos
    arrastrar(reconocedor, puntosDeCirculo(200, 200, 120, 30, 0.6), 2000, 16);
    expect(vueltas).toBeGreaterThanOrEqual(1);
    expect(reconocedor.avance().completado).toBe(true);
  });

  it('el arrastre hacia un lado sigue sumando si suelta a mitad de camino', () => {
    const reconocedor = new Reconocedor();
    let hechas = 0;
    reconocedor.alCompletarGesto(() => {
      hechas += 1;
    });
    reconocedor.pedir({ gesto: 'direccion', direccion: 'derecha', distancia: 60 });

    // 40 de los 60 px, y suelta
    reconocedor.alimentar(evento('pulsar', 100, 100), 0);
    reconocedor.alimentar(evento('mover', 140, 100), 16);
    reconocedor.alimentar(evento('soltar', 140, 100), 32);
    expect(hechas).toBe(0);
    expect(reconocedor.avance().progreso).toBeCloseTo(40 / 60, 2);

    // retoma desde donde quedó: los 30 px que faltan cierran la unidad
    reconocedor.alimentar(evento('pulsar', 140, 100), 400);
    reconocedor.alimentar(evento('mover', 170, 100), 416);
    expect(hechas).toBe(1);
    expect(reconocedor.avance().completado).toBe(true);
  });

  it('ir y volver sobre lo mismo no infla la cuenta', () => {
    const reconocedor = new Reconocedor();
    let hechas = 0;
    reconocedor.alCompletarGesto(() => {
      hechas += 1;
    });
    reconocedor.pedir({ gesto: 'direccion', direccion: 'derecha', distancia: 60 });

    reconocedor.alimentar(evento('pulsar', 100, 100), 0);
    for (let i = 0; i < 4; i++) {
      reconocedor.alimentar(evento('mover', 130, 100), 16 + i * 16);
      reconocedor.alimentar(evento('mover', 100, 100), 24 + i * 16);
    }

    expect(hechas).toBe(0);
    expect(reconocedor.avance().progreso).toBeCloseTo(30 / 60, 2);
  });
});

describe('Reconocedor: pedido, avance y sin castigo', () => {
  it('sin pedido no reconoce nada', () => {
    const reconocedor = new Reconocedor();
    expect(reconocedor.pedido()).toBeNull();
    reconocedor.alimentar(evento('pulsar', 0, 0), 0);
    reconocedor.alimentar(evento('soltar', 0, 0), 10);
    expect(reconocedor.avance().completado).toBe(false);
  });

  it('al completar el pedido, los eventos de más se ignoran', () => {
    const reconocedor = new Reconocedor();
    let unidades = 0;
    reconocedor.alCompletarGesto(() => {
      unidades += 1;
    });
    reconocedor.pedir({ gesto: 'toque_repetido', veces: 1 });
    reconocedor.alimentar(evento('pulsar', 0, 0), 0);
    reconocedor.alimentar(evento('soltar', 0, 0), 20);
    reconocedor.alimentar(evento('pulsar', 0, 0), 40);
    reconocedor.alimentar(evento('soltar', 0, 0), 60);
    expect(unidades).toBe(1);
  });

  it('reiniciar olvida el pedido y el progreso', () => {
    const reconocedor = new Reconocedor();
    reconocedor.pedir({ gesto: 'toque_repetido', veces: 3 });
    reconocedor.alimentar(evento('pulsar', 0, 0), 0);
    reconocedor.alimentar(evento('soltar', 0, 0), 20);
    expect(reconocedor.avance().hechas).toBe(1);
    reconocedor.reiniciar();
    expect(reconocedor.pedido()).toBeNull();
    expect(reconocedor.avance().hechas).toBe(0);
    expect(reconocedor.avance().progreso).toBe(0);
  });

  it('normaliza los pedidos con sus tolerancias por defecto', () => {
    expect(normalizarPedido({ gesto: 'toque_repetido', veces: 0 }).veces).toBe(1);
    expect(normalizarPedido({ gesto: 'mantener' }).milisegundos).toBe(1500);
    expect(normalizarPedido({ gesto: 'direccion' }).distancia).toBe(60);
    expect(normalizarPedido({ gesto: 'direccion' }).direccion).toBe('derecha');
    expect(normalizarPedido({ gesto: 'toque_repetido' }).ventana).toBe(3000);
  });
});
